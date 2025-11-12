import { Stack } from "expo-router";
import React from "react";

const Layout = () => {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#FFFFFF' },
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false,
          gestureEnabled: false, // Prevent swipe to go back on tab navigator
        }} 
      />
      <Stack.Screen 
        name="trip" 
        options={{ 
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
          gestureEnabled: true,
        }} 
      />
    </Stack>
  );
};

export default Layout;
