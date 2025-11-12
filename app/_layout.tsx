import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { StatusBar } from 'expo-status-bar';
import * as Font from 'expo-font';

import "../global.css";
import { tokenCache } from '@/lib/auth';
import React from 'react';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load fonts
  const [fontsLoaded, fontError] = useFonts({
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
    "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "Jakarta-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  });

  // Validate Clerk publishable key
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  useEffect(() => {
    async function prepare() {
      try {
        // Validate Clerk key
        if (!publishableKey) {
          throw new Error(
            'Missing Clerk Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env file.'
          );
        }

        // Wait for fonts to load
        if (fontError) {
          throw fontError;
        }

        if (!fontsLoaded) {
          return;
        }

        // Simulate minimum splash screen time for branding (optional)
        // await new Promise(resolve => setTimeout(resolve, 1000));

        // Mark app as ready
        setAppIsReady(true);
      } catch (e) {
        console.error('Error during app initialization:', e);
        setError(e instanceof Error ? e.message : 'Failed to initialize app');
        setAppIsReady(true); // Still mark as ready to show error screen
      }
    }

    prepare();
  }, [fontsLoaded, fontError, publishableKey]);

  // Hide splash screen when app is ready
  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // Hide splash screen with a small delay for smooth transition
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // Show nothing while app is preparing
  if (!appIsReady) {
    return null;
  }

  // Show error screen if initialization failed
  if (error || !publishableKey) {
    return (
      <View style={styles.errorContainer} onLayout={onLayoutRootView}>
        <StatusBar style="dark" />
        <View style={styles.errorContent}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>⚠️</Text>
          </View>
          <Text style={styles.errorTitle}>Configuration Error</Text>
          <Text style={styles.errorMessage}>
            {error || 'Missing required environment variables'}
          </Text>
          <Text style={styles.errorHint}>
            Please check your .env file and ensure all required keys are set.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
      <ClerkLoaded>
        <View style={styles.container} onLayout={onLayoutRootView}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: '#FFFFFF' },
            }}
          >
            <Stack.Screen 
              name="index" 
              options={{ 
                headerShown: false,
              }} 
            />
            <Stack.Screen 
              name="(auth)" 
              options={{ 
                headerShown: false,
              }} 
            />
            <Stack.Screen 
              name="(root)" 
              options={{ 
                headerShown: false,
              }} 
            />
            <Stack.Screen 
              name="+not-found" 
              options={{
                title: 'Not Found',
                headerShown: true,
              }}
            />
          </Stack>
        </View>
      </ClerkLoaded>
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorContent: {
    maxWidth: 400,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  errorIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#FEE2E2',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  errorIconText: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
