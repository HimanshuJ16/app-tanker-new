import { useUser, useAuth } from "@clerk/clerk-expo";
import { 
  ScrollView, 
  Text, 
  View, 
  TouchableOpacity, 
  Image,
  Alert,
  Pressable 
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { Link, router } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from "react";

const Profile = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [vehicleInfo, setVehicleInfo] = useState({ vehicleNumber: "", vehicleId: "" });
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSignOut = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await signOut();
            router.replace("/(auth)/combined-auth");
          },
        },
      ]
    );
  };

  const InfoCard = ({ 
    icon, 
    label, 
    value, 
    iconColor = "#3B82F6",
    onPress 
  }: { 
    icon: keyof typeof Ionicons.glyphMap; 
    label: string; 
    value: string; 
    iconColor?: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      disabled={!onPress}
      className={`bg-white rounded-2xl p-4 mb-3 flex-row items-center ${onPress ? 'active:bg-gray-50' : ''}`}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View 
        className="w-12 h-12 rounded-full items-center justify-center mr-4"
        style={{ backgroundColor: `${iconColor}15` }}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 font-Jakarta mb-1">{label}</Text>
        <Text className="text-base font-JakartaSemiBold text-gray-900">
          {value || "Not Available"}
        </Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      )}
    </Pressable>
  );

  const ActionButton = ({
    icon,
    label,
    onPress,
    variant = "default"
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    variant?: "default" | "danger";
  }) => (
    <TouchableOpacity
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className={`flex-row items-center justify-center py-4 rounded-xl mb-3 ${
        variant === "danger" ? "bg-red-50 border border-red-200" : "bg-gray-50"
      }`}
      activeOpacity={0.7}
    >
      <Ionicons 
        name={icon} 
        size={20} 
        color={variant === "danger" ? "#EF4444" : "#6B7280"} 
      />
      <Text 
        className={`ml-2 font-JakartaSemiBold ${
          variant === "danger" ? "text-red-600" : "text-gray-700"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Profile Avatar */}
        <View className="bg-gradient-to-b from-blue-600 to-blue-700 pt-6 pb-20 px-6">
          <View className="items-center">
            {/* Avatar */}
            <View className="relative">
              <View 
                className="w-28 h-28 rounded-full bg-white items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Ionicons name="person" size={48} color="#3B82F6" />
              </View>
              {/* Online Status Badge */}
              <View className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 rounded-full border-4 border-white" />
            </View>

            {/* User Info */}
            <Text className="text-2xl font-JakartaBold text-white mt-4">
              Driver Profile
            </Text>
            <Text className="text-sm text-blue-100 font-Jakarta mt-1">
              PHED Tanker Service
            </Text>
          </View>
        </View>

        {/* Main Content Card */}
        <View className="px-6 -mt-12">
          {/* Account Information Section */}
          <View className="bg-white rounded-3xl p-5 mb-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="person-circle-outline" size={24} color="#3B82F6" />
              <Text className="text-lg font-JakartaBold text-gray-900 ml-2">
                Account Information
              </Text>
            </View>

            <InfoCard
              icon="call"
              label="Phone Number"
              value={user?.primaryPhoneNumber?.phoneNumber || "Not Available"}
              iconColor="#10B981"
              onPress={() => {
                // Add call functionality or edit profile
              }}
            />
          </View>

          {/* Vehicle Information Section */}
          <View className="bg-white rounded-3xl p-5 mb-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="car-sport" size={24} color="#3B82F6" />
              <Text className="text-lg font-JakartaBold text-gray-900 ml-2">
                Vehicle Details
              </Text>
            </View>

            <InfoCard
              icon="keypad"
              label="Vehicle Number"
              value={vehicleInfo.vehicleNumber || "Not Available"}
              iconColor="#F59E0B"
            />

            <InfoCard
              icon="finger-print"
              label="Vehicle ID"
              value={vehicleInfo.vehicleId || "Not Available"}
              iconColor="#8B5CF6"
            />
          </View>

          {/* Quick Actions Section */}
          <View className="bg-white rounded-3xl p-5 mb-6"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 12,
              elevation: 4,
            }}
          >
            <View className="flex-row items-center mb-4">
              <Ionicons name="settings-outline" size={24} color="#3B82F6" />
              <Text className="text-lg font-JakartaBold text-gray-900 ml-2">
                Quick Actions
              </Text>
            </View>

            <ActionButton
              icon="notifications-outline"
              label="Notification Settings"
              onPress={() => {
                Alert.alert("Coming Soon", "Notification settings will be available soon.");
              }}
            />

            <ActionButton
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => {
                Alert.alert("Help & Support", "Contact support at: himanshujangir16@gmail.com");
              }}
            />

            <ActionButton
              icon="document-text-outline"
              label="Terms & Conditions"
              onPress={() => {
                Alert.alert("Terms & Conditions", "View terms and conditions.");
              }}
            />
          </View>

          {/* Sign Out Section */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={isLoading}
            className="bg-red-500 rounded-2xl py-4 px-6 flex-row items-center justify-center mb-4"
            style={{
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 5,
            }}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <Text className="text-white font-JakartaBold text-lg">
                Signing Out...
              </Text>
            ) : (
              <>
                <Ionicons name="log-out-outline" size={24} color="#fff" />
                <Text className="text-white font-JakartaBold text-lg ml-2">
                  Sign Out
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* App Version */}
          <Text className="text-center text-gray-400 text-xs font-Jakarta mt-4">
            PHED Tanker Tracking v1.0.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;
