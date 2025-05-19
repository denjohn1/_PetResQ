import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Dimensions,
  ImageBackground,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import CustomText from "../components/CustomText";
import tw from "twrnc";
import { Feather } from "@expo/vector-icons";

// Import Firebase auth
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const { width, height } = Dimensions.get("window");

const LoginScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pawAnimation = useRef(new Animated.Value(0)).current;

  // Animated paw print positions
  const pawPositions = [
    { top: "15%", left: "10%", rotate: "15deg", delay: 300, scale: 0.6 },
    { top: "25%", right: "8%", rotate: "-10deg", delay: 500, scale: 0.8 },
    { top: "75%", left: "15%", rotate: "25deg", delay: 700, scale: 0.7 },
    { top: "85%", right: "12%", rotate: "-5deg", delay: 900, scale: 0.5 },
  ];

  // Check if user is already logged in when component mounts
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in, navigate to Dashboard
        navigation.replace("Dashboard");
      }
    });

    // Clean up the listener on unmount
    return unsubscribe;
  }, []);

  useEffect(() => {
    // Main content animations
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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous paw animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pawAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pawAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage("Please enter both email and password");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Login success:", userCredential);
      
      // Get user profile data from Firestore
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists()) {
        // Store user data in global state or context if needed
        console.log("User data:", userDoc.data());
        
        // Check if phone verification is complete
        if (!userDoc.data().phoneVerified) {
          navigation.replace("PhoneVerification", {
            userId: userCredential.user.uid,
            phoneNumber: userDoc.data().phoneNumber
          });
          return;
        }
      }
      
      navigation.replace("Dashboard");
    } catch (error) {
      console.error("Login error:", error);
      let message = "Login failed. Please try again.";

      if (error.code === "auth/user-not-found") {
        message = "No account found with this email.";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password.";
      } else if (error.code === "auth/invalid-credential") {
        message = "Invalid email or password.";
      } else if (error.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many failed login attempts. Please try again later.";
      }

      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email) {
      setErrorMessage("Please enter your email address first");
      return;
    }

    navigation.navigate("ForgotPassword", { email });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "padding" : "height"}
      style={tw`flex-1`}
    >
      <ImageBackground
        source={require("../assets/images/slideimg1.png")}
        style={tw`flex-1`}
        blurRadius={10}
      >
        <View style={tw`flex-1 bg-white/90`}>
          {/* Animated paw prints background */}
          {pawPositions.map((pos, index) => (
            <Animated.View
              key={index}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                right: pos.right,
                opacity: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.15],
                }),
                transform: [
                  { scale: pos.scale },
                  { rotate: pos.rotate },
                  {
                    translateY: pawAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 10],
                    }),
                  },
                ],
              }}
            >
              <Image
                source={require("../assets/images/black_logo.png")}
                style={{ width: 60, height: 60, tintColor: "#2A80FD" }}
                resizeMode="contain"
              />
            </Animated.View>
          ))}
          <View style={tw`flex-1 pb-8`}>
            {/* Header with back button and logo */}
            <View
              style={tw`flex-row items-center justify-between px-6 pt-12 mb-10`}
            >
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={tw`w-12 h-12 rounded-full bg-white/80 items-center justify-center border border-gray-100`}
              >
                <Feather name="arrow-left" size={24} color="#444" />
              </TouchableOpacity>
              <View style={tw`w-12 h-12 items-center justify-center`}>
                <Image
                  source={require("../assets/images/black_logo.png")}
                  style={tw`w-20 h-20`}
                  resizeMode="contain"
                />
              </View>
            </View>

            <ScrollView contentContainerStyle={tw`flex-grow px-6`}>
              {/* Header Text */}
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
              >
                <CustomText
                  style={tw`text-[28px] text-[#444] mb-3 mt-3`}
                  weight="Bold"
                >
                  Welcome to
                </CustomText>
                <CustomText
                  style={tw`text-[#2A80FD] text-[28px] mb-3`}
                  weight="Bold"
                >
                  PetResQ
                </CustomText>
                <CustomText style={tw`text-[15px] text-gray-600 mb-8`}>
                  Sign in to help reunite lost pets with their families
                </CustomText>
              </Animated.View>

              {/* Login Form */}
              <Animated.View
                style={[
                  tw`mb-6`,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim },
                    ],
                  },
                ]}
              >
                {/* Error Message */}
                {errorMessage ? (
                  <View style={tw`mb-4 bg-red-100 p-3 rounded-lg`}>
                    <CustomText style={tw`text-red-700 text-[13px]`}>
                      {errorMessage}
                    </CustomText>
                  </View>
                ) : null}

                {/* Email Input */}
                <View style={tw`mb-5`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="SemiBold"
                  >
                    Email Address
                  </CustomText>
                  <View
                    style={tw`flex-row items-center border-2 ${
                      isEmailFocused ? "border-[#2A80FD]" : "border-gray-200"
                    } rounded-xl px-4 py-1.5`}
                  >
                    <Feather
                      name="mail"
                      size={20}
                      color="#2A80FD"
                      style={tw`mr-3`}
                    />
                    <TextInput
                      style={[
                        tw`flex-1 text-[14px] text-gray-800`,
                        { fontFamily: "Poppins-Regular" },
                      ]}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        setErrorMessage("");
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setIsEmailFocused(true)}
                      onBlur={() => setIsEmailFocused(false)}
                    />
                    {email.length > 0 && (
                      <Feather name="check-circle" size={20} color="#22c55e" />
                    )}
                  </View>
                </View>

                {/* Password Input */}
                <View style={tw`mb-4`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="SemiBold"
                  >
                    Password
                  </CustomText>
                  <View
                    style={tw`flex-row items-center border-2 ${
                      isPasswordFocused ? "border-[#2A80FD]" : "border-gray-200"
                    } rounded-xl px-4 py-1.5`}
                  >
                    <Feather
                      name="lock"
                      size={20}
                      color="#2A80FD"
                      style={tw`mr-3`}
                    />
                    <TextInput
                      style={[
                        tw`flex-1 text-[14px] text-gray-800`,
                        { fontFamily: "Poppins-Regular" },
                      ]}
                      placeholder="Enter your password"
                      placeholderTextColor="#999"
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        setErrorMessage("");
                      }}
                      secureTextEntry={!showPassword}
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Feather
                        name={showPassword ? "eye-off" : "eye"}
                        size={20}
                        color="#777"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Forgot Password */}
                <TouchableOpacity
                  style={tw`self-end mb-6`}
                  onPress={handleForgotPassword}
                >
                  <CustomText
                    style={tw`text-[13px] text-[#2A80FD]`}
                    weight="Medium"
                  >
                    Forgot Password?
                  </CustomText>
                </TouchableOpacity>

                {/* Login Button */}
                <TouchableOpacity
                  onPress={handleLogin}
                  style={tw`bg-[#2A80FD] rounded-xl py-4 items-center shadow-md`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={tw`flex-row items-center`}>
                      <CustomText
                        style={tw`text-white text-[15px] mr-2`}
                        weight="SemiBold"
                      >
                        Signing in
                      </CustomText>
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
                        <Feather name="loader" size={20} color="white" />
                      </Animated.View>
                    </View>
                  ) : (
                    <CustomText
                      style={tw`text-white text-[15px]`}
                      weight="SemiBold"
                    >
                      Sign In
                    </CustomText>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Community Info */}
              <Animated.View
                style={[
                  tw`mb-6`,
                  { opacity: fadeAnim },
                ]}
              >
                <View style={tw`bg-blue-50 p-4 rounded-lg border border-blue-100`}>
                  <View style={tw`flex-row items-start`}>
                    <Feather name="users" size={18} color="#2A80FD" style={tw`mt-0.5 mr-2`} />
                    <CustomText style={tw`text-[13px] text-gray-700 flex-1`}>
                      PetResQ members can both report their own lost pets and help others by reporting sightings or joining search efforts.
                    </CustomText>
                  </View>
                </View>
              </Animated.View>

              {/* Register Link */}
              <Animated.View
                style={[
                  tw`flex-row justify-center mt-6`,
                  { opacity: fadeAnim },
                ]}
              >
                <CustomText style={tw`text-gray-700 text-[14px]`}>
                  Don't have an account?
                </CustomText>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Register")}
                >
                  <CustomText
                    style={tw`text-[#2A80FD] ml-1 text-[14px]`}
                    weight="Bold"
                  >
                    Sign Up
                  </CustomText>
                </TouchableOpacity>
              </Animated.View>

              {/* Pet rescue tagline */}
              <Animated.View
                style={[tw`mt-auto items-center pt-6`, { opacity: fadeAnim }]}
              >
                <View style={tw`w-16 h-1 bg-gray-300 rounded-full mb-4`} />
                <CustomText
                  style={tw`text-center text-gray-500 text-[12px]`}
                  weight="Medium"
                >
                  Every login brings a lost pet closer to home
                </CustomText>
              </Animated.View>
            </ScrollView>
          </View>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;