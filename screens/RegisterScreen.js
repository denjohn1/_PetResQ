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
  Switch,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import CustomText from "../components/CustomText";
import tw from "twrnc";
import { Feather } from "@expo/vector-icons";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const { width, height } = Dimensions.get("window");

const RegisterScreen = () => {
  const navigation = useNavigation();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Focus states
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pawAnimation = useRef(new Animated.Value(0)).current;

  // Animated paw print positions
  const pawPositions = [
    { top: "10%", left: "15%", rotate: "15deg", delay: 300, scale: 0.6 },
    { top: "20%", right: "10%", rotate: "-10deg", delay: 500, scale: 0.8 },
    { top: "70%", left: "12%", rotate: "25deg", delay: 700, scale: 0.7 },
    { top: "80%", right: "15%", rotate: "-5deg", delay: 900, scale: 0.5 },
  ];

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

  // Password validation
  const isPasswordValid = password.length >= 8;
  const doPasswordsMatch =
    password === confirmPassword && confirmPassword !== "";
  const isPhoneValid = phoneNumber.length >= 10;

  const handleRegister = async () => {
    // Form validation
    if (!fullName.trim()) {
      setErrorMessage("Please enter your full name");
      return;
    }
    
    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setErrorMessage("Please enter a valid email address");
      return;
    }
    
    if (!isPasswordValid) {
      setErrorMessage("Password must be at least 8 characters long");
      return;
    }
    
    if (!doPasswordsMatch) {
      setErrorMessage("Passwords do not match");
      return;
    }
    
    if (!isPhoneValid) {
      setErrorMessage("Please enter a valid phone number");
      return;
    }
    
    if (!acceptTerms) {
      setErrorMessage("You must accept the terms and conditions");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Create user profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        fullName,
        email,
        phoneNumber,
        phoneVerified: false,
        createdAt: serverTimestamp(),
        rating: 0,
        totalRatings: 0,
        badges: [],
        reportedPets: [],
        foundPets: [],
        successfulReunions: 0
      });

      // Stop loading
      setIsLoading(false);

      // Navigate to phone verification screen
      navigation.navigate("PhoneVerification", { 
        userId: user.uid,
        phoneNumber
      });
    } catch (error) {
      let errorMessage = "Registration failed. Please try again.";

      if (error.code === "auth/email-already-in-use") {
        errorMessage = "An account already exists with this email.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Please enter a valid email address.";
      } else if (error.code === "auth/weak-password") {
        errorMessage = "Password should be at least 6 characters.";
      }

      setErrorMessage(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "padding" : "height"}
      style={tw`flex-1`}
    >
      <ImageBackground
        source={require("../assets/images/slideimg2.png")}
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

            <ScrollView
              contentContainerStyle={tw`flex-grow px-6`}
              showsVerticalScrollIndicator={false}
            >
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
                  Join
                </CustomText>
                <CustomText
                  style={tw`text-[#2A80FD] text-[28px] mb-3`}
                  weight="Bold"
                >
                  PetResQ
                </CustomText>
                <CustomText style={tw`text-[15px] text-gray-600 mb-8`}>
                  Create an account to help reunite lost pets with their
                  families
                </CustomText>
              </Animated.View>

              {/* Registration Form */}
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

                {/* Full Name Input */}
                <View style={tw`mb-5`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="SemiBold"
                  >
                    Full Name
                  </CustomText>
                  <View
                    style={tw`flex-row items-center border-2 ${
                      isNameFocused ? "border-[#2A80FD]" : "border-gray-200"
                    } rounded-xl px-4 py-1.5`}
                  >
                    <Feather
                      name="user"
                      size={20}
                      color="#2A80FD"
                      style={tw`mr-3`}
                    />
                    <TextInput
                      style={[
                        tw`flex-1 text-[14px] text-gray-800`,
                        { fontFamily: "Poppins-Regular" },
                      ]}
                      placeholder="Enter your full name"
                      placeholderTextColor="#999"
                      value={fullName}
                      onChangeText={(text) => {
                        setFullName(text);
                        setErrorMessage("");
                      }}
                      autoCapitalize="words"
                      onFocus={() => setIsNameFocused(true)}
                      onBlur={() => setIsNameFocused(false)}
                    />
                    {fullName.length > 0 && (
                      <Feather name="check-circle" size={20} color="#22c55e" />
                    )}
                  </View>
                </View>

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
                    {email.includes("@") && email.includes(".") && (
                      <Feather name="check-circle" size={20} color="#22c55e" />
                    )}
                  </View>
                </View>

                {/* Phone Number Input */}
                <View style={tw`mb-5`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="SemiBold"
                  >
                    Phone Number
                  </CustomText>
                  <View
                    style={tw`flex-row items-center border-2 ${
                      isPhoneFocused ? "border-[#2A80FD]" : "border-gray-200"
                    } rounded-xl px-4 py-1.5`}
                  >
                    <Feather
                      name="phone"
                      size={20}
                      color="#2A80FD"
                      style={tw`mr-3`}
                    />
                    <TextInput
                      style={[
                        tw`flex-1 text-[14px] text-gray-800`,
                        { fontFamily: "Poppins-Regular" },
                      ]}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#999"
                      value={phoneNumber}
                      onChangeText={(text) => {
                        setPhoneNumber(text.replace(/[^0-9]/g, ''));
                        setErrorMessage("");
                      }}
                      keyboardType="phone-pad"
                      onFocus={() => setIsPhoneFocused(true)}
                      onBlur={() => setIsPhoneFocused(false)}
                    />
                    {phoneNumber.length >= 10 && (
                      <Feather name="check-circle" size={20} color="#22c55e" />
                    )}
                  </View>
                  <CustomText style={tw`text-xs text-gray-500 mt-1`}>
                    We'll send a verification code to this number
                  </CustomText>
                </View>

                {/* Password Input */}
                <View style={tw`mb-5`}>
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
                      placeholder="Create a password (min. 8 characters)"
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
                  {password.length > 0 && (
                    <View style={tw`flex-row items-center mt-2`}>
                      <View
                        style={tw`h-1 flex-1 rounded-full ${
                          password.length >= 8 ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <CustomText
                        style={tw`ml-2 text-xs ${
                          password.length >= 8
                            ? "text-green-500"
                            : "text-red-500"
                        }`}
                        weight="Medium"
                      >
                        {password.length >= 8 ? "Strong password" : "Too short"}
                      </CustomText>
                    </View>
                  )}
                </View>

                {/* Confirm Password Input */}
                <View style={tw`mb-6`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-2`}
                    weight="SemiBold"
                  >
                    Confirm Password
                  </CustomText>
                  <View
                    style={tw`flex-row items-center border-2 ${
                      isConfirmPasswordFocused
                        ? "border-[#2A80FD]"
                        : "border-gray-200"
                    } rounded-xl px-4 py-1.5`}
                  >
                    <Feather
                      name="shield"
                      size={20}
                      color="#2A80FD"
                      style={tw`mr-3`}
                    />
                    <TextInput
                      style={[
                        tw`flex-1 text-[14px] text-gray-800`,
                        { fontFamily: "Poppins-Regular" },
                      ]}
                      placeholder="Confirm your password"
                      placeholderTextColor="#999"
                      value={confirmPassword}
                      onChangeText={(text) => {
                        setConfirmPassword(text);
                        setErrorMessage("");
                      }}
                      secureTextEntry={!showConfirmPassword}
                      onFocus={() => setIsConfirmPasswordFocused(true)}
                      onBlur={() => setIsConfirmPasswordFocused(false)}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      <Feather
                        name={showConfirmPassword ? "eye-off" : "eye"}
                        size={20}
                        color="#777"
                      />
                    </TouchableOpacity>
                  </View>
                  {confirmPassword.length > 0 && (
                    <View style={tw`flex-row items-center mt-2`}>
                      <Feather
                        name={doPasswordsMatch ? "check-circle" : "x-circle"}
                        size={16}
                        color={doPasswordsMatch ? "#22c55e" : "#ef4444"}
                        style={tw`mr-1`}
                      />
                      <CustomText
                        style={tw`text-xs ${
                          doPasswordsMatch ? "text-green-500" : "text-red-500"
                        }`}
                        weight="Medium"
                      >
                        {doPasswordsMatch
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </CustomText>
                    </View>
                  )}
                </View>

                {/* Terms and Conditions */}
                <View style={tw`flex-row items-center mb-6`}>
                  <Switch
                    value={acceptTerms}
                    onValueChange={setAcceptTerms}
                    trackColor={{ false: "#d1d5db", true: "#93c5fd" }}
                    thumbColor={acceptTerms ? "#2A80FD" : "#f4f3f4"}
                  />
                  <CustomText style={tw`ml-2 text-gray-700 text-[13px] flex-1`}>
                    I agree to the Terms of Service and Privacy Policy
                  </CustomText>
                </View>

                {/* Register Button */}
                <TouchableOpacity
                  onPress={handleRegister}
                  style={tw`bg-[#2A80FD] rounded-xl py-4 items-center shadow-md ${
                    !isPasswordValid || !doPasswordsMatch || !email || !fullName || !isPhoneValid || !acceptTerms
                      ? "opacity-70"
                      : ""
                  }`}
                  disabled={
                    isLoading ||
                    !isPasswordValid ||
                    !doPasswordsMatch ||
                    !email ||
                    !fullName ||
                    !isPhoneValid ||
                    !acceptTerms
                  }
                >
                  {isLoading ? (
                    <View style={tw`flex-row items-center`}>
                      <CustomText
                        style={tw`text-white text-[15px] mr-2`}
                        weight="SemiBold"
                      >
                        Creating account
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
                      Create Account
                    </CustomText>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Login Link */}
              <Animated.View
                style={[
                  tw`flex-row justify-center mt-6`,
                  { opacity: fadeAnim },
                ]}
              >
                <CustomText style={tw`text-gray-700 text-[14px]`}>
                  Already have an account?
                </CustomText>
                <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                  <CustomText
                    style={tw`text-[#2A80FD] ml-1 text-[14px]`}
                    weight="Bold"
                  >
                    Sign In
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
                  Join our community of pet rescuers today
                </CustomText>
              </Animated.View>
            </ScrollView>
          </View>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;