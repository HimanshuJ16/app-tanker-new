import { Stack } from "expo-router";
import React from "react";
import { Platform } from "react-native";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Smooth animations
        animation: "slide_from_right",
        animationDuration: 300,
        // Gesture configuration
        gestureEnabled: true,
        gestureDirection: "horizontal",
        fullScreenGestureEnabled: true,
        // Custom presentation
        presentation: "card",
        // Content styling
        contentStyle: {
          backgroundColor: "#F9FAFB",
        },
        // Status bar
        statusBarStyle: "dark",
        statusBarAnimation: "fade",
      }}
    >
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: false,
          // Trip-specific animations
          animation: Platform.select({
            ios: "slide_from_right",
            android: "slide_from_right",
            default: "fade",
          }),
          // Allow swipe back gesture
          gestureEnabled: true,
          gestureDirection: "horizontal",
          // Presentation style
          presentation: "card",
          // Animation timing
          animationDuration: 300,
          animationTypeForReplace: "push",
        }} 
      />
    </Stack>
  );
};

export default Layout;
