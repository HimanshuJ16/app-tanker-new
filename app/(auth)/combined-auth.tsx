import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import { 
  Alert, 
  Image, 
  ScrollView, 
  Text, 
  View, 
  KeyboardAvoidingView, 
  Platform,
  Pressable,
  ActivityIndicator 
} from "react-native";
import { ReactNativeModal } from "react-native-modal";
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import React from "react";
import { Ionicons } from '@expo/vector-icons';

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

  // OTP input refs for auto-focus
  const otpInputRefs = useRef<any[]>([]);

  const saveVehicleInfo = async (info: { vehicleNumber: string; vehicleId: string }) => {
    try {
      await SecureStore.setItemAsync('vehicleInfo', JSON.stringify(info));
    } catch (error) {
      console.error('Error saving vehicle info:', error);
    }
  };

  const onAuthPress = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) {
      console.log('Clerk is not loaded yet');
      return;
    }

    // Haptic feedback on button press
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Validate vehicle number format
    if (!form.vehicleNumber || form.vehicleNumber.length < 6) {
      Alert.alert("Invalid Input", "Please enter a valid vehicle number.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Attempting to check vehicle:', form.vehicleNumber);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/vehicle`, {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: form.vehicleNumber,
        }),
      });
      console.log('Vehicle check response:', response);

      if (response.exists) {
        console.log('Vehicle exists, initiating OTP verification');
        const phoneNumber = `+91${response.contactNumber}`;
        
        setVehicleInfo({
          vehicleNumber: form.vehicleNumber,
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
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
        } catch (signInError: any) {
          console.log('Sign in failed:', signInError);
          
          try {
            await signUp.create({
              phoneNumber,
            });
            await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
            setVerification({ ...verification, state: "pending" });
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (signUpError: any) {
            console.error('Sign up failed:', signUpError);
            setShowAccountIssueModal(true);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          }
        }
      } else {
        console.log('Vehicle not found');
        Alert.alert("Error", response.error || "Vehicle not found. Please check the vehicle number.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      console.error('Error in onAuthPress:', err);
      Alert.alert(
        "Error",
        err.message || "An unexpected error occurred. Please try again later."
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const onPressVerify = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) return;
    
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (verification.code.length !== 6) {
      setVerification({
        ...verification,
        error: "Please enter the complete 6-digit code",
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('Attempting to verify OTP:', verification.code);
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
        setVerification({
          ...verification,
          state: "success",
          error: "",
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error("Verification failed");
      }
    } catch (err: any) {
      console.error('Error in onPressVerify:', err);
      setVerification({
        ...verification,
        error: err.errors?.[0]?.longMessage || "Invalid code. Please try again.",
        state: "failed",
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("OTP Resent", "A new verification code has been sent to your phone.");
    // Add your resend logic here
  };

  const handleAccountIssue = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    console.log("Initiating account recovery process");
    Alert.alert(
      "Account Recovery",
      "We've initiated the account recovery process. Our support team will contact you shortly to resolve this issue.",
      [{ text: "OK", onPress: () => setShowAccountIssueModal(false) }]
    );
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
            <View className="absolute inset-0 bg-black/20" />
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/40 to-transparent">
              <Text className="text-3xl text-white font-JakartaBold">
                Welcome Back 👋
              </Text>
              <Text className="text-base text-white/90 font-Jakarta mt-2">
                Enter your vehicle details to continue
              </Text>
            </View>
          </View>

          {/* Form Section with Card Design */}
          <View className="px-6 py-8">
            <View className="bg-gray-50 rounded-3xl p-6 shadow-sm">
              <Text className="text-lg font-JakartaSemiBold text-gray-800 mb-4">
                Vehicle Information
              </Text>
              
              <InputField
                label="Vehicle Number"
                placeholder="MH12AB1234"
                icon={icons.person}
                value={form.vehicleNumber}
                onChangeText={(value) => setForm({ ...form, vehicleNumber: value.toUpperCase() })}
                autoCapitalize="characters"
                maxLength={15}
              />
              
              <CustomButton
                title={isLoading ? "Processing..." : "Continue"}
                onPress={onAuthPress}
                className="mt-6"
                disabled={isLoading || !form.vehicleNumber}
                IconLeft={() => isLoading ? (
                  <ActivityIndicator size="small" color="#fff" className="mr-2" />
                ) : null}
              />

              <Text className="text-xs text-gray-500 text-center mt-4 font-Jakarta">
                By continuing, you agree to our Terms of Service
              </Text>
            </View>
          </View>

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
            backdropOpacity={0.6}
            useNativeDriver={true}
            hideModalContentWhileAnimating={true}
          >
            <View className="bg-white px-6 py-8 rounded-3xl shadow-xl">
              {/* Header with Icon */}
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
                  <Ionicons name="mail-outline" size={32} color="#3B82F6" />
                </View>
                <Text className="font-JakartaBold text-2xl text-gray-900 text-center">
                  Verify Your Number
                </Text>
                <Text className="font-Jakarta text-gray-600 text-center mt-2 leading-5">
                  We've sent a 6-digit code to your registered phone number
                </Text>
              </View>

              {/* OTP Input */}
              <InputField
                label="Verification Code"
                icon={icons.lock}
                placeholder="000000"
                value={verification.code}
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={(code) => {
                  setVerification({ ...verification, code, error: "" });
                  // Auto-submit when 6 digits entered
                  if (code.length === 6) {
                    setTimeout(() => onPressVerify(), 300);
                  }
                }}
              />

              {/* Error Message */}
              {verification.error && (
                <View className="bg-red-50 p-3 rounded-xl mt-3 flex-row items-center">
                  <Ionicons name="alert-circle" size={20} color="#EF4444" />
                  <Text className="text-red-600 text-sm ml-2 flex-1 font-Jakarta">
                    {verification.error}
                  </Text>
                </View>
              )}

              {/* Verify Button */}
              <CustomButton
                title={isLoading ? "Verifying..." : "Verify Code"}
                onPress={onPressVerify}
                className="mt-6 bg-blue-600"
                disabled={isLoading || verification.code.length !== 6}
                IconLeft={() => isLoading ? (
                  <ActivityIndicator size="small" color="#fff" className="mr-2" />
                ) : null}
              />

              {/* Resend OTP */}
              <Pressable 
                onPress={handleResendOTP}
                className="mt-4 py-2"
                disabled={isLoading}
              >
                <Text className="text-blue-600 text-center font-JakartaSemiBold">
                  Didn't receive code? Resend
                </Text>
              </Pressable>
            </View>
          </ReactNativeModal>

          {/* Success Modal */}
          <ReactNativeModal 
            isVisible={showSuccessModal}
            animationIn="zoomIn"
            animationOut="zoomOut"
            backdropOpacity={0.7}
            useNativeDriver={true}
          >
            <View className="bg-white px-8 py-10 rounded-3xl items-center shadow-xl">
              {/* Success Animation Placeholder */}
              <View className="w-28 h-28 bg-green-100 rounded-full items-center justify-center mb-6">
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
              </View>
              
              <Text className="text-3xl font-JakartaBold text-gray-900 text-center mb-3">
                Verified Successfully!
              </Text>
              
              <Text className="text-base text-gray-600 font-Jakarta text-center mb-8 leading-6">
                You have been authenticated successfully. Welcome back!
              </Text>
              
              <CustomButton
                title="Go to Home"
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowSuccessModal(false);
                  router.push(`/(root)/(tabs)/home`);
                }}
                className="w-full"
                IconRight={() => (
                  <Ionicons name="arrow-forward" size={20} color="#fff" className="ml-2" />
                )}
              />
            </View>
          </ReactNativeModal>

          {/* Account Issue Modal */}
          <ReactNativeModal 
            isVisible={showAccountIssueModal}
            animationIn="fadeIn"
            animationOut="fadeOut"
            backdropOpacity={0.6}
            useNativeDriver={true}
          >
            <View className="bg-white px-6 py-8 rounded-3xl shadow-xl">
              {/* Warning Icon */}
              <View className="items-center mb-6">
                <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-4">
                  <Ionicons name="warning-outline" size={36} color="#F59E0B" />
                </View>
                <Text className="font-JakartaBold text-2xl text-gray-900 text-center">
                  Account Issue
                </Text>
              </View>

              <Text className="font-Jakarta text-gray-600 text-center mb-6 leading-6">
                We're having trouble accessing your account. This could be due to a discrepancy in our records.
              </Text>
              
              <CustomButton
                title="Initiate Recovery"
                onPress={handleAccountIssue}
                className="bg-amber-500 mb-3"
              />
              
              <CustomButton
                title="Cancel"
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowAccountIssueModal(false);
                }}
                className="bg-gray-200"
                textVariant="secondary"
              />
            </View>
          </ReactNativeModal>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
