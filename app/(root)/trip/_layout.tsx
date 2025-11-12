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
          android: 'slide_from_right',
          default: 'slide_from_right',
        }),
        contentStyle: { 
          backgroundColor: '#F9FAFB' 
        },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
          // Dynamic title based on trip ID (optional)
          // title: 'Trip Details',
        }} 
      />
    </Stack>
  );
};

export default Layout;
