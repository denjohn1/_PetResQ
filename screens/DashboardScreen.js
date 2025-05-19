import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  FlatList,
  Animated,
  Dimensions,
  RefreshControl,
  StatusBar,
  Modal,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";
import tw from "twrnc";
import { Feather } from "@expo/vector-icons";
import CustomText from "../components/CustomText";
import useAutoRefresh from "../hooks/useAutoRefresh";
import { db, auth } from "../firebaseConfig";
import {
  collection,
  getDocs,
  serverTimestamp,
  addDoc,
  query,
  orderBy,
  limit,
  doc,
  getDoc,
  where,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const weatherConditions = [
  {
    id: "rain",
    name: "Rain",
    icon: "cloud-rain",
    affects: "Dogs tend to seek shelter under porches or dense vegetation",
  },
  {
    id: "wind",
    name: "Wind",
    icon: "wind",
    affects: "Cats may hide in enclosed spaces to avoid strong winds",
  },
  {
    id: "thunder",
    name: "Thunder",
    icon: "zap",
    affects: "Most pets become disoriented and may run farther than usual",
  },
  {
    id: "heat",
    name: "Heat",
    icon: "sun",
    affects: "Pets seek shade and water sources, often near buildings",
  },
];

const DashboardScreen = () => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPet, setSelectedPet] = useState(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [recentLostPets, setRecentLostPets] = useState([]);
  const [recentFoundPets, setRecentFoundPets] = useState([]);
  const [nearbyAlerts, setNearbyAlerts] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [activeWeather, setActiveWeather] = useState("rain");
  const [communityActivities, setCommunityActivities] = useState([]);
  const [activityAddresses, setActivityAddresses] = useState({});
  const [currentWeather, setCurrentWeather] = useState({
    condition: "Clear",
    temperature: "72°F",
    icon: "sun",
  });
  const [userName, setUserName] = useState("");
  const [greeting, setGreeting] = useState("Hello");

  const scrollY = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const notificationDropdownAnim = useRef(new Animated.Value(0)).current;
  const weatherCardAnim = useRef(new Animated.Value(0)).current;

  const getAddressFromCoords = async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await response.json();
      return data.display_name || "Unknown Location";
    } catch (error) {
      return "Unknown Location";
    }
  };

  useEffect(() => {
    const fetchAddresses = async () => {
      const newAddresses = {};
      for (const activity of communityActivities) {
        if (
          activity.location &&
          activity.location.latitude &&
          activity.location.longitude
        ) {
          newAddresses[activity.id] = await getAddressFromCoords(
            activity.location.latitude,
            activity.location.longitude
          );
        }
      }
      setActivityAddresses(newAddresses);
    };

    if (communityActivities.length > 0) {
      fetchAddresses();
    }
  }, [communityActivities]);

  const fetchCommunityActivities = async () => {
    try {
      const partiesRef = collection(db, "communitySearches");
      const partiesQuery = query(
        partiesRef,
        where("status", "==", "active"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const partiesSnapshot = await getDocs(partiesQuery);

      if (!partiesSnapshot.empty) {
        const activities = partiesSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            dateTime: data.createdAt
              ? new Date(data.createdAt.toDate()).toLocaleString()
              : "Unknown time",
          };
        });
        setCommunityActivities(activities);
      } else {
        setCommunityActivities([]);
      }
    } catch (error) {
      console.error("Error fetching community activities:", error);
    }
  };
  useEffect(() => {
    fetchCommunityActivities();
  }, []);

  // Consolidated fetchData function
  const fetchData = useCallback(async () => {
    await fetchCommunityActivities();
    setLoading(true);
    setError(null);

    try {
      const petReportsRef = collection(db, "petReports");
      const petReportsSnapshot = await getDocs(petReportsRef);

      if (petReportsSnapshot.empty) {
        setRecentLostPets([]);
        setRecentFoundPets([]);
      } else {
        const allReports = petReportsSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            image:
              data.imageUrls && data.imageUrls.length > 0
                ? { uri: data.imageUrls[0] }
                : null,
            dateTime: data.createdAt
              ? new Date(data.createdAt.toDate()).toLocaleString()
              : "Unknown time",
          };
        });

        const sortedReports = allReports.sort((a, b) => {
          const dateA = a.createdAt
            ? new Date(a.createdAt.toDate())
            : new Date(0);
          const dateB = b.createdAt
            ? new Date(b.createdAt.toDate())
            : new Date(0);
          return dateB - dateA;
        });

        const lostPets = sortedReports
          .filter((pet) => pet.status === "lost")
          .map((pet) => {
            let behaviorPrediction = "";
            if (pet.petType?.toLowerCase() === "dog") {
              behaviorPrediction =
                "Likely to follow scent trails and seek human contact. May travel 1-3 miles from last location.";
            } else if (pet.petType?.toLowerCase() === "cat") {
              behaviorPrediction =
                "Likely hiding within 3-5 houses from last location. May be in small, dark spaces like under porches.";
            } else {
              behaviorPrediction = "May be hiding in sheltered areas nearby.";
            }

            let distance = "Unknown";
            if (pet.location) {
              distance = `${(Math.random() * 2 + 0.1).toFixed(1)} miles away`;
            }

            return {
              ...pet,
              behaviorPrediction,
              distance,
              searchProbability: Math.floor(Math.random() * 30) + 70,
            };
          });

        const foundPets = sortedReports
          .filter((pet) => pet.status === "found")
          .map((pet) => {
            let distance = "Unknown";
            if (pet.location) {
              distance = `${(Math.random() * 2 + 0.1).toFixed(1)} miles away`;
            }

            return {
              ...pet,
              distance,
            };
          });

        const updatedFoundPets = foundPets.map((foundPet) => {
          const potentialMatches = lostPets.filter(
            (lostPet) =>
              lostPet.petType?.toLowerCase() === foundPet.petType?.toLowerCase()
          );

          return {
            ...foundPet,
            potentialMatches: potentialMatches.length,
            matchProbability: Math.floor(Math.random() * 30) + 70,
          };
        });

        setRecentLostPets(lostPets.slice(0, 5));
        setRecentFoundPets(updatedFoundPets.slice(0, 5));
      }

      await fetchNearbyAlerts();
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to load data. Please try again.");
      Alert.alert(
        "Error Loading Data",
        "There was a problem loading data. Please check your connection and try again.",
        [{ text: "OK" }, { text: "Retry", onPress: () => fetchData() }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useAutoRefresh(fetchData, isFocused ? 30000 : null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(weatherCardAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    fetchData();
    fetchUserData();
    setTimeBasedGreeting();
  }, []);

  useEffect(() => {
    Animated.timing(notificationDropdownAnim, {
      toValue: showNotifications ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showNotifications]);

  const setTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting("Good morning");
    } else if (hour < 18) {
      setGreeting("Good afternoon");
    } else {
      setGreeting("Good evening");
    }
  };

  const fetchUserData = async () => {
    try {
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const fullName = userData.fullName || "";
          const firstName = fullName.split(" ")[0];
          setUserName(firstName);
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const fetchNearbyAlerts = async () => {
    try {
      const alertsRef = collection(db, "alerts");
      const alertsQuery = query(
        alertsRef,
        orderBy("createdAt", "desc"),
        limit(5)
      );
      const alertsSnapshot = await getDocs(alertsQuery);

      if (!alertsSnapshot.empty) {
        const alerts = alertsSnapshot.docs.map((doc) => {
          const data = doc.data();
          let timeString = "Unknown time";
          if (data.createdAt) {
            const now = new Date();
            const alertTime = new Date(data.createdAt.toDate());
            const diffMinutes = Math.floor((now - alertTime) / (1000 * 60));
            if (diffMinutes < 60) {
              timeString = `${diffMinutes} min ago`;
            } else if (diffMinutes < 1440) {
              timeString = `${Math.floor(diffMinutes / 60)} hour${
                Math.floor(diffMinutes / 60) > 1 ? "s" : ""
              } ago`;
            } else {
              timeString = alertTime.toLocaleDateString();
            }
          }
          const distance = data.location
            ? `${(Math.random() * 2 + 0.1).toFixed(1)} miles away`
            : "Unknown";
          return {
            id: doc.id,
            title: data.title || "Alert",
            description: data.description || "No description",
            time: timeString,
            distance,
            priority: data.priority || "medium",
          };
        });
        setNearbyAlerts(alerts);
      } else {
        setNearbyAlerts([]);
      }
    } catch (error) {
      console.error("Error fetching alerts:", error);
      setError(`Error fetching alerts: ${error.message}`);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const handleViewPetDetails = (pet) => {
    navigation.navigate("PetDetails", { pet });
  };

  // Updated navigation to use "Search" instead of "SearchMap"
  const handleViewSearchMap = (pet = null) => {
    if (pet) {
      navigation.navigate("AiSearchMap", { pet });
    } else if (selectedPet) {
      navigation.navigate("AiSearchMap", { pet: selectedPet });
      setShowSearchModal(false);
    } else {
      setShowSearchModal(true);
    }
  };

  const handleSelectPetForSearch = (pet) => {
    setSelectedPet(pet);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#EF4444";
      case "medium":
        return "#F59E0B";
      default:
        return "#3B82F6";
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const createSearchParty = async (petData) => {
    try {
      if (!auth.currentUser) {
        Alert.alert(
          "Authentication Required",
          "Please sign in to create a search party"
        );
        return;
      }
      navigation.navigate("SearchParty", { pet: petData });
    } catch (error) {
      console.error("Error creating search party:", error);
      Alert.alert("Error", "Failed to create search party. Please try again.");
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [-50, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={tw`flex-1 bg-gray-50`}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <Animated.View
        style={[
          tw`absolute top-0 left-0 right-0 h-26 bg-white z-10 shadow-sm`,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslate }],
          },
        ]}
      />
      <View style={tw`z-20 px-6 pt-12 pb-4`}>
        <View style={tw`flex-row items-center justify-between`}>
          <View style={tw`flex-1`}>
            <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
              {greeting}
              {userName ? `, ${userName}` : ""}
            </CustomText>
          </View>
          <View style={tw`flex-row`}>
            <TouchableOpacity
              style={tw`mr-4 p-2`}
              onPress={() => navigation.navigate("Map")}
            >
              <Feather name="map-pin" size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity
              style={tw`p-2 relative`}
              onPress={toggleNotifications}
            >
              <Feather name="bell" size={20} color="#3B82F6" />
              {nearbyAlerts.length > 0 && (
                <View
                  style={tw`absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full border border-white`}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={tw`flex-row items-center mt-1`}>
          <Feather
            name={currentWeather.icon}
            size={16}
            color="#3B82F6"
            style={tw`mr-1.5`}
          />
          <CustomText style={tw`text-gray-500 text-[12px]`}>
            {currentWeather.condition}, {currentWeather.temperature}
          </CustomText>
        </View>
        <CustomText style={tw`text-gray-500 text-[12px] mt-1`}>
          Last refreshed: {lastRefreshed || "Never"}
        </CustomText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={tw`mt-4`}
        >
          <TouchableOpacity
            style={tw`flex-row items-center bg-blue-50 rounded-md px-3 py-1.5 mr-2 border border-blue-100`}
            onPress={() => navigation.navigate("ReportLostPet")}
          >
            <Feather
              name="alert-triangle"
              size={14}
              color="#3B82F6"
              style={tw`mr-1`}
            />
            <CustomText style={tw`text-blue-600 text-[12px]`} weight="Medium">
              Report Lost
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-row items-center bg-green-50 rounded-md px-3 py-1.5 mr-2 border border-green-100`}
            onPress={() => navigation.navigate("ReportFoundPet")}
          >
            <Feather name="search" size={14} color="#10B981" style={tw`mr-1`} />
            <CustomText style={tw`text-green-600 text-[12px]`} weight="Medium">
              Report Found
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-row items-center bg-orange-50 rounded-md px-3 py-1.5 mr-2 border border-orange-100`}
            onPress={() => navigation.navigate("ReportSighting")}
          >
            <Feather name="eye" size={14} color="#F59E0B" style={tw`mr-1`} />
            <CustomText style={tw`text-orange-600 text-[12px]`} weight="Medium">
              Sighting
            </CustomText>
          </TouchableOpacity>
          <TouchableOpacity
            style={tw`flex-row items-center bg-purple-50 rounded-md px-3 py-1.5 mr-2 border border-purple-100`}
            onPress={() => navigation.navigate("SearchParties")}
          >
            <Feather name="users" size={14} color="#8B5CF6" style={tw`mr-1`} />
            <CustomText style={tw`text-purple-600 text-[12px]`} weight="Medium">
              Search Parties
            </CustomText>
          </TouchableOpacity>
        </ScrollView>
      </View>
      {showNotifications && (
        <Animated.View
          style={[
            tw`absolute right-4 top-24 z-50 bg-white rounded-lg shadow-md w-[80%] max-w-[300px]`,
            {
              opacity: notificationDropdownAnim,
              transform: [
                {
                  translateY: notificationDropdownAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={tw`p-4 border-b border-gray-200`}>
            <View style={tw`flex-row justify-between items-center`}>
              <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                Nearby Alerts
              </CustomText>
              <TouchableOpacity onPress={() => navigation.navigate("Alerts")}>
                <CustomText
                  style={tw`text-[14px] text-blue-500`}
                  weight="Medium"
                >
                  See All
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
          <View style={tw`max-h-[400px]`}>
            {nearbyAlerts.length > 0 ? (
              <ScrollView>
                {nearbyAlerts.map((alert) => (
                  <View key={alert.id} style={tw`p-4 border-b border-gray-100`}>
                    <View style={tw`flex-row items-start`}>
                      <View
                        style={[
                          tw`w-10 h-10 rounded-xl items-center justify-center mr-3`,
                          {
                            backgroundColor: `${getPriorityColor(
                              alert.priority
                            )}20`,
                          },
                        ]}
                      >
                        <Feather
                          name="alert-circle"
                          size={18}
                          color={getPriorityColor(alert.priority)}
                        />
                      </View>
                      <View style={tw`flex-1`}>
                        <CustomText
                          style={tw`text-[15px] text-gray-800 mb-1`}
                          weight="SemiBold"
                        >
                          {alert.title}
                        </CustomText>
                        <CustomText
                          style={tw`text-[13px] text-gray-600 mb-2 leading-5`}
                        >
                          {alert.description}
                        </CustomText>
                        <View style={tw`flex-row justify-between items-center`}>
                          <View style={tw`flex-row items-center`}>
                            <Feather
                              name="clock"
                              size={12}
                              color="#9CA3AF"
                              style={tw`mr-1`}
                            />
                            <CustomText style={tw`text-[11px] text-gray-500`}>
                              {alert.time}
                            </CustomText>
                          </View>
                          <View style={tw`flex-row items-center`}>
                            <Feather
                              name="map-pin"
                              size={12}
                              color="#9CA3AF"
                              style={tw`mr-1`}
                            />
                            <CustomText style={tw`text-[11px] text-gray-500`}>
                              {alert.distance}
                            </CustomText>
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <View style={tw`py-8 items-center`}>
                <Feather name="bell-off" size={32} color="#9CA3AF" />
                <CustomText style={tw`text-gray-500 mt-2`}>
                  No alerts at this time
                </CustomText>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={tw`p-4 items-center border-t border-gray-200`}
            onPress={() => {
              setShowNotifications(false);
              navigation.navigate("Alerts");
            }}
          >
            <CustomText style={tw`text-blue-500 text-[14px]`} weight="Medium">
              View All Alerts
            </CustomText>
          </TouchableOpacity>
        </Animated.View>
      )}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`pb-20`}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3B82F6"
          />
        }
      >
        <View style={tw`flex-1`}>
          {error && (
            <View
              style={tw`mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-xl`}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-row items-center flex-1`}>
                  <Feather
                    name="alert-circle"
                    size={20}
                    color="#EF4444"
                    style={tw`mr-2`}
                  />
                  <CustomText style={tw`text-red-600`} weight="Medium">
                    {error}
                  </CustomText>
                </View>
                <TouchableOpacity style={tw`p-2`} onPress={fetchData}>
                  <CustomText
                    style={tw`text-blue-500 text-[12px]`}
                    weight="Medium"
                  >
                    Retry
                  </CustomText>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <Animated.View
            style={[
              tw`px-6 mb-4 mt-2`,
              {
                opacity: weatherCardAnim,
                transform: [
                  {
                    translateY: weatherCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View
              style={tw`bg-white rounded-xl p-3 shadow-sm border border-gray-100`}
            >
              <View style={tw`flex-row items-center justify-between`}>
                <View style={tw`flex-1`}>
                  <View style={tw`flex-row items-center justify-between`}>
                    <CustomText
                      style={tw`text-[16px] text-gray-800`}
                      weight="Bold"
                    >
                      Weather Impact on Pets
                    </CustomText>
                    <TouchableOpacity
                      style={tw`px-2 py-1 bg-blue-50 rounded-lg`}
                      onPress={() => navigation.navigate("WeatherImpact")}
                    >
                      <CustomText
                        style={tw`text-blue-500 text-[11px]`}
                        weight="Medium"
                      >
                        Details
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                  <CustomText style={tw`text-[12px] text-gray-600 mt-0.5`}>
                    {
                      weatherConditions.find((c) => c.id === activeWeather)
                        ?.affects
                    }
                  </CustomText>
                </View>
              </View>
              <View style={tw`flex-row mt-2 overflow-hidden`}>
                {weatherConditions.map((condition) => (
                  <TouchableOpacity
                    key={condition.id}
                    style={tw`mr-2 px-2 py-1 rounded-lg ${
                      activeWeather === condition.id
                        ? "bg-blue-100"
                        : "bg-gray-100"
                    }`}
                    onPress={() => setActiveWeather(condition.id)}
                  >
                    <View style={tw`flex-row items-center`}>
                      <Feather
                        name={condition.icon}
                        size={12}
                        color={
                          activeWeather === condition.id ? "#3B82F6" : "#4B5563"
                        }
                      />
                      <CustomText
                        style={tw`ml-1 ${
                          activeWeather === condition.id
                            ? "text-blue-600"
                            : "text-gray-700"
                        } text-[11px]`}
                        weight={
                          activeWeather === condition.id ? "SemiBold" : "Medium"
                        }
                      >
                        {condition.name}
                      </CustomText>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Animated.View>
          <Animated.View
            style={[
              tw`px-6 mb-6`,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View
              style={tw`bg-blue-50 rounded-xl p-3 border border-blue-200 shadow-sm`}
            >
              <View style={tw`flex-row items-center`}>
                <View style={tw`flex-1`}>
                  <View style={tw`flex-row items-center justify-between`}>
                    <View
                      style={tw`w-10 h-10 rounded-xl bg-blue-500 items-center justify-center mr-3`}
                    >
                      <Feather name="search" size={18} color="white" />
                    </View>
                    <CustomText
                      style={tw`text-[15px] text-gray-800`}
                      weight="Bold"
                    >
                      AI-Powered Search Recommendation
                    </CustomText>
                  </View>
                  <CustomText style={tw`text-[12px] text-gray-600 mt-0.5`}>
                    Our AI suggests that you search in the area where your pet
                    was last seen.
                  </CustomText>
                </View>
              </View>
              <TouchableOpacity
                style={tw`bg-blue-500 py-2 mt-2 rounded-lg items-center flex-row justify-center`}
                onPress={() => handleViewSearchMap()}
              >
                <CustomText
                  style={tw`text-white text-[14px] mr-2`}
                  weight="SemiBold"
                >
                  Start AI Search
                </CustomText>
                <Feather name="map-pin" size={14} color="white" />
              </TouchableOpacity>
            </View>
          </Animated.View>
          <View style={tw`mb-6`}>
            <View style={tw`px-6 flex-row justify-between items-center mb-4`}>
              <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                Recent Pet Reports
              </CustomText>
              <View style={tw`flex-row items-center`}>
                <TouchableOpacity onPress={() => navigation.navigate("Search")}>
                  <CustomText
                    style={tw`text-[14px] text-blue-500`}
                    weight="Medium"
                  >
                    See All
                  </CustomText>
                </TouchableOpacity>
              </View>
            </View>
            {loading ? (
              <View style={tw`px-6 py-8 items-center`}>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "360deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <Feather name="loader" size={32} color="#3B82F6" />
                </Animated.View>
                <CustomText style={tw`text-gray-500 mt-4`}>
                  Loading pet reports...
                </CustomText>
              </View>
            ) : (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={tw`px-6 pb-4`}
                data={[...(recentLostPets || []), ...(recentFoundPets || [])]
                  .sort((a, b) => {
                    const dateA = a.createdAt
                      ? new Date(a.createdAt.toDate())
                      : new Date(0);
                    const dateB = b.createdAt
                      ? new Date(b.createdAt.toDate())
                      : new Date(0);
                    return dateB - dateA;
                  })
                  .slice(0, 5)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isLost = item.status === "lost";
                  return (
                    <TouchableOpacity
                      style={tw`bg-white rounded-xl shadow-sm overflow-hidden mr-4 w-[280px]`}
                      activeOpacity={0.9}
                      onPress={() => handleViewPetDetails(item)}
                    >
                      <View style={tw`relative`}>
                        {item.image ? (
                          <Image
                            source={item.image}
                            style={tw`w-full h-40 bg-gray-200`}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={tw`w-full h-40 bg-gray-200 items-center justify-center`}
                          >
                            <Feather name="image" size={24} color="#9CA3AF" />
                            <CustomText
                              style={tw`text-gray-500 mt-2 text-[14px]`}
                            >
                              No Image
                            </CustomText>
                          </View>
                        )}
                        <View
                          style={tw`absolute top-3 right-3 px-3 py-1 rounded-xl ${
                            isLost ? "bg-red-500" : "bg-green-500"
                          }`}
                        >
                          <CustomText
                            style={tw`text-white text-[11px]`}
                            weight="SemiBold"
                          >
                            {isLost ? "LOST" : "FOUND"}
                          </CustomText>
                        </View>
                      </View>
                      <View style={tw`p-4`}>
                        <View
                          style={tw`flex-row justify-between items-center mb-1`}
                        >
                          <CustomText
                            style={tw`text-[18px] text-gray-800`}
                            weight="Bold"
                          >
                            {isLost
                              ? item.petName || "Unnamed Pet"
                              : item.petType || "Unknown Pet"}
                          </CustomText>
                          {item.distance && (
                            <View style={tw`flex-row items-center`}>
                              <Feather
                                name="map-pin"
                                size={12}
                                color="#9CA3AF"
                                style={tw`mr-1`}
                              />
                              <CustomText style={tw`text-[12px] text-gray-500`}>
                                {item.distance}
                              </CustomText>
                            </View>
                          )}
                        </View>
                        <View style={tw`flex-row items-center mb-2`}>
                          <CustomText style={tw`text-[14px] text-gray-600`}>
                            {item.petBreed || "Unknown Breed"} •{" "}
                            {item.petType || "Unknown Type"}
                          </CustomText>
                        </View>
                        {isLost && item.behaviorPrediction && (
                          <View style={tw`mb-3 p-2 bg-blue-50 rounded-lg`}>
                            <View style={tw`flex-row items-center mb-1`}>
                              <Feather
                                name="activity"
                                size={12}
                                color="#3B82F6"
                                style={tw`mr-1`}
                              />
                              <CustomText
                                style={tw`text-[12px] text-blue-600`}
                                weight="Medium"
                              >
                                Behavior Prediction
                              </CustomText>
                            </View>
                            <CustomText style={tw`text-[11px] text-gray-700`}>
                              {item.behaviorPrediction}
                            </CustomText>
                          </View>
                        )}
                        {!isLost && (
                          <View style={tw`mb-3 p-2 bg-green-50 rounded-lg`}>
                            <View style={tw`flex-row items-center mb-1`}>
                              <Feather
                                name="search"
                                size={12}
                                color="#10B981"
                                style={tw`mr-1`}
                              />
                              <CustomText
                                style={tw`text-[12px] text-green-600`}
                                weight="Medium"
                              >
                                Possible Matches
                              </CustomText>
                            </View>
                            <CustomText style={tw`text-[11px] text-gray-700`}>
                              {item.potentialMatches ||
                                Math.floor(Math.random() * 3) + 1}{" "}
                              potential matches found in your area
                            </CustomText>
                          </View>
                        )}
                        <View style={tw`flex-row items-center mb-3`}>
                          <Feather
                            name="clock"
                            size={14}
                            color="#9CA3AF"
                            style={tw`mr-1`}
                          />
                          <CustomText style={tw`text-[12px] text-gray-500`}>
                            {item.dateTime || "Unknown Time"}
                          </CustomText>
                        </View>
                        <View style={tw`flex-row`}>
                          <TouchableOpacity
                            style={tw`bg-gray-200 py-2.5 rounded-xl items-center flex-1 mr-2`}
                            onPress={() => handleViewPetDetails(item)}
                          >
                            <CustomText
                              style={tw`text-gray-700 text-[14px]`}
                              weight="SemiBold"
                            >
                              Details
                            </CustomText>
                          </TouchableOpacity>
                          {isLost ? (
                            <TouchableOpacity
                              style={tw`bg-blue-500 py-2.5 rounded-xl items-center flex-1`}
                              onPress={() => handleViewSearchMap(item)}
                            >
                              <CustomText
                                style={tw`text-white text-[14px]`}
                                weight="SemiBold"
                              >
                                Search
                              </CustomText>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={tw`bg-green-500 py-2.5 rounded-xl items-center flex-1`}
                              onPress={() =>
                                navigation.navigate("MatchCheck", { pet: item })
                              }
                            >
                              <CustomText
                                style={tw`text-white text-[14px]`}
                                weight="SemiBold"
                              >
                                Check Matches
                              </CustomText>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={() => (
                  <View style={tw`px-6 py-8 items-center w-[${width - 48}px]`}>
                    <Feather name="search" size={32} color="#9CA3AF" />
                    <CustomText style={tw`text-gray-500 mt-4 text-center`}>
                      No pet reports found. Pull down to refresh or add a new
                      report.
                    </CustomText>
                    <TouchableOpacity
                      style={tw`mt-4 bg-blue-500 px-4 py-2 rounded-lg`}
                      onPress={() => navigation.navigate("Report")}
                    >
                      <CustomText style={tw`text-white`}>Add Report</CustomText>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>

            <View style={tw`px-6 mb-6`}>
              <View style={tw`flex-row justify-between items-center mb-4`}>
                <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                  Community Activities
                </CustomText>
                <TouchableOpacity
                  onPress={() => navigation.navigate("SearchParties")}
                >
                  <CustomText
                    style={tw`text-[14px] text-blue-500`}
                    weight="Medium"
                  >
                    See All
                  </CustomText>
                </TouchableOpacity>
              </View>
              <View
                style={tw`bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100`}
              >
                {communityActivities.length === 0 ? (
                  <View style={tw`p-6 items-center bg-gray-50 rounded-xl`}>
                    <Feather name="users" size={40} color="#9CA3AF" />
                    <CustomText
                      style={tw`text-[16px] text-gray-600 mt-4 text-center`}
                      weight="Medium"
                    >
                      No community activities yet. Start a search party or join
                      one!
                    </CustomText>
                    <TouchableOpacity
                      style={tw`mt-4 bg-blue-500 px-6 py-3 rounded-lg flex-row items-center`}
                      onPress={() => navigation.navigate("ReportLostPet")}
                    >
                      <Feather
                        name="plus"
                        size={16}
                        color="white"
                        style={tw`mr-2`}
                      />
                      <CustomText
                        style={tw`text-white text-[14px]`}
                        weight="SemiBold"
                      >
                        Start a Search Party
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                ) : (
                  communityActivities.map((activity) => (
                    <View
                      key={activity.id}
                      style={tw`p-4 border-b border-gray-100 last:border-b-0`}
                    >
                      <View style={tw`flex-row items-start mb-3`}>
                        <View
                          style={tw`w-12 h-12 rounded-full bg-orange-100 items-center justify-center mr-3`}
                        >
                          <Feather name="users" size={20} color="#F59E0B" />
                        </View>
                        <View style={tw`flex-1`}>
                          <CustomText
                            style={tw`text-[16px] text-gray-800 mb-1`}
                            weight="Bold"
                          >
                            {activity.petName
                              ? `Search Party for ${activity.petName}`
                              : "Community Search Party"}
                          </CustomText>
                          <View
                            style={tw`flex-row items-center flex-wrap mb-2`}
                          >
                            <View style={tw`flex-row items-center mr-4`}>
                              <Feather
                                name="clock"
                                size={12}
                                color="#9CA3AF"
                                style={tw`mr-1.5`}
                              />
                              <CustomText style={tw`text-[12px] text-gray-500`}>
                                {activity.dateTime}
                              </CustomText>
                            </View>
                            <View style={tw`flex-row items-center`}>
                              <Feather
                                name="map-pin"
                                size={12}
                                color="#9CA3AF"
                                style={tw`mr-1.5`}
                              />
                              {activityAddresses[activity.id] ? (
                                <CustomText
                                  style={tw`text-[12px] text-gray-500`}
                                  numberOfLines={1}
                                >
                                  {activityAddresses[activity.id]}
                                </CustomText>
                              ) : (
                                <View
                                  style={tw`w-24 h-4 bg-gray-200 rounded animate-pulse`}
                                />
                              )}
                            </View>
                          </View>
                          <CustomText
                            style={tw`text-[13px] text-gray-600 leading-5`}
                            numberOfLines={2}
                          >
                            {activity.details ||
                              "Join the community to help find a lost pet!"}
                          </CustomText>
                        </View>
                      </View>
                      <View style={tw`flex-row items-center justify-between`}>
                        <TouchableOpacity
                          style={tw`bg-orange-500 px-4 py-2.5 rounded-lg flex-row items-center flex-1 mr-2`}
                          onPress={() =>
                            navigation.navigate("SearchParty", {
                              pet: activity,
                            })
                          }
                        >
                          <Feather
                            name="user-plus"
                            size={14}
                            color="white"
                            style={tw`mr-1.5`}
                          />
                          <CustomText
                            style={tw`text-white text-[13px]`}
                            weight="SemiBold"
                          >
                            Join Search
                          </CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={tw`bg-gray-100 px-4 py-2.5 rounded-lg flex-row items-center border border-gray-200`}
                          onPress={() => {
                            // Implement share functionality here
                            Alert.alert(
                              "Share",
                              "Share functionality coming soon!"
                            );
                          }}
                        >
                          <Feather
                            name="share-2"
                            size={14}
                            color="#4B5563"
                            style={tw`mr-1.5`}
                          />
                          <CustomText
                            style={tw`text-gray-700 text-[13px]`}
                            weight="Medium"
                          >
                            Share
                          </CustomText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
                <View style={tw`flex-row border-t border-gray-100 bg-gray-50`}>
                  <TouchableOpacity
                    style={tw`flex-1 p-4 flex-row items-center justify-center border-r border-gray-100`}
                    onPress={() =>
                      navigation.navigate("Chat", {
                        chatId: "rescue-coordination",
                        chatName: "Rescue Coordination",
                      })
                    }
                  >
                    <Feather
                      name="message-circle"
                      size={16}
                      color="#3B82F6"
                      style={tw`mr-2`}
                    />
                    <CustomText
                      style={tw`text-blue-500 text-[14px]`}
                      weight="SemiBold"
                    >
                      Coordination Chat
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`flex-1 p-4 flex-row items-center justify-center`}
                    onPress={() => navigation.navigate("Community")}
                  >
                    <Feather
                      name="users"
                      size={16}
                      color="#3B82F6"
                      style={tw`mr-2`}
                    />
                    <CustomText
                      style={tw`text-blue-500 text-[14px]`}
                      weight="SemiBold"
                    >
                      Community Hub
                    </CustomText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
        </View>
        <Modal
          visible={showSearchModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowSearchModal(false)}
        >
          <View style={tw`flex-1 bg-black/50 justify-end`}>
            <View style={tw`bg-white rounded-t-3xl p-6`}>
              <View style={tw`flex-row justify-between items-center mb-6`}>
                <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                  Select Pet for Search
                </CustomText>
                <TouchableOpacity onPress={() => setShowSearchModal(false)}>
                  <Feather name="x" size={24} color="#4B5563" />
                </TouchableOpacity>
              </View>
              <CustomText style={tw`text-[14px] text-gray-600 mb-6`}>
                Select a lost pet to begin a search based on their behavior
                patterns and environmental factors
              </CustomText>
              {recentLostPets
                .filter(
                  (pet) =>
                    pet.status === "lost" &&
                    pet.userId === auth.currentUser?.uid
                )
                .map((pet) => (
                  <TouchableOpacity
                    key={pet.id}
                    style={tw`flex-row items-center p-4 mb-3 rounded-xl border-2 ${
                      selectedPet?.id === pet.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200"
                    }`}
                    onPress={() => handleSelectPetForSearch(pet)}
                  >
                    {pet.image ? (
                      <Image
                        source={pet.image}
                        style={tw`w-16 h-16 rounded-xl mr-4`}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={tw`w-16 h-16 rounded-xl bg-gray-200 mr-4 items-center justify-center`}
                      >
                        <Feather name="image" size={20} color="#9CA3AF" />
                      </View>
                    )}
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center`}>
                        <CustomText
                          style={tw`text-[16px] text-gray-800 mr-2`}
                          weight="Bold"
                        >
                          {pet.petName || "Unnamed Pet"}
                        </CustomText>
                      </View>
                      <CustomText style={tw`text-[14px] text-gray-600 mb-1`}>
                        {pet.petBreed || "Unknown Breed"} • Last seen{" "}
                        {pet.dateTime || "Unknown Time"}
                      </CustomText>
                      <CustomText
                        style={tw`text-[12px] text-gray-500`}
                        numberOfLines={1}
                      >
                        {pet.behaviorPrediction}
                      </CustomText>
                    </View>
                    {selectedPet?.id === pet.id && (
                      <View
                        style={tw`w-6 h-6 rounded-full bg-blue-500 items-center justify-center`}
                      >
                        <Feather name="check" size={16} color="white" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              {recentLostPets.filter(
                (pet) =>
                  pet.status === "lost" && pet.userId === auth.currentUser?.uid
              ).length === 0 && (
                <View style={tw`items-center py-6`}>
                  <Feather name="alert-circle" size={48} color="#9CA3AF" />
                  <CustomText
                    style={tw`text-[16px] text-gray-600 mt-4 text-center`}
                  >
                    You haven't reported any lost pets yet.
                  </CustomText>
                  <TouchableOpacity
                    style={tw`mt-4 bg-blue-500 px-4 py-2 rounded-lg`}
                    onPress={() => {
                      setShowSearchModal(false);
                      navigation.navigate("ReportLostPet");
                    }}
                  >
                    <CustomText style={tw`text-white`}>
                      Report Lost Pet
                    </CustomText>
                  </TouchableOpacity>
                </View>
              )}
              <View style={tw`flex-row mt-6`}>
                <TouchableOpacity
                  style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                  onPress={() => setShowSearchModal(false)}
                >
                  <CustomText
                    style={tw`text-gray-700 text-[16px]`}
                    weight="SemiBold"
                  >
                    Cancel
                  </CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`bg-blue-500 py-3 rounded-xl items-center justify-center flex-1 ${
                    !selectedPet ? "opacity-50" : ""
                  }`}
                  onPress={() => handleViewSearchMap()}
                  disabled={!selectedPet}
                >
                  <CustomText
                    style={tw`text-white text-[16px]`}
                    weight="SemiBold"
                  >
                    Start Search
                  </CustomText>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={tw`mt-4 items-center`}
                onPress={() => {
                  setShowSearchModal(false);
                  navigation.navigate("ReportLostPet");
                }}
              >
                <CustomText
                  style={tw`text-blue-500 text-[14px]`}
                  weight="Medium"
                >
                  Report a New Lost Pet
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </Animated.ScrollView>
      {showNotifications && (
        <TouchableOpacity
          style={tw`absolute inset-0 z-40`}
          activeOpacity={0}
          onPress={() => setShowNotifications(false)}
        />
      )}
    </View>
  );
};

export default DashboardScreen;
