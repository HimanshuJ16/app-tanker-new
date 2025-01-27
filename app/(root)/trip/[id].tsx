import React, { useEffect, useState, useCallback } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  Alert,
  Platform,
  AppState,
  type AppStateStatus,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { fetchAPI } from "@/lib/fetch"
import { Ionicons } from "@expo/vector-icons"
import * as Location from "expo-location"
import * as TaskManager from "expo-task-manager"

interface ExtendedLocationOptions extends Location.LocationOptions {
  foregroundService?: {
    notificationTitle: string
    notificationBody: string
  }
}

interface TripDetails {
  tripId: string
  status: string
  startTime: string | null
  endTime: string | null
  distance: number | null
  booking: {
    id: string
    journeyDate: string
    status: string
  }
  hydrant: {
    name: string
    address: string
  }
  destination: {
    name: string
    address: string
  }
  customer: {
    name: string
    contactNumber: string
    address: string
  }
}

const LOCATION_TRACKING = "location-tracking"

const sendLocationUpdate = async (location: Location.LocationObject, tripId: string) => {
  try {
    const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/location?id=${tripId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
      }),
    })

    if (response && response.success) {
      console.log("Location updated successfully")
    } else {
      console.error("Failed to update location:", response?.error || "Unknown error")
    }
  } catch (error) {
    console.error("Error sending location update:", error)
  }
}

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  const { id } = useLocalSearchParams<{ id: string }>()
  if (error) {
    console.error("Error in background location task:", error)
    return
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }
    const location = locations[0]
    if (location) {
      await sendLocationUpdate(location, id) // We'll need to pass the `id` here
    }
  }
})

export default function Trip() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [hasLocationPermission, setHasLocationPermission] = useState(false)
  const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null)
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)

  useEffect(() => {
    fetchTripDetails()
    setupLocationTracking(id)

    const subscription = AppState.addEventListener("change", (nextAppState) => handleAppStateChange(nextAppState, id))

    return () => {
      subscription.remove()
      stopLocationTracking()
    }
  }, [id])

  const handleAppStateChange = (nextAppState: AppStateStatus, tripId: string) => {
    setAppState(nextAppState)
    if (appState.match(/inactive|background/) && nextAppState === "active") {
      setupLocationTracking(tripId)
    } else if (appState === "active" && nextAppState.match(/inactive|background/)) {
      stopLocationTracking()
    }
  }

  const fetchTripDetails = async () => {
    try {
      setLoading(true)
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/info?id=${id}`)

      if (response && response.success) {
        setTripDetails(response.trip)
      } else {
        throw new Error(response?.error || "Failed to fetch trip details")
      }
    } catch (error) {
      console.error("Error fetching trip details:", error)
      setError(error instanceof Error ? error.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleOpenLocation = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    Linking.openURL(url)
  }

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`)
  }

  const handleGoBack = () => {
    router.push("/(root)/(tabs)/home")
  }

  const handleReachedHydrant = async () => {
    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/${id}/reached-hydrant`, {
        method: "POST",
      })
      if (response.success) {
        Alert.alert("Success", "Hydrant reached status updated")
        fetchTripDetails()
      } else {
        throw new Error(response.error || "Failed to update hydrant status")
      }
    } catch (error) {
      console.error("Error updating trip status:", error)
      Alert.alert("Error", "Failed to update hydrant status. Please try again.")
    }
  }

  const setupLocationTracking = async (tripId: string) => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync()
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()

      if (foregroundStatus !== "granted" || backgroundStatus !== "granted") {
        setHasLocationPermission(false)
        Alert.alert(
          "Permission Required",
          "This app needs location permissions to track your trip, including when the app is in the background.",
        )
        return
      }

      setHasLocationPermission(true)

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000,
          distanceInterval: 0,
        },
        (location) => {
          sendLocationUpdate(location, tripId)
        },
      )

      setLocationSubscription(subscription)
      console.log("Location tracking started")
    } catch (error) {
      console.error("Error setting up location tracking:", error)
      Alert.alert("Error", "Failed to setup location tracking. Please try again.")
    }
  }

  const stopLocationTracking = () => {
    if (locationSubscription) {
      locationSubscription.remove()
      setLocationSubscription(null)
      console.log("Location tracking stopped")
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text>Loading trip details...</Text>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text className="text-red-500 mb-4">{error}</Text>
        <TouchableOpacity className="bg-blue-500 p-2 rounded" onPress={() => fetchTripDetails()}>
          <Text className="text-white">Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  if (!tripDetails) {
    return (
      <SafeAreaView className="flex-1 bg-white justify-center items-center">
        <Text>No trip details found for trip ID: {id}.</Text>
        <TouchableOpacity className="bg-blue-500 p-2 rounded mt-4" onPress={handleGoBack}>
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
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
          <Text>Tracking: {locationSubscription ? "Active" : "Inactive"}</Text>
        </View>
      </ScrollView>

      <View className="flex-row justify-around p-4">
        <TouchableOpacity className="bg-teal-500 p-4 rounded flex-1 mr-2" onPress={handleReachedHydrant}>
          <Text className="text-white text-center font-bold">REACHED HYDRANT</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

