"use client";

import { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import tw from "twrnc";
import CustomText from "../components/CustomText";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { signOut, updateProfile } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

const ProfileScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [userStats, setUserStats] = useState({
    petsReported: 0,
    petsFound: 0,
    searchParties: 0,
    successfulReunions: 0,
    rating: 0,
    totalRatings: 0,
  });
  const [badges, setBadges] = useState([
    {
      id: "searcher",
      name: "Searcher",
      icon: "search",
      color: "#22C55E",
      earned: false,
    },
    {
      id: "rescuer",
      name: "Rescuer",
      icon: "heart",
      color: "#2A80FD",
      earned: false,
    },
    {
      id: "helper",
      name: "Helper",
      icon: "users",
      color: "#F59E0B",
      earned: false,
    },
    {
      id: "expert",
      name: "Expert",
      icon: "star",
      color: "#8B5CF6",
      earned: false,
    },
    {
      id: "leader",
      name: "Leader",
      icon: "award",
      color: "#EF4444",
      earned: false,
    },
  ]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchUserData();
    fetchUserStats();
    fetchNotifications();
  }, []);

  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        });
        return;
      }

      setUserData({
        uid: currentUser.uid,
        displayName: currentUser.displayName || "Pet Rescuer",
        email: currentUser.email,
        photoURL: currentUser.photoURL,
      });

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (userDoc.exists()) {
        const additionalData = userDoc.data();
        setUserData((prevData) => ({
          ...prevData,
          displayName:
            additionalData.fullName || currentUser.displayName || "Pet Rescuer",
          email: additionalData.email || currentUser.email,
          role: additionalData.role || "Pet Rescuer",
          joinDate: additionalData.createdAt
            ? new Date(additionalData.createdAt.toDate()).toLocaleDateString()
            : "Unknown",
          phone: additionalData.phoneNumber || "",
          phoneVerified: additionalData.phoneVerified || false,
          address: additionalData.address || "",
        }));

        if (additionalData.badges) {
          setBadges((prevBadges) =>
            prevBadges.map((badge) => ({
              ...badge,
              earned: additionalData.badges.includes(badge.id),
            }))
          );
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to fetch user data. Please try again.");
    }
  };

  const fetchUserStats = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      let reported = 0;
      let found = 0;
      let successfulReunions = 0;
      let rating = 0;
      let totalRatings = 0;

      if (userDoc.exists()) {
        const userData = userDoc.data();
        reported = userData.reportedPets?.length || 0;
        found = userData.foundPets?.length || 0;
        successfulReunions = userData.successfulReunions || 0;
        rating = userData.rating || 0;
        totalRatings = userData.totalRatings || 0;
      }

      const petsQuery = query(
        collection(db, "petReports"),
        where("userId", "==", currentUser.uid)
      );
      const petsSnapshot = await getDocs(petsQuery);

      // Handle empty pet reports silently
      if (!petsSnapshot.empty) {
        petsSnapshot.forEach((doc) => {
          reported++;
          const petData = doc.data();
          if (petData.status === "found" || petData.status === "reunited") {
            found++;
          }
        });
      }

      const searchQuery = query(
        collection(db, "searchParties"),
        where("participants", "array-contains", currentUser.uid)
      );
      const searchSnapshot = await getDocs(searchQuery);

      setUserStats({
        petsReported: reported,
        petsFound: found,
        searchParties: searchSnapshot.size,
        successfulReunions,
        rating,
        totalRatings,
      });

      const updatedBadges = [...badges];
      if (reported >= 1)
        updatedBadges.find((b) => b.id === "searcher").earned = true;
      if (found >= 1)
        updatedBadges.find((b) => b.id === "rescuer").earned = true;
      if (searchSnapshot.size >= 2)
        updatedBadges.find((b) => b.id === "helper").earned = true;
      if (reported >= 5)
        updatedBadges.find((b) => b.id === "expert").earned = true;
      if (searchSnapshot.size >= 5)
        updatedBadges.find((b) => b.id === "leader").earned = true;

      setBadges(updatedBadges);

      await updateDoc(doc(db, "users", currentUser.uid), {
        badges: updatedBadges.filter((b) => b.earned).map((b) => b.id),
      });
    } catch (error) {
      Alert.alert("Error", "Failed to fetch user stats. Please try again.");
    }
  };

  const fetchNotifications = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", currentUser.uid),
        where("read", "==", false)
      );

      const notificationsSnapshot = await getDocs(notificationsQuery);

      // Handle empty notifications silently
      if (!notificationsSnapshot.empty) {
        const notificationsData = notificationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotifications(notificationsData);
      } else {
        setNotifications([]); // Ensure notifications are reset if none are found
      }
    } catch (error) {
      // Silently handle error
    }
  };

  const uploadToCloudinary = async (uri) => {
    try {
      // Create form data for the image upload
      const formData = new FormData();

      // Get the filename from the URI
      const uriParts = uri.split("/");
      const filename = uriParts[uriParts.length - 1];

      // Append the image file to the form data
      formData.append("file", {
        uri,
        type: "image/jpeg", // Adjust based on your image type
        name: filename,
      });

      // Replace with your Cloudinary upload preset and cloud name
      formData.append("upload_preset", "Avatar");
      const cloudName = "dwa7agaju";

      // Make the upload request to Cloudinary
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",  
          body: formData,
          headers: {
            Accept: "application/json",
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Parse the response
      const responseData = await response.json();

      if (response.ok) {
        return {
          secure_url: responseData.secure_url,
          public_id: responseData.public_id,
        };
      } else {
        throw new Error(responseData.error?.message || "Upload failed");
      }
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      Alert.alert("Upload Error", "Failed to upload image to Cloudinary");
      return null;
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    } catch (error) {
      Alert.alert("Error", "Failed to sign out. Please try again.");
      setIsLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access camera was denied"
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  };

  const handleChoosePhoto = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Permission to access media library was denied"
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        uploadProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to choose photo. Please try again.");
    }
  };

  const uploadProfileImage = async (uri) => {
    try {
      setUploadingPhoto(true);
      const currentUser = auth.currentUser;

      // Upload to Cloudinary
      const cloudinaryResponse = await uploadToCloudinary(uri);

      if (!cloudinaryResponse) {
        throw new Error("Failed to upload to Cloudinary");
      }

      const downloadUrl = cloudinaryResponse.secure_url;

      // Update user profile with the Cloudinary URL
      await updateProfile(currentUser, {
        photoURL: downloadUrl,
      });

      // Store the Cloudinary URL and metadata in Firebase
      await updateDoc(doc(db, "users", currentUser.uid), {
        photoURL: downloadUrl,
        cloudinaryPublicId: cloudinaryResponse.public_id, // Store this to manage the image later
        updatedAt: new Date(),
      });

      setUserData((prevData) => ({
        ...prevData,
        photoURL: downloadUrl,
      }));

      setShowPhotoModal(false);
      Alert.alert("Success", "Profile photo updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to upload profile image. Please try again.");
      console.error("Profile image upload error:", error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    try {
      setIsLoading(true);
      const currentUser = auth.currentUser;

      await updateProfile(currentUser, {
        displayName: newName,
      });

      await updateDoc(doc(db, "users", currentUser.uid), {
        fullName: newName,
        updatedAt: new Date(),
      });

      setUserData((prevData) => ({
        ...prevData,
        displayName: newName,
      }));

      setShowEditNameModal(false);
      Alert.alert("Success", "Name updated successfully");
    } catch (error) {
      Alert.alert("Error", "Failed to update name. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const earnedBadgesCount = badges.filter((badge) => badge.earned).length;

  return (
    <View style={tw`flex-1 bg-white pt-12`}>
      <View style={tw`px-6 pb-4 flex-row items-center justify-between`}>
        <CustomText style={tw`text-[24px] text-gray-800`} weight="Bold">
          Profile
        </CustomText>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
          <Feather name="settings" size={22} color="#2A80FD" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={tw`px-6 pt-4 pb-20`}>
        <View style={tw`items-center mb-8`}>
          <View style={tw`relative`}>
            {uploadingPhoto ? (
              <View
                style={tw`w-24 h-24 rounded-full mb-4 bg-gray-200 items-center justify-center`}
              >
                <ActivityIndicator size="small" color="#2A80FD" />
              </View>
            ) : (
              <Image
                source={
                  userData?.photoURL
                    ? { uri: userData.photoURL }
                    : require("../assets/images/slideimg1.png")
                }
                style={tw`w-24 h-24 rounded-full mb-4`}
                resizeMode="cover"
              />
            )}
            <TouchableOpacity
              style={tw`absolute bottom-4 right-0 bg-[#2A80FD] w-8 h-8 rounded-full items-center justify-center border-2 border-white`}
              onPress={() => setShowPhotoModal(true)}
            >
              <Feather name="camera" size={14} color="white" />
            </TouchableOpacity>
          </View>
          <View style={tw`flex-row items-center`}>
            <CustomText
              style={tw`text-[20px] text-gray-800 mb-1`}
              weight="Bold"
            >
              {userData?.displayName || "Loading..."}
            </CustomText>
            <TouchableOpacity
              style={tw`ml-2 mb-1`}
              onPress={() => {
                setNewName(userData?.displayName || "");
                setShowEditNameModal(true);
              }}
            >
              <Feather name="edit-2" size={16} color="#2A80FD" />
            </TouchableOpacity>
          </View>
          <CustomText style={tw`text-[16px] text-gray-500`}>
            {userData?.role || "Pet Rescuer"}
          </CustomText>
          {userData?.joinDate && (
            <CustomText style={tw`text-[14px] text-gray-400 mt-1`}>
              Member since {userData.joinDate}
            </CustomText>
          )}
          {userData?.phoneNumber && (
            <View style={tw`flex-row items-center mt-1`}>
              <CustomText style={tw`text-[14px] text-gray-400`}>
                {userData.phoneNumber}
              </CustomText>
              {userData.phoneVerified && (
                <Feather
                  name="check-circle"
                  size={14}
                  color="#22C55E"
                  style={tw`ml-1`}
                />
              )}
            </View>
          )}
          {userData?.email && (
            <CustomText style={tw`text-[14px] text-gray-400 mt-1`}>
              {userData.email}
            </CustomText>
          )}
        </View>

        <View style={tw`bg-white rounded-xl shadow-sm p-4 mb-6`}>
          <View style={tw`flex-row items-center mb-4`}>
            <View
              style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}
            >
              <Feather name="bar-chart-2" size={20} color="#2A80FD" />
            </View>
            <View>
              <CustomText
                style={tw`text-[16px] text-gray-800`}
                weight="SemiBold"
              >
                Your Activity
              </CustomText>
              <CustomText style={tw`text-[14px] text-gray-500`}>
                Your rescue contributions
              </CustomText>
            </View>
          </View>

          <View style={tw`flex-row justify-around mb-2 flex-wrap`}>
            <View style={tw`items-center w-1/3 mb-2`}>
              <CustomText style={tw`text-[24px] text-[#2A80FD]`} weight="Bold">
                {userStats.petsReported}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-600`}>
                Pets Reported
              </CustomText>
            </View>

            <View style={tw`items-center w-1/3 mb-2`}>
              <CustomText style={tw`text-[24px] text-[#22C55E]`} weight="Bold">
                {userStats.petsFound}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-600`}>
                Pets Found
              </CustomText>
            </View>

            <View style={tw`items-center w-1/3 mb-2`}>
              <CustomText style={tw`text-[24px] text-[#F59E0B]`} weight="Bold">
                {userStats.searchParties}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-600`}>
                Search Parties
              </CustomText>
            </View>

            <View style={tw`items-center w-1/3 mb-2`}>
              <CustomText style={tw`text-[24px] text-[#EF4444]`} weight="Bold">
                {userStats.successfulReunions}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-600`}>
                Reunions
              </CustomText>
            </View>

            <View style={tw`items-center w-1/3 mb-2`}>
              <CustomText style={tw`text-[24px] text-[#8B5CF6]`} weight="Bold">
                {userStats.rating.toFixed(1)}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-600`}>
                Rating
              </CustomText>
            </View>

            <View style={tw`items-center w-1/3 mb-2`}>
              <CustomText style={tw`text-[24px] text-[#F59E0B]`} weight="Bold">
                {userStats.totalRatings}
              </CustomText>
              <CustomText style={tw`text-[12px] text-gray-600`}>
                Total Ratings
              </CustomText>
            </View>
          </View>
        </View>

        <View style={tw`bg-white rounded-xl shadow-sm p-4 mb-6`}>
          <View style={tw`flex-row items-center mb-4`}>
            <View
              style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}
            >
              <Feather name="award" size={20} color="#2A80FD" />
            </View>
            <View>
              <CustomText
                style={tw`text-[16px] text-gray-800`}
                weight="SemiBold"
              >
                Rescue Badges
              </CustomText>
              <CustomText style={tw`text-[14px] text-gray-500`}>
                {earnedBadgesCount} badges earned
              </CustomText>
            </View>
          </View>

          <View style={tw`flex-row justify-around mb-2 flex-wrap`}>
            {badges.slice(0, 3).map((badge) => (
              <View key={badge.id} style={tw`items-center mb-4`}>
                <View
                  style={tw`w-12 h-12 rounded-full ${
                    badge.earned
                      ? `bg-${badge.color.substring(1)}-100`
                      : "bg-gray-100"
                  } items-center justify-center mb-2`}
                >
                  <Feather
                    name={badge.icon}
                    size={20}
                    color={badge.earned ? badge.color : "#9CA3AF"}
                  />
                </View>
                <CustomText
                  style={tw`text-[12px] ${
                    badge.earned ? "text-gray-800" : "text-gray-400"
                  }`}
                >
                  {badge.name}
                </CustomText>
              </View>
            ))}
          </View>

          {badges.length > 3 && (
            <TouchableOpacity
              style={tw`mt-2 items-center`}
              onPress={() => navigation.navigate("Badges")}
            >
              <CustomText
                style={tw`text-[14px] text-[#2A80FD]`}
                weight="Medium"
              >
                View All Badges
              </CustomText>
            </TouchableOpacity>
          )}
        </View>

        <View style={tw`bg-white rounded-xl shadow-sm overflow-hidden mb-6`}>
          <TouchableOpacity
            style={tw`flex-row items-center p-4 border-b border-gray-100`}
            onPress={() => navigation.navigate("AccountSettings")}
          >
            <Feather name="user" size={20} color="#2A80FD" style={tw`mr-3`} />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                My Account
              </CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center p-4 border-b border-gray-100`}
            onPress={() => navigation.navigate("Notifications")}
          >
            <Feather name="bell" size={20} color="#2A80FD" style={tw`mr-3`} />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                Notifications
              </CustomText>
            </View>
            {notifications.length > 0 && (
              <View
                style={tw`bg-red-500 w-6 h-6 rounded-full items-center justify-center mr-2`}
              >
                <CustomText style={tw`text-white text-[12px]`} weight="Bold">
                  {notifications.length}
                </CustomText>
              </View>
            )}
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center p-4 border-b border-gray-100`}
            onPress={() => navigation.navigate("MyPets")}
          >
            <Feather name="heart" size={20} color="#2A80FD" style={tw`mr-3`} />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                My Pets
              </CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center p-4 border-b border-gray-100`}
            onPress={() => navigation.navigate("SavedLocations")}
          >
            <Feather
              name="map-pin"
              size={20}
              color="#2A80FD"
              style={tw`mr-3`}
            />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                My Locations
              </CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center p-4`}
            onPress={() => navigation.navigate("HelpSupport")}
          >
            <Feather
              name="help-circle"
              size={20}
              color="#2A80FD"
              style={tw`mr-3`}
            />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                Help & Support
              </CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={tw`bg-white rounded-xl shadow-sm overflow-hidden mb-6`}>
          <TouchableOpacity
            style={tw`flex-row items-center p-4 border-b border-gray-100`}
            onPress={() => navigation.navigate("PrivacySettings")}
          >
            <Feather name="shield" size={20} color="#2A80FD" style={tw`mr-3`} />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                Privacy Settings
              </CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center p-4`}
            onPress={() => navigation.navigate("About")}
          >
            <Feather name="info" size={20} color="#2A80FD" style={tw`mr-3`} />
            <View style={tw`flex-1`}>
              <CustomText style={tw`text-[16px] text-gray-800`}>
                About PetResQ
              </CustomText>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={tw`flex-row items-center justify-center p-4 bg-red-50 rounded-xl`}
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#EF4444" style={tw`mr-2`} />
          ) : (
            <Feather
              name="log-out"
              size={20}
              color="#EF4444"
              style={tw`mr-2`}
            />
          )}
          <CustomText style={tw`text-[16px] text-red-500`} weight="SemiBold">
            {isLoading ? "Signing Out..." : "Sign Out"}
          </CustomText>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showPhotoModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Update Profile Photo
              </CustomText>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`flex-row mb-6`}>
              <TouchableOpacity
                style={tw`bg-[#2A80FD] py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                onPress={handleTakePhoto}
                disabled={uploadingPhoto}
              >
                <CustomText
                  style={tw`text-white text-[16px]`}
                  weight="SemiBold"
                >
                  Take Photo
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1`}
                onPress={handleChoosePhoto}
                disabled={uploadingPhoto}
              >
                <CustomText
                  style={tw`text-gray-700 text-[16px]`}
                  weight="SemiBold"
                >
                  Choose Photo
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEditNameModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEditNameModal(false)}
      >
        <View style={tw`flex-1 bg-black/50 justify-end`}>
          <View style={tw`bg-white rounded-t-3xl p-6`}>
            <View style={tw`flex-row justify-between items-center mb-6`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Update Name
              </CustomText>
              <TouchableOpacity onPress={() => setShowEditNameModal(false)}>
                <Feather name="x" size={24} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={tw`mb-6`}>
              <CustomText
                style={tw`text-[14px] text-gray-700 mb-2`}
                weight="Medium"
              >
                Full Name
              </CustomText>
              <TextInput
                style={tw`bg-gray-100 rounded-lg px-4 py-3 text-gray-800`}
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter your name"
              />
            </View>

            <View style={tw`flex-row`}>
              <TouchableOpacity
                style={tw`bg-gray-200 py-3 rounded-xl items-center justify-center flex-1 mr-3`}
                onPress={() => setShowEditNameModal(false)}
              >
                <CustomText
                  style={tw`text-gray-700 text-[16px]`}
                  weight="SemiBold"
                >
                  Cancel
                </CustomText>
              </TouchableOpacity>
              <TouchableOpacity
                style={tw`bg-[#2A80FD] py-3 rounded-xl items-center justify-center flex-1`}
                onPress={handleUpdateName}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <CustomText
                    style={tw`text-white text-[16px]`}
                    weight="SemiBold"
                  >
                    Save
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

export default ProfileScreen;
