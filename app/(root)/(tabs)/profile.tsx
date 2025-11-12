import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import { icons, images } from '@/constants';

interface VehicleInfo {
  vehicleNumber: string;
  vehicleId: string;
}

const Profile = () => {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadVehicleInfo();
  }, []);

  const loadVehicleInfo = async () => {
    try {
      const info = await SecureStore.getItemAsync('vehicleInfo');
      if (info) {
        setVehicleInfo(JSON.parse(info));
      }
    } catch (error) {
      console.error('Error loading vehicle info:', error);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              await signOut();
              await SecureStore.deleteItemAsync('vehicleInfo');
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Error signing out:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Contact Support',
      'Choose how you would like to contact us:',
      [
        {
          text: 'Call',
          onPress: () => Linking.openURL('tel:+919990339096'),
        },
        {
          text: 'Email',
          onPress: () => Linking.openURL('mailto:himanshujangir16@gmail.com'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleEmergency = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      'Emergency Contact',
      'Call emergency helpline?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Call Now',
          onPress: () => Linking.openURL('tel:100'),
        },
      ]
    );
  };

  const MenuItem = ({ 
    icon, 
    title, 
    subtitle, 
    onPress, 
    iconBg = 'bg-blue-100',
    iconText = '📱',
    showArrow = true,
    danger = false
  }: {
    icon?: any;
    title: string;
    subtitle?: string;
    onPress: () => void;
    iconBg?: string;
    iconText?: string;
    showArrow?: boolean;
    danger?: boolean;
  }) => (
    <TouchableOpacity 
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      className={`flex-row items-center p-4 bg-white rounded-2xl mb-3 shadow-sm border ${
        danger ? 'border-red-200' : 'border-gray-100'
      }`}
      activeOpacity={0.7}
    >
      <View className={`w-12 h-12 ${iconBg} rounded-full items-center justify-center mr-4`}>
        {icon ? (
          <Image source={icon} className="w-6 h-6" />
        ) : (
          <Text className="text-2xl">{iconText}</Text>
        )}
      </View>
      <View className="flex-1">
        <Text className={`text-base font-JakartaBold ${danger ? 'text-red-600' : 'text-gray-800'}`}>
          {title}
        </Text>
        {subtitle && (
          <Text className="text-sm text-gray-500 font-JakartaMedium mt-0.5">
            {subtitle}
          </Text>
        )}
      </View>
      {showArrow && (
        <Text className={`text-lg ${danger ? 'text-red-400' : 'text-gray-400'}`}>›</Text>
      )}
    </TouchableOpacity>
  );

  const InfoCard = ({ label, value, icon }: { label: string; value: string; icon: string }) => (
    <View className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 mb-3 shadow-lg">
      <View className="flex-row items-center mb-2">
        <Text className="text-2xl mr-2">{icon}</Text>
        <Text className="text-sm text-blue-100 font-JakartaMedium">{label}</Text>
      </View>
      <Text className="text-xl text-white font-JakartaBold">{value}</Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <View className="bg-blue-600 px-5 pt-4 pb-8 rounded-b-3xl">
          <Text className="text-3xl font-JakartaBold text-white mb-2">Profile</Text>
          <Text className="text-sm font-JakartaMedium text-blue-100">
            Manage your account & settings
          </Text>
        </View>

        <View className="px-5 -mt-4">
          {/* Profile Avatar Section */}
          <View className="bg-white rounded-3xl p-6 mb-4 shadow-lg items-center border border-gray-100">
            <View className="w-24 h-24 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full items-center justify-center mb-4 shadow-md">
              <Text className="text-4xl">👤</Text>
            </View>
            <Text className="text-2xl font-JakartaBold text-gray-800 mb-1">
              Driver Profile
            </Text>
            {user?.primaryPhoneNumber && (
              <View className="flex-row items-center bg-blue-50 px-4 py-2 rounded-full mt-2">
                <Text className="text-lg mr-2">📱</Text>
                <Text className="text-sm text-blue-700 font-JakartaSemiBold">
                  {user.primaryPhoneNumber.phoneNumber}
                </Text>
              </View>
            )}
          </View>

          {/* Vehicle Information Cards */}
          {vehicleInfo && (
            <View className="mb-4">
              <Text className="text-lg font-JakartaBold text-gray-800 mb-3 px-1">
                Vehicle Information
              </Text>
              <InfoCard 
                label="Vehicle Registration"
                value={vehicleInfo.vehicleNumber}
                icon="🚛"
              />
              <InfoCard 
                label="Vehicle ID"
                value={vehicleInfo.vehicleId}
                icon="🔖"
              />
            </View>
          )}

          {/* Quick Stats */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100">
            <Text className="text-lg font-JakartaBold text-gray-800 mb-4">Quick Stats</Text>
            <View className="flex-row justify-around">
              <View className="items-center">
                <View className="w-16 h-16 bg-green-100 rounded-full items-center justify-center mb-2">
                  <Text className="text-2xl">✓</Text>
                </View>
                <Text className="text-2xl font-JakartaBold text-gray-800">--</Text>
                <Text className="text-xs text-gray-500 font-JakartaMedium">Completed</Text>
              </View>
              <View className="items-center">
                <View className="w-16 h-16 bg-amber-100 rounded-full items-center justify-center mb-2">
                  <Text className="text-2xl">🚛</Text>
                </View>
                <Text className="text-2xl font-JakartaBold text-gray-800">--</Text>
                <Text className="text-xs text-gray-500 font-JakartaMedium">Ongoing</Text>
              </View>
              <View className="items-center">
                <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-2">
                  <Text className="text-2xl">📊</Text>
                </View>
                <Text className="text-2xl font-JakartaBold text-gray-800">--</Text>
                <Text className="text-xs text-gray-500 font-JakartaMedium">Total</Text>
              </View>
            </View>
          </View>

          {/* Menu Section */}
          <View className="mb-4">
            <Text className="text-lg font-JakartaBold text-gray-800 mb-3 px-1">
              Account Settings
            </Text>
            
            <MenuItem 
              iconText="📋"
              iconBg="bg-purple-100"
              title="Trip History"
              subtitle="View your past deliveries"
              onPress={() => {
                Alert.alert('Coming Soon', 'Trip history feature will be available soon!');
              }}
            />

            <MenuItem 
              iconText="📊"
              iconBg="bg-green-100"
              title="Performance Reports"
              subtitle="Check your statistics"
              onPress={() => {
                router.push('/(root)/(tabs)/report');
              }}
            />

            <MenuItem 
              iconText="🔔"
              iconBg="bg-amber-100"
              title="Notifications"
              subtitle="Manage notification preferences"
              onPress={() => {
                Alert.alert('Coming Soon', 'Notification settings will be available soon!');
              }}
            />

            <MenuItem 
              iconText="⚙️"
              iconBg="bg-gray-100"
              title="App Settings"
              subtitle="Language, theme & more"
              onPress={() => {
                Alert.alert('Coming Soon', 'Settings will be available soon!');
              }}
            />
          </View>

          {/* Support Section */}
          <View className="mb-4">
            <Text className="text-lg font-JakartaBold text-gray-800 mb-3 px-1">
              Help & Support
            </Text>

            <MenuItem 
              iconText="💬"
              iconBg="bg-blue-100"
              title="Contact Support"
              subtitle="Get help from our team"
              onPress={handleContactSupport}
            />

            <MenuItem 
              iconText="🆘"
              iconBg="bg-red-100"
              title="Emergency Contact"
              subtitle="Quick access to helpline"
              onPress={handleEmergency}
            />

            <MenuItem 
              iconText="❓"
              iconBg="bg-indigo-100"
              title="FAQs"
              subtitle="Frequently asked questions"
              onPress={() => {
                Alert.alert('Coming Soon', 'FAQ section will be available soon!');
              }}
            />

            <MenuItem 
              iconText="ℹ️"
              iconBg="bg-teal-100"
              title="About App"
              subtitle="Version 1.0.0"
              onPress={() => {
                Alert.alert(
                  'PHED Tanker Tracking',
                  'Version 1.0.0\n\nDeveloped for Public Health Engineering Department\n\n© 2025 PHED',
                  [{ text: 'OK' }]
                );
              }}
            />
          </View>

          {/* Sign Out Section */}
          <View className="mb-8">
            <MenuItem 
              iconText="🚪"
              iconBg="bg-red-100"
              title="Sign Out"
              subtitle="Logout from your account"
              onPress={handleSignOut}
              danger
              showArrow={false}
            />
          </View>

          {/* Footer */}
          <View className="items-center pb-6">
            <Text className="text-xs text-gray-400 font-JakartaMedium mb-1">
              PHED Tanker Tracking System
            </Text>
            <Text className="text-xs text-gray-400 font-JakartaMedium">
              Made with ❤️ for better service
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {isLoading && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center">
          <View className="bg-white p-6 rounded-2xl items-center">
            <Text className="text-lg font-JakartaBold text-gray-800 mb-2">
              Signing Out...
            </Text>
            <Text className="text-sm text-gray-500 font-JakartaMedium">
              Please wait
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default Profile;
