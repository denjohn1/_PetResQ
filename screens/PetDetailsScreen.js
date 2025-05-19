"use client";

import { useEffect, useRef, useState } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Alert,
  Modal,
  Share,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import tw from "twrnc";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import CustomText from "../components/CustomText";
import CustomTextInput from "../components/CustomTextInput";
import { auth, db } from "../firebaseConfig";
import {
  doc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  onSnapshot,
  addDoc,
  deleteDoc,
  orderBy,
  getDoc,
  where,
  getDocs,
} from "firebase/firestore";

const { width } = Dimensions.get("window");

const PetDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { pet } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [showCommunitySearchModal, setShowCommunitySearchModal] =
    useState(false);
  const [potentialMatches, setPotentialMatches] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [reportStatus, setReportStatus] = useState("");
  const [rewardAmount, setRewardAmount] = useState("");
  const [isContactPrivate, setIsContactPrivate] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showMessageRequestModal, setShowMessageRequestModal] = useState(false);
  const [messageRequests, setMessageRequests] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [sightings, setSightings] = useState([]);
  const [showSightingsModal, setShowSightingsModal] = useState(false);
  const [loadingSightings, setLoadingSightings] = useState(false);
  const [communitySearchDetails, setCommunitySearchDetails] = useState("");
  const [communitySearchRadius, setCommunitySearchRadius] = useState("1");
  const [communitySearchLoading, setCommunitySearchLoading] = useState(false);
  const [communitySearches, setCommunitySearches] = useState([]);
  const [loadingCommunitySearches, setLoadingCommunitySearches] =
    useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const fetchSightings = async () => {
    if (!pet?.id) return;

    try {
      setLoadingSightings(true);
      const sightingsQuery = query(
        collection(db, "sightings"),
        where("petId", "==", pet.id),
        orderBy("createdAt", "desc")
      );

      const sightingsSnapshot = await getDocs(sightingsQuery);
      const sightingsData = sightingsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      }));

      setSightings(sightingsData);
    } catch (error) {
      console.error("Error fetching sightings:", error);
      Alert.alert("Error", "Failed to load sighting reports");
    } finally {
      setLoadingSightings(false);
    }
  };

  const fetchCommunitySearches = () => {
    if (!pet?.id) return;

    try {
      setLoadingCommunitySearches(true);
      const searchesQuery = query(
        collection(db, "communitySearches"),
        where("petId", "==", pet.id),
        where("status", "==", "active"),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(searchesQuery, (snapshot) => {
        const searchesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }));
        setCommunitySearches(searchesData);
        setLoadingCommunitySearches(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error fetching community searches:", error);
      Alert.alert("Error", "Failed to load community searches");
      setLoadingCommunitySearches(false);
    }
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

    checkIfOwner();
    if (pet?.status === "found") {
      fetchPotentialMatches();
    }
    if (pet?.id && pet?.status === "lost") {
      fetchSightings();
      fetchCommunitySearches();
    }

    if (auth.currentUser && pet?.userId === auth.currentUser.uid) {
      fetchPendingRequests();
    }

    if (route.params?.openChatModal) {
      setShowChatModal(true);
    }

    return () => {
      // Cleanup Firestore listeners handled by onSnapshot
    };
  }, [pet]);

  useEffect(() => {
    let unsubscribe = null;

    if (showChatModal) {
      unsubscribe = fetchMessages();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [showChatModal]);

  const checkIfOwner = () => {
    if (auth.currentUser && pet?.userId === auth.currentUser.uid) {
      setIsOwner(true);
      setReportStatus(pet?.status || "");
      setRewardAmount(pet?.rewardAmount || "");
      setIsContactPrivate(pet?.isContactPrivate || false);
    }
  };

  const fetchPotentialMatches = async () => {
    try {
      setLoading(true);
      const mockMatches = [
        {
          id: "match1",
          petName: "Max",
          petType: pet?.petType || "Dog",
          petBreed: "Golden Retriever",
          lastSeen: "2 days ago",
          distance: "0.8 miles away",
          matchProbability: 87,
          image: null,
        },
        {
          id: "match2",
          petName: "Buddy",
          petType: pet?.petType || "Dog",
          petBreed: "Labrador Mix",
          lastSeen: "1 day ago",
          distance: "1.2 miles away",
          matchProbability: 72,
          image: null,
        },
      ];
      setPotentialMatches(mockMatches);
    } catch (error) {
      console.error("Error fetching potential matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = () => {
    if (!auth.currentUser || !pet?.id) return;

    const requestsQuery = query(
      collection(db, "requestmessage"),
      where("petId", "==", pet.id),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      requestsQuery,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPendingRequests(requests);
      },
      (error) => {
        console.error("Error fetching pending requests:", error);
        Alert.alert("Error", "Failed to load message requests.");
      }
    );

    return unsubscribe;
  };

  const handleShareReport = async () => {
    try {
      const message = `${pet?.status === "lost" ? "LOST PET" : "FOUND PET"}: ${
        pet?.petType
      } (${pet?.petBreed || "Unknown breed"})\n${
        pet?.petName ? `Name: ${pet?.petName}\n` : ""
      }Last ${pet?.status === "lost" ? "seen" : "found"}: ${
        pet?.dateTime || "Unknown"
      }\nPlease contact if you have any information.`;

      await Share.share({
        message,
        title: `${pet?.status === "lost" ? "Lost" : "Found"} ${pet?.petType}`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  const handleContact = () => {
    if (pet?.isContactPrivate) {
      setShowMessageRequestModal(true);
    } else {
      setShowContactModal(true);
    }
  };

  const handleCall = () => {
    if (pet?.contactPhone) {
      Linking.openURL(`tel:${pet.contactPhone}`);
      setShowContactModal(false);
    }
  };

  const handleEmail = () => {
    if (pet?.contactEmail) {
      Linking.openURL(`mailto:${pet.contactEmail}`);
      setShowContactModal(false);
    }
  };

  const handleReportSighting = () => {
    navigation.navigate("ReportSighting", { pet });
  };

  const handleViewOnMap = () => {
    navigation.navigate("AISearchMap", { pet });
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      if (!auth.currentUser || !pet?.id) {
        Alert.alert("Error", "You must be signed in to update the status");
        return;
      }

      setLoading(true);
      await updateDoc(doc(db, "petReports", pet.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      setReportStatus(newStatus);
      Alert.alert("Success", `Pet status updated to ${newStatus}`);
      setShowReportModal(false);
    } catch (error) {
      console.error("Error updating status:", error);
      Alert.alert("Error", "Failed to update status. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckMatch = (matchPet) => {
    navigation.navigate("MatchDetails", { foundPet: pet, lostPet: matchPet });
  };

  const handleImageScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentImageIndex(currentIndex);
  };

  const handleSaveEdit = async () => {
    try {
      if (!auth.currentUser || !pet?.id) {
        Alert.alert("Error", "You must be signed in to update the information");
        return;
      }

      setLoading(true);
      await updateDoc(doc(db, "petReports", pet.id), {
        rewardAmount: rewardAmount || null,
        isContactPrivate: isContactPrivate,
        updatedAt: serverTimestamp(),
      });

      Alert.alert("Success", "Pet information updated successfully");
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating information:", error);
      Alert.alert("Error", "Failed to update information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCommunitySearch = async () => {
    try {
      if (!auth.currentUser || !pet?.id) {
        Alert.alert(
          "Error",
          "You must be signed in to create a community search"
        );
        return;
      }

      if (!communitySearchDetails.trim()) {
        Alert.alert("Error", "Please enter search details");
        return;
      }

      if (!pet.location) {
        Alert.alert("Error", "Pet location is required for community search");
        return;
      }

      const radius = parseFloat(communitySearchRadius);
      if (isNaN(radius) || radius <= 0) {
        Alert.alert("Error", "Please enter a valid radius greater than 0");
        return;
      }

      setCommunitySearchLoading(true);

      await addDoc(collection(db, "communitySearches"), {
        petId: pet.id,
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || "Anonymous",
        petName: pet.petName || "Unnamed Pet",
        petType: pet.petType || "Unknown",
        petBreed: pet.petBreed || "Unknown",
        details: communitySearchDetails,
        radius: radius,
        location: pet.location,
        createdAt: serverTimestamp(),
        status: "active",
      });

      Alert.alert("Success", "Community search created successfully");
      setShowCommunitySearchModal(false);
      setCommunitySearchDetails("");
      setCommunitySearchRadius("1");
    } catch (error) {
      console.error("Error creating community search:", error);
      Alert.alert(
        "Error",
        "Failed to create community search. Please try again."
      );
    } finally {
      setCommunitySearchLoading(false);
    }
  };

  const handleSendMessageRequest = async () => {
    try {
      if (!auth.currentUser) {
        Alert.alert("Error", "You must be signed in to send a message request");
        return;
      }

      if (!requestMessage.trim()) {
        Alert.alert("Error", "Please enter a message");
        return;
      }

      setLoading(true);
      await addDoc(collection(db, "requestmessage"), {
        petId: pet.id,
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || "Anonymous",
        message: requestMessage,
        timestamp: serverTimestamp(),
        avatar: auth.currentUser.photoURL || null,
        status: "pending",
      });

      setRequestSent(true);
      setLoading(false);

      setTimeout(() => {
        setShowMessageRequestModal(false);
        setRequestMessage("");
        Alert.alert(
          "Success",
          "Message request sent! You'll be notified when the owner responds."
        );
      }, 1500);
    } catch (error) {
      console.error("Error sending message request:", error);
      Alert.alert("Error", "Failed to send message request. Please try again.");
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const newMessageObj = {
        id: Date.now().toString(),
        text: newMessage,
        sender: auth.currentUser?.uid,
        timestamp: new Date().toISOString(),
        isOwner: isOwner,
      };

      await addDoc(collection(db, "messages"), {
        ...newMessageObj,
        petId: pet.id,
        createdAt: serverTimestamp(),
      });

      setMessages([...messages, newMessageObj]);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", "Failed to send message. Please try again.");
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      if (!auth.currentUser || !pet?.id) {
        Alert.alert("Error", "Authentication required");
        return;
      }

      setLoading(true);

      const requestRef = doc(db, "requestmessage", requestId);
      const requestSnap = await getDoc(requestRef);

      if (!requestSnap.exists()) {
        Alert.alert("Error", "Request not found");
        setLoading(false);
        return;
      }

      const requestData = requestSnap.data();
      const requesterUserId = requestData.userId;

      await updateDoc(requestRef, {
        status: "approved",
        updatedAt: serverTimestamp(),
      });

      const chatRef = await addDoc(collection(db, "chats"), {
        participants: [auth.currentUser.uid, requesterUserId],
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastMessage: "Chat started",
        petId: pet.id,
        name: `Chat about ${pet.petName || "Pet"}`,
        type: "pet_inquiry",
      });

      await addDoc(collection(db, "messages"), {
        petId: pet.id,
        text: "Chat started. You can now communicate with each other.",
        sender: "system",
        createdAt: serverTimestamp(),
        isSystem: true,
      });

      setLoading(false);
      Alert.alert("Request Approved", "You can now chat with this user");

      setTimeout(() => {
        setShowRequestsModal(false);
        setShowChatModal(true);
      }, 500);
    } catch (error) {
      console.error("Error approving request:", error);
      Alert.alert("Error", "Failed to approve request. Please try again.");
      setLoading(false);
    }
  };

  const handleDenyRequest = async (requestId) => {
    try {
      await deleteDoc(doc(db, "requestmessage", requestId));
      Alert.alert(
        "Request Denied",
        "This user will not be able to contact you"
      );
    } catch (error) {
      console.error("Error denying request:", error);
      Alert.alert("Error", "Failed to deny request. Please try again.");
    }
  };

  const fetchMessages = async () => {
    if (!auth.currentUser || !pet?.id) return;

    try {
      const messagesQuery = query(
        collection(db, "messages"),
        where("petId", "==", pet.id),
        orderBy("createdAt", "asc")
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messageData = snapshot.docs.map((doc) => ({
          id: doc.id,
          text: doc.data().text,
          sender: doc.data().sender,
          timestamp: doc.data().createdAt?.toDate?.() || new Date(),
          isOwner: doc.data().sender === pet.userId,
        }));

        setMessages(messageData);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Error fetching messages:", error);
      return null;
    }
  };

  if (!pet) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-white`}>
        <Feather name="alert-circle" size={48} color="#9CA3AF" />
        <CustomText style={tw`text-gray-600 mt-4 text-center px-6`}>
          Pet information not available. Please go back and try again.
        </CustomText>
        <TouchableOpacity
          style={tw`mt-6 bg-blue-500 px-6 py-3 rounded-xl`}
          onPress={() => navigation.goBack()}
        >
          <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
            Go Back
          </CustomText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={tw`flex-1 bg-gray-50`}>
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
          Pet Details
        </CustomText>
        <TouchableOpacity onPress={handleShareReport}>
          <Feather name="share-2" size={20} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={tw`pb-20`}
      >
        <Animated.View
          style={[
            tw`flex-1`,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={tw`bg-white`}>
            {pet.imageUrls && pet.imageUrls.length > 0 ? (
              <View>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={tw`w-full h-72`}
                  onScroll={handleImageScroll}
                  scrollEventThrottle={16}
                >
                  {pet.imageUrls.map((imageUrl, index) => (
                    <View key={index} style={{ width, height: 288 }}>
                      <Image
                        source={{ uri: imageUrl }}
                        style={tw`w-full h-full`}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                </ScrollView>
                {pet.imageUrls.length > 1 && (
                  <View
                    style={tw`absolute bottom-4 left-0 right-0 flex-row justify-center`}
                  >
                    {pet.imageUrls.map((_, index) => (
                      <View
                        key={index}
                        style={tw`w-2 h-2 rounded-full mx-1 ${
                          currentImageIndex === index
                            ? "bg-blue-500"
                            : "bg-white opacity-70"
                        }`}
                      />
                    ))}
                  </View>
                )}
                <View
                  style={tw`absolute top-4 right-4 px-3 py-1 rounded-xl ${
                    pet.status === "lost"
                      ? "bg-red-500"
                      : pet.status === "found"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                >
                  <CustomText
                    style={tw`text-white text-[12px]`}
                    weight="SemiBold"
                  >
                    {pet.status?.toUpperCase()}
                  </CustomText>
                </View>
              </View>
            ) : pet.image ? (
              <View style={tw`w-full h-72`}>
                <Image
                  source={pet.image}
                  style={tw`w-full h-full`}
                  resizeMode="cover"
                />
                <View
                  style={tw`absolute top-4 right-4 px-3 py-1 rounded-xl ${
                    pet.status === "lost"
                      ? "bg-red-500"
                      : pet.status === "found"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                >
                  <CustomText
                    style={tw`text-white text-[12px]`}
                    weight="SemiBold"
                  >
                    {pet.status?.toUpperCase()}
                  </CustomText>
                </View>
              </View>
            ) : (
              <View
                style={tw`w-full h-72 items-center justify-center bg-gray-200`}
              >
                <Feather name="image" size={48} color="#9CA3AF" />
                <CustomText style={tw`text-gray-500 mt-4`}>
                  No image available
                </CustomText>
                <View
                  style={tw`absolute top-4 right-4 px-3 py-1 rounded-xl ${
                    pet.status === "lost"
                      ? "bg-red-500"
                      : pet.status === "found"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                >
                  <CustomText
                    style={tw`text-white text-[12px]`}
                    weight="SemiBold"
                  >
                    {pet.status?.toUpperCase()}
                  </CustomText>
                </View>
              </View>
            )}
          </View>

          <View style={tw`px-6 pt-6 pb-4 bg-white`}>
            <View style={tw`flex-row justify-between items-center mb-2`}>
              <CustomText style={tw`text-[24px] text-gray-800`} weight="Bold">
                {pet.petName || "Unnamed Pet"}
              </CustomText>
              {pet.searchProbability && (
                <View style={tw`px-3 py-1 bg-blue-100 rounded-full`}>
                  <CustomText
                    style={tw`text-[12px] text-blue-700`}
                    weight="Medium"
                  >
                    {pet.searchProbability}% Match
                  </CustomText>
                </View>
              )}
            </View>

            <View style={tw`flex-row items-center mb-4`}>
              <CustomText style={tw`text-[16px] text-gray-600`}>
                {pet.petBreed || "Unknown Breed"} •{" "}
                {pet.petType || "Unknown Type"}
              </CustomText>
            </View>

            <View style={tw`flex-row flex-wrap mb-4`}>
              {pet.petGender && (
                <View style={tw`bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2`}>
                  <CustomText style={tw`text-[12px] text-gray-700`}>
                    {pet.petGender}
                  </CustomText>
                </View>
              )}
              {pet.petSize && (
                <View style={tw`bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2`}>
                  <CustomText style={tw`text-[12px] text-gray-700`}>
                    {pet.petSize} Size
                  </CustomText>
                </View>
              )}
              {pet.petColor && (
                <View style={tw`bg-gray-100 px-3 py-1 rounded-full mr-2 mb-2`}>
                  <CustomText style={tw`text-[12px] text-gray-700`}>
                    {pet.petColor}
                  </CustomText>
                </View>
              )}
            </View>

            <View style={tw`flex-row items-center mb-2`}>
              <Feather
                name="clock"
                size={16}
                color="#6B7280"
                style={tw`mr-2`}
              />
              <CustomText style={tw`text-[14px] text-gray-600`}>
                {pet.status === "lost" ? "Lost on: " : "Found on: "}
                {pet.dateTime || "Unknown date"}
              </CustomText>
            </View>

            {pet.location && (
              <View style={tw`flex-row items-center mb-4`}>
                <Feather
                  name="map-pin"
                  size={16}
                  color="#6B7280"
                  style={tw`mr-2`}
                />
                <CustomText style={tw`text-[14px] text-gray-600 flex-1`}>
                  {pet.distance || "Location available"}
                </CustomText>
              </View>
            )}

            {pet.status === "lost" && pet.rewardAmount && (
              <View
                style={tw`mb-4 bg-yellow-50 p-3 rounded-xl border border-yellow-200`}
              >
                <View style={tw`flex-row items-center`}>
                  <Feather
                    name="award"
                    size={18}
                    color="#F59E0B"
                    style={tw`mr-2`}
                  />
                  <CustomText
                    style={tw`text-[16px] text-yellow-700`}
                    weight="SemiBold"
                  >
                    Reward: ₱{pet.rewardAmount}
                  </CustomText>
                </View>
              </View>
            )}

            <View style={tw`flex-row mt-2`}>
              {isOwner ? (
                <>
                  <TouchableOpacity
                    style={tw`bg-blue-500 py-3 rounded-xl items-center flex-1 mr-3`}
                    onPress={() => setShowEditModal(true)}
                  >
                    <CustomText
                      style={tw`text-white text-[14px]`}
                      weight="SemiBold"
                    >
                      Edit Information
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`bg-gray-500 py-3 rounded-xl items-center flex-1 mr-3`}
                    onPress={() => setShowReportModal(true)}
                  >
                    <CustomText
                      style={tw`text-white text-[14px]`}
                      weight="SemiBold"
                    >
                      Update Status
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`bg-blue-500 py-3 rounded-xl items-center justify-center w-12 h-12 rounded-full relative`}
                    onPress={() => setShowRequestsModal(true)}
                  >
                    <Feather name="message-circle" size={20} color="white" />
                    {pendingRequests.length > 0 && (
                      <View
                        style={tw`absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center border-2 border-white`}
                      >
                        <CustomText
                          style={tw`text-white text-[10px]`}
                          weight="Bold"
                        >
                          {pendingRequests.length}
                        </CustomText>
                      </View>
                    )}
                  </TouchableOpacity>
                </>
              ) : pet.status === "lost" ? (
                <>
                  <TouchableOpacity
                    style={tw`bg-blue-500 py-3 rounded-xl items-center flex-1 mr-3`}
                    onPress={handleReportSighting}
                  >
                    <CustomText
                      style={tw`text-white text-[14px]`}
                      weight="SemiBold"
                    >
                      Report Sighting
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`bg-green-500 py-3 rounded-xl items-center flex-1`}
                    onPress={handleContact}
                  >
                    <CustomText
                      style={tw`text-white text-[14px]`}
                      weight="SemiBold"
                    >
                      Contact Owner
                    </CustomText>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={tw`bg-blue-500 py-3 rounded-xl items-center flex-1 mr-3`}
                    onPress={() => setShowMatchModal(true)}
                  >
                    <CustomText
                      style={tw`text-white text-[14px]`}
                      weight="SemiBold"
                    >
                      Check Matches
                    </CustomText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`bg-green-500 py-3 rounded-xl items-center flex-1`}
                    onPress={handleContact}
                  >
                    <CustomText
                      style={tw`text-white text-[14px]`}
                      weight="SemiBold"
                    >
                      Contact Finder
                    </CustomText>
                  </TouchableOpacity>
                </>
              )}
            </View>
            {pet.status === "lost" && (
              <>
                <TouchableOpacity
                  style={tw`mt-3 bg-indigo-100 py-3 rounded-xl items-center justify-center flex-row`}
                  onPress={() => {
                    fetchSightings();
                    setShowSightingsModal(true);
                  }}
                >
                  <Feather
                    name="eye"
                    size={18}
                    color="#4F46E5"
                    style={tw`mr-2`}
                  />
                  <CustomText
                    style={tw`text-indigo-700 text-[14px]`}
                    weight="SemiBold"
                  >
                    View Reported Sightings
                  </CustomText>
                </TouchableOpacity>
                {isOwner && (
                  <TouchableOpacity
                    style={tw`mt-3 bg-purple-100 py-3 rounded-xl items-center justify-center flex-row`}
                    onPress={() => setShowCommunitySearchModal(true)}
                  >
                    <Feather
                      name="users"
                      size={18}
                      color="#7C3AED"
                      style={tw`mr-2`}
                    />
                    <CustomText
                      style={tw`text-purple-700 text-[14px]`}
                      weight="SemiBold"
                    >
                      Create Community Search
                    </CustomText>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {pet.location && (
            <View style={tw`mt-4 bg-white p-6`}>
              <CustomText
                style={tw`text-[18px] text-gray-800 mb-3`}
                weight="Bold"
              >
                Location
              </CustomText>
              <View style={tw`h-48 w-full rounded-xl overflow-hidden mb-3`}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={tw`flex-1`}
                  initialRegion={{
                    latitude: pet.location.latitude,
                    longitude: pet.location.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: pet.location.latitude,
                      longitude: pet.location.longitude,
                    }}
                    title={
                      pet.status === "lost" ? "Last Seen Here" : "Found Here"
                    }
                  />
                </MapView>
              </View>
              {pet.status === "lost" && (
                <TouchableOpacity
                  style={tw`bg-blue-100 py-3 rounded-xl items-center flex-row justify-center`}
                  onPress={handleViewOnMap}
                >
                  <CustomText
                    style={tw`text-blue-700 text-[14px] mr-2`}
                    weight="SemiBold"
                  >
                    View AI Search Map
                  </CustomText>
                  <Feather name="map" size={16} color="#1D4ED8" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {pet.status === "lost" && (
            <View style={tw`mt-4 bg-white p-6`}>
              <View style={tw`flex-row justify-between items-center mb-3`}>
                <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                  Community Searches
                </CustomText>
                <TouchableOpacity
                  onPress={() => navigation.navigate("CommunitySearches")}
                >
                  <CustomText
                    style={tw`text-[14px] text-blue-500`}
                    weight="Medium"
                  >
                    See All
                  </CustomText>
                </TouchableOpacity>
              </View>
              {loadingCommunitySearches ? (
                <View style={tw`items-center py-8`}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <CustomText style={tw`text-gray-500 mt-4`}>
                    Loading community searches...
                  </CustomText>
                </View>
              ) : communitySearches.length > 0 ? (
                <View style={tw`bg-white rounded-xl shadow-sm overflow-hidden`}>
                  {communitySearches.slice(0, 2).map((search) => (
                    <View
                      key={search.id}
                      style={tw`p-3 border-b border-gray-100`}
                    >
                      <View style={tw`flex-row items-center mb-2`}>
                        <View
                          style={tw`w-9 h-9 rounded-full bg-orange-100 items-center justify-center mr-2`}
                        >
                          <Feather name="users" size={16} color="#F59E0B" />
                        </View>
                        <View style={tw`flex-1`}>
                          <CustomText
                            style={tw`text-[15px] text-gray-800`}
                            weight="Bold"
                          >
                            Search for {search.petName}
                          </CustomText>
                          <View style={tw`flex-row items-center`}>
                            <Feather
                              name="clock"
                              size={11}
                              color="#9CA3AF"
                              style={tw`mr-1`}
                            />
                            <CustomText
                              style={tw`text-[11px] text-gray-500 mr-2`}
                            >
                              {search.createdAt.toLocaleString()}
                            </CustomText>
                            <Feather
                              name="map-pin"
                              size={11}
                              color="#9CA3AF"
                              style={tw`mr-1`}
                            />
                            <CustomText style={tw`text-[11px] text-gray-500`}>
                              Within {search.radius} miles
                            </CustomText>
                          </View>
                        </View>
                      </View>
                      <CustomText
                        style={tw`text-[13px] text-gray-700 mb-2`}
                        numberOfLines={2}
                      >
                        {search.details}
                      </CustomText>
                      <View style={tw`flex-row`}>
                        <TouchableOpacity
                          style={tw`bg-orange-500 py-1.5 px-3 rounded-lg mr-2 flex-row items-center`}
                          onPress={() =>
                            navigation.navigate("CommunitySearchDetails", {
                              search,
                              pet,
                            })
                          }
                        >
                          <Feather
                            name="user-plus"
                            size={12}
                            color="white"
                            style={tw`mr-1`}
                          />
                          <CustomText
                            style={tw`text-white text-[12px]`}
                            weight="Medium"
                          >
                            Join Search
                          </CustomText>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={tw`bg-gray-200 py-1.5 px-3 rounded-lg flex-row items-center`}
                          onPress={async () => {
                            try {
                              await Share.share({
                                message: `Join the community search for ${search.petName}, a ${search.petType} (${search.petBreed}) lost near your area! Details: ${search.details}`,
                                title: `Community Search for ${search.petName}`,
                              });
                            } catch (error) {
                              console.error("Error sharing:", error);
                            }
                          }}
                        >
                          <Feather
                            name="share-2"
                            size={12}
                            color="#4B5563"
                            style={tw`mr-1`}
                          />
                          <CustomText
                            style={tw`text-gray-700 text-[12px]`}
                            weight="Medium"
                          >
                            Share
                          </CustomText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={tw`bg-white rounded-xl shadow-sm p-4`}>
                  <View style={tw`items-center py-4`}>
                    <Feather name="users" size={32} color="#9CA3AF" />
                    <CustomText style={tw`text-gray-500 mt-2 text-center`}>
                      No active community searches for this pet.
                    </CustomText>
                    {isOwner && (
                      <TouchableOpacity
                        style={tw`mt-4 bg-purple-500 px-4 py-2 rounded-lg`}
                        onPress={() => setShowCommunitySearchModal(true)}
                      >
                        <CustomText style={tw`text-white text-[14px]`}>
                          Create a Community Search
                        </CustomText>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          {pet.behaviorPrediction && (
            <View style={tw`mt-4 bg-white p-6`}>
              <CustomText
                style={tw`text-[18px] text-gray-800 mb-3`}
                weight="Bold"
              >
                Behavior Analysis
              </CustomText>
              <View style={tw`p-4 bg-blue-50 rounded-xl mb-2`}>
                <View style={tw`flex-row items-center mb-2`}>
                  <Feather
                    name="activity"
                    size={16}
                    color="#3B82F6"
                    style={tw`mr-2`}
                  />
                  <CustomText
                    style={tw`text-[14px] text-blue-700`}
                    weight="Medium"
                  >
                    AI Behavior Prediction
                  </CustomText>
                </View>
                <CustomText style={tw`text-[14px] text-gray-700`}>
                  {pet.behaviorPrediction}
                </CustomText>
              </View>
              {pet.behavioralTraits && pet.behavioralTraits.length > 0 && (
                <View style={tw`mt-3`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="Medium"
                  >
                    Behavioral Traits:
                  </CustomText>
                  <View style={tw`flex-row flex-wrap`}>
                    {pet.behavioralTraits.map((trait, index) => (
                      <View
                        key={index}
                        style={tw`bg-purple-100 px-3 py-1 rounded-full mr-2 mb-2`}
                      >
                        <CustomText style={tw`text-[12px] text-purple-700`}>
                          {trait.charAt(0).toUpperCase() + trait.slice(1)}
                        </CustomText>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {pet.additionalInfo && (
            <View style={tw`mt-4 bg-white p-6`}>
              <CustomText
                style={tw`text-[18px] text-gray-800 mb-3`}
                weight="Bold"
              >
                Additional Information
              </CustomText>
              <View style={tw`p-4 bg-gray-50 rounded-xl`}>
                <CustomText style={tw`text-[14px] text-gray-700`}>
                  {pet.additionalInfo}
                </CustomText>
              </View>
            </View>
          )}

          {pet.environmentalFactors && pet.environmentalFactors.length > 0 && (
            <View style={tw`mt-4 bg-white p-6`}>
              <CustomText
                style={tw`text-[18px] text-gray-800 mb-3`}
                weight="Bold"
              >
                Environmental Factors
              </CustomText>
              <View style={tw`flex-row flex-wrap`}>
                {pet.environmentalFactors.map((factor, index) => (
                  <View
                    key={index}
                    style={tw`bg-green-100 px-3 py-1 rounded-full mr-2 mb-2`}
                  >
                    <CustomText style={tw`text-[12px] text-green-700`}>
                      {factor.charAt(0).toUpperCase() + factor.slice(1)}
                    </CustomText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {pet.weatherCondition && (
            <View style={tw`mt-4 bg-white p-6`}>
              <CustomText
                style={tw`text-[18px] text-gray-800 mb-3`}
                weight="Bold"
              >
                Weather Condition
              </CustomText>
              <View style={tw`flex-row items-center`}>
                <View
                  style={tw`w-10 h-10 rounded-lg bg-blue-100 items-center justify-center mr-3`}
                >
                  <Feather
                    name={
                      pet.weatherCondition === "clear"
                        ? "sun"
                        : pet.weatherCondition === "rain"
                        ? "cloud-rain"
                        : pet.weatherCondition === "wind"
                        ? "wind"
                        : pet.weatherCondition === "thunder"
                        ? "zap"
                        : "cloud"
                    }
                    size={20}
                    color="#3B82F6"
                  />
                </View>
                <View>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Medium"
                  >
                    {pet.weatherCondition.charAt(0).toUpperCase() +
                      pet.weatherCondition.slice(1)}
                  </CustomText>
                  <CustomText style={tw`text-[12px] text-gray-500`}>
                    When the pet was {pet.status === "lost" ? "lost" : "found"}
                  </CustomText>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showContactModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Contact Information
              </CustomText>
              <TouchableOpacity onPress={() => setShowContactModal(false)}>
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`mb-6`}>
              {pet.contactName && (
                <View style={tw`mb-4`}>
                  <CustomText style={tw`text-[14px] text-gray-500 mb-1`}>
                    Name
                  </CustomText>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Medium"
                  >
                    {pet.contactName}
                  </CustomText>
                </View>
              )}

              {pet.contactPhone && (
                <TouchableOpacity
                  style={tw`flex-row items-center justify-between p-4 bg-gray-50 rounded-xl mb-3`}
                  onPress={handleCall}
                >
                  <View style={tw`flex-row items-center`}>
                    <View
                      style={tw`w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3`}
                    >
                      <Feather name="phone" size={20} color="#10B981" />
                    </View>
                    <CustomText
                      style={tw`text-[16px] text-gray-800`}
                      weight="Medium"
                    >
                      {pet.contactPhone}
                    </CustomText>
                  </View>
                  <Feather name="chevron-right" size={20} color="#6B7280" />
                </TouchableOpacity>
              )}

              {pet.contactEmail && (
                <TouchableOpacity
                  style={tw`flex-row items-center justify-between p-4 bg-gray-50 rounded-xl`}
                  onPress={handleEmail}
                >
                  <View style={tw`flex-row items-center`}>
                    <View
                      style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}
                    >
                      <Feather name="mail" size={20} color="#3B82F6" />
                    </View>
                    <CustomText
                      style={tw`text-[16px] text-gray-800`}
                      weight="Medium"
                    >
                      {pet.contactEmail}
                    </CustomText>
                  </View>
                  <Feather name="chevron-right" size={20} color="#6B7280" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center`}
              onPress={() => setShowContactModal(false)}
            >
              <CustomText
                style={tw`text-gray-700 text-[16px]`}
                weight="SemiBold"
              >
                Close
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Update Pet Status
              </CustomText>
              <TouchableOpacity onPress={() => setShowReportModal(false)}>
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`mb-6`}>
              <TouchableOpacity
                style={tw`flex-row items-center p-4 bg-gray-50 rounded-xl mb-3 ${
                  reportStatus === "lost" ? "border-2 border-red-500" : ""
                }`}
                onPress={() => setReportStatus("lost")}
              >
                <View
                  style={tw`w-10 h-10 rounded-full bg-red-100 items-center justify-center mr-3`}
                >
                  <Feather name="alert-circle" size={20} color="#EF4444" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Medium"
                  >
                    Lost
                  </CustomText>
                  <CustomText style={tw`text-[12px] text-gray-500`}>
                    Pet is still missing
                  </CustomText>
                </View>
                {reportStatus === "lost" && (
                  <View
                    style={tw`w-6 h-6 rounded-full bg-red-500 items-center justify-center`}
                  >
                    <Feather name="check" size={14} color="white" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-row items-center p-4 bg-gray-50 rounded-xl mb-3 ${
                  reportStatus === "found" ? "border-2 border-green-500" : ""
                }`}
                onPress={() => setReportStatus("found")}
              >
                <View
                  style={tw`w-10 h-10 rounded-full bg-green-100 items-center justify-center mr-3`}
                >
                  <Feather name="search" size={20} color="#10B981" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Medium"
                  >
                    Found
                  </CustomText>
                  <CustomText style={tw`text-[12px] text-gray-500`}>
                    Pet has been found but not reunited
                  </CustomText>
                </View>
                {reportStatus === "found" && (
                  <View
                    style={tw`w-6 h-6 rounded-full bg-green-500 items-center justify-center`}
                  >
                    <Feather name="check" size={14} color="white" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-row items-center p-4 bg-gray-50 rounded-xl ${
                  reportStatus === "resolved" ? "border-2 border-blue-500" : ""
                }`}
                onPress={() => setReportStatus("resolved")}
              >
                <View
                  style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}
                >
                  <Feather name="check-circle" size={20} color="#3B82F6" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText
                    style={tw`text-[16px] text-gray-800`}
                    weight="Medium"
                  >
                    Reunited
                  </CustomText>
                  <CustomText style={tw`text-[12px] text-gray-500`}>
                    Pet has been reunited with owner
                  </CustomText>
                </View>
                {reportStatus === "resolved" && (
                  <View
                    style={tw`w-6 h-6 rounded-full bg-blue-500 items-center justify-center`}
                  >
                    <Feather name="check" size={14} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={tw`flex-row`}>
              <TouchableOpacity
                style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                onPress={() => setShowReportModal(false)}
              >
                <CustomText
                  style={tw`text-gray-700 text-[16px]`}
                  weight="SemiBold"
                >
                  Cancel
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`bg-blue-500 py-3 rounded-xl items-center justify-center flex-1`}
                onPress={() => handleUpdateStatus(reportStatus)}
                disabled={loading || reportStatus === pet?.status}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <CustomText
                    style={tw`text-white text-[16px]`}
                    weight="SemiBold"
                  >
                    Update Status
                  </CustomText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMatchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMatchModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Potential Matches
              </CustomText>
              <TouchableOpacity onPress={() => setShowMatchModal(false)}>
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`mb-6`}>
              {potentialMatches.length > 0 ? (
                potentialMatches.map((match) => (
                  <TouchableOpacity
                    key={match.id}
                    style={tw`flex-row items-center p-4 bg-gray-50 rounded-xl mb-3`}
                    onPress={() => handleCheckMatch(match)}
                  >
                    <View
                      style={tw`w-12 h-12 rounded-lg bg-gray-200 mr-3 items-center justify-center overflow-hidden`}
                    >
                      {match.image ? (
                        <Image
                          source={match.image}
                          style={tw`w-full h-full`}
                          resizeMode="cover"
                        />
                      ) : (
                        <Feather name="image" size={20} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={tw`flex-1`}>
                      <View style={tw`flex-row items-center`}>
                        <CustomText
                          style={tw`text-[16px] text-gray-800 mr-2`}
                          weight="Medium"
                        >
                          {match.petName}
                        </CustomText>
                        <View style={tw`px-2 py-0.5 rounded-full bg-blue-100`}>
                          <CustomText
                            style={tw`text-[10px] text-blue-700`}
                            weight="Medium"
                          >
                            {match.matchProbability}% Match
                          </CustomText>
                        </View>
                      </View>
                      <CustomText style={tw`text-[12px] text-gray-500`}>
                        {match.petBreed} • Lost {match.lastSeen}
                      </CustomText>
                      <CustomText style={tw`text-[12px] text-gray-500`}>
                        {match.distance}
                      </CustomText>
                    </View>
                    <Feather name="chevron-right" size={20} color="#6B7280" />
                  </TouchableOpacity>
                ))
              ) : (
                <View style={tw`items-center py-6`}>
                  <Feather name="search" size={48} color="#9CA3AF" />
                  <CustomText style={tw`text-gray-600 mt-4 text-center`}>
                    No potential matches found yet. Check back later.
                  </CustomText>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center`}
              onPress={() => setShowMatchModal(false)}
            >
              <CustomText
                style={tw`text-gray-700 text-[16px]`}
                weight="SemiBold"
              >
                Close
              </CustomText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Edit Pet Information
              </CustomText>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`mb-6`}>
              {pet.status === "lost" && (
                <View style={tw`mb-4`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="Medium"
                  >
                    Reward Amount (Optional)
                  </CustomText>
                  <View
                    style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3.5`}
                  >
                    <MaterialCommunityIcons
                      name="currency-usd"
                      size={20}
                      color="#6B7280"
                      style={tw`mr-3`}
                    />
                    <CustomTextInput
                      style={tw`flex-1 text-gray-800`}
                      placeholder="Enter reward amount"
                      value={rewardAmount}
                      onChangeText={setRewardAmount}
                      keyboardType="numeric"
                    />
                  </View>
                  <CustomText style={tw`text-[12px] text-gray-500 mt-1`}>
                    Leave empty for no reward
                  </CustomText>
                </View>
              )}

              <View style={tw`mb-4`}>
                <CustomText
                  style={tw`text-[16px] text-gray-800 mb-3`}
                  weight="SemiBold"
                >
                  Privacy Settings
                </CustomText>

                <View
                  style={tw`bg-gray-50 p-4 rounded-xl border border-gray-200`}
                >
                  <View style={tw`flex-row items-center justify-between mb-2`}>
                    <View style={tw`flex-row items-center`}>
                      <Feather
                        name="shield"
                        size={20}
                        color="#6B7280"
                        style={tw`mr-3`}
                      />
                      <View>
                        <CustomText
                          style={tw`text-[14px] text-gray-800`}
                          weight="Medium"
                        >
                          Hide Contact Information
                        </CustomText>
                        <CustomText style={tw`text-[12px] text-gray-500`}>
                          Users will need to request to message you
                        </CustomText>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={tw`w-12 h-6 ${
                        isContactPrivate ? "bg-blue-500" : "bg-gray-300"
                      } rounded-full px-1`}
                      onPress={() => setIsContactPrivate(!isContactPrivate)}
                      activeOpacity={0.8}
                    >
                      <Animated.View
                        style={[
                          tw`w-5 h-5 bg-white rounded-full shadow-sm`,
                          {
                            transform: [
                              { translateX: isContactPrivate ? 24 : 0 },
                            ],
                          },
                        ]}
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={tw`mt-3 bg-blue-50 p-3 rounded-lg`}>
                    <View style={tw`flex-row items-start`}>
                      <Feather
                        name="info"
                        size={16}
                        color="#3B82F6"
                        style={tw`mr-2 mt-0.5`}
                      />
                      <CustomText style={tw`text-[12px] text-blue-700 flex-1`}>
                        {isContactPrivate
                          ? "Your contact information will be hidden. Users will need to send you a message request first."
                          : "Your contact information will be visible to all users."}
                      </CustomText>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <View style={tw`flex-row`}>
              <TouchableOpacity
                style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                onPress={() => setShowEditModal(false)}
              >
                <CustomText
                  style={tw`text-gray-700 text-[16px]`}
                  weight="SemiBold"
                >
                  Cancel
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`bg-blue-500 py-3 rounded-xl items-center justify-center flex-1`}
                onPress={handleSaveEdit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <CustomText
                    style={tw`text-white text-[16px]`}
                    weight="SemiBold"
                  >
                    Save Changes
                  </CustomText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMessageRequestModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMessageRequestModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Request to Message
              </CustomText>
              <TouchableOpacity
                onPress={() => setShowMessageRequestModal(false)}
              >
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            {requestSent ? (
              <View style={tw`items-center py-6 mb-6`}>
                <View
                  style={tw`w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4`}
                >
                  <Feather name="check" size={32} color="#10B981" />
                </View>
                <CustomText
                  style={tw`text-[18px] text-gray-800 mb-2`}
                  weight="Bold"
                >
                  Request Sent!
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-600 text-center`}>
                  The pet owner will review your request and respond soon.
                </CustomText>
              </View>
            ) : (
              <View style={tw`mb-6`}>
                <View style={tw`mb-4 bg-blue-50 p-4 rounded-xl`}>
                  <View style={tw`flex-row items-start`}>
                    <Feather
                      name="info"
                      size={18}
                      color="#3B82F6"
                      style={tw`mr-3 mt-0.5`}
                    />
                    <CustomText style={tw`text-[14px] text-blue-700 flex-1`}>
                      The pet owner has chosen to keep their contact information
                      private. Send a message request to communicate.
                    </CustomText>
                  </View>
                </View>

                <CustomText
                  style={tw`text-[14px] text-gray-700 mb-2`}
                  weight="Medium"
                >
                  Introduce yourself and explain why you're contacting
                </CustomText>
                <View
                  style={tw`bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4`}
                >
                  <CustomTextInput
                    style={tw`text-gray-800 min-h-[100px]`}
                    placeholder="Hi, I think I may have seen your pet near my neighborhood..."
                    value={requestMessage}
                    onChangeText={setRequestMessage}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={tw`bg-yellow-50 p-3 rounded-lg mb-4`}>
                  <View style={tw`flex-row items-start`}>
                    <Feather
                      name="shield"
                      size={16}
                      color="#F59E0B"
                      style={tw`mr-2 mt-0.5`}
                    />
                    <CustomText style={tw`text-[12px] text-yellow-700 flex-1`}>
                      For safety reasons, please don't share personal
                      information in your initial message.
                    </CustomText>
                  </View>
                </View>
              </View>
            )}

            <View style={tw`flex-row`}>
              <TouchableOpacity
                style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                onPress={() => setShowMessageRequestModal(false)}
              >
                <CustomText
                  style={tw`text-gray-700 text-[16px]`}
                  weight="SemiBold"
                >
                  {requestSent ? "Close" : "Cancel"}
                </CustomText>
              </TouchableOpacity>
              {!requestSent && (
                <TouchableOpacity
                  style={tw`bg-blue-500 py-3 rounded-xl items-center justify-center flex-1`}
                  onPress={handleSendMessageRequest}
                  disabled={loading || !requestMessage.trim()}
                >
                  {loading ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <CustomText
                      style={tw`text-white text-[16px]`}
                      weight="SemiBold"
                    >
                      Send Request
                    </CustomText>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showChatModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowChatModal(false)}
      >
        <View style={tw`flex-1 bg-white`}>
          <View
            style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between bg-white shadow-sm`}
          >
            <TouchableOpacity
              style={tw`mr-4`}
              onPress={() => setShowChatModal(false)}
            >
              <Feather name="arrow-left" size={24} color="#3B82F6" />
            </TouchableOpacity>
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                {isOwner
                  ? `Chat with Finder`
                  : `Chat with ${pet.contactName || "Owner"}`}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-500`}>
                About: {pet.petName || "Pet"} ({pet.petType})
              </CustomText>
            </View>
            <View
              style={tw`w-10 h-10 rounded-full bg-gray-200 items-center justify-center`}
            >
              <Feather name="user" size={20} color="#6B7280" />
            </View>
          </View>

          <ScrollView
            style={tw`flex-1 px-4 pt-4`}
            contentContainerStyle={tw`pb-4`}
            showsVerticalScrollIndicator={false}
          >
            {messages.length === 0 ? (
              <View style={tw`items-center justify-center py-10`}>
                <View
                  style={tw`w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-4`}
                >
                  <Feather name="message-circle" size={32} color="#3B82F6" />
                </View>
                <CustomText
                  style={tw`text-[16px] text-gray-700 mb-2 text-center`}
                  weight="Medium"
                >
                  No messages yet
                </CustomText>
                <CustomText
                  style={tw`text-[14px] text-gray-500 text-center px-10`}
                >
                  Start the conversation about {pet.petName || "this pet"}
                </CustomText>
              </View>
            ) : (
              messages.map((msg) => (
                <View
                  key={msg.id}
                  style={tw`mb-4 ${
                    msg.isOwner === isOwner ? "items-end" : "items-start"
                  }`}
                >
                  <View
                    style={tw`max-w-[80%] p-3 rounded-2xl ${
                      msg.isOwner === isOwner ? "bg-blue-500" : "bg-gray-200"
                    }`}
                  >
                    <CustomText
                      style={tw`${
                        msg.isOwner === isOwner ? "text-white" : "text-gray-800"
                      }`}
                    >
                      {msg.text}
                    </CustomText>
                  </View>
                  <CustomText style={tw`text-[10px] text-gray-500 mt-1`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </CustomText>
                </View>
              ))
            )}
          </ScrollView>

          <View style={tw`px-4 py-3 border-t border-gray-200 bg-white`}>
            <View style={tw`flex-row items-center`}>
              <View
                style={tw`flex-1 bg-gray-100 rounded-full px-4 py-2 mr-2 flex-row items-center`}
              >
                <CustomTextInput
                  style={tw`flex-1 text-gray-800`}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline
                />
                <TouchableOpacity>
                  <Feather name="camera" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={tw`w-10 h-10 rounded-full bg-blue-500 items-center justify-center`}
                onPress={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <Feather name="send" size={18} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRequestsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRequestsModal(false)}
      >
        <View style={tw`flex-1 bg-white`}>
          <View
            style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between bg-white shadow-sm`}
          >
            <TouchableOpacity
              style={tw`mr-4`}
              onPress={() => setShowRequestsModal(false)}
            >
              <Feather name="arrow-left" size={24} color="#3B82F6" />
            </TouchableOpacity>
            <CustomText
              style={tw`text-[18px] text-gray-800 flex-1 text-center`}
              weight="Bold"
            >
              Message Requests
            </CustomText>
            <View style={tw`w-6`}></View>
          </View>

          <ScrollView
            style={tw`flex-1 px-4 pt-4`}
            contentContainerStyle={tw`pb-4`}
          >
            {pendingRequests.length === 0 ? (
              <View style={tw`items-center justify-center py-10`}>
                <View
                  style={tw`w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-4`}
                >
                  <Feather name="inbox" size={32} color="#3B82F6" />
                </View>
                <CustomText
                  style={tw`text-[16px] text-gray-700 mb-2 text-center`}
                  weight="Medium"
                >
                  No pending requests
                </CustomText>
                <CustomText
                  style={tw`text-[14px] text-gray-500 text-center px-10`}
                >
                  When someone wants to contact you about your pet, their
                  request will appear here
                </CustomText>
              </View>
            ) : (
              pendingRequests.map((request) => (
                <View
                  key={request.id}
                  style={tw`mb-4 bg-gray-50 rounded-xl p-4 border border-gray-200`}
                >
                  <View style={tw`flex-row items-center mb-3`}>
                    <View
                      style={tw`w-10 h-10 rounded-full bg-gray-200 items-center justify-center mr-3`}
                    >
                      {request.avatar ? (
                        <Image
                          source={{ uri: request.avatar }}
                          style={tw`w-full h-full rounded-full`}
                        />
                      ) : (
                        <Feather name="user" size={20} color="#6B7280" />
                      )}
                    </View>
                    <View style={tw`flex-1`}>
                      <CustomText
                        style={tw`text-[16px] text-gray-800`}
                        weight="Medium"
                      >
                        {request.userName}
                      </CustomText>
                      <CustomText style={tw`text-[12px] text-gray-500`}>
                        {new Date(
                          request.timestamp?.toDate?.() || request.timestamp
                        ).toLocaleString()}
                      </CustomText>
                    </View>
                  </View>

                  <View
                    style={tw`bg-white p-3 rounded-lg mb-3 border border-gray-100`}
                  >
                    <CustomText style={tw`text-[14px] text-gray-700`}>
                      {request.message}
                    </CustomText>
                  </View>

                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      style={tw`flex-1 bg-gray-200 py-2 rounded-lg items-center mr-2`}
                      onPress={() => handleDenyRequest(request.id)}
                    >
                      <CustomText style={tw`text-gray-700`} weight="Medium">
                        Deny
                      </CustomText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={tw`flex-1 bg-blue-500 py-2 rounded-lg items-center`}
                      onPress={() => handleApproveRequest(request.id)}
                    >
                      <CustomText style={tw`text-white`} weight="Medium">
                        Approve
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showSightingsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSightingsModal(false)}
      >
        <View style={tw`flex-1 bg-white`}>
          <View
            style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between bg-white shadow-sm`}
          >
            <TouchableOpacity
              style={tw`mr-4`}
              onPress={() => setShowSightingsModal(false)}
            >
              <Feather name="arrow-left" size={24} color="#3B82F6" />
            </TouchableOpacity>
            <CustomText
              style={tw`text-[18px] text-gray-800 flex-1 text-center`}
              weight="Bold"
            >
              Reported Sightings
            </CustomText>
            <View style={tw`w-6`} />
          </View>
          <ScrollView
            style={tw`flex-1 px-4 pt-4`}
            contentContainerStyle={tw`pb-4`}
          >
            {loadingSightings ? (
              <View style={tw`items-center justify-center py-10`}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <CustomText style={tw`text-gray-500 mt-4 text-center`}>
                  Loading sightings...
                </CustomText>
              </View>
            ) : sightings.length === 0 ? (
              <View style={tw`items-center justify-center py-10`}>
                <View
                  style={tw`w-16 h-16 rounded-full bg-blue-100 items-center justify-center mb-4`}
                >
                  <Feather name="eye" size={32} color="#3B82F6" />
                </View>
                <CustomText
                  style={tw`text-[16px] text-gray-700 mb-2 text-center`}
                  weight="Medium"
                >
                  No reported sightings
                </CustomText>
                <CustomText
                  style={tw`text-[14px] text-gray-500 text-center px-10`}
                >
                  No sightings have been reported for{" "}
                  {pet.petName || "this pet"} yet.
                </CustomText>
                {!isOwner && (
                  <TouchableOpacity
                    style={tw`mt-4 bg-blue-500 px-4 py-2 rounded-lg`}
                    onPress={() => {
                      setShowSightingsModal(false);
                      navigation.navigate("ReportSighting", { pet });
                    }}
                  >
                    <CustomText style={tw`text-white text-[14px]`}>
                      Report a Sighting
                    </CustomText>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              sightings.map((sighting) => (
                <View
                  key={sighting.id}
                  style={tw`mb-4 bg-gray-50 rounded-xl p-4 border border-gray-200`}
                >
                  <View style={tw`flex-row items-center mb-3`}>
                    <View
                      style={tw`w-10 h-10 rounded-full bg-indigo-100 items-center justify-center mr-3`}
                    >
                      <Feather name="eye" size={20} color="#4F46E5" />
                    </View>
                    <View style={tw`flex-1`}>
                      <CustomText
                        style={tw`text-[16px] text-gray-800`}
                        weight="Medium"
                      >
                        Sighting Reported
                      </CustomText>
                      <CustomText style={tw`text-[12px] text-gray-500`}>
                        {sighting.createdAt.toLocaleString()}
                      </CustomText>
                    </View>
                  </View>

                  {sighting.description && (
                    <View
                      style={tw`bg-white p-3 rounded-lg mb-3 border border-gray-100`}
                    >
                      <CustomText style={tw`text-[14px] text-gray-700`}>
                        {sighting.description}
                      </CustomText>
                    </View>
                  )}

                  {sighting.location && (
                    <TouchableOpacity
                      style={tw`flex-row items-center p-3 bg-indigo-50 rounded-lg mb-3`}
                      onPress={() =>
                        navigation.navigate("MapScreen", {
                          coordinates: {
                            latitude: sighting.location.latitude,
                            longitude: sighting.location.longitude,
                          },
                          title: `Sighting of ${pet.petName || "Pet"}`,
                        })
                      }
                    >
                      <Feather
                        name="map-pin"
                        size={16}
                        color="#4F46E5"
                        style={tw`mr-2`}
                      />
                      <CustomText
                        style={tw`text-[14px] text-indigo-700 flex-1`}
                        weight="Medium"
                      >
                        View Location on Map
                      </CustomText>
                      <Feather name="chevron-right" size={16} color="#4F46E5" />
                    </TouchableOpacity>
                  )}

                  {sighting.imageUrl && (
                    <TouchableOpacity
                      style={tw`w-full h-40 rounded-lg overflow-hidden mb-3`}
                      onPress={() =>
                        navigation.navigate("ImageView", {
                          imageUrl: sighting.imageUrl,
                        })
                      }
                    >
                      <Image
                        source={{ uri: sighting.imageUrl }}
                        style={tw`w-full h-full`}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  )}

                  {isOwner && sighting.userId && (
                    <TouchableOpacity
                      style={tw`bg-blue-500 py-2 rounded-lg items-center flex-row justify-center`}
                      onPress={() => {
                        setShowSightingsModal(false);
                        setShowChatModal(true);
                      }}
                    >
                      <Feather
                        name="message-circle"
                        size={16}
                        color="white"
                        style={tw`mr-2`}
                      />
                      <CustomText
                        style={tw`text-white text-[14px]`}
                        weight="Medium"
                      >
                        Contact Reporter
                      </CustomText>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showCommunitySearchModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCommunitySearchModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Create Community Search
              </CustomText>
              <TouchableOpacity
                onPress={() => setShowCommunitySearchModal(false)}
              >
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`mb-6`}>
              <CustomText
                style={tw`text-[14px] text-gray-700 mb-2`}
                weight="Medium"
              >
                Search Details
              </CustomText>
              <View
                style={tw`bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4`}
              >
                <CustomTextInput
                  style={tw`text-gray-800 min-h-[100px]`}
                  placeholder="Describe the search (e.g., areas to focus on, times, etc.)"
                  value={communitySearchDetails}
                  onChangeText={setCommunitySearchDetails}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <CustomText
                style={tw`text-[14px] text-gray-700 mb-2`}
                weight="Medium"
              >
                Search Radius (miles)
              </CustomText>
              <View
                style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3.5 mb-4`}
              >
                <Feather
                  name="map-pin"
                  size={20}
                  color="#6B7280"
                  style={tw`mr-3`}
                />
                <CustomTextInput
                  style={tw`flex-1 text-gray-800`}
                  placeholder="Enter radius in miles"
                  value={communitySearchRadius}
                  onChangeText={setCommunitySearchRadius}
                  keyboardType="numeric"
                />
              </View>

              <View style={tw`bg-blue-50 p-3 rounded-lg`}>
                <View style={tw`flex-row items-start`}>
                  <Feather
                    name="info"
                    size={16}
                    color="#3B82F6"
                    style={tw`mr-2 mt-0.5`}
                  />
                  <CustomText style={tw`text-[12px] text-blue-700 flex-1`}>
                    This will notify users within the specified radius to join
                    the search for {pet.petName || "your pet"}.
                  </CustomText>
                </View>
              </View>
            </View>

            <View style={tw`flex-row`}>
              <TouchableOpacity
                style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                onPress={() => setShowCommunitySearchModal(false)}
              >
                <CustomText
                  style={tw`text-gray-700 text-[16px]`}
                  weight="SemiBold"
                >
                  Cancel
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`bg-purple-500 py-3 rounded-xl items-center justify-center flex-1`}
                onPress={handleCreateCommunitySearch}
                disabled={communitySearchLoading}
              >
                {communitySearchLoading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <CustomText
                    style={tw`text-white text-[16px]`}
                    weight="SemiBold"
                  >
                    Create Search
                  </CustomText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PetDetailsScreen;
