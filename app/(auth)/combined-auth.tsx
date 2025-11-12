import { useSignIn, useSignUp } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, ScrollView, Text, View, KeyboardAvoidingView, Platform } from "react-native";
import { ReactNativeModal } from "react-native-modal";
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";
import React from "react";
import { TouchableOpacity } from "react-native";

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

    // Validate vehicle number format
    if (!form.vehicleNumber || form.vehicleNumber.length < 4) {
      Alert.alert('Invalid Input', 'Please enter a valid vehicle number');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setVerification({ ...verification, state: "pending" });
        } catch (signInError: any) {
          console.log('Sign in failed:', signInError);
          
          try {
            await signUp.create({
              phoneNumber,
            });
            await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setVerification({ ...verification, state: "pending" });
          } catch (signUpError: any) {
            console.error('Sign up failed:', signUpError);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setShowAccountIssueModal(true);
          }
        }
      } else {
        console.log('Vehicle not found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert("Error", response.error || "Vehicle not found. Please check the vehicle number.");
      }
    } catch (err: any) {
      console.error('Error in onAuthPress:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        err.message || "An unexpected error occurred. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onPressVerify = async () => {
    if (!isSignInLoaded || !isSignUpLoaded) return;

    if (verification.code.length !== 6) {
      setVerification({
        ...verification,
        error: "Please enter a 6-digit code",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

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
          await saveVehicleInfo(vehicleInfo);
        }
      }

      if (completeAuth.status === "complete") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVerification({
          ...verification,
          state: "success",
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
    console.log("Initiating account recovery process");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      <ScrollView className="flex-1 bg-white" bounces={false}>
        <View className="flex-1 bg-white">
          {/* Hero Section with Gradient Overlay */}
          <View className="relative w-full h-[280px]">
            <Image source={images.signUpCar} className="z-0 w-full h-[280px]" />
            <View className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <View className="absolute bottom-0 left-0 right-0 p-6">
              <Text className="text-3xl text-white font-JakartaBold mb-2">
                Welcome Back! 👋
              </Text>
              <Text className="text-base text-white/90 font-JakartaMedium">
                Enter your vehicle number to continue
              </Text>
            </View>
          </View>

          {/* Form Section */}
          <View className="p-6 pt-8">
            {/* Info Card */}
            <View className="bg-blue-50 p-4 rounded-xl mb-6 border border-blue-100">
              <Text className="text-sm text-blue-800 font-JakartaMedium">
                📱 You'll receive an OTP on your registered mobile number
              </Text>
            </View>

            <InputField
              label="Vehicle Registration Number"
              placeholder="e.g., RJ14XX1234"
              icon={icons.person}
              value={form.vehicleNumber}
              onChangeText={(value) => setForm({ ...form, vehicleNumber: value.toUpperCase() })}
              containerStyle="mb-4"
              inputStyle="uppercase"
            />
            
            <CustomButton
              title={isLoading ? "Processing..." : "Get OTP"}
              onPress={onAuthPress}
              className="mt-4 bg-blue-600 shadow-lg"
              disabled={isLoading}
              IconLeft={() => isLoading ? null : <Text className="text-white text-lg mr-2">🚛</Text>}
            />

            {/* Help Text */}
            <View className="mt-8 p-4 bg-gray-50 rounded-xl">
              <Text className="text-xs text-gray-600 font-JakartaMedium text-center">
                Need help? Contact support at support@phed.gov
              </Text>
            </View>
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
          backdropOpacity={0.7}
        >
          <View className="bg-white px-6 py-8 rounded-3xl">
            <View className="items-center mb-6">
              <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
                <Text className="text-3xl">📱</Text>
              </View>
              <Text className="font-JakartaBold text-2xl mb-2 text-center">
                Verify OTP
              </Text>
              <Text className="font-JakartaMedium text-gray-600 text-center">
                Enter the 6-digit code sent to your registered mobile number
              </Text>
            </View>

            <InputField
              label="Verification Code"
              icon={icons.lock}
              placeholder="000000"
              value={verification.code}
              keyboardType="numeric"
              maxLength={6}
              onChangeText={(code) =>
                setVerification({ ...verification, code, error: "" })
              }
              containerStyle="mb-4"
            />

            {verification.error && (
              <View className="bg-red-50 p-3 rounded-lg mb-4 border border-red-200">
                <Text className="text-red-600 text-sm font-JakartaMedium text-center">
                  ⚠️ {verification.error}
                </Text>
              </View>
            )}

            <CustomButton
              title={isLoading ? "Verifying..." : "Verify & Continue"}
              onPress={onPressVerify}
              className="bg-green-600 shadow-lg"
              disabled={isLoading || verification.code.length !== 6}
            />

            <TouchableOpacity 
              onPress={() => setVerification({ ...verification, state: "default" })}
              className="mt-4 p-3"
            >
              <Text className="text-center text-gray-600 font-JakartaMedium">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </ReactNativeModal>

        {/* Success Modal */}
        <ReactNativeModal 
          isVisible={showSuccessModal}
          animationIn="zoomIn"
          animationOut="zoomOut"
        >
          <View className="bg-white px-7 py-9 rounded-3xl items-center">
            <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
              <Image
                source={images.check}
                className="w-16 h-16"
              />
            </View>
            <Text className="text-3xl font-JakartaBold text-center mb-3">
              Success! 🎉
            </Text>
            <Text className="text-base text-gray-600 font-JakartaMedium text-center mb-8">
              You have been successfully authenticated
            </Text>
            <CustomButton
              title="Go to Dashboard"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowSuccessModal(false);
                router.push(`/(root)/(tabs)/home`);
              }}
              className="w-full bg-blue-600"
            />
          </View>
        </ReactNativeModal>

        {/* Account Issue Modal */}
        <ReactNativeModal isVisible={showAccountIssueModal}>
          <View className="bg-white px-7 py-9 rounded-3xl">
            <View className="items-center mb-6">
              <View className="w-20 h-20 bg-amber-100 rounded-full items-center justify-center mb-4">
                <Text className="text-4xl">⚠️</Text>
              </View>
              <Text className="font-JakartaBold text-2xl mb-2 text-center">
                Account Issue
              </Text>
              <Text className="font-JakartaMedium text-gray-600 text-center">
                We're having trouble accessing your account. This could be due to a discrepancy in our records.
              </Text>
            </View>

            <CustomButton
              title="Contact Support"
              onPress={handleAccountIssue}
              className="bg-amber-500 mb-3"
            />
            <CustomButton
              title="Try Again"
              onPress={() => setShowAccountIssueModal(false)}
              className="bg-gray-200"
              textVariant="primary"
            />
          </View>
        </ReactNativeModal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
