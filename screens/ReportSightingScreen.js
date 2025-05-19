"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from "react-native"
import { useNavigation, useRoute } from "@react-navigation/native"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
import * as Location from "expo-location"
import * as ImagePicker from "expo-image-picker"
import tw from "twrnc"
import { Feather } from "@expo/vector-icons"
import CustomText from "../components/CustomText"

import { auth, db } from "../firebaseConfig"
// No need for Firebase Storage imports when using Cloudinary
import { collection, addDoc, serverTimestamp } from "firebase/firestore"

const ReportSightingScreen = () => {
  const navigation = useNavigation()
  const route = useRoute()
  const { pet } = route.params || {}

  const [location, setLocation] = useState(null)
  const [description, setDescription] = useState("")
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [initialRegion, setInitialRegion] = useState(null)
  const [markerLocation, setMarkerLocation] = useState(null)
  const [confidence, setConfidence] = useState("high") // high, medium, low
  const [submitting, setSubmitting] = useState(false)

  const mapRef = useRef(null)

  useEffect(() => {
    getLocationPermission()
  }, [])

  const getLocationPermission = async () => {
    setLoading(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()

      if (status !== "granted") {
        Alert.alert("Permission Denied", "Permission to access location was denied")
        setLoading(false)
        return
      }

      const locationData = await Location.getCurrentPositionAsync({})
      const currentLocation = {
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
      }

      setLocation(currentLocation)
      setMarkerLocation(currentLocation)

      setInitialRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      })

      setLoading(false)
    } catch (error) {
      console.error("Error getting location:", error)
      Alert.alert("Error", "Failed to get your location. Please try again.")
      setLoading(false)
    }
  }

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent
    setMarkerLocation(coordinate)
  }

  const pickImage = async () => {
    if (images.length >= 3) {
      Alert.alert("Limit Reached", "You can only upload up to 3 images")
      return
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission Denied", "Permission to access media library was denied")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImages([...images, result.assets[0].uri])
    }
  }

  const takePhoto = async () => {
    if (images.length >= 3) {
      Alert.alert("Limit Reached", "You can only upload up to 3 images")
      return
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission Denied", "Permission to access camera was denied")
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImages([...images, result.assets[0].uri])
    }
  }

  const removeImage = (index) => {
    const newImages = [...images]
    newImages.splice(index, 1)
    setImages(newImages)
  }

  const uploadToCloudinary = async (uri) => {
    try {
      // Create form data for the image upload
      const formData = new FormData()

      // Get the filename from the URI
      const uriParts = uri.split("/")
      const filename = uriParts[uriParts.length - 1]

      // Append the image file to the form data
      formData.append("file", {
        uri,
        type: "image/jpeg", // Adjust based on your image type
        name: filename,
      })

      // Replace with your Cloudinary upload preset and cloud name
      formData.append("upload_preset", "Avatar")
      const cloudName = "dwa7agaju"

      // Make the upload request to Cloudinary
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "Content-Type": "multipart/form-data",
        },
      })

      // Parse the response
      const responseData = await response.json()

      if (response.ok) {
        return {
          secure_url: responseData.secure_url,
          public_id: responseData.public_id,
        }
      } else {
        throw new Error(responseData.error?.message || "Upload failed")
      }
    } catch (error) {
      console.error("Cloudinary upload error:", error)
      Alert.alert("Upload Error", "Failed to upload image to Cloudinary")
      return null
    }
  }

  const handleSubmit = async () => {
    if (!markerLocation) {
      Alert.alert("Missing Location", "Please select a location on the map")
      return
    }

    if (!description.trim()) {
      Alert.alert("Missing Description", "Please provide a description of the sighting")
      return
    }

    setSubmitting(true)

    try {
      if (!auth.currentUser) {
        throw new Error("You must be logged in to report a sighting")
      }

      // Upload images to Cloudinary
      const imageUrls = []

      for (const imageUri of images) {
        const cloudinaryResponse = await uploadToCloudinary(imageUri)
        if (cloudinaryResponse) {
          imageUrls.push(cloudinaryResponse.secure_url)
        }
      }

      // Add sighting to Firestore
      await addDoc(collection(db, "sightings"), {
        petId: pet?.id,
        petName: pet?.petName,
        petType: pet?.petType,
        location: {
          latitude: markerLocation.latitude,
          longitude: markerLocation.longitude,
        },
        description,
        confidence,
        imageUrls,
        reportedBy: auth.currentUser.uid,
        reportedByName: auth.currentUser.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      })

      Alert.alert("Sighting Reported", "Thank you for reporting this sighting. Pet owners have been notified.", [
        {
          text: "OK",
          onPress: () => {
            navigation.goBack()
          },
        },
      ])
    } catch (error) {
      console.error("Error submitting sighting:", error)
      Alert.alert("Error", "Failed to submit sighting. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-gray-50`}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 64 : 0}
    >
      <View style={tw`flex-1`}>
        {/* Header */}
        <View style={tw`bg-white shadow-sm z-10`}>
          <View style={tw`px-4 pt-10 pb-4 flex-row items-center justify-between`}>
            <TouchableOpacity
              style={tw`w-10 h-10 rounded-full bg-gray-100 items-center justify-center`}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={20} color="#4B5563" />
            </TouchableOpacity>

            <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
              Report Sighting
            </CustomText>

            <View style={tw`w-10`} />
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-6`}>
          {/* Pet Info (if provided) */}
          {pet && (
            <View style={tw`mx-4 mt-4 bg-blue-50 p-4 rounded-xl`}>
              <View style={tw`flex-row items-center`}>
                <View style={tw`w-12 h-12 rounded-xl bg-blue-100 items-center justify-center mr-3`}>
                  {pet.image ? (
                    <Image source={pet.image} style={tw`w-10 h-10 rounded-lg`} resizeMode="cover" />
                  ) : (
                    <Feather
                      name={pet.petType?.toLowerCase() === "cat" ? "github" : "github"}
                      size={24}
                      color="#3B82F6"
                    />
                  )}
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                    Reporting sighting of {pet.petName || "Unknown Pet"}
                  </CustomText>
                  <CustomText style={tw`text-[13px] text-gray-600`}>
                    {pet.petBreed || "Unknown Breed"} • {pet.petType || "Unknown Type"}
                  </CustomText>
                </View>
              </View>
            </View>
          )}

          {/* Map Section */}
          <View style={tw`mx-4 mt-4`}>
            <CustomText style={tw`text-[16px] text-gray-800 mb-2`} weight="SemiBold">
              Location of Sighting
            </CustomText>
            <CustomText style={tw`text-[13px] text-gray-600 mb-3`}>
              Tap on the map to mark where you saw the pet
            </CustomText>

            <View style={tw`h-64 rounded-xl overflow-hidden border border-gray-200`}>
              {loading ? (
                <View style={tw`flex-1 items-center justify-center bg-gray-100`}>
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <CustomText style={tw`text-gray-500 mt-2`}>Loading map...</CustomText>
                </View>
              ) : initialRegion ? (
                <MapView
                  ref={mapRef}
                  style={tw`flex-1`}
                  provider={PROVIDER_GOOGLE}
                  initialRegion={initialRegion}
                  onPress={handleMapPress}
                >
                  {markerLocation && (
                    <Marker
                      coordinate={markerLocation}
                      title="Sighting Location"
                      description="Pet was seen here"
                      draggable
                      onDragEnd={(e) => setMarkerLocation(e.nativeEvent.coordinate)}
                    >
                      <View style={tw`items-center`}>
                        <View
                          style={tw`w-8 h-8 rounded-full bg-green-500 items-center justify-center border-2 border-white shadow-md`}
                        >
                          <Feather name="eye" size={16} color="white" />
                        </View>
                      </View>
                    </Marker>
                  )}
                </MapView>
              ) : (
                <View style={tw`flex-1 items-center justify-center bg-gray-100`}>
                  <Feather name="map-pin" size={32} color="#9CA3AF" />
                  <CustomText style={tw`text-gray-500 mt-2`}>Could not load map</CustomText>
                  <TouchableOpacity style={tw`mt-2 bg-blue-500 px-4 py-2 rounded-lg`} onPress={getLocationPermission}>
                    <CustomText style={tw`text-white`}>Retry</CustomText>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <CustomText style={tw`text-[12px] text-gray-500 mt-2`}>
              You can drag the marker to adjust the exact location
            </CustomText>
          </View>

          {/* Description Section */}
          <View style={tw`mx-4 mt-6`}>
            <CustomText style={tw`text-[16px] text-gray-800 mb-2`} weight="SemiBold">
              Description
            </CustomText>
            <CustomText style={tw`text-[13px] text-gray-600 mb-3`}>
              Provide details about the pet and the sighting
            </CustomText>

            <TextInput
              style={tw`bg-white border border-gray-200 rounded-xl p-3 min-h-[100px] text-gray-800`}
              placeholder="Describe what you saw (appearance, behavior, direction of travel, etc.)"
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Confidence Level */}
          <View style={tw`mx-4 mt-6`}>
            <CustomText style={tw`text-[16px] text-gray-800 mb-2`} weight="SemiBold">
              Confidence Level
            </CustomText>
            <CustomText style={tw`text-[13px] text-gray-600 mb-3`}>
              How confident are you that this was the missing pet?
            </CustomText>

            <View style={tw`flex-row`}>
              <TouchableOpacity
                style={tw`flex-1 p-3 rounded-l-xl border ${
                  confidence === "high" ? "bg-green-100 border-green-300" : "bg-white border-gray-200"
                }`}
                onPress={() => setConfidence("high")}
              >
                <CustomText
                  style={tw`text-center ${confidence === "high" ? "text-green-700" : "text-gray-600"}`}
                  weight={confidence === "high" ? "SemiBold" : "Medium"}
                >
                  High
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-1 p-3 border-t border-b ${
                  confidence === "medium" ? "bg-amber-100 border-amber-300" : "bg-white border-gray-200"
                }`}
                onPress={() => setConfidence("medium")}
              >
                <CustomText
                  style={tw`text-center ${confidence === "medium" ? "text-amber-700" : "text-gray-600"}`}
                  weight={confidence === "medium" ? "SemiBold" : "Medium"}
                >
                  Medium
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-1 p-3 rounded-r-xl border ${
                  confidence === "low" ? "bg-blue-100 border-blue-300" : "bg-white border-gray-200"
                }`}
                onPress={() => setConfidence("low")}
              >
                <CustomText
                  style={tw`text-center ${confidence === "low" ? "text-blue-700" : "text-gray-600"}`}
                  weight={confidence === "low" ? "SemiBold" : "Medium"}
                >
                  Low
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>

          {/* Photos Section */}
          <View style={tw`mx-4 mt-6`}>
            <CustomText style={tw`text-[16px] text-gray-800 mb-2`} weight="SemiBold">
              Photos (Optional)
            </CustomText>
            <CustomText style={tw`text-[13px] text-gray-600 mb-3`}>Add photos of the pet you saw (up to 3)</CustomText>

            <View style={tw`flex-row mb-3`}>
              <TouchableOpacity
                style={tw`flex-1 bg-blue-500 py-3 rounded-xl items-center justify-center mr-3`}
                onPress={takePhoto}
              >
                <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                  Take Photo
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-1 bg-gray-200 py-3 rounded-xl items-center justify-center`}
                onPress={pickImage}
              >
                <CustomText style={tw`text-gray-700 text-[14px]`} weight="SemiBold">
                  Upload Photo
                </CustomText>
              </TouchableOpacity>
            </View>

            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`py-2`}>
                {images.map((uri, index) => (
                  <View key={index} style={tw`mr-3 relative`}>
                    <Image source={{ uri }} style={tw`w-24 h-24 rounded-lg bg-gray-200`} resizeMode="cover" />
                    <TouchableOpacity
                      style={tw`absolute top-1 right-1 bg-red-500 rounded-full w-6 h-6 items-center justify-center`}
                      onPress={() => removeImage(index)}
                    >
                      <Feather name="x" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Submit Button */}
          <View style={tw`mx-4 mt-8`}>
            <TouchableOpacity
              style={tw`bg-blue-500 py-4 rounded-xl items-center justify-center ${submitting ? "opacity-70" : ""}`}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <View style={tw`flex-row items-center`}>
                  <ActivityIndicator size="small" color="white" style={tw`mr-2`} />
                  <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
                    Submitting...
                  </CustomText>
                </View>
              ) : (
                <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
                  Submit Sighting Report
                </CustomText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

export default ReportSightingScreen
