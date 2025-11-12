import { router } from "expo-router";
import { useRef, useState } from "react";
import { 
  Image, 
  Text, 
  TouchableOpacity, 
  View, 
  Animated,
  Dimensions,
  Platform,
  StatusBar
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";
import * as Haptics from 'expo-haptics';
import React from "react";

import CustomButton from "@/components/CustomButton";
import { onboarding } from "@/constants";

const { width, height } = Dimensions.get('window');

const Home = () => {
  const swiperRef = useRef<Swiper>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const isLastSlide = activeIndex === onboarding.length - 1;

  React.useEffect(() => {
    // Animate content on slide change
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeIndex]);

  const handleIndexChanged = (index: number) => {
    // Reset animations before changing slide
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    scaleAnim.setValue(0.9);
    setActiveIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(auth)/combined-auth");
  };

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLastSlide) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(auth)/combined-auth");
    } else {
      swiperRef.current?.scrollBy(1);
    }
  };

  const ProgressBar = () => (
    <View className="flex-row items-center justify-center mb-8">
      {onboarding.map((_, index) => (
        <View
          key={index}
          className="flex-row items-center"
        >
          <Animated.View
            style={{
              opacity: index <= activeIndex ? 1 : 0.3,
              transform: [
                {
                  scale: index === activeIndex ? 1.1 : 1,
                },
              ],
            }}
            className={`h-2 rounded-full mx-1 ${
              index === activeIndex
                ? 'w-8 bg-blue-600'
                : index < activeIndex
                ? 'w-2 bg-blue-600'
                : 'w-2 bg-gray-300'
            }`}
          />
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      
      {/* Header with Skip and Progress */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          {/* Progress Counter */}
          <View className="bg-gray-100 px-3 py-1.5 rounded-full">
            <Text className="text-gray-600 text-xs font-JakartaSemiBold">
              {activeIndex + 1} / {onboarding.length}
            </Text>
          </View>

          {/* Skip Button */}
          {!isLastSlide && (
            <TouchableOpacity
              onPress={handleSkip}
              className="px-4 py-2 rounded-full active:opacity-70"
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Skip onboarding"
            >
              <Text className="text-gray-600 text-sm font-JakartaBold">
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <ProgressBar />
      </View>

      {/* Swiper Content */}
      <View className="flex-1">
        <Swiper
          ref={swiperRef}
          loop={false}
          showsPagination={false}
          onIndexChanged={handleIndexChanged}
          scrollEnabled={true}
          removeClippedSubviews={false}
        >
          {onboarding.map((item, index) => (
            <View 
              key={item.id} 
              className="flex-1 items-center justify-center px-6"
            >
              {/* Image with Animation */}
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [
                    { scale: scaleAnim },
                    { translateY: slideAnim },
                  ],
                }}
                className="w-full items-center mb-8"
              >
                <View className="relative">
                  {/* Decorative Background Circle */}
                  <View className="absolute -inset-8 bg-blue-50 rounded-full opacity-30" />
                  <Image
                    source={item.image}
                    className="w-[280px] h-[280px]"
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* Text Content with Animation */}
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }}
                className="w-full items-center"
              >
                {/* Title */}
                <Text className="text-gray-900 text-3xl font-JakartaBold text-center leading-tight mb-4 px-4">
                  {item.title}
                </Text>

                {/* Description */}
                <Text className="text-base font-Jakarta text-center text-gray-600 leading-relaxed px-6 mb-2">
                  {item.description}
                </Text>

                {/* Feature Highlights (if applicable) */}
                {index === 0 && (
                  <View className="flex-row items-center justify-center mt-4 flex-wrap">
                    <View className="bg-blue-50 px-3 py-1.5 rounded-full mr-2 mb-2">
                      <Text className="text-blue-700 text-xs font-JakartaSemiBold">
                        🚗 Track Vehicles
                      </Text>
                    </View>
                    <View className="bg-green-50 px-3 py-1.5 rounded-full mr-2 mb-2">
                      <Text className="text-green-700 text-xs font-JakartaSemiBold">
                        📍 Real-time GPS
                      </Text>
                    </View>
                    <View className="bg-purple-50 px-3 py-1.5 rounded-full mb-2">
                      <Text className="text-purple-700 text-xs font-JakartaSemiBold">
                        🔔 Instant Alerts
                      </Text>
                    </View>
                  </View>
                )}
              </Animated.View>
            </View>
          ))}
        </Swiper>
      </View>

      {/* Bottom Actions */}
      <View className="px-6 pb-6">
        {/* Navigation Hint */}
        {!isLastSlide && (
          <Animated.View
            style={{ opacity: fadeAnim }}
            className="flex-row items-center justify-center mb-4"
          >
            <Text className="text-gray-400 text-xs font-Jakarta mr-2">
              Swipe to continue
            </Text>
            <Text className="text-gray-400 text-sm">👉</Text>
          </Animated.View>
        )}

        {/* Primary Action Button */}
        <CustomButton
          title={isLastSlide ? "Get Started 🚀" : "Next"}
          onPress={handleNext}
          className="w-full shadow-lg"
          accessible={true}
          accessibilityLabel={isLastSlide ? "Get started" : "Next slide"}
          accessibilityRole="button"
        />

        {/* Back Button (except first slide) */}
        {activeIndex > 0 && (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              swiperRef.current?.scrollBy(-1);
            }}
            className="mt-3 py-3 items-center active:opacity-70"
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text className="text-gray-600 text-sm font-JakartaSemiBold">
              ← Back
            </Text>
          </TouchableOpacity>
        )}

        {/* Terms & Privacy (last slide only) */}
        {isLastSlide && (
          <Text className="text-center text-gray-400 text-xs font-Jakarta mt-4 px-8">
            By continuing, you agree to our{' '}
            <Text className="text-blue-600 font-JakartaSemiBold">
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text className="text-blue-600 font-JakartaSemiBold">
              Privacy Policy
            </Text>
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
};

export default Home;
