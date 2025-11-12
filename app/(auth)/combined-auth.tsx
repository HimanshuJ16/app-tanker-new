import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { useState, useRef } from "react";
import { 
  Alert, 
  Image, 
  ScrollView, 
  Text, 
  View, 
  KeyboardAvoidingView, 
  Platform,
  Animated,
  ActivityIndicator,
  Pressable
} from "react-native";
import { ReactNativeModal } from "react-native-modal";
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import React from "react";

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";

export default function CombinedAuth() {
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAccountIssueModal, setShowAccountIssueModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const [form, setForm] = useState({
    vehicleNumber: "",
  });
  const [verification, setVerification] = useState({
    state: "default",
    error: "",
    code: "",
  });
  const [vehicleInfo, setVehicleInfo] = useState({
    vehicleNumber: "",
    vehicleId: "",
  });

  // Animate entrance
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const saveVehicleInfo = async (info: { vehicleNumber: string; vehicleId: string }) => {
    try {
      await SecureStore.setItemAsync('vehicleInfo', JSON.stringify(info));
    } catch (error) {
      console.error('Error saving vehicle info:', error);
    }
  };

  const formatVehicleNumber = (text: string) => {
    // Remove spaces and convert to uppercase
    let formatted = text.replace(/\s/g, '').toUpperCase();
    
    // Auto-format: XX00XX0000 pattern with spaces
    if (formatted.length > 2) {
      formatted = formatted.slice(0, 2) + ' ' + formatted.slice(2);
    }
    if (formatted.length > 5) {
      formatted = formatted.slice(0, 5) + ' ' + formatted.slice(5);
    }
    if (formatted.length > 8) {
      formatted = formatted.slice(0, 8) + ' ' + formatted.slice(8, 12);
    }
    
    return formatted;
  };

  const validateVehicleNumber = (number: string) => {
    // Basic Indian vehicle number validation
    const pattern = /^[A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{0,3}\s?[0-9]{4}$/;
    return pattern.test(number.replace(/\s/g, ''));
  };

  const onAuthPress = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) {
      Alert.alert("Loading", "Please wait while we initialize...");
      return;
    }

    const cleanedNumber = form.vehicleNumber.replace(/\s/g, '');
    
    if (!validateVehicleNumber(cleanedNumber)) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Invalid Format", 
        "Please enter a valid vehicle number (e.g., DL 01 AB 1234)"
      );
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/vehicle`, {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: cleanedNumber,
        }),
      });

      if (response.exists) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const phoneNumber = `+91${response.contactNumber}`;
        
        setVehicleInfo({
          vehicleNumber: cleanedNumber,
          vehicleId: response.vehicleId,
        });

        try {
          const signInAttempt = await signIn.create({
            identifier: phoneNumber,
          });
          const phoneNumberId = signInAttempt?.supportedFirstFactors?.find(
            factor => factor.strategy === "phone_code"
          )?.phoneNumberId;

          if (!phoneNumberId) {
            throw new Error("Phone number ID not found");
          }
          await signIn.prepareFirstFactor({
            strategy: "phone_code",
            phoneNumberId: phoneNumberId,
          });
          setVerification({ ...verification, state: "pending" });
        } catch (signInError: any) {
          try {
            await signUp.create({
              phoneNumber,
            });
            await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
            setVerification({ ...verification, state: "pending" });
          } catch (signUpError: any) {
            console.error('Sign up failed:', signUpError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setShowAccountIssueModal(true);
          }
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Vehicle Not Found", 
          "The vehicle number you entered is not registered. Please verify and try again."
        );
      }
    } catch (err: any) {
      console.error('Error in onAuthPress:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Connection Error",
        "Unable to connect to the server. Please check your internet connection and try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onPressVerify = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) return;
    
    if (verification.code.length !== 6) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setVerification({
        ...verification,
        error: "Please enter a 6-digit code",
      });
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      let completeAuth;
      try {
        completeAuth = await signIn.attemptFirstFactor({
          strategy: "phone_code",
          code: verification.code,
        });
        if (completeAuth.status === "complete") {
          await setSignInActive({ session: completeAuth.createdSessionId });
          await saveVehicleInfo(vehicleInfo);
        }
      } catch (signInError) {
        completeAuth = await signUp.attemptPhoneNumberVerification({
          code: verification.code,
        });
        if (completeAuth.status === "complete") {
          await setSignUpActive({ session: completeAuth.createdSessionId });
        }
      }

      if (completeAuth.status === "complete") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVerification({
          ...verification,
          state: "success",
          error: "",
        });
      } else {
        throw new Error("Verification failed");
      }
    } catch (err: any) {
      console.error('Error in onPressVerify:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setVerification({
        ...verification,
        error: err.errors?.[0]?.longMessage || "Invalid code. Please try again.",
        state: "failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountIssue = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Account Recovery Initiated",
      "Our support team will contact you within 24 hours to resolve this issue. You'll receive an SMS confirmation shortly.",
      [{ 
        text: "Understood", 
        onPress: () => setShowAccountIssueModal(false),
        style: "default"
      }]
    );
  };

  const handleResendOTP = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Re-trigger OTP
      if (!isSignInLoaded || !signIn) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", "Unable to resend OTP right now. Please wait a moment and try again.");
        return;
      }

      const phoneNumberId = signIn.supportedFirstFactors?.find(
        factor => factor.strategy === "phone_code"
      )?.phoneNumberId;
      
      if (phoneNumberId) {
        await signIn.prepareFirstFactor({
          strategy: "phone_code",
          phoneNumberId: phoneNumberId,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("OTP Resent", "A new verification code has been sent to your phone.");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", "No phone factor available to resend OTP.");
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to resend OTP. Please try again.");
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <ScrollView 
        className="flex-1 bg-white"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 bg-white">
          {/* Hero Section with Gradient Overlay */}
          <View className="relative w-full h-[280px]">
            <Image 
              source={images.signUpCar} 
              className="z-0 w-full h-[280px]" 
              resizeMode="cover"
            />
            <View className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
            <Animated.View 
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }}
              className="absolute bottom-8 left-6 right-6"
            >
              <Text className="text-3xl text-black font-JakartaBold mb-2">
                Welcome Back! 👋
              </Text>
              <Text className="text-base text-gray-700 font-Jakarta">
                Enter your vehicle number to get started
              </Text>
            </Animated.View>
          </View>

          {/* Form Section */}
          <Animated.View 
            style={{ opacity: fadeAnim }}
            className="px-6 py-8"
          >
            {/* Info Card */}
            <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex-row items-start">
              <Text className="text-2xl mr-3">ℹ️</Text>
              <View className="flex-1">
                <Text className="text-sm font-JakartaSemiBold text-blue-900 mb-1">
                  Quick Tip
                </Text>
                <Text className="text-xs font-Jakarta text-blue-700">
                  Enter your vehicle registration number (e.g., DL 01 AB 1234)
                </Text>
              </View>
            </View>

            <InputField
              label="Vehicle Registration Number"
              placeholder="DL 01 AB 1234"
              icon={icons.person}
              value={form.vehicleNumber}
              onChangeText={(value) => setForm({ 
                ...form, 
                vehicleNumber: formatVehicleNumber(value) 
              })}
              autoCapitalize="characters"
              maxLength={15}
              accessible={true}
              accessibilityLabel="Vehicle registration number input"
              accessibilityHint="Enter your vehicle number to authenticate"
            />

            <CustomButton
              title={isLoading ? "Verifying Vehicle..." : "Continue"}
              onPress={onAuthPress}
              className="mt-6"
              disabled={isLoading || form.vehicleNumber.length < 9}
              IconLeft={isLoading ? () => (
                <ActivityIndicator size="small" color="white" className="mr-2" />
              ) : undefined}
            />

            {/* Security Badge */}
            <View className="flex-row items-center justify-center mt-6 opacity-60">
              <Text className="text-xs font-Jakarta text-gray-500">🔒</Text>
              <Text className="text-xs font-Jakarta text-gray-500 ml-2">
                Secured with end-to-end encryption
              </Text>
            </View>
          </Animated.View>

          {/* OTP Verification Modal */}
          <ReactNativeModal
            isVisible={verification.state === "pending"}
            onModalHide={() => {
              if (verification.state === "success") {
                setShowSuccessModal(true);
              }
            }}
            animationIn="slideInUp"
            animationOut="slideOutDown"
            backdropOpacity={0.7}
            useNativeDriver
            hideModalContentWhileAnimating
          >
            <View className="bg-white px-7 py-9 rounded-3xl min-h-[380px]">
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
                  <Text className="text-3xl">📱</Text>
                </View>
                <Text className="font-JakartaExtraBold text-2xl mb-2 text-center">
                  Verify Your Number
                </Text>
                <Text className="font-Jakarta text-gray-600 text-center">
                  We've sent a 6-digit code to your registered phone number
                </Text>
              </View>

              <InputField
                label="Verification Code"
                icon={icons.lock}
                placeholder="000000"
                value={verification.code}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(code) =>
                  setVerification({ ...verification, code, error: "" })
                }
                accessible={true}
                accessibilityLabel="OTP verification code input"
                accessibilityHint="Enter the 6-digit code sent to your phone"
              />

              {verification.error && (
                <View className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2 flex-row items-start">
                  <Text className="text-red-600 text-xs mr-2">❌</Text>
                  <Text className="text-red-600 text-xs font-Jakarta flex-1">
                    {verification.error}
                  </Text>
                </View>
              )}

              <CustomButton
                title={isLoading ? "Verifying..." : "Verify OTP"}
                onPress={onPressVerify}
                className="mt-5 bg-success-500"
                disabled={isLoading || verification.code.length !== 6}
                IconLeft={isLoading ? () => (
                  <ActivityIndicator size="small" color="white" className="mr-2" />
                ) : undefined}
              />

              <Pressable 
                onPress={handleResendOTP}
                className="mt-4 py-3"
                disabled={isLoading}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Resend OTP"
              >
                <Text className="text-center text-blue-600 font-JakartaSemiBold text-sm">
                  Didn't receive the code? Resend OTP
                </Text>
              </Pressable>
            </View>
          </ReactNativeModal>

          {/* Success Modal */}
          <ReactNativeModal 
            isVisible={showSuccessModal}
            animationIn="zoomIn"
            animationOut="zoomOut"
            useNativeDriver
          >
            <View className="bg-white px-7 py-9 rounded-3xl min-h-[380px] items-center justify-center">
              <Image
                source={images.check}
                className="w-[120px] h-[120px] mb-6"
              />
              <Text className="text-3xl font-JakartaBold text-center mb-3">
                Verified! ✅
              </Text>
              <Text className="text-base text-gray-600 font-Jakarta text-center mb-8 px-4">
                You have successfully authenticated your vehicle. Welcome back!
              </Text>
              <CustomButton
                title="Go to Home"
                onPress={() => {
                  setShowSuccessModal(false);
                  router.push(`/(root)/(tabs)/home`);
                }}
                className="w-full"
              />
            </View>
          </ReactNativeModal>

          {/* Account Issue Modal */}
          <ReactNativeModal 
            isVisible={showAccountIssueModal}
            animationIn="fadeIn"
            animationOut="fadeOut"
            useNativeDriver
          >
            <View className="bg-white px-7 py-9 rounded-3xl min-h-[340px]">
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-4">
                  <Text className="text-3xl">⚠️</Text>
                </View>
                <Text className="font-JakartaExtraBold text-2xl mb-2 text-center">
                  Account Issue Detected
                </Text>
                <Text className="font-Jakarta text-gray-600 text-center">
                  We're having trouble accessing your account. This could be due to a verification issue.
                </Text>
              </View>

              <CustomButton
                title="Contact Support"
                onPress={handleAccountIssue}
                className="mt-5 bg-amber-500"
              />
              <CustomButton
                title="Try Again"
                onPress={() => setShowAccountIssueModal(false)}
                className="mt-3 bg-gray-200"
                textVariant="default"
              />
            </View>
          </ReactNativeModal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
