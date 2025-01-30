import { useEffect, useState } from "react"
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  Alert,
  AppState,
  type AppStateStatus,
  Image,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { fetchAPI } from "@/lib/fetch"
import { Ionicons } from "@expo/vector-icons"
import { setupLocationTracking, stopLocationTracking, checkTrackingStatus } from "@/lib/location"
import * as ImagePicker from "expo-image-picker"
import { uploadImageToCloudinary } from "@/lib/cloudinary"
import React from "react"

declare global {
  var tripId: string
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
  hydrantPhotoUploaded?: boolean
}

export default function Trip() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const [hasLocationPermission, setHasLocationPermission] = useState(false)
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState)
  const [trackingStatus, setTrackingStatus] = useState(false)
  const [hydrantPhotoUploaded, setHydrantPhotoUploaded] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  useEffect(() => {
    global.tripId = id
    fetchTripDetails()
    initializeLocationTracking(id)

    const subscription = AppState.addEventListener("change", (nextAppState) => handleAppStateChange(nextAppState, id))

    return () => {
      subscription.remove()
      stopLocationTracking()
    }
  }, [id])

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

  const handleReachedHydrant = async (photoUrl?: string) => {
    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/reached-hydrant?id=${id}`, {
        method: "POST",
        body: JSON.stringify({ photoUrl }),
      })
      if (response.success) {
        setHydrantPhotoUploaded(true)
        Alert.alert("Success", "Hydrant reached status updated")
        fetchTripDetails()
      } else {
        throw new Error(response.error || "Failed to update hydrant status")
      }
    } catch (error) {
      console.error("Error updating trip status:", error)
      Alert.alert("Error", "Failed to update hydrant status. Please try again.")
    } finally {
      setUploadingImage(false)
    }
  }

  const pickImageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        aspect: [4, 3],
        quality: 1,
      })

      console.log(result)

      if (!result.canceled) {
        setUploadingImage(true)
        const link = await uploadImageToCloudinary(result.assets[0])
        console.log("uploaded link=>", link)
        handleReachedHydrant(link)
      }
    }
  }

  const handleAppStateChange = (nextAppState: AppStateStatus, tripId: string) => {
    setAppState(nextAppState)

    if (appState.match(/inactive|background/) && nextAppState === "active") {
      console.log("App has moved to the foreground, ensuring location tracking is active.")
      initializeLocationTracking(tripId)
    } else if (appState === "active" && nextAppState.match(/inactive|background/)) {
      console.log("App has moved to the background, continuing location tracking.")
    }
  }

  const initializeLocationTracking = async (tripId: string) => {
    const success = await setupLocationTracking(tripId)
    setHasLocationPermission(success)
    if (!success) {
      Alert.alert(
        "Permission Required",
        "This app needs location permissions to track your trip, including when the app is in the background.",
      )
    }
    setTrackingStatus(success)
  }

  useEffect(() => {
    const updateTrackingStatus = async () => {
      const status = await checkTrackingStatus()
      setTrackingStatus(status)
    }
    updateTrackingStatus()
  }, [])

  const pickVideoFromCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (permission.granted) {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 1,
          videoMaxDuration: 30,
        })

        if (!result.canceled) {
          setUploadingVideo(true)
          const videoUrl = await uploadImageToCloudinary(result.assets[0])

          const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/water-supply-video?id=${id}`, {
            method: "POST",
            body: JSON.stringify({ videoUrl }),
          })

          if (response.success) {
            Alert.alert("Success", "Water supply video uploaded successfully")
            fetchTripDetails()
          } else {
            throw new Error(response.error || "Failed to upload video")
          }
        }
      }
    } catch (error) {
      console.error("Error uploading video:", error)
      Alert.alert("Error", "Failed to upload video. Please try again.")
    } finally {
      setUploadingVideo(false)
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
          <Text>Tracking: {trackingStatus ? "Active" : "Inactive"}</Text>
        </View>
      </ScrollView>

      <View className="flex-row justify-around p-4">
        {!hydrantPhotoUploaded ? (
          <TouchableOpacity 
            className="bg-teal-500 p-4 rounded flex-1 mr-2" 
            onPress={pickImageFromCamera} 
            disabled={uploadingImage}
          >
            <Text className="text-white text-center font-bold">
              {uploadingImage ? "UPLOADING..." : "REACHED HYDRANT"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-1 space-y-4">
            <View className="flex-row items-center justify-center bg-green-100 p-4 rounded">
              <Image source={require("@/assets/images/check.png")} style={{ width: 24, height: 24, marginRight: 8 }} />
              <Text className="text-green-700 font-semibold">Hydrant Photo Uploaded</Text>
            </View>

            <TouchableOpacity
              className="bg-pink-500 p-4 rounded"
              onPress={pickVideoFromCamera}
              disabled={uploadingVideo}
            >
              <Text className="text-white text-center font-bold">
                {uploadingVideo ? "UPLOADING..." : "CAPTURE VIDEO AFTER WATER SUPPLY"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

