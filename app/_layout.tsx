import { useFonts } from 'expo-font';
import { Stack, SplashScreen } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import 'react-native-reanimated';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import "../global.css";
import { tokenCache } from '@/lib/auth';
import React from 'react';

// Prevent the splash screen from auto-hiding before asset loading is complete
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
    "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "Jakarta-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });

  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  useEffect(() => {
    async function prepare() {
      try {
        // Check for publishable key
        if (!publishableKey) {
          console.error('Missing Clerk Publishable Key');
          throw new Error(
            'Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env'
          );
        }

        // Wait for fonts to load
        if (fontsLoaded || fontError) {
          // Simulate minimum splash duration for smooth UX
          await new Promise(resolve => setTimeout(resolve, 500));
          setAppIsReady(true);
        }
      } catch (e) {
        console.warn('Error during app preparation:', e);
      }
    }

    prepare();
  }, [fontsLoaded, fontError, publishableKey]);

  useEffect(() => {
    async function hideSplash() {
      if (appIsReady) {
        // Hide splash screen with optional haptic feedback
        await SplashScreen.hideAsync();
        if (Platform.OS === 'ios') {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
    }

    hideSplash();
  }, [appIsReady]);

  // Handle font loading errors
  if (fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EF4444' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Font Loading Error
        </Text>
        <Text style={{ color: 'white', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 }}>
          Failed to load fonts. Please restart the app.
        </Text>
      </View>
    );
  }

  // Handle missing Clerk key
  if (!publishableKey) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B' }}>
        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Configuration Error
        </Text>
        <Text style={{ color: 'white', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 }}>
          Missing Clerk API key. Please check your environment configuration.
        </Text>
      </View>
    );
  }

  // Show loading state while preparing
  if (!appIsReady) {
    return null; // Splash screen is still visible
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
          <ClerkLoaded>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: Platform.select({
                  ios: 'slide_from_right',
                  android: 'slide_from_right',
                  default: 'fade',
                }),
                animationDuration: 300,
                gestureEnabled: true,
                contentStyle: {
                  backgroundColor: '#F9FAFB',
                },
                statusBarStyle: 'dark',
                statusBarAnimation: 'fade',
              }}
            >
              {/* Root index - Auth router */}
              <Stack.Screen 
                name="index" 
                options={{ 
                  headerShown: false,
                  animation: 'fade',
                }} 
              />
              
              {/* Authentication screens */}
              <Stack.Screen 
                name="(auth)" 
                options={{ 
                  headerShown: false,
                  animation: 'slide_from_right',
                  presentation: 'card',
                }} 
              />
              
              {/* Main app screens */}
              <Stack.Screen 
                name="(root)" 
                options={{ 
                  headerShown: false,
                  animation: 'fade',
                  gestureEnabled: false,
                }} 
              />
              
              {/* 404 Not Found */}
              <Stack.Screen 
                name="+not-found"
                options={{
                  title: 'Not Found',
                  presentation: 'modal',
                }}
              />
            </Stack>
          </ClerkLoaded>
        </ClerkProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
