"use client"

import { useState, useEffect, useRef } from "react"
import {
  View,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Modal,
  Switch,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native"
import { useNavigation } from "@react-navigation/native"
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps"
import tw from "twrnc"
import CustomText from "../components/CustomText"
import { Feather } from "@expo/vector-icons"
import { db } from "../firebaseConfig"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
import * as Location from "expo-location"

const { width, height } = Dimensions.get("window")

const SearchScreen = () => {
  const navigation = useNavigation()
  const mapRef = useRef(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [allPets, setAllPets] = useState([])
  const [filteredPets, setFilteredPets] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [activeFilter, setActiveFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const [showMap, setShowMap] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [showAiModal, setShowAiModal] = useState(false)
  const [selectedPetType, setSelectedPetType] = useState(null)
  const [selectedBehavior, setSelectedBehavior] = useState(null)
  const [weatherConditions, setWeatherConditions] = useState(null)
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [advancedFilters, setAdvancedFilters] = useState({
    petTypes: [],
    status: [],
    distance: "any",
    timeFrame: "any",
    withPhotos: false,
    withLocation: false,
  })
  const [noResults, setNoResults] = useState(false)
  const [mapRegion, setMapRegion] = useState(null)
  const [showSortModal, setShowSortModal] = useState(false)
  const [sortBy, setSortBy] = useState("recent")

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

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
    ]).start()

    fetchPetReports()
    getUserLocation()
  }, [])

  // Fetch all pet reports from Firestore
  const fetchPetReports = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "petReports"), orderBy("createdAt", "desc"))
      const querySnapshot = await getDocs(q)

      const reports = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          name: data.petName || "Unnamed Pet",
          type: data.petType || "Unknown",
          breed: data.petBreed || "Unknown Breed",
          age: data.petAge || "Unknown Age",
          lastSeen: data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : "Unknown",
          location: data.location || null,
          distance: data.distance || calculateDistance(data.location),
          status: data.status || "unknown",
          image: data.imageUrls && data.imageUrls.length > 0 ? { uri: data.imageUrls[0] } : null,
          behavior: data.behaviorContext || data.behavioralTraits?.join(", ") || null,
          timeElapsed: data.createdAt ? calculateTimeElapsed(data.createdAt.toDate()) : null,
          searchProbability: data.searchProbability || Math.floor(Math.random() * 30) + 70,
        }
      })

      setAllPets(reports)
      setFilteredPets(reports)
      setNoResults(reports.length === 0)
    } catch (error) {
      console.error("Error fetching pet reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateTimeElapsed = (date) => {
    const now = new Date()
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))

    if (diffInHours < 1) return "Less than an hour ago"
    if (diffInHours < 24) return `${diffInHours} hours ago`
    const diffInDays = Math.floor(diffInHours / 24)
    return diffInDays === 1 ? "1 day ago" : `${diffInDays} days ago`
  }

  const calculateDistance = (petLocation) => {
    if (!userLocation || !petLocation) return "Unknown distance"

    // Simple distance calculation
    const lat1 = userLocation.latitude
    const lon1 = userLocation.longitude
    const lat2 = petLocation.latitude
    const lon2 = petLocation.longitude

    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km

    return d < 1 ? `${(d * 1000).toFixed(0)} meters away` : `${d.toFixed(1)} km away`
  }

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180)
  }

  // Get user's current location
  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        console.log("Permission to access location was denied")
        return
      }

      const location = await Location.getCurrentPositionAsync({})
      const userLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }

      setUserLocation(userLoc)
      setMapRegion(userLoc)

      // Also fetch weather conditions for the current location
      fetchWeatherConditions(location.coords.latitude, location.coords.longitude)
    } catch (error) {
      console.error("Error getting location:", error)
    }
  }

  // Fetch weather conditions for AI suggestions
  const fetchWeatherConditions = async (lat, lng) => {
    try {
      // This would be replaced with an actual weather API call
      // For demo purposes, we'll simulate weather data
      const weatherTypes = ["Clear", "Rainy", "Cloudy", "Stormy", "Windy", "Hot", "Cold"]
      const randomWeather = weatherTypes[Math.floor(Math.random() * weatherTypes.length)]

      setWeatherConditions({
        condition: randomWeather,
        temperature: Math.floor(Math.random() * 30) + 10, // Random temp between 10-40°C
        windSpeed: Math.floor(Math.random() * 20), // Random wind speed 0-20 mph
        humidity: Math.floor(Math.random() * 100), // Random humidity 0-100%
        timeOfDay: new Date().getHours() < 18 ? "Day" : "Night",
      })
    } catch (error) {
      console.error("Error fetching weather:", error)
    }
  }

  // Generate AI-driven search suggestions based on pet behavior and environmental factors
  const generateAiSuggestions = async () => {
    if (!selectedPetType || !selectedBehavior || !userLocation || !weatherConditions) {
      return
    }

    setAiSuggestionsLoading(true)

    try {
      // In a real implementation, this would be an API call to your AI backend
      // For demo purposes, we'll simulate AI-generated search areas

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500))

      // Generate behavior-based search areas
      const suggestions = []

      // Base radius in meters - will be modified based on factors
      let baseRadius = 1000

      // Adjust radius based on time elapsed (if available from selected pet)
      const selectedPet = allPets.find(
        (p) => p.type.toLowerCase() === selectedPetType.toLowerCase() && p.status === "lost",
      )
      if (selectedPet && selectedPet.timeElapsed) {
        if (selectedPet.timeElapsed.includes("days")) {
          const days = Number.parseInt(selectedPet.timeElapsed)
          baseRadius = baseRadius * (1 + days * 0.5) // Increase radius by 50% per day
        } else if (selectedPet.timeElapsed.includes("hours")) {
          const hours = Number.parseInt(selectedPet.timeElapsed)
          baseRadius = baseRadius * (1 + hours * 0.1) // Increase radius by 10% per hour
        }
      }

      // Behavior-specific adjustments
      switch (selectedBehavior) {
        case "scared":
          // Scared pets tend to hide nearby
          suggestions.push({
            title: "Hiding Spots",
            description: "Scared pets often hide in small, dark spaces nearby",
            priority: "High",
            center: {
              latitude: userLocation.latitude + (Math.random() * 0.01 - 0.005),
              longitude: userLocation.longitude + (Math.random() * 0.01 - 0.005),
            },
            radius: baseRadius * 0.5, // Smaller radius for hiding
            color: "rgba(255, 0, 0, 0.2)", // Red for high priority
          })
          break

        case "curious":
          // Curious pets wander exploring new areas
          suggestions.push({
            title: "Exploration Areas",
            description: "Curious pets tend to explore new territories",
            priority: "Medium",
            center: {
              latitude: userLocation.latitude + (Math.random() * 0.03 - 0.015),
              longitude: userLocation.longitude + (Math.random() * 0.03 - 0.015),
            },
            radius: baseRadius * 1.5, // Larger radius for exploration
            color: "rgba(255, 165, 0, 0.2)", // Orange for medium priority
          })
          break

        case "hungry":
          // Hungry pets seek food sources
          suggestions.push({
            title: "Food Sources",
            description: "Hungry pets seek areas with food availability",
            priority: "High",
            center: {
              latitude: userLocation.latitude + (Math.random() * 0.02 - 0.01),
              longitude: userLocation.longitude + (Math.random() * 0.02 - 0.01),
            },
            radius: baseRadius,
            color: "rgba(255, 0, 0, 0.2)", // Red for high priority
          })
          break

        case "territorial":
          // Territorial pets may return to familiar areas
          suggestions.push({
            title: "Familiar Territory",
            description: "Territorial pets often return to familiar areas",
            priority: "High",
            center: {
              latitude: userLocation.latitude + (Math.random() * 0.005 - 0.0025),
              longitude: userLocation.longitude + (Math.random() * 0.005 - 0.0025),
            },
            radius: baseRadius * 0.7,
            color: "rgba(255, 0, 0, 0.2)", // Red for high priority
          })
          break

        default:
          // Default behavior
          suggestions.push({
            title: "General Search Area",
            description: "Recommended search area based on pet behavior",
            priority: "Medium",
            center: {
              latitude: userLocation.latitude + (Math.random() * 0.02 - 0.01),
              longitude: userLocation.longitude + (Math.random() * 0.02 - 0.01),
            },
            radius: baseRadius,
            color: "rgba(255, 165, 0, 0.2)", // Orange for medium priority
          })
      }

      // Add weather-based suggestions
      if (weatherConditions) {
        // Weather-specific adjustments
        switch (weatherConditions.condition) {
          case "Rainy":
          case "Stormy":
            // Pets seek shelter in bad weather
            suggestions.push({
              title: "Weather Shelters",
              description: `Pets seek shelter during ${weatherConditions.condition.toLowerCase()} weather`,
              priority: "High",
              center: {
                latitude: userLocation.latitude + (Math.random() * 0.01 - 0.005),
                longitude: userLocation.longitude + (Math.random() * 0.01 - 0.005),
              },
              radius: baseRadius * 0.6, // Smaller radius as they seek nearby shelter
              color: "rgba(0, 0, 255, 0.2)", // Blue for weather-related
            })
            break

          case "Hot":
            // Pets seek shade and water in hot weather
            suggestions.push({
              title: "Water Sources",
              description: "Pets seek water sources in hot weather",
              priority: "High",
              center: {
                latitude: userLocation.latitude + (Math.random() * 0.02 - 0.01),
                longitude: userLocation.longitude + (Math.random() * 0.02 - 0.01),
              },
              radius: baseRadius * 0.8,
              color: "rgba(0, 0, 255, 0.2)", // Blue for weather-related
            })
            break

          case "Windy":
            // Pets may follow scents in windy weather
            suggestions.push({
              title: "Downwind Areas",
              description: "Pets may follow scents downwind",
              priority: "Medium",
              center: {
                latitude: userLocation.latitude + (Math.random() * 0.03 - 0.015),
                longitude: userLocation.longitude + (Math.random() * 0.03 - 0.015),
              },
              radius: baseRadius * 1.2,
              color: "rgba(0, 255, 0, 0.2)", // Green for medium priority
            })
            break
        }
      }

      // Add species-specific suggestions
      if (selectedPetType === "dog") {
        suggestions.push({
          title: "Scent Trails",
          description: "Dogs often follow familiar scents back home",
          priority: "Medium",
          center: {
            latitude: userLocation.latitude + (Math.random() * 0.02 - 0.01),
            longitude: userLocation.longitude + (Math.random() * 0.02 - 0.01),
          },
          radius: baseRadius * 0.9,
          color: "rgba(0, 255, 0, 0.2)", // Green for medium priority
        })
      } else if (selectedPetType === "cat") {
        suggestions.push({
          title: "Elevated Hiding Spots",
          description: "Cats often seek high places to hide and observe",
          priority: "High",
          center: {
            latitude: userLocation.latitude + (Math.random() * 0.01 - 0.005),
            longitude: userLocation.longitude + (Math.random() * 0.01 - 0.005),
          },
          radius: baseRadius * 0.7,
          color: "rgba(255, 0, 0, 0.2)", // Red for high priority
        })
      }

      setAiSuggestions(suggestions)

      // If map is not showing, switch to map view to display suggestions
      if (!showMap) {
        setShowMap(true)
      }

      // Fit map to show all suggestion areas
      if (mapRef.current && suggestions.length > 0) {
        const coordinates = suggestions.map((s) => s.center)
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        })
      }
    } catch (error) {
      console.error("Error generating AI suggestions:", error)
    } finally {
      setAiSuggestionsLoading(false)
      setShowAiModal(false)
    }
  }

  // Apply filters and search
  useEffect(() => {
    applyFilters()
  }, [searchQuery, activeFilter, allPets, advancedFilters, sortBy])

  const applyFilters = () => {
    let results = [...allPets]

    // Apply text search
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      results = results.filter(
        (pet) =>
          (pet.name && pet.name.toLowerCase().includes(query)) ||
          (pet.breed && pet.breed.toLowerCase().includes(query)) ||
          (pet.type && pet.type.toLowerCase().includes(query)) ||
          (pet.behavior && pet.behavior.toLowerCase().includes(query)),
      )
    }

    // Apply quick filters
    if (activeFilter === "lost" || activeFilter === "found") {
      results = results.filter((pet) => pet.status.toLowerCase() === activeFilter.toLowerCase())
    } else if (activeFilter === "dogs") {
      results = results.filter((pet) => pet.type && pet.type.toLowerCase() === "dog")
    } else if (activeFilter === "cats") {
      results = results.filter((pet) => pet.type && pet.type.toLowerCase() === "cat")
    } else if (activeFilter === "nearby") {
      results = results.filter((pet) => {
        if (!pet.distance || !userLocation) return false
        if (typeof pet.distance === "string") {
          // Extract the numeric part and convert to number
          const distanceMatch = pet.distance.match(/^([\d.]+)/)
          if (distanceMatch) {
            const distance = Number.parseFloat(distanceMatch[1])
            // Check if the unit is km or meters
            const isKm = pet.distance.includes("km")
            return isKm ? distance < 5 : distance < 5000
          }
          return false
        }
        return false
      })
    }

    // Apply advanced filters
    if (advancedFilters.petTypes.length > 0) {
      results = results.filter((pet) =>
        advancedFilters.petTypes.some((type) => pet.type && pet.type.toLowerCase() === type.toLowerCase()),
      )
    }

    if (advancedFilters.status.length > 0) {
      results = results.filter((pet) =>
        advancedFilters.status.some((status) => pet.status && pet.status.toLowerCase() === status.toLowerCase()),
      )
    }

    if (advancedFilters.distance !== "any" && userLocation) {
      const maxDistanceKm =
        advancedFilters.distance === "1km"
          ? 1
          : advancedFilters.distance === "5km"
            ? 5
            : advancedFilters.distance === "10km"
              ? 10
              : 50

      results = results.filter((pet) => {
        if (!pet.location) return false

        // Calculate distance
        const lat1 = userLocation.latitude
        const lon1 = userLocation.longitude
        const lat2 = pet.location.latitude
        const lon2 = pet.location.longitude

        const R = 6371 // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1)
        const dLon = deg2rad(lon2 - lon1)
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        const distance = R * c // Distance in km

        return distance <= maxDistanceKm
      })
    }

    if (advancedFilters.timeFrame !== "any") {
      const now = new Date()
      const timeThreshold = new Date()

      switch (advancedFilters.timeFrame) {
        case "24h":
          timeThreshold.setHours(now.getHours() - 24)
          break
        case "week":
          timeThreshold.setDate(now.getDate() - 7)
          break
        case "month":
          timeThreshold.setMonth(now.getMonth() - 1)
          break
      }

      results = results.filter((pet) => {
        if (!pet.createdAt) return false
        const petDate = new Date(pet.createdAt.toDate())
        return petDate >= timeThreshold
      })
    }

    if (advancedFilters.withPhotos) {
      results = results.filter((pet) => pet.image !== null)
    }

    if (advancedFilters.withLocation) {
      results = results.filter((pet) => pet.location !== null)
    }

    // Apply sorting
    if (sortBy === "recent") {
      results.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0
        const dateA = new Date(a.createdAt.toDate())
        const dateB = new Date(b.createdAt.toDate())
        return dateB - dateA
      })
    } else if (sortBy === "probability") {
      results.sort((a, b) => (b.searchProbability || 0) - (a.searchProbability || 0))
    } else if (sortBy === "distance" && userLocation) {
      results.sort((a, b) => {
        if (!a.location || !b.location) return 0

        // Calculate distance for pet A
        const distanceA = calculateDistanceValue(a.location, userLocation)

        // Calculate distance for pet B
        const distanceB = calculateDistanceValue(b.location, userLocation)

        return distanceA - distanceB
      })
    }

    setFilteredPets(results)
    setNoResults(results.length === 0)
  }

  const calculateDistanceValue = (petLocation, userLoc) => {
    if (!petLocation || !userLoc) return Number.POSITIVE_INFINITY

    const lat1 = userLoc.latitude
    const lon1 = userLoc.longitude
    const lat2 = petLocation.latitude
    const lon2 = petLocation.longitude

    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c // Distance in km
  }

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchPetReports()
    setRefreshing(false)
  }

  const handleViewPetDetails = (pet) => {
    navigation.navigate("PetDetails", { pet })
  }

  const openAiSuggestionsModal = () => {
    setShowAiModal(true)
  }

  const toggleFilterModal = () => {
    setShowFilterModal(!showFilterModal)
  }

  const toggleSortModal = () => {
    setShowSortModal(!showSortModal)
  }

  const resetFilters = () => {
    setAdvancedFilters({
      petTypes: [],
      status: [],
      distance: "any",
      timeFrame: "any",
      withPhotos: false,
      withLocation: false,
    })
    setActiveFilter("all")
    setSearchQuery("")
  }

  const handlePetTypeFilter = (type) => {
    setAdvancedFilters((prev) => {
      const newPetTypes = [...prev.petTypes]
      const index = newPetTypes.indexOf(type)

      if (index > -1) {
        newPetTypes.splice(index, 1)
      } else {
        newPetTypes.push(type)
      }

      return {
        ...prev,
        petTypes: newPetTypes,
      }
    })
  }

  const handleStatusFilter = (status) => {
    setAdvancedFilters((prev) => {
      const newStatus = [...prev.status]
      const index = newStatus.indexOf(status)

      if (index > -1) {
        newStatus.splice(index, 1)
      } else {
        newStatus.push(status)
      }

      return {
        ...prev,
        status: newStatus,
      }
    })
  }

  const renderPetItem = ({ item }) => {
    const isLost = item.status === "lost"

    return (
      <TouchableOpacity
        style={tw`flex-row bg-white rounded-xl shadow-sm mb-4 overflow-hidden`}
        onPress={() => handleViewPetDetails(item)}
      >
        {item.image ? (
          <Image source={item.image} style={tw`w-24 h-24 bg-gray-200`} resizeMode="cover" />
        ) : (
          <View style={tw`w-24 h-24 bg-gray-200 items-center justify-center`}>
            <Feather name="image" size={24} color="#9CA3AF" />
          </View>
        )}
        <View style={tw`flex-1 p-3 justify-center`}>
          <View style={tw`flex-row justify-between items-center mb-1`}>
            <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
              {item.name}
            </CustomText>
            <View style={tw`px-2 py-1 rounded-full ${item.status === "lost" ? "bg-red-500" : "bg-green-500"}`}>
              <CustomText style={tw`text-white text-[10px]`} weight="SemiBold">
                {item.status === "lost" ? "LOST" : "FOUND"}
              </CustomText>
            </View>
          </View>
          <CustomText style={tw`text-[14px] text-gray-600 mb-1`}>
            {item.breed} • {item.type}
          </CustomText>
          <View style={tw`flex-row items-center`}>
            <Feather name="map-pin" size={12} color="#9CA3AF" style={tw`mr-1`} />
            <CustomText style={tw`text-[12px] text-gray-500`}>{item.distance || "Unknown distance"}</CustomText>
          </View>
          <View style={tw`flex-row items-center mt-1`}>
            <Feather name="clock" size={12} color="#9CA3AF" style={tw`mr-1`} />
            <CustomText style={tw`text-[12px] text-gray-500`}>{item.timeElapsed || item.lastSeen}</CustomText>
          </View>
          {item.behavior && (
            <View style={tw`flex-row items-center mt-1`}>
              <Feather name="activity" size={12} color="#9CA3AF" style={tw`mr-1`} />
              <CustomText style={tw`text-[12px] text-gray-500 flex-1`} numberOfLines={1}>
                {item.behavior}
              </CustomText>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  // AI Suggestions Modal
  const renderAiSuggestionsModal = () => (
    <Modal visible={showAiModal} transparent={true} animationType="slide" onRequestClose={() => setShowAiModal(false)}>
      <View style={tw`flex-1 justify-center items-center bg-black bg-opacity-50`}>
        <View style={tw`bg-white rounded-xl p-6 w-[90%] max-h-[80%]`}>
          <View style={tw`flex-row justify-between items-center mb-4`}>
            <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
              AI Search Suggestions
            </CustomText>
            <TouchableOpacity onPress={() => setShowAiModal(false)}>
              <Feather name="x" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <CustomText style={tw`text-[16px] text-gray-600 mb-4`}>
            Our AI will analyze pet behavior patterns and environmental factors to suggest optimal search areas.
          </CustomText>

          <View style={tw`mb-4`}>
            <CustomText style={tw`text-[14px] text-gray-800 mb-2`} weight="SemiBold">
              Pet Type
            </CustomText>
            <View style={tw`flex-row flex-wrap`}>
              {["dog", "cat", "bird", "other"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    tw`px-4 py-2 rounded-lg mr-2 mb-2 border`,
                    selectedPetType === type ? tw`bg-[#2A80FD] border-[#2A80FD]` : tw`bg-white border-gray-300`,
                  ]}
                  onPress={() => setSelectedPetType(type)}
                >
                  <CustomText
                    style={[tw`text-[14px]`, selectedPetType === type ? tw`text-white` : tw`text-gray-700`]}
                    weight="Medium"
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={tw`mb-4`}>
            <CustomText style={tw`text-[14px] text-gray-800 mb-2`} weight="SemiBold">
              Behavior When Lost
            </CustomText>
            <View style={tw`flex-row flex-wrap`}>
              {["scared", "curious", "hungry", "territorial"].map((behavior) => (
                <TouchableOpacity
                  key={behavior}
                  style={[
                    tw`px-4 py-2 rounded-lg mr-2 mb-2 border`,
                    selectedBehavior === behavior ? tw`bg-[#2A80FD] border-[#2A80FD]` : tw`bg-white border-gray-300`,
                  ]}
                  onPress={() => setSelectedBehavior(behavior)}
                >
                  <CustomText
                    style={[tw`text-[14px]`, selectedBehavior === behavior ? tw`text-white` : tw`text-gray-700`]}
                    weight="Medium"
                  >
                    {behavior.charAt(0).toUpperCase() + behavior.slice(1)}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {weatherConditions && (
            <View style={tw`mb-6 p-3 bg-gray-50 rounded-lg`}>
              <CustomText style={tw`text-[14px] text-gray-800 mb-1`} weight="SemiBold">
                Current Weather Conditions
              </CustomText>
              <View style={tw`flex-row items-center`}>
                <Feather
                  name={
                    weatherConditions.condition === "Clear"
                      ? "sun"
                      : weatherConditions.condition === "Rainy"
                        ? "cloud-rain"
                        : weatherConditions.condition === "Cloudy"
                          ? "cloud"
                          : weatherConditions.condition === "Stormy"
                            ? "cloud-lightning"
                            : weatherConditions.condition === "Windy"
                              ? "wind"
                              : "thermometer"
                  }
                  size={16}
                  color="#4B5563"
                  style={tw`mr-2`}
                />
                <CustomText style={tw`text-[14px] text-gray-600`}>
                  {weatherConditions.condition}, {weatherConditions.temperature}°C
                </CustomText>
              </View>
              <CustomText style={tw`text-[12px] text-gray-500 mt-1`}>
                These conditions will be factored into the AI suggestions
              </CustomText>
            </View>
          )}

          <TouchableOpacity
            style={[
              tw`bg-[#2A80FD] py-3 rounded-xl items-center justify-center`,
              (!selectedPetType || !selectedBehavior) && tw`bg-gray-300`,
            ]}
            onPress={generateAiSuggestions}
            disabled={!selectedPetType || !selectedBehavior || aiSuggestionsLoading}
          >
            {aiSuggestionsLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
                Generate Search Suggestions
              </CustomText>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  // Filter Modal
  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilterModal(false)}
    >
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={tw`flex-1`}>
        <View style={tw`flex-1 justify-end bg-black bg-opacity-50`}>
          <View style={tw`bg-white rounded-t-3xl p-6 max-h-[90%]`}>
            <View style={tw`flex-row justify-between items-center mb-4`}>
              <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
                Filter Reports
              </CustomText>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Feather name="x" size={24} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tw`pb-6`}>
              {/* Pet Types */}
              <View style={tw`mb-6`}>
                <CustomText style={tw`text-[16px] text-gray-800 mb-3`} weight="SemiBold">
                  Pet Type
                </CustomText>
                <View style={tw`flex-row flex-wrap`}>
                  {["Dog", "Cat", "Bird", "Other"].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        tw`px-4 py-2 rounded-lg mr-2 mb-2 border`,
                        advancedFilters.petTypes.includes(type)
                          ? tw`bg-blue-500 border-blue-500`
                          : tw`bg-white border-gray-300`,
                      ]}
                      onPress={() => handlePetTypeFilter(type)}
                    >
                      <CustomText
                        style={[
                          tw`text-[14px]`,
                          advancedFilters.petTypes.includes(type) ? tw`text-white` : tw`text-gray-700`,
                        ]}
                        weight="Medium"
                      >
                        {type}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Status */}
              <View style={tw`mb-6`}>
                <CustomText style={tw`text-[16px] text-gray-800 mb-3`} weight="SemiBold">
                  Status
                </CustomText>
                <View style={tw`flex-row flex-wrap`}>
                  {[
                    { value: "lost", label: "Lost", color: "red" },
                    { value: "found", label: "Found", color: "green" },
                    { value: "resolved", label: "Reunited", color: "blue" },
                  ].map((status) => (
                    <TouchableOpacity
                      key={status.value}
                      style={[
                        tw`px-4 py-2 rounded-lg mr-2 mb-2 border`,
                        advancedFilters.status.includes(status.value)
                          ? tw`bg-${status.color}-500 border-${status.color}-500`
                          : tw`bg-white border-gray-300`,
                      ]}
                      onPress={() => handleStatusFilter(status.value)}
                    >
                      <CustomText
                        style={[
                          tw`text-[14px]`,
                          advancedFilters.status.includes(status.value) ? tw`text-white` : tw`text-gray-700`,
                        ]}
                        weight="Medium"
                      >
                        {status.label}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Distance */}
              <View style={tw`mb-6`}>
                <CustomText style={tw`text-[16px] text-gray-800 mb-3`} weight="SemiBold">
                  Distance
                </CustomText>
                <View style={tw`flex-row flex-wrap`}>
                  {[
                    { value: "any", label: "Any Distance" },
                    { value: "1km", label: "Within 1 km" },
                    { value: "5km", label: "Within 5 km" },
                    { value: "10km", label: "Within 10 km" },
                    { value: "50km", label: "Within 50 km" },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        tw`px-4 py-2 rounded-lg mr-2 mb-2 border`,
                        advancedFilters.distance === option.value
                          ? tw`bg-blue-500 border-blue-500`
                          : tw`bg-white border-gray-300`,
                      ]}
                      onPress={() => setAdvancedFilters((prev) => ({ ...prev, distance: option.value }))}
                    >
                      <CustomText
                        style={[
                          tw`text-[14px]`,
                          advancedFilters.distance === option.value ? tw`text-white` : tw`text-gray-700`,
                        ]}
                        weight="Medium"
                      >
                        {option.label}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Time Frame */}
              <View style={tw`mb-6`}>
                <CustomText style={tw`text-[16px] text-gray-800 mb-3`} weight="SemiBold">
                  Time Frame
                </CustomText>
                <View style={tw`flex-row flex-wrap`}>
                  {[
                    { value: "any", label: "Any Time" },
                    { value: "24h", label: "Last 24 Hours" },
                    { value: "week", label: "Last Week" },
                    { value: "month", label: "Last Month" },
                  ].map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        tw`px-4 py-2 rounded-lg mr-2 mb-2 border`,
                        advancedFilters.timeFrame === option.value
                          ? tw`bg-blue-500 border-blue-500`
                          : tw`bg-white border-gray-300`,
                      ]}
                      onPress={() => setAdvancedFilters((prev) => ({ ...prev, timeFrame: option.value }))}
                    >
                      <CustomText
                        style={[
                          tw`text-[14px]`,
                          advancedFilters.timeFrame === option.value ? tw`text-white` : tw`text-gray-700`,
                        ]}
                        weight="Medium"
                      >
                        {option.label}
                      </CustomText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Additional Filters */}
              <View style={tw`mb-6`}>
                <CustomText style={tw`text-[16px] text-gray-800 mb-3`} weight="SemiBold">
                  Additional Filters
                </CustomText>

                <View style={tw`flex-row items-center justify-between py-2 border-b border-gray-200`}>
                  <CustomText style={tw`text-[14px] text-gray-700`}>Only show reports with photos</CustomText>
                  <Switch
                    value={advancedFilters.withPhotos}
                    onValueChange={(value) => setAdvancedFilters((prev) => ({ ...prev, withPhotos: value }))}
                    trackColor={{ false: "#D1D5DB", true: "#BFDBFE" }}
                    thumbColor={advancedFilters.withPhotos ? "#3B82F6" : "#9CA3AF"}
                  />
                </View>

                <View style={tw`flex-row items-center justify-between py-2 border-b border-gray-200`}>
                  <CustomText style={tw`text-[14px] text-gray-700`}>Only show reports with location</CustomText>
                  <Switch
                    value={advancedFilters.withLocation}
                    onValueChange={(value) => setAdvancedFilters((prev) => ({ ...prev, withLocation: value }))}
                    trackColor={{ false: "#D1D5DB", true: "#BFDBFE" }}
                    thumbColor={advancedFilters.withLocation ? "#3B82F6" : "#9CA3AF"}
                  />
                </View>
              </View>
            </ScrollView>

            <View style={tw`flex-row mt-4`}>
              <TouchableOpacity style={tw`flex-1 bg-gray-200 py-3 rounded-xl mr-3 items-center`} onPress={resetFilters}>
                <CustomText style={tw`text-gray-700 text-[16px]`} weight="SemiBold">
                  Reset
                </CustomText>
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-1 bg-blue-500 py-3 rounded-xl items-center`}
                onPress={() => setShowFilterModal(false)}
              >
                <CustomText style={tw`text-white text-[16px]`} weight="SemiBold">
                  Apply Filters
                </CustomText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )

  // Sort Modal
  const renderSortModal = () => (
    <Modal
      visible={showSortModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowSortModal(false)}
    >
      <View style={tw`flex-1 justify-end bg-black bg-opacity-50`}>
        <View style={tw`bg-white rounded-t-3xl p-6`}>
          <View style={tw`flex-row justify-between items-center mb-4`}>
            <CustomText style={tw`text-[20px] text-gray-800`} weight="Bold">
              Sort By
            </CustomText>
            <TouchableOpacity onPress={() => setShowSortModal(false)}>
              <Feather name="x" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={tw`flex-row items-center justify-between py-4 border-b border-gray-200`}
            onPress={() => {
              setSortBy("recent")
              setShowSortModal(false)
            }}
          >
            <View style={tw`flex-row items-center`}>
              <Feather name="clock" size={20} color="#3B82F6" style={tw`mr-3`} />
              <CustomText style={tw`text-[16px] text-gray-800`}>Most Recent</CustomText>
            </View>
            {sortBy === "recent" && <Feather name="check" size={20} color="#3B82F6" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center justify-between py-4 border-b border-gray-200`}
            onPress={() => {
              setSortBy("probability")
              setShowSortModal(false)
            }}
          >
            <View style={tw`flex-row items-center`}>
              <Feather name="target" size={20} color="#3B82F6" style={tw`mr-3`} />
              <CustomText style={tw`text-[16px] text-gray-800`}>Highest Match Probability</CustomText>
            </View>
            {sortBy === "probability" && <Feather name="check" size={20} color="#3B82F6" />}
          </TouchableOpacity>

          <TouchableOpacity
            style={tw`flex-row items-center justify-between py-4`}
            onPress={() => {
              setSortBy("distance")
              setShowSortModal(false)
            }}
          >
            <View style={tw`flex-row items-center`}>
              <Feather name="map-pin" size={20} color="#3B82F6" style={tw`mr-3`} />
              <CustomText style={tw`text-[16px] text-gray-800`}>Nearest to Me</CustomText>
            </View>
            {sortBy === "distance" && <Feather name="check" size={20} color="#3B82F6" />}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )

  return (
    <View style={tw`flex-1 bg-white pt-12`}>
      <View style={tw`px-6 pb-4 flex-row items-center justify-between`}>
        <CustomText style={tw`text-[24px] text-gray-800`} weight="Bold">
          Search
        </CustomText>
        <View style={tw`flex-row`}>
          <TouchableOpacity style={tw`mr-4`} onPress={openAiSuggestionsModal}>
            <Feather name="cpu" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMap(!showMap)}>
            <Feather name={showMap ? "list" : "map"} size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={tw`px-6 mb-4`}>
        <View style={tw`flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 w-full`}>
          <Feather name="search" size={20} color="#9CA3AF" style={tw`mr-2`} />
          <TextInput
            style={tw`flex-1 text-gray-800 text-base`}
            placeholder="Search by name, breed, location..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter and Sort Buttons */}
      <View style={tw`px-6 flex-row justify-between mb-4`}>
        <TouchableOpacity
          style={tw`flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mr-2 flex-1`}
          onPress={toggleFilterModal}
        >
          <Feather name="filter" size={16} color="#3B82F6" style={tw`mr-2`} />
          <CustomText style={tw`text-gray-700 text-[14px]`} weight="Medium">
            Filter
          </CustomText>
          {Object.values(advancedFilters).some(
            (val) => (Array.isArray(val) && val.length > 0) || (!Array.isArray(val) && val !== false && val !== "any"),
          ) && <View style={tw`w-2 h-2 bg-blue-500 rounded-full ml-2`} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={tw`flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex-1`}
          onPress={toggleSortModal}
        >
          <Feather name="bar-chart-2" size={16} color="#3B82F6" style={tw`mr-2`} />
          <CustomText style={tw`text-gray-700 text-[14px]`} weight="Medium">
            Sort: {sortBy === "recent" ? "Most Recent" : sortBy === "probability" ? "Probability" : "Nearest"}
          </CustomText>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`px-6 pb-4`}>
        {["all", "dogs", "cats", "lost", "found", "nearby"].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              tw`px-4 py-2 rounded-lg mr-2 h-8 items-center justify-center`,
              activeFilter === filter ? tw`bg-[#3B82F6]` : tw`bg-gray-100`,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <CustomText
              style={[tw`text-xs`, activeFilter === filter ? tw`text-white` : tw`text-gray-700`]}
              weight="Medium"
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </CustomText>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* AI Suggestions Banner (when suggestions are available) */}
      {aiSuggestions.length > 0 && !showMap && (
        <TouchableOpacity
          style={tw`mx-6 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex-row items-center`}
          onPress={() => setShowMap(true)}
        >
          <View style={tw`w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3`}>
            <Feather name="cpu" size={20} color="#3B82F6" />
          </View>
          <View style={tw`flex-1`}>
            <CustomText style={tw`text-[14px] text-gray-800`} weight="SemiBold">
              AI Search Suggestions Available
            </CustomText>
            <CustomText style={tw`text-[12px] text-gray-600`}>
              {aiSuggestions.length} optimized search areas based on pet behavior
            </CustomText>
          </View>
          <Feather name="chevron-right" size={20} color="#3B82F6" />
        </TouchableOpacity>
      )}

      {/* Conditional Rendering: Map or List */}
      {showMap ? (
        <View style={tw`flex-1 absolute top-0 left-0 right-0 bottom-0 z-10`}>
          <MapView
            ref={mapRef}
            style={tw`w-full h-full`}
            initialRegion={
              mapRegion || {
                latitude: 37.7749,
                longitude: -122.4194,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }
            }
            provider={PROVIDER_GOOGLE}
            showsUserLocation
          >
            {/* Pet Markers */}
            {filteredPets.map((pet) =>
              pet.location ? (
                <Marker
                  key={pet.id}
                  coordinate={{
                    latitude: pet.location.latitude,
                    longitude: pet.location.longitude,
                  }}
                  title={pet.name}
                  description={`${pet.status.toUpperCase()} - ${pet.breed}`}
                  pinColor={pet.status === "lost" ? "red" : "green"}
                  onPress={() => handleViewPetDetails(pet)}
                >
                  <View style={tw`items-center`}>
                    <View style={tw`w-10 h-10 rounded-full bg-white items-center justify-center shadow-md`}>
                      <Feather
                        name={pet.status === "lost" ? "alert-circle" : "check-circle"}
                        size={20}
                        color={pet.status === "lost" ? "#EF4444" : "#10B981"}
                      />
                    </View>
                  </View>
                </Marker>
              ) : null,
            )}

            {/* AI Suggestion Circles */}
            {aiSuggestions.map((suggestion, index) => (
              <Circle
                key={`suggestion-${index}`}
                center={suggestion.center}
                radius={suggestion.radius}
                fillColor={suggestion.color}
                strokeColor={suggestion.color.replace("0.2", "0.8")}
                strokeWidth={1}
              />
            ))}
          </MapView>

          {/* Map Header Controls */}
          <View style={tw`absolute top-0 left-0 right-0 bg-white bg-opacity-90 px-6 pt-12 pb-4 shadow-sm z-20`}>
            <View style={tw`flex-row items-center justify-between mb-4`}>
              <CustomText style={tw`text-[24px] text-gray-800`} weight="Bold">
                Search
              </CustomText>
              <View style={tw`flex-row`}>
                <TouchableOpacity style={tw`mr-4`} onPress={openAiSuggestionsModal}>
                  <Feather name="cpu" size={24} color="#3B82F6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowMap(!showMap)}>
                  <Feather name="list" size={24} color="#3B82F6" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Search Input */}
            <View style={tw`mb-4`}>
              <View style={tw`flex-row items-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 w-full`}>
                <Feather name="search" size={20} color="#9CA3AF" style={tw`mr-2`} />
                <TextInput
                  style={tw`flex-1 text-gray-800 text-base`}
                  placeholder="Search by name, breed, location..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Feather name="x" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Filter and Sort Buttons */}
            <View style={tw`flex-row justify-between mb-4`}>
              <TouchableOpacity
                style={tw`flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 mr-2 flex-1`}
                onPress={toggleFilterModal}
              >
                <Feather name="filter" size={16} color="#3B82F6" style={tw`mr-2`} />
                <CustomText style={tw`text-gray-700 text-[14px]`} weight="Medium">
                  Filter
                </CustomText>
                {Object.values(advancedFilters).some(
                  (val) =>
                    (Array.isArray(val) && val.length > 0) || (!Array.isArray(val) && val !== false && val !== "any"),
                ) && <View style={tw`w-2 h-2 bg-blue-500 rounded-full ml-2`} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={tw`flex-row items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex-1`}
                onPress={toggleSortModal}
              >
                <Feather name="bar-chart-2" size={16} color="#3B82F6" style={tw`mr-2`} />
                <CustomText style={tw`text-gray-700 text-[14px]`} weight="Medium">
                  Sort: {sortBy === "recent" ? "Most Recent" : sortBy === "probability" ? "Probability" : "Nearest"}
                </CustomText>
              </TouchableOpacity>
            </View>

            {/* Quick Filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tw`pb-2`}>
              {["all", "dogs", "cats", "lost", "found", "nearby"].map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    tw`px-4 py-2 rounded-lg mr-2 h-8 items-center justify-center`,
                    activeFilter === filter ? tw`bg-[#3B82F6]` : tw`bg-gray-100`,
                  ]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <CustomText
                    style={[tw`text-xs`, activeFilter === filter ? tw`text-white` : tw`text-gray-700`]}
                    weight="Medium"
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </CustomText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* AI Suggestions Legend (when suggestions are available) */}
          {aiSuggestions.length > 0 && (
            <View style={tw`absolute bottom-4 left-4 right-4 bg-white rounded-xl shadow-md p-4 z-20`}>
              <View style={tw`flex-row justify-between items-center mb-2`}>
                <CustomText style={tw`text-[16px] text-gray-800`} weight="Bold">
                  AI Search Suggestions
                </CustomText>
                <TouchableOpacity onPress={() => setAiSuggestions([])}>
                  <Feather name="x" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <ScrollView style={tw`max-h-32`}>
                {aiSuggestions.map((suggestion, index) => (
                  <View key={`legend-${index}`} style={tw`flex-row items-center mb-2`}>
                    <View
                      style={[
                        tw`w-4 h-4 rounded-full mr-2`,
                        { backgroundColor: suggestion.color.replace("0.2", "0.8") },
                      ]}
                    />
                    <View style={tw`flex-1`}>
                      <CustomText style={tw`text-[14px] text-gray-800`} weight="SemiBold">
                        {suggestion.title}
                      </CustomText>
                      <CustomText style={tw`text-[12px] text-gray-600`}>{suggestion.description}</CustomText>
                    </View>
                    <View
                      style={[
                        tw`px-2 py-1 rounded-full ml-2`,
                        suggestion.priority === "High"
                          ? tw`bg-red-100`
                          : suggestion.priority === "Medium"
                            ? tw`bg-orange-100`
                            : tw`bg-blue-100`,
                      ]}
                    >
                      <CustomText
                        style={[
                          tw`text-[10px]`,
                          suggestion.priority === "High"
                            ? tw`text-red-700`
                            : suggestion.priority === "Medium"
                              ? tw`text-orange-700`
                              : tw`text-blue-700`,
                        ]}
                        weight="SemiBold"
                      >
                        {suggestion.priority}
                      </CustomText>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={tw`bg-[#3B82F6] py-2 rounded-lg items-center justify-center mt-2`}
                onPress={openAiSuggestionsModal}
              >
                <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                  Refine Search Areas
                </CustomText>
              </TouchableOpacity>
            </View>
          )}

          {/* Map Controls */}
          <View style={tw`absolute top-32 right-4 flex-col z-20`}>
            <TouchableOpacity
              style={tw`w-10 h-10 rounded-full bg-white shadow-md items-center justify-center mb-2`}
              onPress={() => {
                if (userLocation && mapRef.current) {
                  mapRef.current.animateToRegion(userLocation, 1000)
                }
              }}
            >
              <Feather name="navigation" size={18} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // List view remains the same
        <FlatList
          data={filteredPets}
          renderItem={renderPetItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={tw`px-6 pt-4 pb-20 flex-grow`}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          ListEmptyComponent={
            <View style={tw`items-center justify-center py-10`}>
              <View style={tw`w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4`}>
                {loading ? (
                  <ActivityIndicator size="large" color="#3B82F6" />
                ) : (
                  <Feather name="search" size={24} color="#9CA3AF" />
                )}
              </View>
              <CustomText style={tw`text-[16px] text-gray-800 mb-2 text-center`} weight="Bold">
                {loading ? "Loading pets..." : "No pets found"}
              </CustomText>
              <CustomText style={tw`text-[14px] text-gray-600 text-center mb-6 px-10`}>
                {loading
                  ? ""
                  : noResults
                    ? "No pet reports matching your criteria"
                    : "Try adjusting your search or filters"}
              </CustomText>
              {!loading && noResults && (
                <TouchableOpacity
                  style={tw`bg-[#3B82F6] px-6 py-3 rounded-xl`}
                  onPress={() => navigation.navigate("Report")}
                >
                  <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                    Add New Report
                  </CustomText>
                </TouchableOpacity>
              )}
              {!loading && !noResults && (
                <TouchableOpacity
                  style={tw`bg-[#3B82F6] px-6 py-3 rounded-xl`}
                  onPress={() => {
                    setActiveFilter("all")
                    setSearchQuery("")
                    resetFilters()
                  }}
                >
                  <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                    Reset Filters
                  </CustomText>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* AI Suggestions Modal */}
      {renderAiSuggestionsModal()}

      {/* Filter Modal */}
      {renderFilterModal()}

      {/* Sort Modal */}
      {renderSortModal()}
    </View>
  )
}

export default SearchScreen
