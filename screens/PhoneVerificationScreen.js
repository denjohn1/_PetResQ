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
import { useNavigation, useRoute } from "@react-navigation/native";
import CustomText from "../components/CustomText";
import tw from "twrnc";
import { Feather } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const { width, height } = Dimensions.get("window");

const PhoneVerificationScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId, phoneNumber } = route.params || {};
  
  const [verificationCode, setVerificationCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  // Refs for TextInputs
  const inputRefs = useRef([]);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

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
    
    // Timer for resend code
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    // Simulate sending verification code
    // In a real app, you would integrate with a service like Firebase Phone Auth
    // or Twilio to send actual SMS verification codes
    Alert.alert(
      "Verification Code",
      "For demo purposes, the verification code is: 123456"
    );
    
    return () => clearInterval(timer);
  }, []);
  
  const handleCodeChange = (text, index) => {
    // Update the code array
    const newCode = [...verificationCode];
    newCode[index] = text;
    setVerificationCode(newCode);
    
    // Auto-focus next input
    if (text && index < 5) {
      inputRefs.current[index + 1].focus();
    }
    
    // Clear error message when user types
    if (errorMessage) {
      setErrorMessage("");
    }
  };
  
  const handleKeyPress = (e, index) => {
    // Handle backspace to move to previous input
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
  };
  
  const handleResendCode = () => {
    if (!canResend) return;
    
    // Reset timer
    setTimeLeft(60);
    setCanResend(false);
    
    // Simulate resending code
    Alert.alert(
      "Verification Code Resent",
      "For demo purposes, the verification code is still: 123456"
    );
    
    // Start timer again
    const timer = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };
  
  const handleVerify = async () => {
    const code = verificationCode.join("");
    
    if (code.length !== 6) {
      setErrorMessage("Please enter the complete 6-digit code");
      return;
    }
    
    setIsLoading(true);
    
    try {
      // For demo purposes, we'll accept any 6-digit code
      // In a real app, you would verify this code with your SMS provider
      
      // Simulate verification delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update user's phone verification status in Firestore
      if (userId) {
        await updateDoc(doc(db, "users", userId), {
          phoneVerified: true
        });
      }
      
      // Navigate to dashboard
      navigation.replace("Dashboard");
    } catch (error) {
      console.error("Verification error:", error);
      setErrorMessage("Failed to verify code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "android" ? "padding" : "height"}
      style={tw`flex-1`}
    >
      <ImageBackground
        source={require("../assets/images/slideimg3.png")}
        style={tw`flex-1`}
        blurRadius={10}
      >
        <View style={tw`flex-1 bg-white/90`}>
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
                  Verify Your
                </CustomText>
                <CustomText
                  style={tw`text-[#2A80FD] text-[28px] mb-3`}
                  weight="Bold"
                >
                  Phone Number
                </CustomText>
                <CustomText style={tw`text-[15px] text-gray-600 mb-8`}>
                  We've sent a 6-digit verification code to{" "}
                  <CustomText weight="SemiBold">{phoneNumber}</CustomText>
                </CustomText>
              </Animated.View>

              {/* Verification Form */}
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

                {/* Verification Code Input */}
                <View style={tw`mb-8`}>
                  <CustomText
                    style={tw`text-[14px] text-gray-700 mb-4 text-center`}
                    weight="SemiBold"
                  >
                    Enter Verification Code
                  </CustomText>
                  <View style={tw`flex-row justify-between mb-4`}>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <TextInput
                        key={index}
                        ref={(ref) => (inputRefs.current[index] = ref)}
                        style={tw`w-12 h-14 border-2 border-gray-200 rounded-lg text-center text-xl font-bold text-[#2A80FD]`}
                        maxLength={1}
                        keyboardType="number-pad"
                        value={verificationCode[index]}
                        onChangeText={(text) => handleCodeChange(text, index)}
                        onKeyPress={(e) => handleKeyPress(e, index)}
                      />
                    ))}
                  </View>
                  <View style={tw`flex-row justify-center items-center`}>
                    <CustomText style={tw`text-gray-500 text-[13px]`}>
                      Didn't receive code?{" "}
                    </CustomText>
                    {canResend ? (
                      <TouchableOpacity onPress={handleResendCode}>
                        <CustomText
                          style={tw`text-[#2A80FD] text-[13px]`}
                          weight="SemiBold"
                        >
                          Resend Code
                        </CustomText>
                      </TouchableOpacity>
                    ) : (
                      <CustomText
                        style={tw`text-gray-400 text-[13px]`}
                        weight="Medium"
                      >
                        Resend in {timeLeft}s
                      </CustomText>
                    )}
                  </View>
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  onPress={handleVerify}
                  style={tw`bg-[#2A80FD] rounded-xl py-4 items-center shadow-md`}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={tw`flex-row items-center`}>
                      <CustomText
                        style={tw`text-white text-[15px] mr-2`}
                        weight="SemiBold"
                      >
                        Verifying
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
                      Verify & Continue
                    </CustomText>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Verification Info */}
              <Animated.View
                style={[tw`mt-6`, { opacity: fadeAnim }]}
              >
                <View style={tw`bg-blue-50 p-4 rounded-lg border border-blue-100`}>
                  <View style={tw`flex-row items-start mb-2`}>
                    <Feather name="info" size={18} color="#2A80FD" style={tw`mt-0.5 mr-2`} />
                    <CustomText
                      style={tw`text-[14px] text-gray-700 flex-1`}
                      weight="SemiBold"
                    >
                      Why we verify phone numbers
                    </CustomText>
                  </View>
                  <CustomText style={tw`text-[13px] text-gray-600 ml-6`}>
                    Phone verification helps us create a secure community for pet owners and rescuers. It prevents spam accounts and ensures reliable reporting of lost and found pets.
                  </CustomText>
                </View>
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
                  One step closer to helping lost pets find their way home
                </CustomText>
              </Animated.View>
            </ScrollView>
          </View>
        </View>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
};

export default PhoneVerificationScreen;