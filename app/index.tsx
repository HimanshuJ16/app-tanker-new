import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import { View, Text, ActivityIndicator, Animated, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

const Page = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Simulate loading progress
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 20;
      });
    }, 100);

    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();

    // Minimum splash duration
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, []);

  // Loading Screen with Progress
  if (!isLoaded || !isReady) {
    return (
      <View className="flex-1 bg-blue-600">
        <LinearGradient
          colors={["#1E40AF", "#3B82F6", "#60A5FA"]}
          style={{ flex: 1 }}
        >
          <SafeAreaView className="flex-1">
            <View className="flex-1 items-center justify-center px-6">
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                  alignItems: "center",
                  width: "100%",
                }}
              >
                {/* App Icon */}
                <View 
                  className="w-32 h-32 bg-white rounded-3xl items-center justify-center mb-8"
                  style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.4,
                    shadowRadius: 20,
                    elevation: 10,
                  }}
                >
                  <Ionicons name="water" size={64} color="#3B82F6" />
                </View>

                {/* App Title */}
                <Text className="text-white text-4xl font-JakartaBold mb-2 text-center">
                  PHED Tanker
                </Text>
                <Text className="text-blue-100 text-lg font-JakartaSemiBold mb-12 text-center">
                  Water Delivery System
                </Text>

                {/* Progress Bar */}
                <View className="w-full max-w-xs mb-4">
                  <View className="bg-white/20 rounded-full h-2 overflow-hidden">
                    <Animated.View
                      style={{
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0%", "100%"],
                        }),
                        height: "100%",
                        backgroundColor: "#ffffff",
                        borderRadius: 9999,
                      }}
                    />
                  </View>
                  <Text className="text-white text-sm font-JakartaSemiBold mt-2 text-center">
                    {loadingProgress}%
                  </Text>
                </View>

                {/* Loading Spinner */}
                <ActivityIndicator size="large" color="#ffffff" className="mt-4" />
              </Animated.View>
            </View>

            {/* Footer Information */}
            <View className="pb-8 items-center">
              <View className="flex-row items-center mb-2">
                <Ionicons name="shield-checkmark" size={16} color="#BFDBFE" />
                <Text className="text-blue-200 text-xs font-Jakarta ml-2">
                  Secure & Reliable
                </Text>
              </View>
              <Text className="text-blue-300 text-xs font-Jakarta">
                Version 1.0.0 • PHED © 2025
              </Text>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>
    );
  }

  // Route to appropriate screen based on auth status
  if (isSignedIn) {
    return <Redirect href="/(root)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/combined-auth" />;
};

export default Page;
