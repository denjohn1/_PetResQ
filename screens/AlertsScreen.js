"use client"

import { useState, useEffect } from "react"
import { View, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native"
import tw from "twrnc"
import CustomText from "../components/CustomText"
import { Feather } from "@expo/vector-icons"
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore"
import { db } from "../firebaseConfig"

const AlertsScreen = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [hasAlerts, setHasAlerts] = useState(false)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAlerts()
  }, [])

  const fetchAlerts = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Create a query against the alerts collection
      const alertsRef = collection(db, "alerts")
      const alertsQuery = query(alertsRef, orderBy("createdAt", "desc"), limit(10))
      const alertsSnapshot = await getDocs(alertsQuery)

      if (alertsSnapshot.empty) {
        console.log("No alerts found")
        setAlerts([])
        setHasAlerts(false)
      } else {
        const alertsList = alertsSnapshot.docs.map((doc) => {
          const data = doc.data()

          // Format the time
          let timeString = "Unknown time"
          if (data.createdAt) {
            const now = new Date()
            const alertTime = new Date(data.createdAt.toDate())
            const diffMinutes = Math.floor((now - alertTime) / (1000 * 60))

            if (diffMinutes < 60) {
              timeString = `${diffMinutes} min ago`
            } else if (diffMinutes < 1440) {
              timeString = `${Math.floor(diffMinutes / 60)} hour${Math.floor(diffMinutes / 60) > 1 ? "s" : ""} ago`
            } else {
              timeString = alertTime.toLocaleDateString()
            }
          }

          // Calculate distance (mock for now)
          const distance = data.location ? `${(Math.random() * 2 + 0.1).toFixed(1)} miles away` : "Unknown"

          return {
            id: doc.id,
            title: data.title || "Alert",
            description: data.description || "No description",
            time: timeString,
            distance: distance,
            priority: data.priority || "medium",
            petId: data.petId,
          }
        })

        setAlerts(alertsList)
        setHasAlerts(alertsList.length > 0)
      }
    } catch (error) {
      console.error("Error fetching alerts:", error)
      setError(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const refreshAlerts = () => {
    fetchAlerts()
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "high":
        return "#EF4444"
      case "medium":
        return "#F59E0B"
      default:
        return "#3B82F6"
    }
  }

  return (
    <View style={tw`flex-1 bg-white pt-12`}>
      <View style={tw`px-6 pb-4 flex-row items-center justify-between`}>
        <CustomText style={tw`text-[24px] text-gray-800`} weight="Bold">
          Alerts
        </CustomText>
        <TouchableOpacity onPress={refreshAlerts}>
          <Feather name={hasAlerts ? "bell" : "bell-off"} size={22} color="#2A80FD" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={tw`mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-xl`}>
          <View style={tw`flex-row items-center`}>
            <Feather name="alert-circle" size={20} color="#EF4444" style={tw`mr-2`} />
            <CustomText style={tw`text-red-600 flex-1`}>Error fetching alerts: {error}</CustomText>
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={tw`flex-1 justify-center items-center`}>
          <ActivityIndicator size="large" color="#2A80FD" />
          <CustomText style={tw`mt-4 text-gray-600`}>Loading alerts...</CustomText>
        </View>
      ) : hasAlerts ? (
        <ScrollView contentContainerStyle={tw`px-6 pt-4 pb-20`}>
          {alerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              style={tw`bg-white rounded-xl shadow p-4 mb-4`}
              onPress={() => navigation.navigate("PetDetails", { petId: alert.petId })}
            >
              <View style={tw`flex-row items-start`}>
                <View
                  style={[
                    tw`w-12 h-12 rounded-xl items-center justify-center mr-4`,
                    { backgroundColor: `${getPriorityColor(alert.priority)}20` },
                  ]}
                >
                  <Feather name="alert-circle" size={22} color={getPriorityColor(alert.priority)} />
                </View>
                <View style={tw`flex-1`}>
                  <CustomText style={tw`text-[17px] text-gray-800 mb-1`} weight="SemiBold">
                    {alert.title}
                  </CustomText>
                  <CustomText style={tw`text-[14px] text-gray-600 mb-3 leading-5`}>{alert.description}</CustomText>
                  <View style={tw`flex-row justify-between items-center`}>
                    <View style={tw`flex-row items-center`}>
                      <Feather name="clock" size={14} color="#9CA3AF" style={tw`mr-1`} />
                      <CustomText style={tw`text-[12px] text-gray-500`}>{alert.time}</CustomText>
                    </View>
                    <View style={tw`flex-row items-center`}>
                      <Feather name="map-pin" size={14} color="#9CA3AF" style={tw`mr-1`} />
                      <CustomText style={tw`text-[12px] text-gray-500`}>{alert.distance}</CustomText>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={tw`px-6 pt-4 pb-20`}>
          <View style={tw`items-center justify-center py-20`}>
            <View style={tw`w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-6`}>
              <Feather name="bell" size={32} color="#2A80FD" />
            </View>
            <CustomText style={tw`text-[18px] text-gray-800 mb-2 text-center`} weight="Bold">
              No Alerts Yet
            </CustomText>
            <CustomText style={tw`text-[16px] text-gray-600 text-center mb-6 px-10`}>
              Get notified about lost and found pets in your area
            </CustomText>
            <TouchableOpacity
              style={tw`bg-[#2A80FD] px-6 py-3 rounded-xl flex-row items-center`}
              onPress={refreshAlerts}
            >
              <Feather name="refresh-cw" size={18} color="white" style={tw`mr-2`} />
              <CustomText style={tw`text-white text-[14px]`} weight="SemiBold">
                Check for Alerts
              </CustomText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  )
}

export default AlertsScreen
