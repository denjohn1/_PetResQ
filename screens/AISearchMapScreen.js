"use client";

import { useState, useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import tw from "twrnc";
import { Feather } from "@expo/vector-icons";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import CustomText from "../components/CustomText";
import { auth, db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  limit,
  serverTimestamp,
  addDoc,
} from "firebase/firestore";

const { width, height } = Dimensions.get("window");

const AISearchMapScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pet, focusSighting } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [searchAreas, setSearchAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [showAreaDetails, setShowAreaDetails] = useState(false);
  const [showBehaviorModal, setShowBehaviorModal] = useState(false);
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [showSearchPartyModal, setShowSearchPartyModal] = useState(false);
  const [searchPartyMembers, setSearchPartyMembers] = useState([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: pet?.location?.latitude || 37.78825,
    longitude: pet?.location?.longitude || -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [searchHistory, setSearchHistory] = useState([]);
  const [searchProbability, setSearchProbability] = useState(
    pet?.searchProbability || 85
  );
  const [showTips, setShowTips] = useState(true);
  const [activeTab, setActiveTab] = useState("map");
  const [recentSightings, setRecentSightings] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [behaviorPrediction, setBehaviorPrediction] = useState("");
  const [searchTips, setSearchTips] = useState([]);

  const mapRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const searchProgressAnim = useRef(new Animated.Value(0)).current;

  // Weather conditions that affect pet behavior
  const weatherConditions = {
    rain: {
      name: "Rain",
      icon: "cloud-rain",
      affects:
        "Dogs tend to seek shelter under porches or dense vegetation. Cats may hide in enclosed spaces like garages or sheds.",
      searchTips:
        "Focus on covered areas within 1/4 mile of last seen location. Check under decks, porches, and dense bushes.",
    },
    wind: {
      name: "Wind",
      icon: "wind",
      affects:
        "Pets are more likely to travel downwind. Strong winds can disorient pets and mask familiar scents.",
      searchTips:
        "Search in the downwind direction from last known location. Check areas with wind breaks like walls and hedges.",
    },
    thunder: {
      name: "Thunder",
      icon: "zap",
      affects:
        "Most pets become disoriented and may run farther than usual. They often seek enclosed, sound-dampening spaces.",
      searchTips:
        "Expand search radius to 3-5 miles. Focus on basements, bathrooms, closets, and under beds in nearby homes.",
    },
    heat: {
      name: "Heat",
      icon: "sun",
      affects:
        "Pets seek shade and water sources, often near buildings. They may be less active during hot daytime hours.",
      searchTips:
        "Search near water sources and shaded areas. Look during cooler morning and evening hours when pets are more active.",
    },
    clear: {
      name: "Clear",
      icon: "sun",
      affects:
        "Pets may travel farther in good weather. Dogs often follow scent trails, while cats establish territory.",
      searchTips:
        "For dogs, search in expanding circles. For cats, focus on a 5-7 house radius with many hiding spots.",
    },
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    if (pet) {
      fetchRecentSightings().then(() => {
        generateAIAnalysis();
      });
      fetchSearchHistory();

      // If there's a specific sighting to focus on, center the map on it
      if (focusSighting && mapRef.current) {
        setTimeout(() => {
          mapRef.current.animateToRegion(
            {
              latitude: focusSighting.location.latitude,
              longitude: focusSighting.location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            1000
          );
        }, 1000);
      }
    } else {
      setLoading(false);
      Alert.alert(
        "Error",
        "No pet information provided. Please go back and select a pet."
      );
    }
  }, []);

  useEffect(() => {
    if (isSearching) {
      Animated.timing(searchProgressAnim, {
        toValue: searchProgress,
        duration: 500,
        useNativeDriver: false,
      }).start();

      if (searchProgress < 100) {
        const timer = setTimeout(() => {
          setSearchProgress((prev) => Math.min(prev + 10, 100));
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setIsSearching(false);
        Alert.alert(
          "AI Search Complete",
          "The AI has analyzed behavioral patterns and environmental factors to identify high-probability search areas.",
          [{ text: "View Results", onPress: () => {} }]
        );
      }
    }
  }, [isSearching, searchProgress]);

  const generateAIAnalysis = async () => {
    setIsSearching(true);
    setSearchProgress(10);

    try {
      if (!pet || !pet.location) {
        setLoading(false);
        setIsSearching(false);
        return;
      }

      // Prepare the pet data for the xAI Grok analysis
      const petData = {
        petType: pet.petType || "Unknown",
        petBreed: pet.petBreed || "Unknown",
        petAge: pet.petAge || "Unknown",
        petGender: pet.petGender || "Unknown",
        petSize: pet.petSize || "Medium",
        petColor: pet.petColor || "Unknown",
        behavioralTraits: pet.behavioralTraits || [],
        environmentalFactors: pet.environmentalFactors || [],
        weatherCondition: pet.weatherCondition || "clear",
        lastSeenLocation: {
          latitude: pet.location.latitude,
          longitude: pet.location.longitude,
        },
        lastSeenTime: pet.dateTime || "Unknown",
        sightings: recentSightings.map((s) => ({
          location: {
            latitude: s.location.latitude,
            longitude: s.location.longitude,
          },
          timestamp: s.timestamp,
          confidence: s.confidence,
          description: s.description,
        })),
      };

      setSearchProgress(30);

      // Call xAI Grok API for analysis
      const response = await fetch(
        "https://api.x.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.XAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "grok-3", // Adjust based on xAI's available models
            messages: [
              {
                role: "system",
                content:
                  "You are Grok, an AI assistant created by xAI, specialized in analyzing lost pet behavior patterns and providing search strategies. Provide detailed, accurate analysis based on animal behavior science, maximizing helpfulness.",
              },
              {
                role: "user",
                content: `Analyze this lost pet data and provide: 
              1. A behavior prediction explaining likely movement patterns
              2. 4-5 specific search tips based on the pet type, traits, and environmental factors
              3. 3-6 high-probability search areas with coordinates relative to the last seen location (use offsets like +0.001 latitude), radius in meters, and probability percentage
              
              Format your response as JSON with keys: "behaviorPrediction", "searchTips" (array), and "searchAreas" (array of objects with center, radius, probability, description, and tips)
              
              Pet data: ${JSON.stringify(petData)}`,
              },
            ],
            temperature: 0.7,
            response_format: { type: "json_object" },
          }),
        }
      );

      setSearchProgress(60);

      if (!response.ok) {
        if (response.status === 429) {
          Alert.alert(
            "AI Rate Limit Reached",
            "Too many requests to the xAI service. Please wait a minute and try again.",
            [{ text: "OK" }]
          );
          setLoading(false);
          setIsSearching(false);
          return;
        }
        throw new Error(`xAI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiResult = JSON.parse(data.choices[0].message.content);

      setAiAnalysis(aiResult);
      setBehaviorPrediction(aiResult.behaviorPrediction);
      setSearchTips(aiResult.searchTips);

      // Process the search areas from AI
      const baseLocation = {
        latitude: pet.location.latitude,
        longitude: pet.location.longitude,
      };

      const areas = aiResult.searchAreas.map((area, index) => {
        // Calculate absolute coordinates from relative offsets
        const center = {
          latitude: baseLocation.latitude + (area.center.latitudeOffset || 0),
          longitude:
            baseLocation.longitude + (area.center.longitudeOffset || 0),
        };

        return {
          id: `area${index + 1}`,
          center: center,
          radius: area.radius || 500,
          probability: area.probability || 75,
          color:
            index === 0
              ? "#EF4444"
              : // red for highest probability
              index === 1
              ? "#F59E0B"
              : // amber for second
              index === 2
              ? "#3B82F6"
              : // blue for third
              index === 3
              ? "#8B5CF6"
              : // purple for fourth
              index === 4
              ? "#10B981"
              : // green for fifth
                "#6366F1", // indigo for others
          description: area.description || `Search area ${index + 1}`,
          tips:
            area.tips || "Focus on this area based on pet behavior analysis",
        };
      });

      setSearchAreas(areas);
      setSearchProgress(100);
      setLoading(false);
    } catch (error) {
      console.error("Error generating AI analysis:", error);

      // Fallback to basic search areas if AI fails
      generateBasicSearchAreas();

      Alert.alert(
        "AI Analysis Error",
        "There was an error generating the AI analysis. Using basic search patterns instead.",
        [{ text: "OK" }]
      );
    }
  };

  const generateBasicSearchAreas = () => {
    if (!pet || !pet.location) {
      setLoading(false);
      setIsSearching(false);
      return;
    }

    const baseLocation = {
      latitude: pet.location.latitude,
      longitude: pet.location.longitude,
    };

    // Generate search areas based on pet type and behavioral traits
    const areas = [];

    // Primary search area - highest probability
    areas.push({
      id: "area1",
      center: baseLocation,
      radius: pet.petType === "Dog" ? 800 : 400, // Dogs travel farther than cats
      probability: Math.min(95, searchProbability + 10),
      color: "#EF4444", // red
      description: "Primary search area with highest probability",
      tips:
        pet.petType === "Dog"
          ? "Focus on scent trails and familiar routes"
          : "Check hiding spots like bushes, under porches, and in garages",
    });

    // Secondary search areas
    // Area 2 - North/Northeast
    areas.push({
      id: "area2",
      center: {
        latitude: baseLocation.latitude + 0.003,
        longitude: baseLocation.longitude + 0.002,
      },
      radius: pet.petType === "Dog" ? 600 : 300,
      probability: Math.max(60, searchProbability - 20),
      color: "#F59E0B", // amber
      description: "Secondary search area with moderate probability",
      tips: "Check areas with food and water sources",
    });

    // Area 3 - South/Southwest
    areas.push({
      id: "area3",
      center: {
        latitude: baseLocation.latitude - 0.002,
        longitude: baseLocation.longitude - 0.003,
      },
      radius: pet.petType === "Dog" ? 500 : 250,
      probability: Math.max(50, searchProbability - 30),
      color: "#3B82F6", // blue
      description: "Tertiary search area with lower probability",
      tips: "Look for sheltered areas and potential hiding spots",
    });

    // If pet is scared, add a specific area for hiding
    if (pet.behavioralTraits && pet.behavioralTraits.includes("scared")) {
      areas.push({
        id: "area4",
        center: {
          latitude: baseLocation.latitude - 0.001,
          longitude: baseLocation.longitude + 0.001,
        },
        radius: 200,
        probability: Math.max(70, searchProbability - 15),
        color: "#8B5CF6", // purple
        description: "Potential hiding area based on scared behavior",
        tips: "Check dense vegetation, under structures, and quiet areas",
      });
    }

    // If environmental factors include urban areas
    if (
      pet.environmentalFactors &&
      pet.environmentalFactors.includes("urban")
    ) {
      areas.push({
        id: "area5",
        center: {
          latitude: baseLocation.latitude + 0.0015,
          longitude: baseLocation.longitude - 0.0015,
        },
        radius: 350,
        probability: Math.max(65, searchProbability - 20),
        color: "#10B981", // green
        description: "Urban area with potential food sources",
        tips: "Check near restaurants, dumpsters, and public spaces",
      });
    }

    // If weather condition is rain or thunder, add shelter area
    if (
      pet.weatherCondition &&
      (pet.weatherCondition === "rain" || pet.weatherCondition === "thunder")
    ) {
      areas.push({
        id: "area6",
        center: {
          latitude: baseLocation.latitude - 0.0005,
          longitude: baseLocation.longitude - 0.0005,
        },
        radius: 150,
        probability: Math.max(75, searchProbability - 10),
        color: "#6366F1", // indigo
        description: "Potential shelter from weather",
        tips: "Check covered areas, under overhangs, and enclosed spaces",
      });
    }

    // If we have sightings, add areas around them
    if (recentSightings.length > 0) {
      // Sort sightings by confidence (high to low)
      const sortedSightings = [...recentSightings].sort((a, b) => {
        const confidenceOrder = { high: 3, medium: 2, low: 1 };
        return (
          confidenceOrder[b.confidence.toLowerCase()] -
          confidenceOrder[a.confidence.toLowerCase()]
        );
      });

      // Take the top 2 most confident sightings
      const topSightings = sortedSightings.slice(0, 2);

      topSightings.forEach((sighting, index) => {
        areas.push({
          id: `sighting${index + 1}`,
          center: {
            latitude: sighting.location.latitude,
            longitude: sighting.location.longitude,
          },
          radius: pet.petType === "Dog" ? 400 : 200,
          probability:
            sighting.confidence.toLowerCase() === "high"
              ? 85
              : sighting.confidence.toLowerCase() === "medium"
              ? 70
              : 55,
          color: "#059669", // emerald
          description: `Search area based on ${sighting.confidence} confidence sighting`,
          tips: "Focus on this area as a recent sighting was reported here",
        });
      });
    }

    setSearchAreas(areas);
    setLoading(false);
    setSearchProgress(100);
  };

  const fetchRecentSightings = async () => {
    try {
      if (!pet?.id) return;

      const sightingsQuery = query(
        collection(db, "sightings"),
        where("petId", "==", pet.id),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const sightingsSnapshot = await getDocs(sightingsQuery);
      const sightingsData = sightingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp:
          doc.data().createdAt?.toDate?.().toLocaleString() ||
          new Date().toLocaleString(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }));

      setRecentSightings(sightingsData);

      // If we have sightings, update the search probability
      if (sightingsData.length > 0) {
        // Calculate a new search probability based on sightings
        // More recent and higher confidence sightings increase the probability
        let newProbability = searchProbability;

        const highConfidenceSightings = sightingsData.filter(
          (s) => s.confidence.toLowerCase() === "high"
        ).length;

        const mediumConfidenceSightings = sightingsData.filter(
          (s) => s.confidence.toLowerCase() === "medium"
        ).length;

        // Adjust probability based on sightings confidence
        newProbability += highConfidenceSightings * 5;
        newProbability += mediumConfidenceSightings * 2;

        // Cap at 95%
        setSearchProbability(Math.min(95, newProbability));
      }
    } catch (error) {
      console.error("Error fetching sightings:", error);
      Alert.alert("Error", "Failed to load recent sightings");
    }
  };

  const fetchSearchHistory = async () => {
    try {
      if (!pet?.id || !auth.currentUser) return;

      const searchHistoryQuery = query(
        collection(db, "searchHistory"),
        where("petId", "==", pet.id),
        orderBy("createdAt", "desc"),
        limit(5)
      );

      const historySnapshot = await getDocs(searchHistoryQuery);

      if (historySnapshot.empty) {
        // If no search history exists, create a default entry
        const defaultHistory = {
          petId: pet.id,
          userId: auth.currentUser.uid,
          date: new Date().toLocaleDateString(),
          areas: searchAreas.length || 3,
          duration: "30 minutes",
          participants: 1,
          createdAt: serverTimestamp(),
        };

        // Add the default history to Firestore
        await addDoc(collection(db, "searchHistory"), defaultHistory);
        setSearchHistory([defaultHistory]);
      } else {
        const historyData = historySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          date:
            doc.data().createdAt?.toDate?.().toLocaleDateString() ||
            new Date().toLocaleDateString(),
        }));

        setSearchHistory(historyData);
      }
    } catch (error) {
      console.error("Error fetching search history:", error);
      // Use mock data as fallback
      const mockHistory = [
        {
          id: "search1",
          date: new Date(Date.now() - 86400000).toLocaleDateString(), // 1 day ago
          areas: 3,
          duration: "45 minutes",
          participants: 2,
        },
        {
          id: "search2",
          date: new Date(Date.now() - 172800000).toLocaleDateString(), // 2 days ago
          areas: 2,
          duration: "30 minutes",
          participants: 1,
        },
      ];

      setSearchHistory(mockHistory);
    }
  };

  const handleAreaPress = (area) => {
    setSelectedArea(area);
    setShowAreaDetails(true);

    // Center map on selected area
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: area.center.latitude,
          longitude: area.center.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        1000
      );
    }
  };

  const startSearchParty = () => {
    setShowSearchPartyModal(true);
  };

  const createSearchParty = async () => {
    try {
      if (!auth.currentUser) {
        Alert.alert(
          "Authentication Required",
          "Please sign in to create a search party"
        );
        return;
      }

      // Close the modal first
      setShowSearchPartyModal(false);

      // Navigate to the SearchParty screen with the pet and search areas
      navigation.navigate("SearchParty", {
        pet: {
          ...pet,
          searchAreas: searchAreas,
        },
      });
    } catch (error) {
      console.error("Error creating search party:", error);
      Alert.alert("Error", "Failed to create search party. Please try again.");
    }
  };

  const reportSighting = () => {
    navigation.navigate("ReportSighting", { pet });
  };

  const refreshAnalysis = () => {
    setLoading(true);
    setSearchAreas([]);
    fetchRecentSightings().then(() => {
      generateAIAnalysis();
    });
  };

  const renderWeatherImpact = () => {
    const weatherType = pet?.weatherCondition || "clear";
    const weather = weatherConditions[weatherType] || weatherConditions.clear;

    return (
      <View
        style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
      >
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <View style={tw`flex-row items-center`}>
            <View
              style={tw`w-10 h-10 rounded-lg bg-blue-100 items-center justify-center mr-3`}
            >
              <Feather name={weather.icon} size={20} color="#3B82F6" />
            </View>
            <View>
              <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                {weather.name} Conditions
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-500`}>
                Weather impacts search strategy
              </CustomText>
              <TouchableOpacity
                style={tw`px-3 py-1.5 bg-blue-50 rounded-lg w-[115px]`}
                onPress={() => setShowWeatherModal(true)}
              >
                <CustomText
                  style={tw`text-blue-500 text-[12px]`}
                  weight="Medium"
                >
                  Weather Impact
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={tw`p-3 bg-blue-50 rounded-lg mb-3`}>
          <CustomText style={tw`text-[13px] text-gray-700`}>
            {weather.affects}
          </CustomText>
        </View>

        <View style={tw`p-3 bg-green-50 rounded-lg`}>
          <View style={tw`flex-row items-center mb-1`}>
            <Feather name="search" size={14} color="#10B981" style={tw`mr-1`} />
            <CustomText style={tw`text-[13px] text-green-700`} weight="Medium">
              Search Tip
            </CustomText>
          </View>
          <CustomText style={tw`text-[13px] text-gray-700`}>
            {weather.searchTips}
          </CustomText>
        </View>
      </View>
    );
  };

  const renderBehaviorAnalysis = () => {
    return (
      <View
        style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
      >
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <View style={tw`flex-row items-center`}>
            <View
              style={tw`w-10 h-10 rounded-lg bg-purple-100 items-center justify-center mr-3`}
            >
              <Feather name="activity" size={20} color="#8B5CF6" />
            </View>
            <View>
              <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                AI Behavior Analysis
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-500`}>
                Powered by xAI Grok
              </CustomText>
              <TouchableOpacity
                style={tw`px-3 py-1.5 bg-purple-50 rounded-lg w-[90px]`}
                onPress={() => setShowBehaviorModal(true)}
              >
                <CustomText
                  style={tw`text-purple-500 text-[12px]`}
                  weight="Medium"
                >
                  View Details
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={tw`p-3 bg-purple-50 rounded-lg mb-3`}>
          <CustomText style={tw`text-[13px] text-gray-700`}>
            {behaviorPrediction || "AI is analyzing pet behavior patterns..."}
          </CustomText>
        </View>

        <View style={tw`p-3 bg-blue-50 rounded-lg`}>
          <View style={tw`flex-row items-center mb-1`}>
            <Feather name="search" size={14} color="#3B82F6" style={tw`mr-1`} />
            <CustomText style={tw`text-[13px] text-blue-700`} weight="Medium">
              AI Search Tips
            </CustomText>
          </View>
          {searchTips && searchTips.length > 0 ? (
            searchTips.map((tip, index) => (
              <View key={index} style={tw`flex-row items-center mb-1`}>
                <View
                  style={tw`w-1.5 h-1.5 rounded-full bg-blue-500 mr-2 mt-1`}
                />
                <CustomText style={tw`text-[13px] text-gray-700 flex-1`}>
                  {tip}
                </CustomText>
              </View>
            ))
          ) : (
            <CustomText style={tw`text-[13px] text-gray-700 flex-1`}>
              Loading AI-generated search tips...
            </CustomText>
          )}
        </View>
      </View>
    );
  };

  const renderSearchAreas = () => {
    return (
      <View style={tw`mb-4`}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
            AI Search Areas
          </CustomText>
          <TouchableOpacity
            style={tw`flex-row items-center`}
            onPress={refreshAnalysis}
          >
            <Feather
              name="refresh-cw"
              size={14}
              color="#3B82F6"
              style={tw`mr-1`}
            />
            <CustomText style={tw`text-[14px] text-blue-500`} weight="Medium">
              Refresh
            </CustomText>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View
            style={tw`bg-white p-5 rounded-xl items-center justify-center h-40 shadow-sm border border-gray-100`}
          >
            <ActivityIndicator size="large" color="#3B82F6" />
            <CustomText style={tw`text-gray-600 mt-4`}>
              Analyzing pet behavior patterns...
            </CustomText>
          </View>
        ) : isSearching ? (
          <View
            style={tw`bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
          >
            <View style={tw`flex-row items-center mb-4`}>
              <View
                style={tw`w-10 h-10 rounded-lg bg-blue-100 items-center justify-center mr-3`}
              >
                <Feather name="cpu" size={20} color="#3B82F6" />
              </View>
              <View style={tw`flex-1`}>
                <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                  AI Analysis in Progress
                </CustomText>
                <CustomText style={tw`text-[12px] text-gray-500`}>
                  Processing behavioral patterns and environmental data
                </CustomText>
              </View>
            </View>

            <View style={tw`mb-3`}>
              <View style={tw`flex-row justify-between mb-1`}>
                <CustomText
                  style={tw`text-[14px] text-gray-700`}
                  weight="Medium"
                >
                  Analysis Progress
                </CustomText>
                <CustomText
                  style={tw`text-[14px] text-blue-600`}
                  weight="Medium"
                >
                  {searchProgress}%
                </CustomText>
              </View>
              <View
                style={tw`w-full h-2.5 bg-gray-200 rounded-full overflow-hidden`}
              >
                <Animated.View
                  style={[
                    tw`h-2.5 bg-blue-500 rounded-full`,
                    {
                      width: searchProgressAnim.interpolate({
                        inputRange: [0, 100],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
            </View>

            <View style={tw`p-3 bg-blue-50 rounded-lg`}>
              <View style={tw`flex-row items-start mb-2`}>
                <Feather
                  name="info"
                  size={16}
                  color="#3B82F6"
                  style={tw`mr-2 mt-0.5`}
                />
                <CustomText style={tw`text-[13px] text-gray-700 flex-1`}>
                  Our AI is analyzing {pet?.petType || "pet"} behavior patterns,
                  environmental factors, and historical data to identify the
                  most likely locations.
                </CustomText>
              </View>
            </View>
          </View>
        ) : searchAreas.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`pb-2`}
          >
            {searchAreas.map((area) => (
              <TouchableOpacity
                key={area.id}
                style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 mr-3 w-[280px]`}
                onPress={() => handleAreaPress(area)}
              >
                <View style={tw`flex-row items-center mb-3`}>
                  <View
                    style={[
                      tw`w-10 h-10 rounded-lg items-center justify-center mr-3`,
                      { backgroundColor: `${area.color}20` },
                    ]}
                  >
                    <Feather name="map-pin" size={20} color={area.color} />
                  </View>
                  <View style={tw`flex-1`}>
                    <View style={tw`flex-row items-center`}>
                      <CustomText
                        style={tw`text-[16px] text-gray-800 mr-2`}
                        weight="Bold"
                      >
                        Area {area.id.slice(-1)}
                      </CustomText>
                      <View style={tw`px-2 py-0.5 rounded-full bg-blue-100`}>
                        <CustomText
                          style={tw`text-[10px] text-blue-700`}
                          weight="Medium"
                        >
                          {area.probability}% Match
                        </CustomText>
                      </View>
                    </View>
                    <CustomText style={tw`text-[12px] text-gray-500`}>
                      {(area.radius / 1000).toFixed(1)} km radius
                    </CustomText>
                  </View>
                </View>

                <View style={tw`p-3 bg-gray-50 rounded-lg mb-3`}>
                  <CustomText style={tw`text-[13px] text-gray-700`}>
                    {area.description}
                  </CustomText>
                </View>

                <View style={tw`flex-row items-center`}>
                  <Feather
                    name="info"
                    size={14}
                    color="#3B82F6"
                    style={tw`mr-1`}
                  />
                  <CustomText
                    style={tw`text-[12px] text-blue-600 flex-1`}
                    weight="Medium"
                  >
                    Tap to view on map
                  </CustomText>
                  <Feather name="chevron-right" size={16} color="#3B82F6" />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View
            style={tw`bg-white p-5 rounded-xl items-center justify-center shadow-sm border border-gray-100`}
          >
            <Feather name="alert-circle" size={32} color="#9CA3AF" />
            <CustomText style={tw`text-gray-600 mt-4 text-center`}>
              No search areas generated. Tap refresh to try again.
            </CustomText>
          </View>
        )}
      </View>
    );
  };

  const renderRecentSightings = () => {
    return (
      <View style={tw`mb-4`}>
        <View style={tw`flex-row items-center justify-between mb-3`}>
          <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
            Recent Sightings
          </CustomText>
          <TouchableOpacity
            style={tw`flex-row items-center`}
            onPress={reportSighting}
          >
            <Feather name="plus" size={14} color="#3B82F6" style={tw`mr-1`} />
            <CustomText style={tw`text-[14px] text-blue-500`} weight="Medium">
              Report Sighting
            </CustomText>
          </TouchableOpacity>
        </View>

        {recentSightings.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={tw`pb-2`}
          >
            {recentSightings.map((sighting) => (
              <TouchableOpacity
                key={sighting.id}
                style={tw`bg-white p-4 rounded-xl shadow-sm border border-gray-100 mr-3 w-[280px]`}
                onPress={() => {
                  if (mapRef.current) {
                    mapRef.current.animateToRegion(
                      {
                        latitude: sighting.location.latitude,
                        longitude: sighting.location.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      },
                      1000
                    );
                  }
                  setActiveTab("map");
                }}
              >
                <View style={tw`flex-row items-center mb-3`}>
                  <View
                    style={tw`w-10 h-10 rounded-lg bg-green-100 items-center justify-center mr-3`}
                  >
                    <Feather name="eye" size={20} color="#10B981" />
                  </View>
                  <View style={tw`flex-1`}>
                    <View style={tw`flex-row items-center`}>
                      <CustomText
                        style={tw`text-[16px] text-gray-800 mr-2`}
                        weight="Bold"
                      >
                        Reported Sighting
                      </CustomText>
                      <View style={tw`px-2 py-0.5 rounded-full bg-green-100`}>
                        <CustomText
                          style={tw`text-[10px] text-green-700`}
                          weight="Medium"
                        >
                          {sighting.confidence}
                        </CustomText>
                      </View>
                    </View>
                    <CustomText style={tw`text-[12px] text-gray-500`}>
                      {sighting.timestamp}
                    </CustomText>
                  </View>
                </View>

                {sighting.imageUrls && sighting.imageUrls.length > 0 && (
                  <View style={tw`mb-3`}>
                    <Image
                      source={{ uri: sighting.imageUrls[0] }}
                      style={tw`w-full h-32 rounded-lg`}
                      resizeMode="cover"
                    />
                  </View>
                )}

                <View style={tw`p-3 bg-gray-50 rounded-lg mb-3`}>
                  <CustomText style={tw`text-[13px] text-gray-700`}>
                    {sighting.description}
                  </CustomText>
                </View>

                <View style={tw`flex-row items-center justify-between`}>
                  <View style={tw`flex-row items-center`}>
                    <Feather
                      name="user"
                      size={14}
                      color="#6B7280"
                      style={tw`mr-1`}
                    />
                    <CustomText style={tw`text-[12px] text-gray-600`}>
                      Reported by {sighting.reportedByName || "Anonymous"}
                    </CustomText>
                  </View>
                  <TouchableOpacity>
                    <CustomText
                      style={tw`text-[12px] text-blue-600`}
                      weight="Medium"
                    >
                      View on Map
                    </CustomText>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View
            style={tw`bg-white p-5 rounded-xl items-center justify-center shadow-sm border border-gray-100`}
          >
            <Feather name="eye-off" size={32} color="#9CA3AF" />
            <CustomText style={tw`text-gray-600 mt-4 text-center`}>
              No recent sightings reported. Tap "Report Sighting" if you've seen
              this pet.
            </CustomText>
          </View>
        )}
      </View>
    );
  };

  const renderSearchHistory = () => {
    return (
      <View style={tw`mb-4`}>
        <CustomText style={tw`text-[18px] text-gray-800 mb-3`} weight="Bold">
          Search History
        </CustomText>

        {searchHistory.length > 0 ? (
          <View
            style={tw`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden`}
          >
            {searchHistory.map((search, index) => (
              <View
                key={search.id}
                style={tw`p-4 ${
                  index < searchHistory.length - 1
                    ? "border-b border-gray-100"
                    : ""
                }`}
              >
                <View style={tw`flex-row items-center justify-between mb-2`}>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Medium"
                  >
                    Search on {search.date}
                  </CustomText>
                  <View style={tw`px-2 py-0.5 rounded-full bg-blue-100`}>
                    <CustomText
                      style={tw`text-[10px] text-blue-700`}
                      weight="Medium"
                    >
                      {search.areas} Areas
                    </CustomText>
                  </View>
                </View>
                <View style={tw`flex-row items-center justify-between`}>
                  <View style={tw`flex-row items-center`}>
                    <Feather
                      name="clock"
                      size={14}
                      color="#6B7280"
                      style={tw`mr-1`}
                    />
                    <CustomText style={tw`text-[13px] text-gray-600`}>
                      Duration: {search.duration}
                    </CustomText>
                  </View>
                  <View style={tw`flex-row items-center`}>
                    <Feather
                      name="users"
                      size={14}
                      color="#6B7280"
                      style={tw`mr-1`}
                    />
                    <CustomText style={tw`text-[13px] text-gray-600`}>
                      {search.participants}{" "}
                      {search.participants === 1 ? "Person" : "People"}
                    </CustomText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View
            style={tw`bg-white p-5 rounded-xl items-center justify-center shadow-sm border border-gray-100`}
          >
            <Feather name="clock" size={32} color="#9CA3AF" />
            <CustomText style={tw`text-gray-600 mt-4 text-center`}>
              No search history available yet.
            </CustomText>
          </View>
        )}
      </View>
    );
  };

  const renderSearchTips = () => {
    if (!showTips) return null;

    return (
      <View style={tw`mb-4 bg-blue-50 p-5 rounded-xl border border-blue-200`}>
        <View style={tw`flex-row justify-between items-center mb-3`}>
          <View style={tw`flex-row items-center`}>
            <View
              style={tw`w-10 h-10 rounded-lg bg-blue-500 items-center justify-center mr-3`}
            >
              <Feather name="info" size={20} color="white" />
            </View>
            <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
              AI Search Tips
            </CustomText>
          </View>
          <TouchableOpacity onPress={() => setShowTips(false)}>
            <Feather name="x" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <View style={tw`mb-3`}>
          {searchTips && searchTips.length > 0 ? (
            searchTips.map((tip, index) => (
              <View key={index} style={tw`flex-row items-start mb-2`}>
                <View
                  style={tw`w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-2 mt-0.5`}
                >
                  <CustomText style={tw`text-blue-700`} weight="Bold">
                    {index + 1}
                  </CustomText>
                </View>
                <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                  {tip}
                </CustomText>
              </View>
            ))
          ) : (
            <>
              <View style={tw`flex-row items-start mb-2`}>
                <View
                  style={tw`w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-2 mt-0.5`}
                >
                  <CustomText style={tw`text-blue-700`} weight="Bold">
                    1
                  </CustomText>
                </View>
                <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                  Focus on high-probability areas (red circles) first
                </CustomText>
              </View>
              <View style={tw`flex-row items-start mb-2`}>
                <View
                  style={tw`w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-2 mt-0.5`}
                >
                  <CustomText style={tw`text-blue-700`} weight="Bold">
                    2
                  </CustomText>
                </View>
                <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                  Search during dawn and dusk when pets are most active
                </CustomText>
              </View>
              <View style={tw`flex-row items-start mb-2`}>
                <View
                  style={tw`w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-2 mt-0.5`}
                >
                  <CustomText style={tw`text-blue-700`} weight="Bold">
                    3
                  </CustomText>
                </View>
                <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                  Bring familiar items with the pet's scent to attract them
                </CustomText>
              </View>
              <View style={tw`flex-row items-start`}>
                <View
                  style={tw`w-6 h-6 rounded-full bg-blue-100 items-center justify-center mr-2 mt-0.5`}
                >
                  <CustomText style={tw`text-blue-700`} weight="Bold">
                    4
                  </CustomText>
                </View>
                <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                  Create a search party to cover more ground efficiently
                </CustomText>
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "map":
        return (
          <View style={tw`flex-1`}>
            <View style={tw`h-[300px] w-full rounded-xl overflow-hidden mb-4`}>
              <MapView
                provider={PROVIDER_GOOGLE}
                ref={mapRef}
                style={tw`flex-1`}
                initialRegion={mapRegion}
                showsUserLocation={true}
                showsCompass={true}
                showsScale={true}
              >
                {/* Last known location marker */}
                {pet?.location && (
                  <Marker
                    coordinate={{
                      latitude: pet.location.latitude,
                      longitude: pet.location.longitude,
                    }}
                    title="Last Known Location"
                    description={`${
                      pet.petName || pet.petType
                    } was last seen here`}
                  >
                    <View style={tw`items-center`}>
                      <View
                        style={tw`w-8 h-8 rounded-full bg-white items-center justify-center shadow-md`}
                      >
                        <Feather name="map-pin" size={20} color="#EF4444" />
                      </View>
                    </View>
                  </Marker>
                )}

                {/* Search area circles */}
                {searchAreas.map((area) => (
                  <Circle
                    key={area.id}
                    center={area.center}
                    radius={area.radius}
                    strokeWidth={2}
                    strokeColor={area.color}
                    fillColor={`${area.color}20`}
                    onPress={() => handleAreaPress(area)}
                  />
                ))}

                {/* Recent sightings markers */}
                {recentSightings.map((sighting) => (
                  <Marker
                    key={sighting.id}
                    coordinate={sighting.location}
                    title="Reported Sighting"
                    description={sighting.description}
                    pinColor={
                      sighting.confidence.toLowerCase() === "high"
                        ? "green"
                        : sighting.confidence.toLowerCase() === "medium"
                        ? "orange"
                        : "blue"
                    }
                  >
                    <View style={tw`items-center`}>
                      <View
                        style={tw`w-8 h-8 rounded-full bg-white items-center justify-center shadow-md`}
                      >
                        <Feather
                          name="eye"
                          size={20}
                          color={
                            sighting.confidence.toLowerCase() === "high"
                              ? "#10B981"
                              : sighting.confidence.toLowerCase() === "medium"
                              ? "#F59E0B"
                              : "#3B82F6"
                          }
                        />
                      </View>
                    </View>
                  </Marker>
                ))}
              </MapView>

              {/* Map Controls */}
              <View style={tw`absolute bottom-4 right-4 flex-col`}>
                <TouchableOpacity
                  style={tw`w-10 h-10 rounded-full bg-white shadow-md items-center justify-center mb-2`}
                  onPress={() => {
                    if (mapRef.current) {
                      mapRef.current.animateToRegion(mapRegion, 1000);
                    }
                  }}
                >
                  <Feather name="home" size={20} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`w-10 h-10 rounded-full bg-white shadow-md items-center justify-center`}
                  onPress={() => {
                    if (mapRef.current) {
                      mapRef.current.getCamera().then((camera) => {
                        mapRef.current.animateCamera({
                          center: camera.center,
                          zoom: camera.zoom + 1,
                        });
                      });
                    }
                  }}
                >
                  <Feather name="plus" size={20} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={tw`w-10 h-10 rounded-full bg-white shadow-md items-center justify-center mt-2`}
                  onPress={() => {
                    if (mapRef.current) {
                      mapRef.current.getCamera().then((camera) => {
                        mapRef.current.animateCamera({
                          center: camera.center,
                          zoom: camera.zoom - 1,
                        });
                      });
                    }
                  }}
                >
                  <Feather name="minus" size={20} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </View>

            {renderSearchTips()}
            {renderSearchAreas()}
            {renderRecentSightings()}
          </View>
        );
      case "analysis":
        return (
          <View style={tw`flex-1`}>
            {renderBehaviorAnalysis()}
            {renderWeatherImpact()}

            <View
              style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
            >
              <View style={tw`flex-row items-center mb-3`}>
                <View
                  style={tw`w-10 h-10 rounded-lg bg-orange-100 items-center justify-center mr-3`}
                >
                  <Feather name="target" size={20} color="#F59E0B" />
                </View>
                <View>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Bold"
                  >
                    Search Probability
                  </CustomText>
                  <CustomText style={tw`text-[12px] text-gray-500`}>
                    Based on provided information
                  </CustomText>
                </View>
              </View>

              <View style={tw`mb-3`}>
                <View style={tw`flex-row justify-between mb-1`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700`}
                    weight="Medium"
                  >
                    Overall Search Accuracy
                  </CustomText>
                  <CustomText
                    style={tw`text-[14px] text-blue-600`}
                    weight="Medium"
                  >
                    {searchProbability}%
                  </CustomText>
                </View>
                <View
                  style={tw`w-full h-2.5 bg-gray-200 rounded-full overflow-hidden`}
                >
                  <View
                    style={[
                      tw`h-2.5 rounded-full`,
                      {
                        width: `${searchProbability}%`,
                        backgroundColor:
                          searchProbability > 90
                            ? "#10B981"
                            : searchProbability > 80
                            ? "#3B82F6"
                            : "#F59E0B",
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={tw`p-3 bg-blue-50 rounded-lg`}>
                <View style={tw`flex-row items-start`}>
                  <Feather
                    name="info"
                    size={16}
                    color="#3B82F6"
                    style={tw`mr-2 mt-0.5`}
                  />
                  <CustomText style={tw`text-[13px] text-gray-700 flex-1`}>
                    This probability score is calculated based on the pet's
                    behavioral traits, environmental factors, and the quality of
                    information provided in the report.
                    {recentSightings.length > 0
                      ? " Recent sightings have increased the search accuracy."
                      : ""}
                  </CustomText>
                </View>
              </View>
            </View>

            {behaviorPrediction && (
              <View
                style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
              >
                <View style={tw`flex-row items-center mb-3`}>
                  <View
                    style={tw`w-10 h-10 rounded-lg bg-blue-100 items-center justify-center mr-3`}
                  >
                    <Feather name="cpu" size={20} color="#3B82F6" />
                  </View>
                  <View>
                    <CustomText
                      style={tw`text-[16px] text-gray-800`}
                      weight="Bold"
                    >
                      AI Behavior Prediction
                    </CustomText>
                    <CustomText style={tw`text-[12px] text-gray-500`}>
                      Generated from behavioral analysis
                    </CustomText>
                  </View>
                </View>

                <View style={tw`p-3 bg-blue-50 rounded-lg`}>
                  <CustomText style={tw`text-[13px] text-gray-700`}>
                    {behaviorPrediction}
                  </CustomText>
                </View>
              </View>
            )}
          </View>
        );
      case "search":
        return (
          <View style={tw`flex-1`}>
            <View
              style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
            >
              <View style={tw`flex-row items-center mb-4`}>
                <View
                  style={tw`w-12 h-12 rounded-xl bg-orange-500 items-center justify-center mr-3`}
                >
                  <Feather name="users" size={22} color="white" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText
                    style={tw`text-[18px] text-gray-800`}
                    weight="Bold"
                  >
                    Create Search Party
                  </CustomText>
                  <CustomText style={tw`text-[14px] text-gray-500`}>
                    Coordinate with others to find {pet?.petName || "your pet"}
                  </CustomText>
                </View>
              </View>

              <CustomText style={tw`text-[14px] text-gray-700 mb-4`}>
                Create a search party to coordinate with friends, family, and
                volunteers. Our AI will assign search areas based on pet
                behavior patterns.
              </CustomText>

              <TouchableOpacity
                style={tw`bg-orange-500 py-3 rounded-xl items-center flex-row justify-center`}
                onPress={startSearchParty}
              >
                <CustomText
                  style={tw`text-white text-[15px] mr-2`}
                  weight="SemiBold"
                >
                  Start Search Party
                </CustomText>
                <Feather name="users" size={16} color="white" />
              </TouchableOpacity>
            </View>

            <View
              style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100`}
            >
              <View style={tw`flex-row items-center mb-4`}>
                <View
                  style={tw`w-12 h-12 rounded-xl bg-green-500 items-center justify-center mr-3`}
                >
                  <Feather name="eye" size={22} color="white" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText
                    style={tw`text-[18px] text-gray-800`}
                    weight="Bold"
                  >
                    Report a Sighting
                  </CustomText>
                  <CustomText style={tw`text-[14px] text-gray-500`}>
                    Seen this pet? Let the owner know
                  </CustomText>
                </View>
              </View>

              <CustomText style={tw`text-[14px] text-gray-700 mb-4`}>
                If you've spotted a pet matching this description, report the
                sighting to help the owner in their search.
              </CustomText>

              <TouchableOpacity
                style={tw`bg-green-500 py-3 rounded-xl items-center flex-row justify-center`}
                onPress={reportSighting}
              >
                <CustomText
                  style={tw`text-white text-[15px] mr-2`}
                  weight="SemiBold"
                >
                  Report Sighting
                </CustomText>
                <Feather name="eye" size={16} color="white" />
              </TouchableOpacity>
            </View>

            {renderSearchHistory()}

            <TouchableOpacity
              style={tw`mb-4 bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex-row items-center`}
              onPress={() =>
                navigation.navigate("Chat", {
                  chatId: "rescue-coordination",
                  chatName: "Rescue Coordination",
                  petId: pet?.id,
                })
              }
            >
              <View
                style={tw`w-12 h-12 rounded-xl bg-blue-100 items-center justify-center mr-3`}
              >
                <Feather name="message-circle" size={22} color="#3B82F6" />
              </View>
              <View style={tw`flex-1`}>
                <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                  Rescue Coordination Chat
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500`}>
                  Communicate with search volunteers
                </CustomText>
              </View>
              <Feather name="chevron-right" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={tw`flex-1 bg-gray-50`}>
      {/* Header */}
      <View
        style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between bg-white shadow-sm`}
      >
        <TouchableOpacity style={tw`mr-4`} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <CustomText
          style={tw`text-[18px] text-gray-800 flex-1 text-center`}
          weight="Bold"
        >
          AI Search Map
        </CustomText>
        <TouchableOpacity
          onPress={() => navigation.navigate("PetDetails", { pet })}
        >
          <Feather name="info" size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Pet Info Bar */}
      {pet && (
        <View style={tw`px-6 py-3 bg-white border-t border-gray-100 shadow-sm`}>
          <View style={tw`flex-row items-center`}>
            {pet.imageUrls && pet.imageUrls.length > 0 ? (
              <Image
                source={{ uri: pet.imageUrls[0] }}
                style={tw`w-10 h-10 rounded-lg mr-3 bg-gray-200`}
                resizeMode="cover"
              />
            ) : pet.image ? (
              <Image
                source={pet.image}
                style={tw`w-10 h-10 rounded-lg mr-3 bg-gray-200`}
                resizeMode="cover"
              />
            ) : (
              <View
                style={tw`w-10 h-10 rounded-lg mr-3 bg-gray-200 items-center justify-center`}
              >
                <Feather name="image" size={16} color="#9CA3AF" />
              </View>
            )}
            <View style={tw`flex-1`}>
              <View style={tw`flex-row items-center`}>
                <CustomText
                  style={tw`text-[16px] text-gray-800 mr-2`}
                  weight="Bold"
                >
                  {pet.petName || pet.petType || "Unknown Pet"}
                </CustomText>
                <View style={tw`px-2 py-0.5 rounded-full bg-red-100`}>
                  <CustomText
                    style={tw`text-[10px] text-red-700`}
                    weight="Medium"
                  >
                    LOST
                  </CustomText>
                </View>
              </View>
              <CustomText style={tw`text-[12px] text-gray-500`}>
                {pet.petBreed || "Unknown Breed"} • Last seen{" "}
                {pet.dateTime || "Unknown Time"}
              </CustomText>
            </View>
          </View>
        </View>
      )}

      {/* Tab Navigation */}
      <View style={tw`flex-row bg-white border-t border-b border-gray-200`}>
        <TouchableOpacity
          style={tw`flex-1 py-3 items-center ${
            activeTab === "map" ? "border-b-2 border-blue-500" : ""
          }`}
          onPress={() => setActiveTab("map")}
        >
          <CustomText
            style={tw`text-[14px] ${
              activeTab === "map" ? "text-blue-600" : "text-gray-600"
            }`}
            weight={activeTab === "map" ? "SemiBold" : "Medium"}
          >
            Map
          </CustomText>
        </TouchableOpacity>
        <TouchableOpacity
          style={tw`flex-1 py-3 items-center ${
            activeTab === "analysis" ? "border-b-2 border-blue-500" : ""
          }`}
          onPress={() => setActiveTab("analysis")}
        >
          <CustomText
            style={tw`text-[14px] ${
              activeTab === "analysis" ? "text-blue-600" : "text-gray-600"
            }`}
            weight={activeTab === "analysis" ? "SemiBold" : "Medium"}
          >
            Analysis
          </CustomText>
        </TouchableOpacity>
        <TouchableOpacity
          style={tw`flex-1 py-3 items-center ${
            activeTab === "search" ? "border-b-2 border-blue-500" : ""
          }`}
          onPress={() => setActiveTab("search")}
        >
          <CustomText
            style={tw`text-[14px] ${
              activeTab === "search" ? "text-blue-600" : "text-gray-600"
            }`}
            weight={activeTab === "search" ? "SemiBold" : "Medium"}
          >
            Search
          </CustomText>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`px-6 py-4 pb-20`}
      >
        <Animated.View
          style={[
            tw`flex-1`,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {renderTabContent()}
        </Animated.View>
      </ScrollView>

      {/* Area Details Modal */}
      <Modal
        visible={showAreaDetails}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAreaDetails(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <View style={tw`flex-row items-center`}>
                <View
                  style={[
                    tw`w-10 h-10 rounded-lg items-center justify-center mr-3`,
                    {
                      backgroundColor: selectedArea
                        ? `${selectedArea.color}20`
                        : "#E5E7EB",
                    },
                  ]}
                >
                  <Feather
                    name="map-pin"
                    size={20}
                    color={selectedArea ? selectedArea.color : "#9CA3AF"}
                  />
                </View>
                <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                  Search Area {selectedArea ? selectedArea.id.slice(-1) : ""}
                </CustomText>
              </View>
              <TouchableOpacity onPress={() => setShowAreaDetails(false)}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedArea && (
              <View>
                <View style={tw`mb-4`}>
                  <CustomText
                    style={tw`text-[16px] text-gray-700`}
                    weight="Medium"
                  >
                    Probability: {selectedArea.probability}%
                  </CustomText>
                  <CustomText style={tw`text-[16px] text-gray-700`}>
                    Radius: {(selectedArea.radius / 1000).toFixed(1)} km
                  </CustomText>
                  <CustomText style={tw`text-[16px] text-gray-700`}>
                    Description: {selectedArea.description}
                  </CustomText>
                </View>

                <View style={tw`p-3 bg-blue-50 rounded-lg`}>
                  <View style={tw`flex-row items-start`}>
                    <Feather
                      name="info"
                      size={16}
                      color="#3B82F6"
                      style={tw`mr-2 mt-0.5`}
                    />
                    <CustomText style={tw`text-[13px] text-gray-700 flex-1`}>
                      {selectedArea.tips}
                    </CustomText>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Weather Impact Modal */}
      <Modal
        visible={showWeatherModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowWeatherModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-center items-center`}>
          <View style={tw`bg-white rounded-xl p-6 w-[90%]`}>
            <CustomText
              style={tw`text-[20px] text-gray-800 mb-4`}
              weight="Bold"
            >
              Weather Impact Analysis
            </CustomText>
            <CustomText style={tw`text-[14px] text-gray-700 mb-4`}>
              Understanding how weather conditions affect pet behavior can
              significantly improve search strategies.
            </CustomText>

            {pet?.weatherCondition &&
            weatherConditions[pet.weatherCondition] ? (
              <View>
                <CustomText
                  style={tw`text-[16px] text-gray-800 mb-2`}
                  weight="Medium"
                >
                  {weatherConditions[pet.weatherCondition].name} Conditions
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-700 mb-2`}>
                  {weatherConditions[pet.weatherCondition].affects}
                </CustomText>
                <CustomText
                  style={tw`text-[14px] text-gray-700 mb-4`}
                  weight="Medium"
                >
                  Search Tips:
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-700`}>
                  {weatherConditions[pet.weatherCondition].searchTips}
                </CustomText>
              </View>
            ) : (
              <CustomText style={tw`text-[14px] text-gray-700`}>
                No specific weather condition provided. General search tips
                apply.
              </CustomText>
            )}

            <TouchableOpacity
              style={tw`bg-blue-500 py-2 rounded-xl items-center mt-4`}
              onPress={() => setShowWeatherModal(false)}
            >
              <CustomText style={tw`text-white text-[15px]`} weight="SemiBold">
                Close
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Behavior Analysis Modal */}
      <Modal
        visible={showBehaviorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBehaviorModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-center items-center`}>
          <View style={tw`bg-white rounded-xl p-6 w-[90%]`}>
            <CustomText
              style={tw`text-[20px] text-gray-800 mb-4`}
              weight="Bold"
            >
              AI Behavioral Analysis
            </CustomText>
            <CustomText style={tw`text-[14px] text-gray-700 mb-4`}>
              Our AI has analyzed your pet's behavior patterns to help predict
              their movements.
            </CustomText>

            {behaviorPrediction ? (
              <View>
                <CustomText
                  style={tw`text-[16px] text-gray-800 mb-2`}
                  weight="Medium"
                >
                  Behavior Prediction
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-700 mb-4`}>
                  {behaviorPrediction}
                </CustomText>

                <CustomText
                  style={tw`text-[16px] text-gray-800 mb-2`}
                  weight="Medium"
                >
                  AI-Generated Search Tips
                </CustomText>
                {searchTips && searchTips.length > 0 ? (
                  searchTips.map((tip, index) => (
                    <View key={index} style={tw`flex-row items-start mb-2`}>
                      <View
                        style={tw`w-5 h-5 rounded-full bg-blue-100 items-center justify-center mr-2 mt-0.5`}
                      >
                        <CustomText
                          style={tw`text-blue-700 text-[12px]`}
                          weight="Bold"
                        >
                          {index + 1}
                        </CustomText>
                      </View>
                      <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                        {tip}
                      </CustomText>
                    </View>
                  ))
                ) : (
                  <CustomText style={tw`text-[14px] text-gray-700`}>
                    No specific search tips available.
                  </CustomText>
                )}
              </View>
            ) : (
              <CustomText style={tw`text-[14px] text-gray-700`}>
                AI analysis is still in progress. Please check back in a moment.
              </CustomText>
            )}

            <TouchableOpacity
              style={tw`bg-blue-500 py-2 rounded-xl items-center mt-4`}
              onPress={() => setShowBehaviorModal(false)}
            >
              <CustomText style={tw`text-white text-[15px]`} weight="SemiBold">
                Close
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Search Party Modal */}
      <Modal
        visible={showSearchPartyModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSearchPartyModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-center items-center`}>
          <View style={tw`bg-white rounded-xl p-6 w-[90%]`}>
            <CustomText
              style={tw`text-[20px] text-gray-800 mb-4`}
              weight="Bold"
            >
              Create Search Party
            </CustomText>
            <CustomText style={tw`text-[14px] text-gray-700 mb-4`}>
              Coordinate with others to find {pet?.petName || "your pet"}.
            </CustomText>

            <View style={tw`mb-4`}>
              <CustomText
                style={tw`text-[16px] text-gray-800 mb-2`}
                weight="Medium"
              >
                Search Party Details
              </CustomText>
              <CustomText style={tw`text-[14px] text-gray-700 mb-1`}>
                Pet: {pet?.petName || pet?.petType || "Unknown"}
              </CustomText>
              <CustomText style={tw`text-[14px] text-gray-700 mb-1`}>
                Search Areas: {searchAreas.length}
              </CustomText>
            </View>

            <TouchableOpacity
              style={tw`bg-orange-500 py-2 rounded-xl items-center mt-4`}
              onPress={createSearchParty}
            >
              <CustomText style={tw`text-white text-[15px]`} weight="SemiBold">
                Create Search Party
              </CustomText>
            </TouchableOpacity>

            <TouchableOpacity
              style={tw`bg-gray-300 py-2 rounded-xl items-center mt-4`}
              onPress={() => setShowSearchPartyModal(false)}
            >
              <CustomText
                style={tw`text-gray-700 text-[15px]`}
                weight="SemiBold"
              >
                Cancel
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default AISearchMapScreen;