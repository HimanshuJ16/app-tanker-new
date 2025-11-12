import { useUser, useAuth } from "@clerk/clerk-expo";
import { 
  ScrollView, 
  Text, 
  View, 
  TouchableOpacity, 
  Image,
  Alert,
  Linking,
  Animated
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useRef } from "react";
import { router } from "expo-router";
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from "react";

import { icons } from "@/constants";

interface MenuItem {
  icon: string;
  label: string;
  value: string;
  onPress?: () => void;
  type?: 'default' | 'link' | 'info';
}

const Profile = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const [vehicleInfo, setVehicleInfo] = useState({ vehicleNumber: "", vehicleId: "" });
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadVehicleInfo();
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
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

  const handleSignOut = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await signOut();
              router.replace("/(auth)/combined-auth");
            } catch (error) {
              console.error('Error signing out:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCallSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('tel:+919990339096');
  };

  const InfoCard = ({ 
    icon, 
    label, 
    value, 
    onPress, 
    type = 'default' 
  }: MenuItem) => (
    <TouchableOpacity
      onPress={() => {
        if (onPress) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }
      }}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      className="flex-row items-center bg-white rounded-xl p-4 mb-3 shadow-sm"
    >
      <View 
        style={{ backgroundColor: '#EBF4FF' }}
        className="w-11 h-11 rounded-full items-center justify-center mr-4"
      >
        <Ionicons name={icon as any} size={22} color="#3B82F6" />
      </View>
      <View className="flex-1">
        <Text className="text-xs text-gray-500 font-Jakarta mb-1">
          {label}
        </Text>
        <Text className="text-sm text-gray-900 font-JakartaSemiBold">
          {value || 'Not Available'}
        </Text>
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );

  const ActionButton = ({ 
    icon, 
    label, 
    onPress, 
    variant = 'default' 
  }: { 
    icon: string; 
    label: string; 
    onPress: () => void;
    variant?: 'default' | 'danger';
  }) => {
    const bgColor = variant === 'danger' ? 'bg-red-50' : 'bg-gray-50';
    const iconColor = variant === 'danger' ? '#EF4444' : '#6B7280';
    const textColor = variant === 'danger' ? 'text-red-600' : 'text-gray-700';

    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        activeOpacity={0.7}
        className={`flex-row items-center ${bgColor} rounded-xl p-4 mb-3`}
      >
        <Ionicons name={icon as any} size={22} color={iconColor} />
        <Text className={`flex-1 ml-4 text-base font-JakartaSemiBold ${textColor}`}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={iconColor} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient Background */}
        <View className="bg-blue-600 pt-6 pb-20 px-5 relative">
          {/* Decorative circles */}
          <View className="absolute top-10 right-10 w-32 h-32 bg-blue-500 rounded-full opacity-20" />
          <View className="absolute -top-5 left-20 w-24 h-24 bg-blue-400 rounded-full opacity-15" />
          
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <Text className="text-white text-2xl font-JakartaBold">
              My Profile
            </Text>
            <Text className="text-blue-100 text-sm font-Jakarta mt-1">
              Manage your account information
            </Text>
          </Animated.View>
        </View>

        {/* Profile Card - Overlapping Header */}
        <View className="px-5 -mt-12">
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
            className="bg-white rounded-2xl p-6 shadow-lg items-center"
          >
            {/* Avatar */}
            <View className="relative mb-4">
              <View className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full items-center justify-center shadow-md">
                <Text className="text-white text-3xl font-JakartaBold">
                  {user?.primaryPhoneNumber?.phoneNumber?.slice(-4) || 'U'}
                </Text>
              </View>
              <View className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-500 rounded-full border-4 border-white items-center justify-center">
                <Ionicons name="checkmark" size={14} color="white" />
              </View>
            </View>

            {/* User Info */}
            <Text className="text-xl font-JakartaBold text-gray-900 mb-1">
              Driver {user?.primaryPhoneNumber?.phoneNumber?.slice(-4) || ''}
            </Text>
            <Text className="text-sm text-gray-500 font-Jakarta mb-4">
              PHED Tanker Service
            </Text>

            {/* Stats */}
            <View className="flex-row w-full border-t border-gray-100 pt-4 mt-2">
              <View className="flex-1 items-center border-r border-gray-100">
                <Text className="text-2xl font-JakartaBold text-blue-600">0</Text>
                <Text className="text-xs text-gray-500 font-Jakarta mt-1">Trips</Text>
              </View>
              <View className="flex-1 items-center border-r border-gray-100">
                <Text className="text-2xl font-JakartaBold text-green-600">0</Text>
                <Text className="text-xs text-gray-500 font-Jakarta mt-1">Completed</Text>
              </View>
              <View className="flex-1 items-center">
                <Text className="text-2xl font-JakartaBold text-purple-600">0</Text>
                <Text className="text-xs text-gray-500 font-Jakarta mt-1">Hours</Text>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Account Information Section */}
        <View className="px-5 mt-6">
          <Text className="text-lg font-JakartaBold text-gray-900 mb-3 px-1">
            Account Information
          </Text>
          
          <InfoCard
            icon="call"
            label="Phone Number"
            value={user?.primaryPhoneNumber?.phoneNumber || "Not Found"}
            type="info"
          />
          
          <InfoCard
            icon="car-sport"
            label="Vehicle Number"
            value={vehicleInfo.vehicleNumber || "Not Found"}
            type="info"
          />
          
          <InfoCard
            icon="pricetag"
            label="Vehicle ID"
            value={vehicleInfo.vehicleId || "Not Found"}
            type="info"
          />
        </View>

        {/* Quick Actions Section */}
        <View className="px-5 mt-6">
          <Text className="text-lg font-JakartaBold text-gray-900 mb-3 px-1">
            Quick Actions
          </Text>

          <ActionButton
            icon="help-circle"
            label="Help & Support"
            onPress={handleCallSupport}
          />

          <ActionButton
            icon="information-circle"
            label="About App"
            onPress={() => {
              Alert.alert(
                'PHED Tanker Tracking',
                'Version 1.0.0\n\nManage your water tanker deliveries efficiently.',
                [{ text: 'OK' }]
              );
            }}
          />
        </View>

        {/* Danger Zone */}
        <View className="px-5 mt-6">
          <Text className="text-lg font-JakartaBold text-gray-900 mb-3 px-1">
            Account
          </Text>

          <ActionButton
            icon="log-out"
            label="Sign Out"
            onPress={handleSignOut}
            variant="danger"
          />
        </View>

        {/* App Info Footer */}
        <View className="px-5 mt-8 mb-4">
          <View className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <View className="flex-row items-center mb-2">
              <Ionicons name="shield-checkmark" size={20} color="#3B82F6" />
              <Text className="text-sm font-JakartaSemiBold text-blue-900 ml-2">
                Secure & Verified
              </Text>
            </View>
            <Text className="text-xs text-blue-700 font-Jakarta leading-5">
              Your account is secured with end-to-end encryption. All vehicle and trip data is protected.
            </Text>
          </View>
        </View>

        <Text className="text-center text-gray-400 text-xs font-Jakarta mb-4">
          PHED Tanker Tracking v1.0.0
        </Text>
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-black/30 items-center justify-center">
          <View className="bg-white rounded-2xl p-6 items-center">
            <Text className="text-gray-700 font-JakartaSemiBold">Signing out...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default Profile;
