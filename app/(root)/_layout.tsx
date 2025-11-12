import { Stack } from "expo-router";
import React from "react";
import { Platform } from "react-native";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Global animation settings
        animation: Platform.select({
          ios: "slide_from_right",
          android: "slide_from_right",
          default: "fade",
        }),
        animationDuration: 300,
        // Gesture configuration
        gestureEnabled: true,
        gestureDirection: "horizontal",
        fullScreenGestureEnabled: Platform.OS === "ios",
        // Presentation and styling
        presentation: "card",
        contentStyle: {
          backgroundColor: "#F9FAFB",
        },
        // Status bar
        statusBarStyle: "dark",
        statusBarAnimation: "fade",
        statusBarTranslucent: false,
      }}
    >
      {/* Main tabs navigation */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false,
          animation: "fade",
          // Prevent gesture back on tabs
          gestureEnabled: false,
        }} 
      />
      
      {/* Trip stack (nested) */}
      <Stack.Screen 
        name="trip" 
        options={{ 
          headerShown: false,
          animation: "slide_from_right",
          presentation: "card",
          gestureEnabled: true,
          gestureDirection: "horizontal",
          animationDuration: 300,
        }} 
      />
    </Stack>
  );
};

export default Layout;
