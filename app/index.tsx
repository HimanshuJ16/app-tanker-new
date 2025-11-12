import { useAuth } from "@clerk/clerk-expo";
import { Redirect, SplashScreen } from "expo-router";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import React from "react";

// Keep splash screen visible while checking auth state
SplashScreen.preventAutoHideAsync();

const Page = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for Clerk to initialize and check auth state
    if (isLoaded) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        setIsReady(true);
        SplashScreen.hideAsync();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isLoaded]);

  // Show nothing while Clerk is loading - keeps splash screen visible
  if (!isLoaded || !isReady) {
    return null;
  }

  // Redirect based on authentication state
  if (isSignedIn) {
    return <Redirect href="/(root)/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/combined-auth" />;
};

export default Page;
