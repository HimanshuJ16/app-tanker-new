import { Stack } from "expo-router";
import React from "react";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Enable gesture-based navigation
        gestureEnabled: true,
        gestureDirection: "horizontal",
        // Full screen gesture for better UX
        fullScreenGestureEnabled: true,
        // Smooth animation configuration
        animation: "slide_from_right",
        // Status bar styling
        statusBarStyle: "dark",
        statusBarAnimation: "fade",
        // Content style
        contentStyle: {
          backgroundColor: "#ffffff",
        },
      }}
    >
      <Stack.Screen 
        name="combined-auth" 
        options={{ 
          headerShown: false,
          // iOS-style slide animation
          animation: "slide_from_right",
          // Custom presentation style
          presentation: "card",
          // Animation timing
          animationDuration: 300,
          // Gesture configuration
          gestureEnabled: true,
          gestureDirection: "horizontal",
        }} 
      />
    </Stack>
  );
};

export default Layout;
