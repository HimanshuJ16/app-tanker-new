import { useUser, useAuth } from "@clerk/clerk-expo";
import { ScrollView, Text, View, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { Link } from "expo-router";
import * as SecureStore from 'expo-secure-store';

import InputField from "@/components/InputField";
import { icons } from "@/constants";
import React from "react";

const Profile = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [vehicleInfo, setVehicleInfo] = useState({ vehicleNumber: "", vehicleId: "" });

  useEffect(() => {
    loadVehicleInfo();
  }, []);

  const loadVehicleInfo = async () => {
    try {
      const storedVehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (storedVehicleInfo) {
        setVehicleInfo(JSON.parse(storedVehicleInfo));
      }
    } catch (error) {
      console.error('Error loading vehicle info:', error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView
        className="px-5"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Text className="text-3xl font-bold text-center text-blue-600 my-6">My Profile</Text>
        <View className="bg-white rounded-lg shadow-md p-5 space-y-4">
          <InputField
            label="Phone"
            placeholder={user?.primaryPhoneNumber?.phoneNumber || "Not Found"}
            containerStyle="w-full bg-gray-50"
            inputStyle="p-3.5 text-gray-800"
            editable={false}
          />
          <InputField
            label="Vehicle Number"
            placeholder={vehicleInfo.vehicleNumber || "Not Found"}
            containerStyle="w-full bg-gray-50"
            inputStyle="p-3.5 text-gray-800"
            editable={false}
          />
          <InputField
            label="Vehicle ID"
            placeholder={vehicleInfo.vehicleId || "Not Found"}
            containerStyle="w-full bg-gray-50"
            inputStyle="p-3.5 text-gray-800"
            editable={false}
          />
        </View>

        {/* Sign Out Button */}
        <View className="mt-10">
          <Link href="/(auth)/combined-auth" onPress={() => signOut()} asChild>
            <TouchableOpacity className="bg-blue-500 p-4 rounded-full">
              <Text className="text-center text-white font-semibold text-lg">Sign Out</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
