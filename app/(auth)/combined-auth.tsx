import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, ScrollView, Text, View } from "react-native";
import { ReactNativeModal } from "react-native-modal";
import * as SecureStore from 'expo-secure-store';

import CustomButton from "@/components/CustomButton";
import InputField from "@/components/InputField";
import { icons, images } from "@/constants";
import { fetchAPI } from "@/lib/fetch";
import { tokenCache } from "@/lib/auth"; // Using your auth helper
import React from "react";

export default function CombinedAuth() {
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
    verificationId: "", // Added to store the ID from Message Central
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
    setIsLoading(true);
    try {
      // 1. Check if Vehicle Exists
      console.log('Attempting to check vehicle:', form.vehicleNumber);
      const vehicleCheckResponse = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/vehicle`, {
        method: "POST",
        body: JSON.stringify({
          vehicleNumber: form.vehicleNumber,
        }),
      });

      if (vehicleCheckResponse.exists) {
        const contactNumber = vehicleCheckResponse.contactNumber; // e.g., "9999999999"
        
        // Store vehicle info needed for verification step
        setVehicleInfo({
          vehicleNumber: form.vehicleNumber,
          vehicleId: vehicleCheckResponse.vehicleId,
        });

        // 2. Send OTP using your Custom API (Message Central)
        console.log('Initiating Custom OTP send to:', contactNumber);
        
        const otpResponse = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/auth/send-otp`, {
          method: "POST",
          body: JSON.stringify({
            phoneNumber: contactNumber, // Backend expects 'phoneNumber'
            otpLength: 4 // Optional, matches your default
          }),
        });

        if (otpResponse.success) {
           setVerification({ 
             ...verification, 
             state: "pending",
             verificationId: otpResponse.verificationId // Store this for the verify step
           });
        } else {
          Alert.alert("Error", otpResponse.error || "Failed to send OTP.");
        }

      } else {
        console.log('Vehicle not found');
        Alert.alert("Error", vehicleCheckResponse.error || "Vehicle not found. Please check the vehicle number.");
      }
    } catch (err: any) {
      console.error('Error in onAuthPress:', err);
      Alert.alert(
        "Error",
        err.message || "An unexpected error occurred. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onPressVerify = async () => {
    setIsLoading(true);
    try {
      console.log('Attempting to verify OTP:', verification.code);

      // 3. Verify OTP using your Custom API
      // Your backend route expects: { verificationId, otp, vehicleId }
      const verifyResponse = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/auth/verify-otp`, {
        method: "POST",
        body: JSON.stringify({
          verificationId: verification.verificationId,
          otp: verification.code,
          vehicleId: vehicleInfo.vehicleId
        }),
      });

      if (verifyResponse.success) {
        // 4. Handle Success & Session
        // Save the JWT token using your auth helper
        if (verifyResponse.token) {
          await tokenCache.saveToken('jwt', verifyResponse.token);
        }
        
        await saveVehicleInfo(vehicleInfo);

        setVerification({
          ...verification,
          state: "success",
          error: "",
        });
      } else {
        setVerification({
          ...verification,
          error: verifyResponse.error || "Verification failed",
          state: "failed",
        });
      }
    } catch (err: any) {
      console.error('Error in onPressVerify:', err);
      setVerification({
        ...verification,
        error: "Verification failed. Please try again.",
        state: "failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccountIssue = () => {
    // This might be less relevant without Clerk, but keeping for UI consistency
    Alert.alert(
      "Contact Support",
      "Please contact your administrator to resolve issues with your vehicle registration.",
      [{ text: "OK", onPress: () => setShowAccountIssueModal(false) }]
    );
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="flex-1 bg-white">
        <View className="relative w-full h-[250px]">
          <Image source={images.signUpCar} className="z-0 w-full h-[250px]" />
          <Text className="text-2xl text-black font-JakartaSemiBold absolute bottom-5 left-5">
            Welcome 👋
          </Text>
        </View>
        <View className="p-5">
          <InputField
            label="Vehicle Number"
            placeholder="Enter vehicle number"
            icon={icons.person}
            value={form.vehicleNumber}
            onChangeText={(value) => setForm({ ...form, vehicleNumber: value.toUpperCase() })}
          />
          <CustomButton
            title={isLoading ? "Processing..." : "Continue"}
            onPress={onAuthPress}
            className="mt-6"
            disabled={isLoading}
          />
        </View>
        <ReactNativeModal
          isVisible={verification.state === "pending"}
          onModalHide={() => {
            if (verification.state === "success") {
              setShowSuccessModal(true);
            }
          }}
        >
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Text className="font-JakartaExtraBold text-2xl mb-2">
              Verification
            </Text>
            <Text className="font-Jakarta mb-5">
              We've sent a verification code to your registered phone number.
            </Text>
            <InputField
              label={"Code"}
              icon={icons.lock}
              placeholder={"1234"}
              value={verification.code}
              keyboardType="numeric"
              onChangeText={(code) =>
                setVerification({ ...verification, code })
              }
            />
            {verification.error && (
              <Text className="text-red-500 text-sm mt-1">
                {verification.error}
              </Text>
            )}
            <CustomButton
              title={isLoading ? "Verifying..." : "Verify OTP"}
              onPress={onPressVerify}
              className="mt-5 bg-success-500"
              disabled={isLoading}
            />
          </View>
        </ReactNativeModal>
        <ReactNativeModal isVisible={showSuccessModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Image
              source={images.check}
              className="w-[110px] h-[110px] mx-auto my-5"
            />
            <Text className="text-3xl font-JakartaBold text-center">
              Verified
            </Text>
            <Text className="text-base text-gray-400 font-Jakarta text-center mt-2">
              You have successfully authenticated.
            </Text>
            <CustomButton
              title="Browse Home"
              onPress={() => {
                setShowSuccessModal(false); 
                router.push(`/(root)/(tabs)/home`);
              }}
              className="mt-5"
            />
          </View>
        </ReactNativeModal>
        <ReactNativeModal isVisible={showAccountIssueModal}>
          <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
            <Text className="font-JakartaExtraBold text-2xl mb-2">
              Account Issue Detected
            </Text>
            <Text className="font-Jakarta mb-5">
              We're having trouble accessing your account. This could be due to a discrepancy in our records.
            </Text>
            <CustomButton
              title="Contact Support"
              onPress={handleAccountIssue}
              className="mt-5 bg-warning-500"
            />
            <CustomButton
              title="Cancel"
              onPress={() => setShowAccountIssueModal(false)}
              className="mt-3"
            />
          </View>
        </ReactNativeModal>
      </View>
    </ScrollView>
  );
}