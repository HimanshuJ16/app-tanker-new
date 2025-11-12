import { Stack } from "expo-router";
import React from "react";
import { Platform } from "react-native";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: Platform.select({
          ios: 'default',
          android: 'fade_from_bottom',
          default: 'fade',
        }),
        contentStyle: { 
          backgroundColor: '#FFFFFF' 
        },
        gestureEnabled: false, // Prevent swipe back on auth screens
      }}
    >
      <Stack.Screen 
        name="combined-auth" 
        options={{ 
          headerShown: false,
          animation: 'fade',
          gestureEnabled: false, // No back gesture during auth
          // Prevent going back to prevent auth bypass
        }} 
      />
    </Stack>
  );
};

export default Layout;
