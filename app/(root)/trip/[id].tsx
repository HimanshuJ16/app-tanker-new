import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Linking, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchAPI } from "@/lib/fetch";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { AppState, type AppStateStatus } from "react-native";
import * as TaskManager from "expo-task-manager";

const LOCATION_TASK_NAME = "background-location-task";

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error("Background location task error:", error);
    return;
  }

  if (data) {
    const { locations } = data as any;
    const location = locations[0];
    const { id } = useLocalSearchParams();

    if (location) {
      try {
        const response = await fetchAPI(
          `${process.env.EXPO_PUBLIC_API_URL}/trip/location?id=${id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude,
              speed: location.coords.speed,
              heading: location.coords.heading,
            }),
          }
        );

        if (!response.success) {
          console.error("Failed to update background location:", response.error);
        }
      } catch (err) {
        console.error("Error sending background location:", err);
      }
    }
  }
});

interface TripDetails {
  tripId: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  distance: number | null;
  booking: {
    id: string;
    journeyDate: string;
    status: string;
  };
  hydrant: {
    name: string;
    address: string;
  };
  destination: {
    name: string;
    address: string;
  };
  customer: {
    name: string;
    contactNumber: string;
    address: string;
  };
}

export default function Trip() {
  const { id } = useLocalSearchParams();
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    fetchTripDetails();
  }, []);

  useEffect(() => {
    fetchTripDetails();

    const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
    setupLocationTracking();

    // Check location tracking status periodically
    const interval = setInterval(checkTrackingStatus, 5000);

    return () => {
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, []);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === "active") {
      console.log("App has come to the foreground");
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        setupLocationTracking();
      }
    } else if (appState === "active" && nextAppState.match(/inactive|background/)) {
      console.log("App has gone to the background");
    }
    setAppState(nextAppState);
  };

  const setupLocationTracking = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      console.log("Foreground permission status:", foregroundStatus);
  
      if (foregroundStatus !== "granted") {
        setHasLocationPermission(false);
        Alert.alert("Permission required", "Location permission is required to track your trip.");
        return;
      }
  
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      console.log("Background permission status:", backgroundStatus);
  
      if (backgroundStatus !== "granted") {
        setHasLocationPermission(false);
        Alert.alert(
          "Background Permission Required",
          "We need background location access to track your trip while the app is not in use."
        );
        return;
      }
  
      setHasLocationPermission(true);
  
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (!hasStarted) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000,
          distanceInterval: 0,
          foregroundService: {
            notificationTitle: "Location Tracking",
            notificationBody: "Your location is being tracked for your trip.",
          },
        });
      }
      setIsTracking(true);
      console.log("Location tracking started");
    } catch (error) {
      console.error("Error setting up location tracking:", error);
      setIsTracking(false);
    }
  };  

  const stopLocationTracking = async () => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log("Location tracking stopped");
      }
      setIsTracking(false);
    } catch (error) {
      console.error("Error stopping location tracking:", error);
    }
  };

  const checkTrackingStatus = async () => {
    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      setIsTracking(hasStarted);
    } catch (error) {
      console.error("Error checking tracking status:", error);
    }
  };

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/info?id=${id}`);

      if (response && response.success) {
        setTripDetails(response.trip);
      } else {
        throw new Error(response?.error || "Failed to fetch trip details");
      }
    } catch (error) {
      console.error("Error fetching trip details:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLocation = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url);
  };

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleGoBack = () => {
    router.push("/(root)/(tabs)/home");
  };

  const handleReachedHydrant = async () => {
    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/${id}/reached-hydrant`, {
        method: "POST",
      });
      if (response.success) {
        Alert.alert("Success", "Hydrant reached status updated");
        fetchTripDetails();
      } else {
        throw new Error(response.error || "Failed to update hydrant status");
      }
    } catch (error) {
      console.error("Error updating trip status:", error);
      Alert.alert("Error", "Failed to update hydrant status. Please try again.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text>Loading trip details...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-red-500 mb-4">{error}</Text>
        <TouchableOpacity className="bg-blue-500 p-2 rounded" onPress={() => fetchTripDetails()}>
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!tripDetails) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text>No trip details found for trip ID: {id}.</Text>
        <TouchableOpacity className="bg-blue-500 p-2 rounded mt-4" onPress={handleGoBack}>
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="bg-blue-600 p-4 flex-row items-center">
        <TouchableOpacity onPress={handleGoBack} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">En-Route</Text>
      </View>

      <ScrollView className="flex-1 p-4">
        <View className="mb-6">
          <Text className="text-gray-600 text-sm">Booking ID</Text>
          <Text className="text-gray-800">{tripDetails.booking.id}</Text>
        </View>

        <View className="mb-6">
          <Text className="text-gray-600 text-sm">Journey Date</Text>
          <Text className="text-gray-800">{tripDetails.booking.journeyDate}</Text>
        </View>

        <View className="bg-gray-200 p-2 mb-4">
          <Text className="font-semibold">Hydrant</Text>
        </View>

        <View className="mb-6">
          <Text className="text-gray-600 text-sm">Name</Text>
          <Text className="text-gray-800">{tripDetails.hydrant.name}</Text>

          <Text className="text-gray-600 text-sm mt-2">Address</Text>
          <View className="flex-row items-center">
            <Text className="text-gray-800 flex-1">{tripDetails.hydrant.address}</Text>
            <TouchableOpacity onPress={() => handleOpenLocation(tripDetails.hydrant.address)} className="ml-2">
              <Ionicons name="location" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-gray-200 p-2 mb-4">
          <Text className="font-semibold">Destination</Text>
        </View>

        <View className="mb-6">
          <Text className="text-gray-600 text-sm">Name</Text>
          <Text className="text-gray-800">{tripDetails.destination.name}</Text>

          <Text className="text-gray-600 text-sm mt-2">Number</Text>
          <View className="flex-row items-center">
            <Text className="text-gray-800 flex-1">{tripDetails.customer.contactNumber}</Text>
            <TouchableOpacity onPress={() => handleCall(tripDetails.customer.contactNumber)} className="ml-2">
              <Ionicons name="call" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          <Text className="text-gray-600 text-sm mt-2">Address</Text>
          <View className="flex-row items-center">
            <Text className="text-gray-800 flex-1">{tripDetails.destination.address}</Text>
            <TouchableOpacity onPress={() => handleOpenLocation(tripDetails.destination.address)} className="ml-2">
              <Ionicons name="location" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-lg font-semibold">Location Tracking</Text>
          <Text>{hasLocationPermission ? "Enabled" : "Disabled"}</Text>
          <Text>App State: {appState}</Text>
          <Text>Tracking: {isTracking ? "Active" : "Inactive"}</Text>
        </View>
      </ScrollView>

      <View className="flex-row justify-around p-4">
        <TouchableOpacity className="bg-teal-500 p-4 rounded flex-1 mr-2" onPress={handleReachedHydrant}>
          <Text className="text-white text-center font-bold">REACHED HYDRANT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}