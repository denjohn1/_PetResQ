import { useEffect, useState } from "react";
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Animated,
} from "react-native";
import * as Font from "expo-font";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import tw from "twrnc";
import { Ionicons } from "@expo/vector-icons";
import { auth } from "./firebaseConfig";

import LandingScreen from "./screens/LandingScreens";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import DashboardScreen from "./screens/DashboardScreen";
import ReportScreen from "./screens/ReportScreen";
import SearchScreen from "./screens/SearchScreen";
import AlertsScreen from "./screens/AlertsScreen";
import ChatScreen from "./screens/ChatScreen";
import AISearchMapScreen from "./screens/AISearchMapScreen";
import PetDetailsScreen from "./screens/PetDetailsScreen";
import ProfileScreen from "./screens/ProfileScreen";
import CustomText from "./components/CustomText";
import ReportSightingScreen from "./screens/ReportSightingScreen";
import React from "react";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Bottom Tab Navigator Component
function MainTabs({ navigation }) {
  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            height: 65,
            paddingTop: 5,
            paddingBottom: 10,
            backgroundColor: "white",
            borderTopWidth: 1,
            borderTopColor: "#F3F4F6",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 6,
          },
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Search") {
              iconName = focused ? "map" : "map-outline";
            } else if (route.name === "Chat") {
              iconName = focused ? "chatbubbles" : "chatbubbles-outline";
            } else if (route.name === "Profile") {
              iconName = focused ? "person" : "person-outline";
            }
            return (
              <Animated.View
                style={{
                  transform: [{ scale: focused ? 1.1 : 1 }],
                }}
              >
                <Ionicons name={iconName} size={size} color={color} />
              </Animated.View>
            );
          },
          tabBarActiveTintColor: "#2A80FD",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarLabel: ({ focused, color }) => {
            return (
              <CustomText
                style={tw`text-[10px] ${
                  focused ? "text-[#2A80FD]" : "text-gray-400"
                }`}
                weight={focused ? "SemiBold" : "Medium"}
              >
                {route.name}
              </CustomText>
            );
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={DashboardScreen}
          options={{
            tabBarAccessibilityLabel: "Home tab",
            tabBarAccessibilityHint:
              "View the dashboard with pet alerts and actions",
          }}
        />
        <Tab.Screen
          name="Search"
          component={SearchScreen}
          options={{
            tabBarAccessibilityLabel: "Search tab",
            tabBarAccessibilityHint: "Access AI-driven pet search",
          }}
        />
        <Tab.Screen
          name="ReportButton"
          component={EmptyScreen}
          options={{
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                style={tw`items-center justify-center w-16 h-16 rounded-full bg-[#2A80FD] -mt-5 shadow-sm`}
                onPress={() => {
                  navigation.navigate("Report", { reportType: "lost" });
                }}
                accessible
                accessibilityLabel="Report a pet"
                accessibilityHint="Navigates to the report screen"
              >
                <Ionicons name="paw" size={24} color="white" />
              </TouchableOpacity>
            ),
          }}
        />
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            tabBarAccessibilityLabel: "Chat tab",
            tabBarAccessibilityHint: "Join the rescue coordination chatroom",
          }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{
            tabBarAccessibilityLabel: "Profile tab",
            tabBarAccessibilityHint: "Manage your account and pet details",
          }}
        />
      </Tab.Navigator>
    </>
  );
}

// Empty component for the tab button
function EmptyScreen() {
  return null;
}

export default function App() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      await Font.loadAsync({
        "Poppins-Regular": require("./assets/fonts/Poppins-Regular.ttf"),
        "Poppins-Bold": require("./assets/fonts/Poppins-Bold.ttf"),
        "Poppins-SemiBold": require("./assets/fonts/Poppins-SemiBold.ttf"),
        "Poppins-Medium": require("./assets/fonts/Poppins-Medium.ttf"),
        "Poppins-Light": require("./assets/fonts/Poppins-Light.ttf"),
        "Poppins-Thin": require("./assets/fonts/Poppins-Thin.ttf"),
        "Poppins-ExtraBold": require("./assets/fonts/Poppins-ExtraBold.ttf"),
        "Poppins-ExtraLight": require("./assets/fonts/Poppins-ExtraLight.ttf"),
      });
      setFontsLoaded(true);
    };
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-white`}>
        <ActivityIndicator size="large" color="#2A80FD" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName="Landing"
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen
          name="Dashboard"
          component={MainTabs}
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen name="Report" component={ReportScreen} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Alerts" component={AlertsScreen} />
        <Stack.Screen
          name="PetDetails"
          component={PetDetailsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AiSearchMap"
          component={AISearchMapScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen
          name="ReportSighting"
          component={ReportSightingScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
