"use client"

import { useState, useRef, useEffect } from "react"
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Dimensions,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import tw from "twrnc"
import CustomText from "../components/CustomText"
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps"
import DateTimePicker from "@react-native-community/datetimepicker"
import CustomTextInput from "../components/CustomTextInput"
import { auth, db } from "../firebaseConfig"
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore"
import { LinearGradient } from "expo-linear-gradient"

const { width, height } = Dimensions.get("window")

const ReportScreen = () => {
  const navigation = useNavigation()
  const [reportType, setReportType] = useState(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [petType, setPetType] = useState("")
  const [petBreed, setPetBreed] = useState("")
  const [petColor, setPetColor] = useState("")
  const [petSize, setPetSize] = useState("")
  const [petName, setPetName] = useState("")
  const [petGender, setPetGender] = useState("")
  const [location, setLocation] = useState(null)
  const [dateTime, setDateTime] = useState("")
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [contactName, setContactName] = useState("")
  const [contactPhone, setContactPhone] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [additionalInfo, setAdditionalInfo] = useState("")
  const [behavioralContext, setBehavioralContext] = useState("")
  const [behavioralTrait, setBehavioralTrait] = useState([])
  const [environmentalFactors, setEnvironmentalFactors] = useState([])
  const [images, setImages] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [focusedField, setFocusedField] = useState("")
  const [showMapModal, setShowMapModal] = useState(false)
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  })
  const [markerPosition, setMarkerPosition] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [weatherCondition, setWeatherCondition] = useState("")
  const [searchProbability, setSearchProbability] = useState(0)
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false)
  const [distinctiveFeatures, setDistinctiveFeatures] = useState([])
  const [verificationMethods, setVerificationMethods] = useState([])
  const [userRole, setUserRole] = useState("dual") // "owner", "rescuer", or "dual"
  const [potentialMatches, setPotentialMatches] = useState([])
  const [showPotentialMatches, setShowPotentialMatches] = useState(false)
  const [isAnalyzingImages, setIsAnalyzingImages] = useState(false)

  const scrollViewRef = useRef(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current
  const mapRef = useRef(null)
  const successAnimationValue = useRef(new Animated.Value(0)).current
  const successScaleValue = useRef(new Animated.Value(0.3)).current

  const behavioralContexts = [
    { id: "hiding", label: "Hiding", icon: "shield" },
    { id: "wandering", label: "Wandering", icon: "map" },
    { id: "injured", label: "Injured", icon: "activity" },
    { id: "aggressive", label: "Aggressive", icon: "alert-triangle" },
  ]

  const behavioralTraits = [
    { id: "scared", label: "Scared/Fearful", icon: "alert-circle", color: "#3B82F6" },
    { id: "friendly", label: "Friendly/Approachable", icon: "heart", color: "#3B82F6" },
    { id: "aggressive", label: "Aggressive/Defensive", icon: "shield", color: "#3B82F6" },
    { id: "confused", label: "Confused/Disoriented", icon: "help-circle", color: "#3B82F6" },
  ]

  const environmentalFactorsList = [
    { id: "urban", label: "Urban Area", icon: "home", color: "#3B82F6" },
    { id: "rural", label: "Rural/Woods", icon: "sunset", color: "#3B82F6" },
    { id: "water", label: "Near Water", icon: "droplet", color: "#3B82F6" },
    { id: "traffic", label: "High Traffic", icon: "truck", color: "#3B82F6" },
    { id: "noise", label: "Loud Noises", icon: "volume-2", color: "#3B82F6" },
  ]

  const weatherConditions = [
    { id: "clear", label: "Clear/Sunny", icon: "sun", color: "#3B82F6" },
    { id: "rain", label: "Rainy", icon: "cloud-rain", color: "#3B82F6" },
    { id: "wind", label: "Windy", icon: "wind", color: "#3B82F6" },
    { id: "thunder", label: "Thunderstorm", icon: "zap", color: "#3B82F6" },
    { id: "snow", label: "Snow", icon: "cloud-snow", color: "#3B82F6" },
  ]

  const distinctiveFeaturesList = [
    { id: "collar", label: "Collar/Tag", icon: "tag", color: "#3B82F6" },
    { id: "scar", label: "Scar/Mark", icon: "star", color: "#3B82F6" },
    { id: "limp", label: "Limp/Gait", icon: "activity", color: "#3B82F6" },
    { id: "eye", label: "Eye Color/Issue", icon: "eye", color: "#3B82F6" },
    { id: "ear", label: "Ear Shape/Mark", icon: "triangle", color: "#3B82F6" },
    { id: "tail", label: "Tail Feature", icon: "minus", color: "#3B82F6" },
  ]

  const verificationMethodsList = [
    { id: "visual", label: "Visual ID", icon: "eye", color: "#3B82F6" },
    { id: "collar", label: "Collar/Tag", icon: "tag", color: "#3B82F6" },
    { id: "physical", label: "Distinctive Features", icon: "star", color: "#3B82F6" },
    { id: "behavior", label: "Behavior Response", icon: "activity", color: "#3B82F6" },
    { id: "photo", label: "Photo Matching", icon: "image", color: "#3B82F6" },
  ]

  // Fetch user role preference from Firebase on component mount
  useEffect(() => {
    const fetchUserRole = async () => {
      if (auth.currentUser) {
        try {
          const userRef = collection(db, "users")
          const q = query(userRef, where("userId", "==", auth.currentUser.uid))
          const querySnapshot = await getDocs(q)

          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data()
            if (userData.preferredRole) {
              setUserRole(userData.preferredRole)
            }
          }
        } catch (error) {
          console.error("Error fetching user role:", error)
        }
      }
    }

    fetchUserRole()
  }, [])

  const handleMapPress = (e) => {
    const { coordinate } = e.nativeEvent
    setMarkerPosition(coordinate)
    setMapRegion({
      ...mapRegion,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    })
    setLocation({
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    })
  }

  const focusOnUserLocation = () => {
    if (mapRef.current) {
      mapRef.current.getCamera().then((camera) => {
        mapRef.current.animateCamera({
          center: {
            latitude: mapRegion.latitude,
            longitude: mapRegion.longitude,
          },
          zoom: 15,
        })
      })
    }
  }

  const confirmLocation = () => {
    if (markerPosition) {
      setShowMapModal(false)
    } else {
      Alert.alert("No Location Selected", "Please select a location on the map")
    }
  }

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setSelectedDate(selectedDate)
      setShowTimePicker(true)
    }
  }

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false)
    if (selectedTime) {
      const combinedDateTime = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        selectedTime.getHours(),
        selectedTime.getMinutes(),
      )
      setSelectedDate(combinedDateTime)
      setDateTime(combinedDateTime.toLocaleString())
    }
  }

  const openDateTimePicker = () => {
    setShowDatePicker(true)
  }

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
    ]).start()
  }, [reportType, currentStep])

  // Calculate search probability based on provided information
  useEffect(() => {
    if (reportType === "lost") {
      let probability = 70 // Base probability

      // Add points for more complete information
      if (petType) probability += 5
      if (petBreed) probability += 3
      if (petColor) probability += 3
      if (location) probability += 5
      if (dateTime) probability += 3
      if (images.length > 0) probability += 5 * images.length
      if (behavioralTrait.length > 0) probability += 3 * behavioralTrait.length
      if (environmentalFactors.length > 0) probability += 2 * environmentalFactors.length
      if (weatherCondition) probability += 4
      if (distinctiveFeatures.length > 0) probability += 3 * distinctiveFeatures.length

      // Cap at 98%
      setSearchProbability(Math.min(98, probability))
    }
  }, [
    reportType,
    petType,
    petBreed,
    petColor,
    location,
    dateTime,
    images,
    behavioralTrait,
    environmentalFactors,
    weatherCondition,
    distinctiveFeatures,
  ])

  // Simulate AI analysis of images to find potential matches
  useEffect(() => {
    if (reportType === "found" && images.length > 0 && currentStep === 4) {
      setIsAnalyzingImages(true)

      // Simulate AI processing delay
      const timer = setTimeout(() => {
        // Mock data for potential matches
        const mockMatches = [
          {
            id: "match1",
            petName: "Max",
            petType: "Dog",
            petBreed: "Golden Retriever",
            distance: "1.2 miles away",
            matchConfidence: 87,
            reportedBy: "John D.",
            reportedTime: "2 days ago",
            image: require("../assets/images/black_logo.png"),
          },
          {
            id: "match2",
            petName: "Luna",
            petType: "Cat",
            petBreed: "Siamese",
            distance: "0.8 miles away",
            matchConfidence: 92,
            reportedBy: "Sarah M.",
            reportedTime: "1 day ago",
            image: require("../assets/images/black_logo.png"),
          },
        ]

        // Only show matches if they match the pet type
        const filteredMatches = mockMatches.filter((match) => match.petType.toLowerCase() === petType.toLowerCase())

        setPotentialMatches(filteredMatches)
        setIsAnalyzingImages(false)

        if (filteredMatches.length > 0) {
          setShowPotentialMatches(true)
        }
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [reportType, images, currentStep, petType])

  const petTypes = [
    { id: "Dog", icon: "dog", label: "Dog" },
    { id: "Cat", icon: "cat", label: "Cat" },
  ]

  const petSizes = [
    { id: "Small", label: "Small", description: "<20 lbs" },
    { id: "Medium", label: "Medium", description: "20-50 lbs" },
    { id: "Large", label: "Large", description: ">50 lbs" },
  ]

  const petGenders = [
    { id: "Male", icon: "gender-male", label: "Male" },
    { id: "Female", icon: "gender-female", label: "Female" },
  ]

  const pickImage = async () => {
    if (images.length >= 3) {
      Alert.alert("Maximum Images", "You can only upload up to 3 images")
      return
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library")
      return
    }

    try {
      setIsAnalyzingImages(true)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages([...images, result.assets[0].uri])
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.")
    } finally {
      setIsAnalyzingImages(false)
    }
  }

  const takePhoto = async () => {
    if (images.length >= 3) {
      Alert.alert("Maximum Images", "You can only upload up to 3 images")
      return
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your camera")
      return
    }

    try {
      setIsAnalyzingImages(true)
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImages([...images, result.assets[0].uri])
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo. Please try again.")
    } finally {
      setIsAnalyzingImages(false)
    }
  }

  const removeImage = (index) => {
    const newImages = [...images]
    newImages.splice(index, 1)
    setImages(newImages)
  }

  const toggleBehavioralTrait = (traitId) => {
    if (behavioralTrait.includes(traitId)) {
      setBehavioralTrait(behavioralTrait.filter((id) => id !== traitId))
    } else {
      setBehavioralTrait([...behavioralTrait, traitId])
    }
  }

  const toggleEnvironmentalFactor = (factorId) => {
    if (environmentalFactors.includes(factorId)) {
      setEnvironmentalFactors(environmentalFactors.filter((id) => id !== factorId))
    } else {
      setEnvironmentalFactors([...environmentalFactors, factorId])
    }
  }

  const toggleDistinctiveFeature = (featureId) => {
    if (distinctiveFeatures.includes(featureId)) {
      setDistinctiveFeatures(distinctiveFeatures.filter((id) => id !== featureId))
    } else {
      setDistinctiveFeatures([...distinctiveFeatures, featureId])
    }
  }

  const toggleVerificationMethod = (methodId) => {
    if (verificationMethods.includes(methodId)) {
      setVerificationMethods(verificationMethods.filter((id) => id !== methodId))
    } else {
      setVerificationMethods([...verificationMethods, methodId])
    }
  }

  const validateCurrentStep = () => {
    if (currentStep === 1) {
      if (!petType || !["Dog", "Cat"].includes(petType)) {
        Alert.alert("Missing Information", "Please select either Dog or Cat as the pet type")
        return false
      }
      return true
    } else if (currentStep === 2) {
      if (!location) {
        Alert.alert("Missing Information", "Please select the location where the pet was lost or found")
        return false
      }
      if (reportType === "found" && !behavioralContext) {
        Alert.alert("Missing Information", "Please select the pet's behavioral context")
        return false
      }
      return true
    } else if (currentStep === 3) {
      // For lost pets, we recommend but don't require behavioral traits
      if (reportType === "lost" && behavioralTrait.length === 0 && environmentalFactors.length === 0) {
        Alert.alert(
          "Behavioral Information",
          "Adding behavioral traits and environmental factors will significantly improve search accuracy. Do you want to continue without this information?",
          [
            { text: "Add Information", style: "cancel" },
            { text: "Continue", onPress: () => setCurrentStep(currentStep + 1) },
          ],
        )
        return false
      }
      return true
    } else if (currentStep === 4) {
      return true
    } else if (currentStep === 5) {
      if (!contactPhone && !contactEmail) {
        Alert.alert("Missing Information", "Please provide at least one contact method")
        return false
      }
      return true
    }
    return true
  }

  const nextStep = () => {
    if (validateCurrentStep()) {
      if (currentStep < 5) {
        setCurrentStep(currentStep + 1)
        scrollViewRef.current?.scrollTo({ y: 0, animated: true })
      } else {
        handleSubmit()
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      scrollViewRef.current?.scrollTo({ y: 0, animated: true })
    } else {
      setReportType(null)
    }
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

  const uploadImageToStorage = async (uri, reportId, index) => {
    try {
      // Upload to Cloudinary
      const cloudinaryResponse = await uploadToCloudinary(uri)

      if (!cloudinaryResponse) {
        throw new Error("Failed to upload to Cloudinary")
      }

      // Return the secure URL from Cloudinary
      return cloudinaryResponse.secure_url
    } catch (error) {
      console.error("Image upload error:", error)
      throw error
    }
  }

  // Generate a behavior prediction based on pet type and selected traits
  const generateBehaviorPrediction = () => {
    let prediction = ""

    if (petType === "Dog") {
      if (behavioralTrait.includes("scared")) {
        prediction =
          "Likely to hide in enclosed spaces or run away from loud noises. May travel 1-3 miles from last location."
      } else if (behavioralTrait.includes("friendly")) {
        prediction = "May approach humans for help. Likely to stay within 1 mile of last location."
      } else {
        prediction = "Likely to follow scent trails and seek familiar areas. May travel 1-3 miles from last location."
      }
    } else if (petType === "Cat") {
      if (behavioralTrait.includes("scared")) {
        prediction =
          "Likely hiding within 3-5 houses from last location. May be in small, dark spaces like under porches or in garages."
      } else if (behavioralTrait.includes("friendly")) {
        prediction = "May approach humans for food. Typically stays within 500 feet of last location."
      } else {
        prediction =
          "Likely to find elevated hiding spots or dense vegetation. Usually stays within 1/4 mile of last location."
      }
    }

    // Add environmental factors to prediction
    if (environmentalFactors.includes("urban")) {
      prediction += " In urban areas, check under vehicles, porches, and quiet corners."
    } else if (environmentalFactors.includes("rural")) {
      prediction += " In rural areas, check dense vegetation, fallen trees, and abandoned structures."
    }

    // Add weather impact
    if (weatherCondition === "rain" || weatherCondition === "thunder") {
      prediction += " During bad weather, pets often seek shelter in the closest available covered area."
    }

    return prediction
  }

  const runSuccessAnimation = () => {
    setShowSuccessAnimation(true)
    Animated.sequence([
      Animated.timing(successAnimationValue, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(successScaleValue, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(successAnimationValue, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowSuccessAnimation(false)
      successAnimationValue.setValue(0)
      successScaleValue.setValue(0.3)
    })
  }

  const handleSubmit = async () => {
    if (!petType || !["Dog", "Cat"].includes(petType)) {
      Alert.alert("Missing Information", "Please select either Dog or Cat as the pet type")
      setCurrentStep(1)
      return
    }
    if (!location) {
      Alert.alert("Missing Information", "Please select the location where the pet was lost or found")
      setCurrentStep(2)
      return
    }
    if (!contactPhone && !contactEmail) {
      Alert.alert("Missing Information", "Please provide at least one contact method")
      setCurrentStep(5)
      return
    }
    if (reportType === "found" && !behavioralContext) {
      Alert.alert("Missing Information", "Please select the pet's behavioral context")
      setCurrentStep(2)
      return
    }
    if (!auth.currentUser) {
      Alert.alert("Authentication Required", "Please sign in to submit a report")
      navigation.navigate("Login")
      return
    }

    setIsSubmitting(true)
    try {
      const imageUrls = []
      for (let i = 0; i < images.length; i++) {
        const imageUrl = await uploadImageToStorage(images[i], auth.currentUser.uid, i)
        imageUrls.push(imageUrl)
      }

      // Generate behavior prediction for lost pets
      const behaviorPrediction = reportType === "lost" ? generateBehaviorPrediction() : ""

      const reportData = {
        userId: auth.currentUser.uid,
        reportType,
        petType,
        petBreed: petBreed || "",
        petColor: petColor || "",
        petSize: petSize || "",
        petName: petName || "",
        petGender: petGender || "",
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        dateTime,
        contactName: contactName || "",
        contactPhone: contactPhone || "",
        contactEmail: contactEmail || "",
        additionalInfo: additionalInfo || "",
        behavioralContext: reportType === "found" ? behavioralContext : "",
        behavioralTraits: behavioralTrait,
        environmentalFactors: environmentalFactors,
        weatherCondition: weatherCondition || "",
        behaviorPrediction: behaviorPrediction,
        searchProbability: reportType === "lost" ? searchProbability : null,
        imageUrls,
        status: reportType,
        createdAt: serverTimestamp(),
        distinctiveFeatures: distinctiveFeatures,
        verificationMethods: reportType === "lost" ? verificationMethods : [],
        userRole: userRole,
      }

      const docRef = await addDoc(collection(db, "petReports"), reportData)

      const pet = {
        id: docRef.id,
        ...reportData,
      }

      // Run success animation
      runSuccessAnimation()

      setTimeout(() => {
        Alert.alert(
          "Report Submitted",
          "Thank you for your report. It has been saved and will be displayed on the dashboard.",
          [
            {
              text: "OK",
              onPress: () => {
                setReportType(null)
                setCurrentStep(1)
                setPetType("")
                setPetBreed("")
                setPetColor("")
                setPetSize("")
                setPetName("")
                setPetGender("")
                setLocation(null)
                setDateTime("")
                setContactName("")
                setContactPhone("")
                setContactEmail("")
                setAdditionalInfo("")
                setBehavioralContext("")
                setBehavioralTrait([])
                setEnvironmentalFactors([])
                setWeatherCondition("")
                setImages([])
                setDistinctiveFeatures([])
                setVerificationMethods([])
                if (reportType === "lost") {
                  navigation.navigate("AISearchMap", { pet })
                } else {
                  navigation.navigate("Dashboard")
                }
              },
            },
          ],
        )
      }, 2000)
    } catch (error) {
      console.error("Error submitting report:", error)
      Alert.alert("Error", "Failed to submit report. Please try again.")
      setIsSubmitting(false)
    }
  }

  if (!reportType) {
    return (
      <View style={tw`flex-1 bg-white`}>
        <LinearGradient colors={["#3B82F6", "#1E40AF"]} style={tw`absolute top-0 left-0 right-0 h-80`} />
        <View style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between z-10`}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <CustomText style={tw`text-[24px] text-white flex-1 text-center`} weight="Bold">
            Report
          </CustomText>
          <View style={tw`w-6`}></View>
        </View>
        <Animated.View
          style={[tw`flex-1 px-6 pt-4 pb-20 z-10`, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          <View style={tw`items-center justify-center py-10`}>
            <CustomText style={tw`text-[26px] text-white mb-3 text-center`} weight="Bold">
              Report a Pet
            </CustomText>
            <CustomText style={tw`text-[16px] text-white text-center mb-12 px-6 leading-6 opacity-90`}>
              Help reunite pets with their owners by reporting a lost pet or a pet you've found
            </CustomText>

            <View style={tw`w-full mt-4`}>
              <TouchableOpacity
                style={tw`bg-white w-full py-5 px-6 rounded-2xl mb-4 flex-row items-center justify-center shadow-xl`}
                onPress={() => setReportType("lost")}
              >
                <View style={tw`w-12 h-12 rounded-full bg-red-100 items-center justify-center mr-4`}>
                  <Feather name="alert-octagon" size={24} color="#EF4444" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-red-500 text-[18px]`} weight="Bold">
                    I Lost My Pet
                  </CustomText>
                  <CustomText style={tw`text-gray-500 text-[13px]`}>
                    Report your missing pet and get AI-powered search help
                  </CustomText>
                </View>
                <Feather name="chevron-right" size={24} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`bg-white w-full py-5 px-6 rounded-2xl flex-row items-center justify-center shadow-xl`}
                onPress={() => setReportType("found")}
              >
                <View style={tw`w-12 h-12 rounded-full bg-green-100 items-center justify-center mr-4`}>
                  <Feather name="search" size={24} color="#10B981" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-green-600 text-[18px]`} weight="Bold">
                    I Found a Pet
                  </CustomText>
                  <CustomText style={tw`text-gray-500 text-[13px]`}>
                    Report a pet you've found to help reunite it with its owner
                  </CustomText>
                </View>
                <Feather name="chevron-right" size={24} color="#10B981" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        <View style={tw`absolute bottom-10 left-0 right-0 items-center`}>
          <CustomText style={tw`text-white text-[14px] opacity-80`}>Powered by AI Behavioral Analysis</CustomText>
        </View>
      </View>
    )
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Animated.View style={[tw`mb-6`, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={tw`flex-row items-center mb-6`}>
              <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                <Ionicons name="paw" size={20} color="#3B82F6" />
              </View>
              <View>
                <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
                  Pet Information
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500`}>
                  Tell us about the {reportType === "lost" ? "lost" : "found"} pet
                </CustomText>
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-4`} weight="SemiBold">
                Pet Type*
              </CustomText>
              <View style={tw`flex-row justify-between`}>
                {petTypes.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={tw`flex-1 mx-2 p-4 rounded-xl border-2 ${
                      petType === type.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                    } items-center justify-center`}
                    onPress={() => setPetType(type.id)}
                    accessibilityLabel={`Select ${type.label} as pet type`}
                  >
                    <MaterialCommunityIcons
                      name={type.icon}
                      size={32}
                      color={petType === type.id ? "#3B82F6" : "#9CA3AF"}
                      style={tw`mb-2`}
                    />
                    <CustomText
                      style={tw`text-[16px] ${petType === type.id ? "text-blue-500" : "text-gray-700"}`}
                      weight="SemiBold"
                    >
                      {type.label}
                    </CustomText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-4`} weight="SemiBold">
                Pet Details
              </CustomText>

              <View style={tw`mb-5`}>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Breed {reportType === "found" ? "(if known)" : ""}
                </CustomText>
                <View
                  style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 ${focusedField === "petBreed" ? "border-blue-500" : ""}`}
                >
                  <Feather
                    name="tag"
                    size={20}
                    color={focusedField === "petBreed" || petBreed ? "#3B82F6" : "#9CA3AF"}
                    style={tw`mr-3`}
                  />
                  <CustomTextInput
                    style={tw`flex-1 text-gray-800`}
                    placeholder={petType === "Dog" ? "e.g., Golden Retriever" : "e.g., Siamese"}
                    value={petBreed}
                    onChangeText={setPetBreed}
                    onFocus={() => setFocusedField("petBreed")}
                    onBlur={() => setFocusedField("")}
                    accessibilityLabel="Enter pet breed"
                  />
                </View>
              </View>

              <View style={tw`mb-5`}>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Color {reportType === "found" ? "(if known)" : ""}
                </CustomText>
                <View
                  style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 ${focusedField === "petColor" ? "border-blue-500" : ""}`}
                >
                  <Feather
                    name="droplet"
                    size={20}
                    color={focusedField === "petColor" || petColor ? "#3B82F6" : "#9CA3AF"}
                    style={tw`mr-3`}
                  />
                  <CustomTextInput
                    style={tw`flex-1 text-gray-800`}
                    placeholder="e.g., Golden, Black & White"
                    value={petColor}
                    onChangeText={setPetColor}
                    onFocus={() => setFocusedField("petColor")}
                    onBlur={() => setFocusedField("")}
                    accessibilityLabel="Enter pet color"
                  />
                </View>
              </View>

              <View style={tw`mb-5`}>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Size {reportType === "found" ? "(if known)" : ""}
                </CustomText>
                <View style={tw`flex-row justify-between`}>
                  {petSizes.map((size) => (
                    <TouchableOpacity
                      key={size.id}
                      style={tw`flex-1 h-14 p-2 mx-1 rounded-xl border-2 ${
                        petSize === size.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                      } items-center justify-center`}
                      onPress={() => setPetSize(size.id)}
                      accessibilityLabel={`Select ${size.label} size`}
                    >
                      <CustomText
                        style={tw`text-[14px] ${petSize === size.id ? "text-blue-500" : "text-gray-700"}`}
                        weight="SemiBold"
                      >
                        {size.label}
                      </CustomText>
                      <CustomText style={tw`text-[11px] ${petSize === size.id ? "text-blue-400" : "text-gray-500"}`}>
                        {size.description}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={tw`mb-5`}>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Pet Name {reportType === "found" ? "(if known)" : ""}
                </CustomText>
                <View
                  style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 ${focusedField === "petName" ? "border-blue-500" : ""}`}
                >
                  <Ionicons
                    name="paw-outline"
                    size={20}
                    color={focusedField === "petName" || petName ? "#3B82F6" : "#9CA3AF"}
                    style={tw`mr-3`}
                  />
                  <CustomTextInput
                    style={tw`flex-1 text-gray-800`}
                    placeholder="Enter pet's name"
                    value={petName}
                    onChangeText={setPetName}
                    onFocus={() => setFocusedField("petName")}
                    onBlur={() => setFocusedField("")}
                    accessibilityLabel="Enter pet name"
                  />
                </View>
              </View>

              <View>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Gender {reportType === "found" ? "(if known)" : ""}
                </CustomText>
                <View style={tw`flex-row justify-between`}>
                  {petGenders.map((gender) => (
                    <TouchableOpacity
                      key={gender.id}
                      style={tw`flex-1 h-14 p-2 mx-1 rounded-xl border-2 ${
                        petGender === gender.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                      } items-center justify-center`}
                      onPress={() => setPetGender(gender.id)}
                      accessibilityLabel={`Select ${gender.label} gender`}
                    >
                      <View style={tw`flex-row items-center`}>
                        <MaterialCommunityIcons
                          name={gender.icon}
                          size={20}
                          color={petGender === gender.id ? "#3B82F6" : "#9CA3AF"}
                          style={tw`mr-1`}
                        />
                        <CustomText
                          style={tw`text-[14px] ${petGender === gender.id ? "text-blue-500" : "text-gray-700"}`}
                          weight="Medium"
                        >
                          {gender.label}
                        </CustomText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </Animated.View>
        )
      case 2:
        return (
          <Animated.View style={[tw`mb-6`, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={tw`flex-row items-center mb-6`}>
              <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                <Feather name="map-pin" size={20} color="#3B82F6" />
              </View>
              <View>
                <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
                  Location & Time
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500`}>
                  Where and when was the pet {reportType === "lost" ? "last seen" : "found"}?
                </CustomText>
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                Location*
              </CustomText>

              <TouchableOpacity
                onPress={() => setShowMapModal(true)}
                style={tw`bg-gray-50 rounded-xl border border-gray-200 overflow-hidden mb-3 ${location ? "border-blue-500" : ""}`}
              >
                {location ? (
                  <View style={tw`h-40 w-full`}>
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={tw`flex-1`}
                      region={{
                        latitude: location.latitude,
                        longitude: location.longitude,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01,
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                    >
                      <Marker coordinate={location} />
                    </MapView>
                    <View style={tw`absolute top-2 right-2 bg-white rounded-lg px-2 py-1 shadow-sm`}>
                      <CustomText style={tw`text-[12px] text-blue-500`} weight="Medium">
                        Tap to change
                      </CustomText>
                    </View>
                  </View>
                ) : (
                  <View style={tw`h-40 w-full items-center justify-center bg-gray-50`}>
                    <Feather name="map" size={40} color="#9CA3AF" style={tw`mb-2`} />
                    <CustomText style={tw`text-gray-500 text-[14px]`} weight="Medium">
                      Tap to select location on map
                    </CustomText>
                  </View>
                )}
              </TouchableOpacity>

              {location && (
                <View style={tw`bg-blue-50 rounded-lg p-3 mb-4 flex-row items-center`}>
                  <Feather name="info" size={16} color="#3B82F6" style={tw`mr-2`} />
                  <CustomText style={tw`text-[12px] text-blue-700 flex-1`}>
                    Location selected: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                  </CustomText>
                </View>
              )}
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                Date & Time
              </CustomText>

              <CustomText style={tw`text-[14px] text-gray-600 mb-2`}>
                When was the pet {reportType === "lost" ? "last seen" : "found"}?
              </CustomText>

              <TouchableOpacity
                style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-4 ${dateTime ? "border-blue-500" : ""}`}
                onPress={openDateTimePicker}
              >
                <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                  <Feather name="calendar" size={18} color="#3B82F6" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-[15px] text-gray-800`} weight="Medium">
                    {dateTime || "Select date and time"}
                  </CustomText>
                  {!dateTime && (
                    <CustomText style={tw`text-[12px] text-gray-500`}>
                      Tap to select when the pet was {reportType === "lost" ? "last seen" : "found"}
                    </CustomText>
                  )}
                </View>
                <Feather name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {reportType === "found" && (
              <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
                <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                  Behavioral Context*
                </CustomText>

                <CustomText style={tw`text-[14px] text-gray-600 mb-3`}>
                  How was the pet behaving when you found it?
                </CustomText>

                <View style={tw`flex-row flex-wrap justify-between`}>
                  {behavioralContexts.map((context) => (
                    <TouchableOpacity
                      key={context.id}
                      style={tw`w-[48%] mb-3 p-3 rounded-xl border-2 ${
                        behavioralContext === context.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                      }`}
                      onPress={() => setBehavioralContext(context.id)}
                    >
                      <View style={tw`items-center`}>
                        <View
                          style={tw`w-10 h-10 rounded-full ${behavioralContext === context.id ? "bg-blue-100" : "bg-gray-200"} items-center justify-center mb-2`}
                        >
                          <Feather
                            name={context.icon}
                            size={18}
                            color={behavioralContext === context.id ? "#3B82F6" : "#6B7280"}
                          />
                        </View>
                        <CustomText
                          style={tw`text-[14px] ${behavioralContext === context.id ? "text-blue-600" : "text-gray-700"}`}
                          weight={behavioralContext === context.id ? "SemiBold" : "Medium"}
                        >
                          {context.label}
                        </CustomText>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                Weather Conditions
              </CustomText>

              <CustomText style={tw`text-[14px] text-gray-600 mb-3`}>
                What was the weather like when the pet was {reportType === "lost" ? "lost" : "found"}?
              </CustomText>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`pb-2`}>
                {weatherConditions.map((condition) => (
                  <TouchableOpacity
                    key={condition.id}
                    style={tw`mr-3 items-center`}
                    onPress={() => setWeatherCondition(condition.id)}
                  >
                    <View
                      style={tw`w-16 h-16 rounded-full ${weatherCondition === condition.id ? `bg-${condition.color.split("#")[1]}-100` : "bg-gray-100"} items-center justify-center mb-2`}
                    >
                      <Feather
                        name={condition.icon}
                        size={28}
                        color={weatherCondition === condition.id ? condition.color : "#9CA3AF"}
                      />
                    </View>
                    <CustomText
                      style={tw`text-[12px] ${weatherCondition === condition.id ? "text-gray-800" : "text-gray-600"}`}
                      weight={weatherCondition === condition.id ? "SemiBold" : "Medium"}
                    >
                      {condition.label}
                    </CustomText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                Additional Details
              </CustomText>

              <CustomText style={tw`text-[14px] text-gray-600 mb-3`}>
                Any distinctive features or additional information?
              </CustomText>

              <View
                style={tw`bg-gray-50 rounded-xl border border-gray-200 p-4 ${focusedField === "additionalInfo" ? "border-blue-500" : ""}`}
              >
                <CustomTextInput
                  style={tw`text-gray-800 min-h-[100px]`}
                  placeholder="Describe distinctive features, behaviors, or any other details that might help identify the pet..."
                  value={additionalInfo}
                  onChangeText={setAdditionalInfo}
                  multiline
                  textAlignVertical="top"
                  onFocus={() => setFocusedField("additionalInfo")}
                  onBlur={() => setFocusedField("")}
                  accessibilityLabel="Enter additional details"
                />
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker value={selectedDate} mode="date" display="default" onChange={handleDateChange} />
            )}
            {showTimePicker && (
              <DateTimePicker value={selectedDate} mode="time" display="default" onChange={handleTimeChange} />
            )}
            <Modal
              visible={showMapModal}
              animationType="slide"
              transparent={false}
              onRequestClose={() => setShowMapModal(false)}
            >
              <View style={tw`flex-1`}>
                <View style={tw`flex-row items-center justify-between p-4 bg-white border-b border-gray-200`}>
                  <TouchableOpacity onPress={() => setShowMapModal(false)}>
                    <Feather name="x" size={24} color="#3B82F6" />
                  </TouchableOpacity>
                  <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                    Select Location
                  </CustomText>
                  <TouchableOpacity onPress={confirmLocation}>
                    <CustomText style={tw`text-blue-500 text-[16px]`} weight="SemiBold">
                      Confirm
                    </CustomText>
                  </TouchableOpacity>
                </View>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  ref={mapRef}
                  style={tw`flex-1`}
                  region={mapRegion}
                  onPress={handleMapPress}
                  showsUserLocation={true}
                  followsUserLocation={true}
                  showsMyLocationButton={true}
                  onMapReady={() => {
                    if (mapRef.current) {
                      mapRef.current.animateToRegion(
                        {
                          latitude: mapRegion.latitude,
                          longitude: mapRegion.longitude,
                          latitudeDelta: 0.0922,
                          longitudeDelta: 0.0421,
                        },
                        1000,
                      )
                    }
                  }}
                >
                  {markerPosition && (
                    <Marker
                      coordinate={markerPosition}
                      title="Selected Location"
                      description={
                        location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : "Pet location"
                      }
                    />
                  )}
                </MapView>
                <View style={tw`p-4 bg-white border-t border-gray-200`}>
                  <CustomText style={tw`text-gray-700 mb-2`} weight="Medium">
                    {location
                      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                      : "Tap on the map to select location"}
                  </CustomText>
                  <CustomText style={tw`text-gray-500 text-[12px]`}>
                    Accurate location helps our AI predict where the pet might be
                  </CustomText>
                </View>
                <TouchableOpacity
                  style={tw`absolute bottom-20 right-4 bg-blue-500 p-3 rounded-full shadow-lg`}
                  onPress={focusOnUserLocation}
                >
                  <Feather name="navigation" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </Modal>
          </Animated.View>
        )
      case 3:
        return (
          <Animated.View style={[tw`mb-6`, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={tw`flex-row items-center mb-6`}>
              <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                <Feather name="activity" size={20} color="#3B82F6" />
              </View>
              <View>
                <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
                  Behavioral Analysis
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500`}>Help our AI predict pet behavior</CustomText>
              </View>
            </View>

            {reportType === "lost" && (
              <View style={tw`mb-6 bg-blue-50 p-5 rounded-2xl border border-blue-200`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <View style={tw`w-12 h-12 rounded-xl bg-blue-500 items-center justify-center mr-3`}>
                    <Feather name="zap" size={22} color="white" />
                  </View>
                  <View style={tw`flex-1`}>
                    <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                      AI Search Probability: {searchProbability}%
                    </CustomText>
                    <CustomText style={tw`text-[12px] text-gray-600`}>
                      Adding behavioral information increases search accuracy
                    </CustomText>
                  </View>
                </View>

                <View style={tw`w-full bg-gray-200 h-2.5 rounded-full mb-3`}>
                  <View
                    style={[
                      tw`h-2.5 rounded-full`,
                      {
                        width: `${searchProbability}%`,
                        backgroundColor:
                          searchProbability > 90 ? "#10B981" : searchProbability > 80 ? "#3B82F6" : "#F59E0B",
                      },
                    ]}
                  />
                </View>

                <CustomText style={tw`text-[14px] text-gray-700`}>
                  Our AI uses behavioral analysis to predict where your pet might be. Adding more details increases
                  search accuracy.
                </CustomText>
              </View>
            )}

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                Pet Behavioral Traits
              </CustomText>

              <CustomText style={tw`text-[14px] text-gray-600 mb-4`}>
                Select traits that describe the pet's behavior
              </CustomText>

              <View>
                {behavioralTraits.map((trait) => (
                  <TouchableOpacity
                    key={trait.id}
                    style={tw`w-full mb-3 p-3 rounded-xl border-2 ${
                      behavioralTrait.includes(trait.id)
                        ? `border-${trait.color.split("#")[1]}-500 bg-${trait.color.split("#")[1]}-50`
                        : "border-gray-200 bg-gray-50"
                    }`}
                    onPress={() => toggleBehavioralTrait(trait.id)}
                  >
                    <View style={tw`flex-row items-center`}>
                      <View
                        style={tw`w-10 h-10 rounded-full ${behavioralTrait.includes(trait.id) ? `bg-${trait.color.split("#")[1]}-100` : "bg-gray-200"} items-center justify-center mr-3`}
                      >
                        <Feather
                          name={trait.icon}
                          size={18}
                          color={behavioralTrait.includes(trait.id) ? trait.color : "#6B7280"}
                        />
                      </View>
                      <View style={tw`flex-1`}>
                        <CustomText
                          style={tw`text-[14px] ${behavioralTrait.includes(trait.id) ? `text-${trait.color.split("#")[1]}-700` : "text-gray-700"}`}
                          weight={behavioralTrait.includes(trait.id) ? "SemiBold" : "Medium"}
                        >
                          {trait.label}
                        </CustomText>
                      </View>
                      {behavioralTrait.includes(trait.id) && (
                        <View
                          style={tw`w-6 h-6 rounded-full bg-${trait.color.split("#")[1]}-500 items-center justify-center`}
                        >
                          <Feather name="check" size={14} color="white" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                Environmental Factors
              </CustomText>

              <CustomText style={tw`text-[14px] text-gray-600 mb-4`}>
                Select factors that describe the environment
              </CustomText>

              <View>
                {environmentalFactorsList.map((factor) => (
                  <TouchableOpacity
                    key={factor.id}
                    style={tw`w-full mb-3 p-3 rounded-xl border-2 ${
                      environmentalFactors.includes(factor.id)
                        ? `border-${factor.color.split("#")[1]}-500 bg-${factor.color.split("#")[1]}-50`
                        : "border-gray-200 bg-gray-50"
                    }`}
                    onPress={() => toggleEnvironmentalFactor(factor.id)}
                  >
                    <View style={tw`flex-row items-center`}>
                      <View
                        style={tw`w-10 h-10 rounded-full ${environmentalFactors.includes(factor.id) ? `bg-${factor.color.split("#")[1]}-100` : "bg-gray-200"} items-center justify-center mr-3`}
                      >
                        <Feather
                          name={factor.icon}
                          size={18}
                          color={environmentalFactors.includes(factor.id) ? factor.color : "#6B7280"}
                        />
                      </View>
                      <View style={tw`flex-1`}>
                        <CustomText
                          style={tw`text-[14px] ${environmentalFactors.includes(factor.id) ? `text-${factor.color.split("#")[1]}-700` : "text-gray-700"}`}
                          weight={environmentalFactors.includes(factor.id) ? "SemiBold" : "Medium"}
                        >
                          {factor.label}
                        </CustomText>
                      </View>
                      {environmentalFactors.includes(factor.id) && (
                        <View
                          style={tw`w-6 h-6 rounded-full bg-${factor.color.split("#")[1]}-500 items-center justify-center`}
                        >
                          <Feather name="check" size={14} color="white" />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Distinctive Features Section - New for verification */}
            {reportType === "lost" && (
              <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
                <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                  Distinctive Features
                </CustomText>

                <CustomText style={tw`text-[14px] text-gray-600 mb-4`}>
                  Select features that can help verify your pet's identity
                </CustomText>

                <View>
                  {distinctiveFeaturesList.map((feature) => (
                    <TouchableOpacity
                      key={feature.id}
                      style={tw`w-full mb-3 p-3 rounded-xl border-2 ${
                        distinctiveFeatures.includes(feature.id)
                          ? `border-${feature.color.split("#")[1]}-500 bg-${feature.color.split("#")[1]}-50`
                          : "border-gray-200 bg-gray-50"
                      }`}
                      onPress={() => toggleDistinctiveFeature(feature.id)}
                    >
                      <View style={tw`flex-row items-center`}>
                        <View
                          style={tw`w-10 h-10 rounded-full ${distinctiveFeatures.includes(feature.id) ? `bg-${feature.color.split("#")[1]}-100` : "bg-gray-200"} items-center justify-center mr-3`}
                        >
                          <Feather
                            name={feature.icon}
                            size={18}
                            color={distinctiveFeatures.includes(feature.id) ? feature.color : "#6B7280"}
                          />
                        </View>
                        <View style={tw`flex-1`}>
                          <CustomText
                            style={tw`text-[14px] ${distinctiveFeatures.includes(feature.id) ? `text-${feature.color.split("#")[1]}-700` : "text-gray-700"}`}
                            weight={distinctiveFeatures.includes(feature.id) ? "SemiBold" : "Medium"}
                          >
                            {feature.label}
                          </CustomText>
                        </View>
                        {distinctiveFeatures.includes(feature.id) && (
                          <View
                            style={tw`w-6 h-6 rounded-full bg-${feature.color.split("#")[1]}-500 items-center justify-center`}
                          >
                            <Feather name="check" size={14} color="white" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {reportType === "lost" && (
              <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
                <CustomText style={tw`text-[16px] text-gray-700 mb-3`} weight="SemiBold">
                  Verification Methods
                </CustomText>

                <CustomText style={tw`text-[14px] text-gray-600 mb-4`}>
                  Select methods that can be used to verify your pet if found
                </CustomText>

                <View>
                  {verificationMethodsList.map((method) => (
                    <TouchableOpacity
                      key={method.id}
                      style={tw`w-full mb-3 p-3 rounded-xl border-2 ${
                        verificationMethods.includes(method.id)
                          ? `border-${method.color.split("#")[1]}-500 bg-${method.color.split("#")[1]}-50`
                          : "border-gray-200 bg-gray-50"
                      }`}
                      onPress={() => toggleVerificationMethod(method.id)}
                    >
                      <View style={tw`flex-row items-center`}>
                        <View
                          style={tw`w-10 h-10 rounded-full ${verificationMethods.includes(method.id) ? `bg-${method.color.split("#")[1]}-100` : "bg-gray-200"} items-center justify-center mr-3`}
                        >
                          <Feather
                            name={method.icon}
                            size={18}
                            color={verificationMethods.includes(method.id) ? method.color : "#6B7280"}
                          />
                        </View>
                        <View style={tw`flex-1`}>
                          <CustomText
                            style={tw`text-[14px] ${verificationMethods.includes(method.id) ? `text-${method.color.split("#")[1]}-700` : "text-gray-700"}`}
                            weight={verificationMethods.includes(method.id) ? "SemiBold" : "Medium"}
                          >
                            {method.label}
                          </CustomText>
                        </View>
                        {verificationMethods.includes(method.id) && (
                          <View
                            style={tw`w-6 h-6 rounded-full bg-${method.color.split("#")[1]}-500 items-center justify-center`}
                          >
                            <Feather name="check" size={14} color="white" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {reportType === "lost" && behavioralTrait.length > 0 && environmentalFactors.length > 0 && (
              <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-blue-200`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <Feather name="cpu" size={20} color="#3B82F6" style={tw`mr-2`} />
                  <CustomText style={tw`text-[16px] text-gray-800`} weight="SemiBold">
                    AI Behavior Prediction
                  </CustomText>
                </View>

                <View style={tw`p-4 bg-blue-50 rounded-xl`}>
                  <CustomText style={tw`text-[14px] text-gray-700 leading-5`}>
                    {generateBehaviorPrediction()}
                  </CustomText>
                </View>

                <View style={tw`mt-3 flex-row items-center`}>
                  <Feather name="info" size={14} color="#3B82F6" style={tw`mr-2`} />
                  <CustomText style={tw`text-[12px] text-gray-600 flex-1`}>
                    This prediction will be used to guide search efforts and increase chances of finding your pet
                  </CustomText>
                </View>
              </View>
            )}
          </Animated.View>
        )
      case 4:
        return (
          <Animated.View style={[tw`mb-6`, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={tw`flex-row items-center mb-6`}>
              <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                <Feather name="camera" size={20} color="#3B82F6" />
              </View>
              <View>
                <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
                  Photos
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500`}>Add photos to help identify the pet</CustomText>
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <View style={tw`flex-row items-center justify-between mb-4`}>
                <CustomText style={tw`text-[16px] text-gray-700`} weight="SemiBold">
                  Pet Photos
                </CustomText>
                <View style={tw`bg-blue-100 px-3 py-1 rounded-full`}>
                  <CustomText style={tw`text-[12px] text-blue-700`} weight="Medium">
                    {images.length}/3 Photos
                  </CustomText>
                </View>
              </View>

              <CustomText style={tw`text-[14px] text-gray-600 mb-4`}>
                Upload clear photos of the pet to help with identification
              </CustomText>

              <View style={tw`flex-row flex-wrap mb-6`}>
                {images.map((image, index) => (
                  <View key={index} style={tw`relative mr-3 mb-3`}>
                    <Image source={{ uri: image }} style={tw`w-28 h-28 rounded-xl`} />
                    <TouchableOpacity
                      style={tw`absolute -top-2 -right-2 bg-red-500 rounded-full p-1.5 shadow-md`}
                      onPress={() => removeImage(index)}
                      accessibilityLabel="Remove image"
                    >
                      <Feather name="x" size={14} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}

                {images.length < 3 && (
                  <View style={tw`flex-row`}>
                    <TouchableOpacity
                      style={tw`w-28 h-28 bg-gray-50 rounded-xl items-center justify-center mr-3 border-2 border-gray-200 shadow-sm`}
                      onPress={pickImage}
                      accessibilityLabel="Upload from gallery"
                    >
                      <View style={tw`w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2`}>
                        <Feather name="image" size={20} color="#3B82F6" />
                      </View>
                      <CustomText style={tw`text-[13px] text-gray-600`} weight="Medium">
                        Gallery
                      </CustomText>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={tw`w-28 h-28 bg-gray-50 rounded-xl items-center justify-center border-2 border-gray-200 shadow-sm`}
                      onPress={takePhoto}
                      accessibilityLabel="Take photo"
                    >
                      <View style={tw`w-12 h-12 rounded-full bg-blue-100 items-center justify-center mb-2`}>
                        <Feather name="camera" size={20} color="#3B82F6" />
                      </View>
                      <CustomText style={tw`text-[13px] text-gray-600`} weight="Medium">
                        Camera
                      </CustomText>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={tw`bg-blue-50 p-4 rounded-xl border border-blue-200 flex-row items-start`}>
                <Feather name="info" size={18} color="#3B82F6" style={tw`mr-3 mt-0.5`} />
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-[14px] text-gray-700 mb-1`} weight="Medium">
                    Why photos matter:
                  </CustomText>
                  <CustomText style={tw`text-[13px] text-gray-600`}>
                    Clear photos help our AI system analyze pet features, identify distinctive markings, and improve
                    search accuracy by up to 70%.
                  </CustomText>
                </View>
              </View>
            </View>

            {reportType === "lost" && images.length > 0 && (
              <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <Feather name="check-circle" size={20} color="#10B981" style={tw`mr-2`} />
                  <CustomText style={tw`text-[16px] text-gray-800`} weight="SemiBold">
                    AI Image Analysis Ready
                  </CustomText>
                </View>

                <CustomText style={tw`text-[14px] text-gray-600 mb-3`}>Our AI will analyze these photos to:</CustomText>

                <View style={tw`mb-2 flex-row items-center`}>
                  <View style={tw`w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2`}>
                    <Feather name="check" size={16} color="#10B981" />
                  </View>
                  <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                    Identify distinctive markings and features
                  </CustomText>
                </View>

                <View style={tw`mb-2 flex-row items-center`}>
                  <View style={tw`w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2`}>
                    <Feather name="check" size={16} color="#10B981" />
                  </View>
                  <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                    Match with similar pets in found reports
                  </CustomText>
                </View>

                <View style={tw`flex-row items-center`}>
                  <View style={tw`w-8 h-8 rounded-full bg-green-100 items-center justify-center mr-2`}>
                    <Feather name="check" size={16} color="#10B981" />
                  </View>
                  <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                    Improve search accuracy with visual recognition
                  </CustomText>
                </View>
              </View>
            )}

            {/* AI Matching Analysis for Found Pets */}
            {reportType === "found" && images.length > 0 && (
              <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <Feather name="cpu" size={20} color="#6366F1" style={tw`mr-2`} />
                  <CustomText style={tw`text-[16px] text-gray-800`} weight="SemiBold">
                    AI Image Analysis
                  </CustomText>
                </View>

                {isAnalyzingImages ? (
                  <View style={tw`items-center py-4`}>
                    <ActivityIndicator size="large" color="#6366F1" style={tw`mb-3`} />
                    <CustomText style={tw`text-[14px] text-gray-700`}>
                      Analyzing images to find potential matches...
                    </CustomText>
                  </View>
                ) : potentialMatches.length > 0 ? (
                  <View>
                    <CustomText style={tw`text-[14px] text-gray-600 mb-3`}>
                      Our AI found {potentialMatches.length} potential matches for this pet:
                    </CustomText>

                    {potentialMatches.map((match) => (
                      <View key={match.id} style={tw`mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-200`}>
                        <View style={tw`flex-row items-center mb-2`}>
                          <Image source={match.image} style={tw`w-12 h-12 rounded-lg mr-3`} />
                          <View style={tw`flex-1`}>
                            <CustomText style={tw`text-[15px] text-gray-800`} weight="SemiBold">
                              {match.petName} ({match.petBreed})
                            </CustomText>
                            <CustomText style={tw`text-[12px] text-gray-600`}>
                              Reported by {match.reportedBy} • {match.reportedTime}
                            </CustomText>
                          </View>
                          <View style={tw`bg-indigo-500 px-2 py-1 rounded-lg`}>
                            <CustomText style={tw`text-white text-[12px]`} weight="Bold">
                              {match.matchConfidence}%
                            </CustomText>
                          </View>
                        </View>
                        <View style={tw`flex-row items-center justify-between`}>
                          <View style={tw`flex-row items-center`}>
                            <Feather name="map-pin" size={12} color="#6366F1" style={tw`mr-1`} />
                            <CustomText style={tw`text-[12px] text-indigo-700`}>{match.distance}</CustomText>
                          </View>
                          <TouchableOpacity style={tw`bg-indigo-500 px-3 py-1 rounded-lg`}>
                            <CustomText style={tw`text-white text-[12px]`} weight="Medium">
                              Contact Owner
                            </CustomText>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View>
                    <CustomText style={tw`text-[14px] text-gray-600 mb-3`}>
                      Our AI will analyze these photos to find potential matches with reported lost pets.
                    </CustomText>

                    <View style={tw`mb-2 flex-row items-center`}>
                      <View style={tw`w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2`}>
                        <Feather name="search" size={16} color="#6366F1" />
                      </View>
                      <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                        Compare with lost pet reports in the area
                      </CustomText>
                    </View>

                    <View style={tw`mb-2 flex-row items-center`}>
                      <View style={tw`w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2`}>
                        <Feather name="target" size={16} color="#6366F1" />
                      </View>
                      <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                        Calculate match probability based on visual features
                      </CustomText>
                    </View>

                    <View style={tw`flex-row items-center`}>
                      <View style={tw`w-8 h-8 rounded-full bg-indigo-100 items-center justify-center mr-2`}>
                        <Feather name="users" size={16} color="#6366F1" />
                      </View>
                      <CustomText style={tw`text-[14px] text-gray-700 flex-1`}>
                        Connect you with potential pet owners
                      </CustomText>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Potential Matches Modal */}
            <Modal
              visible={showPotentialMatches}
              transparent={true}
              animationType="slide"
              onRequestClose={() => setShowPotentialMatches(false)}
            >
              <View style={tw`flex-1 bg-black/70 justify-end`}>
                <View style={tw`bg-white rounded-t-3xl p-6`}>
                  <View style={tw`flex-row justify-between items-center mb-4`}>
                    <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                      Potential Matches Found!
                    </CustomText>
                    <TouchableOpacity onPress={() => setShowPotentialMatches(false)}>
                      <Feather name="x" size={24} color="#4B5563" />
                    </TouchableOpacity>
                  </View>

                  <CustomText style={tw`text-[16px] text-gray-700 mb-4`}>
                    Our AI has found {potentialMatches.length} potential matches for this pet. Would you like to contact
                    the owners?
                  </CustomText>

                  {potentialMatches.map((match) => (
                    <View key={match.id} style={tw`mb-4 p-4 bg-indigo-50 rounded-xl border border-indigo-200`}>
                      <View style={tw`flex-row items-center mb-3`}>
                        <Image source={match.image} style={tw`w-16 h-16 rounded-lg mr-3`} />
                        <View style={tw`flex-1`}>
                          <View style={tw`flex-row items-center justify-between`}>
                            <CustomText style={tw`text-[18px] text-gray-800`} weight="Bold">
                              {match.petName}
                            </CustomText>
                            <View style={tw`bg-indigo-500 px-2 py-1 rounded-lg`}>
                              <CustomText style={tw`text-white text-[12px]`} weight="Bold">
                                {match.matchConfidence}% Match
                              </CustomText>
                            </View>
                          </View>
                          <CustomText style={tw`text-[14px] text-gray-600`}>
                            {match.petBreed} • {match.distance}
                          </CustomText>
                          <CustomText style={tw`text-[12px] text-gray-500`}>
                            Reported by {match.reportedBy} • {match.reportedTime}
                          </CustomText>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={tw`bg-indigo-500 py-2.5 rounded-lg items-center`}
                        onPress={() => {
                          setShowPotentialMatches(false)
                          // In a real app, this would navigate to a contact screen
                          Alert.alert(
                            "Contact Owner",
                            `You'll be able to contact ${match.reportedBy} after submitting your report.`,
                          )
                        }}
                      >
                        <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                          Contact Owner
                        </CustomText>
                      </TouchableOpacity>
                    </View>
                  ))}

                  <TouchableOpacity
                    style={tw`mt-2 bg-gray-200 py-3 rounded-xl items-center`}
                    onPress={() => setShowPotentialMatches(false)}
                  >
                    <CustomText style={tw`text-gray-700 text-[14px]`} weight="SemiBold">
                      Continue with Report
                    </CustomText>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </Animated.View>
        )
      case 5:
        return (
          <Animated.View style={[tw`mb-6`, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={tw`flex-row items-center mb-6`}>
              <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
                <Feather name="user" size={20} color="#3B82F6" />
              </View>
              <View>
                <CustomText style={tw`text-[22px] text-gray-800`} weight="Bold">
                  Contact Information
                </CustomText>
                <CustomText style={tw`text-[14px] text-gray-500`}>How can others reach you?</CustomText>
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <CustomText style={tw`text-[16px] text-gray-700 mb-4`} weight="SemiBold">
                Your Details
              </CustomText>

              <View style={tw`mb-5`}>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Your Name
                </CustomText>
                <View
                  style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3.5 ${focusedField === "contactName" ? "border-blue-500" : ""}`}
                >
                  <Feather
                    name="user"
                    size={20}
                    color={focusedField === "contactName" || contactName ? "#3B82F6" : "#9CA3AF"}
                    style={tw`mr-3`}
                  />
                  <CustomTextInput
                    style={tw`flex-1 text-gray-800`}
                    placeholder="Enter your name"
                    value={contactName}
                    onChangeText={setContactName}
                    onFocus={() => setFocusedField("contactName")}
                    onBlur={() => setFocusedField("")}
                    accessibilityLabel="Enter your name"
                  />
                </View>
              </View>

              <View style={tw`mb-5`}>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Phone Number*
                </CustomText>
                <View
                  style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3.5 ${focusedField === "contactPhone" ? "border-blue-500" : ""}`}
                >
                  <Feather
                    name="phone"
                    size={20}
                    color={focusedField === "contactPhone" || contactPhone ? "#3B82F6" : "#9CA3AF"}
                    style={tw`mr-3`}
                  />
                  <CustomTextInput
                    style={tw`flex-1 text-gray-800`}
                    placeholder="Enter your phone number"
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    keyboardType="phone-pad"
                    onFocus={() => setFocusedField("contactPhone")}
                    onBlur={() => setFocusedField("")}
                    accessibilityLabel="Enter phone number"
                  />
                </View>
              </View>

              <View>
                <CustomText style={tw`text-[14px] text-gray-600 mb-2`} weight="Medium">
                  Email*
                </CustomText>
                <View
                  style={tw`flex-row items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3.5 ${focusedField === "contactEmail" ? "border-blue-500" : ""}`}
                >
                  <Feather
                    name="mail"
                    size={20}
                    color={focusedField === "contactEmail" || contactEmail ? "#3B82F6" : "#9CA3AF"}
                    style={tw`mr-3`}
                  />
                  <CustomTextInput
                    style={tw`flex-1 text-gray-800`}
                    placeholder="Enter your email"
                    value={contactEmail}
                    onChangeText={setContactEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    onFocus={() => setFocusedField("contactEmail")}
                    onBlur={() => setFocusedField("")}
                    accessibilityLabel="Enter email address"
                  />
                </View>
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <View style={tw`flex-row items-start`}>
                <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3 mt-1`}>
                  <Feather name="shield" size={20} color="#3B82F6" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-[16px] text-gray-700 mb-2`} weight="SemiBold">
                    Privacy & Security
                  </CustomText>
                  <CustomText style={tw`text-[14px] text-gray-600`}>
                    Your contact information will only be shared with verified users who may have found your pet or are
                    looking for the pet you found.
                  </CustomText>
                </View>
              </View>
            </View>

            <View style={tw`mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100`}>
              <View style={tw`flex-row items-start`}>
                <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3 mt-1`}>
                  <Feather name="check-circle" size={20} color="#3B82F6" />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-[16px] text-gray-700 mb-2`} weight="SemiBold">
                    Confirmation
                  </CustomText>
                  <CustomText style={tw`text-[14px] text-gray-600`}>
                    By submitting this report, you confirm that all information provided is accurate to the best of your
                    knowledge.
                  </CustomText>
                </View>
              </View>
            </View>

            {reportType === "lost" && (
              <View style={tw`mb-6 bg-blue-50 p-6 rounded-2xl border border-blue-200`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <View style={tw`w-12 h-12 rounded-xl bg-blue-500 items-center justify-center mr-3`}>
                    <Feather name="map" size={22} color="white" />
                  </View>
                  <View style={tw`flex-1`}>
                    <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                      Next: AI Search Map
                    </CustomText>
                    <CustomText style={tw`text-[12px] text-gray-600`}>
                      After submission, you'll be taken to the AI Search Map
                    </CustomText>
                  </View>
                </View>

                <CustomText style={tw`text-[14px] text-gray-700 mb-3`}>
                  Our AI will analyze your report and generate a search map with high-probability areas where your pet
                  might be found.
                </CustomText>

                <View style={tw`flex-row items-center`}>
                  <Feather name="info" size={16} color="#3B82F6" style={tw`mr-2`} />
                  <CustomText style={tw`text-[12px] text-blue-700 flex-1`}>
                    Search probability: {searchProbability}% accuracy based on provided information
                  </CustomText>
                </View>
              </View>
            )}

            {reportType === "found" && potentialMatches.length > 0 && (
              <View style={tw`mb-6 bg-indigo-50 p-6 rounded-2xl border border-indigo-200`}>
                <View style={tw`flex-row items-center mb-3`}>
                  <View style={tw`w-12 h-12 rounded-xl bg-indigo-500 items-center justify-center mr-3`}>
                    <Feather name="users" size={22} color="white" />
                  </View>
                  <View style={tw`flex-1`}>
                    <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                      Next: Connect with Pet Owners
                    </CustomText>
                    <CustomText style={tw`text-[12px] text-gray-600`}>
                      After submission, you can connect with potential pet owners
                    </CustomText>
                  </View>
                </View>

                <CustomText style={tw`text-[14px] text-gray-700 mb-3`}>
                  Our AI has found {potentialMatches.length} potential matches for this pet. After submitting your
                  report, you'll be able to contact the owners.
                </CustomText>

                <TouchableOpacity
                  style={tw`bg-indigo-500 py-2.5 rounded-lg items-center`}
                  onPress={() => setShowPotentialMatches(true)}
                >
                  <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                    View Potential Matches
                  </CustomText>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        )
      default:
        return null
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "padding" : "height"}
      style={tw`flex-1 bg-gray-50`}
      keyboardVerticalOffset={Platform.OS === "android" ? 64 : 0}
    >
      <View style={tw`pt-12 px-6 pb-4 flex-row items-center justify-between bg-white shadow-sm`}>
        <TouchableOpacity style={tw`mr-4`} onPress={prevStep}>
          <Feather name="arrow-left" size={24} color="#3B82F6" />
        </TouchableOpacity>
        <CustomText style={tw`text-[18px] text-gray-800 flex-1 text-center`} weight="Bold">
          {reportType === "lost" ? "Report Lost Pet" : "Report Found Pet"}
        </CustomText>
        <View style={tw`w-6`}></View>
      </View>

      <View style={tw`px-6 py-4 bg-white`}>
        <View style={tw`flex-row justify-between mb-2`}>
          {[1, 2, 3, 4, 5].map((step) => (
            <View
              key={step}
              style={tw`flex-1 h-2 ${
                step < currentStep ? "bg-blue-500" : step === currentStep ? "bg-blue-400" : "bg-gray-200"
              } rounded-full ${step < 5 ? "mr-1" : ""}`}
            />
          ))}
        </View>

        <View style={tw`flex-row justify-between px-1 mt-1`}>
          <CustomText style={tw`text-[11px] ${currentStep >= 1 ? "text-blue-500" : "text-gray-400"}`} weight="Medium">
            Pet Info
          </CustomText>
          <CustomText style={tw`text-[11px] ${currentStep >= 2 ? "text-blue-500" : "text-gray-400"}`} weight="Medium">
            Location
          </CustomText>
          <CustomText style={tw`text-[11px] ${currentStep >= 3 ? "text-blue-500" : "text-gray-400"}`} weight="Medium">
            Behavior
          </CustomText>
          <CustomText style={tw`text-[11px] ${currentStep >= 4 ? "text-blue-500" : "text-gray-400"}`} weight="Medium">
            Photos
          </CustomText>
          <CustomText style={tw`text-[11px] ${currentStep >= 5 ? "text-blue-500" : "text-gray-400"}`} weight="Medium">
            Contact
          </CustomText>
        </View>
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} contentContainerStyle={tw`px-6 pt-4 pb-40`}>
        {renderStepContent()}
      </ScrollView>

      <View style={tw`absolute bottom-0 left-0 right-0 bg-white px-6 py-4 border-t border-gray-200 shadow-lg`}>
        <View style={tw`flex-row`}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={tw`bg-gray-100 py-4 rounded-xl items-center justify-center flex-1 mr-3`}
              onPress={prevStep}
            >
              <CustomText style={tw`text-gray-700 text-[16px]`} weight="SemiBold">
                Back
              </CustomText>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={tw`bg-blue-500 py-4 rounded-xl items-center justify-center flex-1`}
            onPress={nextStep}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
                {currentStep < 5 ? "Continue" : "Submit Report"}
              </CustomText>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Success Animation */}
      {showSuccessAnimation && (
        <View style={[StyleSheet.absoluteFill, tw`bg-black/70 items-center justify-center z-50`]}>
          <Animated.View
            style={[
              tw`bg-white rounded-2xl p-8 items-center justify-center w-64 h-64`,
              {
                opacity: successAnimationValue,
                transform: [{ scale: successScaleValue }],
              },
            ]}
          >
            <View style={tw`w-20 h-20 rounded-full bg-green-100 items-center justify-center mb-4`}>
              <Feather name="check" size={40} color="#10B981" />
            </View>
            <CustomText style={tw`text-[20px] text-gray-800 mb-2 text-center`} weight="Bold">
              Report Submitted!
            </CustomText>
            <CustomText style={tw`text-[14px] text-gray-600 text-center`}>
              Thank you for helping reunite pets with their owners
            </CustomText>
          </Animated.View>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
})

export default ReportScreen
