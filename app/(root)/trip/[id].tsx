import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Linking, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchAPI } from '@/lib/fetch';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Camera, CameraType } from 'expo-camera';
import Home from '../(tabs)/home';

const LOCATION_TRACKING = 'location-tracking';

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  const { id } = useLocalSearchParams();
  if (error) {
    console.error("Error in background location task:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    try {
      await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/location?id=${id}`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          altitude: location.coords.altitude,
          speed: location.coords.speed,
          heading: location.coords.heading,
        }),
      });
    } catch (error) {
      console.error("Failed to update location:", error);
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
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const router = useRouter();
  // const cameraRef = useRef<Camera | null>(null);

  useEffect(() => {
    fetchTripDetails();
    requestPermissions();
  }, [id]);

  const requestPermissions = async () => {
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    if (locationStatus === 'granted') {
      setHasLocationPermission(true);
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 100,
      });
    }

    const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(cameraStatus === 'granted');
  };

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/info?id=${id}`);
      
      if (response && response.success) {
        setTripDetails(response.trip);
      } else {
        throw new Error(response?.error || 'Failed to fetch trip details');
      }
    } catch (error) {
      console.error('Error fetching trip details:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
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
    router.push('/(root)/(tabs)/home');
  };

  const handleReachedHydrant = async () => {
    // try {
    //   const response = await fetchAPI(`/trip/${id}/reached-hydrant`, {
    //     method: 'POST'
    //   });
    //   if (response.success) {
    //     Alert.alert('Success', 'Hydrant reached status updated');
    //     fetchTripDetails();
    //   } else {
    //     throw new Error(response.error || 'Failed to update hydrant status');
    //   }
    // } catch (error) {
    //   console.error('Error updating trip status:', error);
    //   Alert.alert('Error', 'Failed to update hydrant status. Please try again.');
    // }
  };

  // const handleTakePhoto = async () => {
    // if (cameraRef.current) {
      // try {
        // const photo = await cameraRef.current.takePictureAsync();
        // console.log("Photo taken:", photo.uri);
        // Alert.alert("Success", "Photo captured successfully");
        // // Here you would typically upload the photo to your server
      // } catch (error) {
        // console.error("Error taking photo:", error);
        // Alert.alert("Error", "Failed to capture photo");
      // }
    // }
  // };

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
        <TouchableOpacity
          className="bg-blue-500 p-2 rounded"
          onPress={() => fetchTripDetails()}
        >
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!tripDetails) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text>No trip details found for trip ID: {id}.</Text>
        <TouchableOpacity
          className="bg-blue-500 p-2 rounded mt-4"
          onPress={handleGoBack}
        >
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
          <Text className="text-gray-600 text-sm">Current Location</Text>
          <Text className="text-gray-800">{tripDetails.customer.address}</Text>
        </View>

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
            <TouchableOpacity 
              onPress={() => handleOpenLocation(tripDetails.hydrant.address)}
              className="ml-2"
            >
              <Ionicons name="location" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-gray-200 p-2 mb-4">
          <Text className="font-semibold">Destination 1</Text>
        </View>

        <View className="mb-6">
          <Text className="text-gray-600 text-sm">Name</Text>
          <Text className="text-gray-800">{tripDetails.destination.name}</Text>

          <Text className="text-gray-600 text-sm mt-2">Number</Text>
          <View className="flex-row items-center">
            <Text className="text-gray-800 flex-1">{tripDetails.customer.contactNumber}</Text>
            <TouchableOpacity 
              onPress={() => handleCall(tripDetails.customer.contactNumber)}
              className="ml-2"
            >
              <Ionicons name="call" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
          
          <Text className="text-gray-600 text-sm mt-2">Address</Text>
          <View className="flex-row items-center">
            <Text className="text-gray-800 flex-1">{tripDetails.destination.address}</Text>
            <TouchableOpacity 
              onPress={() => handleOpenLocation(tripDetails.destination.address)}
              className="ml-2"
            >
              <Ionicons name="location" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        {/* {hasCameraPermission && (
          <View className="mb-6">
            <Camera 
              ref={cameraRef} 
              style={{ width: '100%', height: 200 }}
              type={CameraType.back}
            />
            <TouchableOpacity
              className="bg-blue-500 p-2 rounded mt-2"
              onPress={handleTakePhoto}
            >
              <Text className="text-white text-center">Take Photo</Text>
            </TouchableOpacity>
          </View>
        )} */}

        <View className="mb-6">
          <Text className="text-lg font-semibold">Location Tracking</Text>
          <Text>{hasLocationPermission ? 'Enabled' : 'Disabled'}</Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        className="bg-teal-500 p-4 m-4 rounded"
        onPress={handleReachedHydrant}
      >
        <Text className="text-white text-center font-bold">REACHED HYDRANT</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}