import { useEffect, useState, useRef } from "react"
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
  ActivityIndicator,
  Animated,
  Dimensions,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { fetchAPI } from "@/lib/fetch"
import { Ionicons } from "@expo/vector-icons"
import { setupLocationTracking, stopLocationTracking, checkTrackingStatus } from "@/lib/location"
import * as ImagePicker from "expo-image-picker"
import { uploadToCloudinary } from "@/lib/cloudinary"
import ReactNativeModal from "react-native-modal"
import InputField from "@/components/InputField"
import CustomButton from "@/components/CustomButton"
import { icons } from "@/constants"
import React from "react"
import * as Location from "expo-location"
import { calculateDistance } from "@/lib/distance"
import ViewShot from "react-native-view-shot"
import * as Haptics from 'expo-haptics'

const { width } = Dimensions.get('window')
const GEOFENCE_RADIUS_KM = 0.07

declare global {
  var tripId: string
}

interface TripDetails {
  tripId: string
  status: string
  startTime: string | null
  endTime: string | null
  distance: number | null
  photo: string | null
  video: string | null
  booking: {
    id: string
    journeyDate: string
    status: string
  }
  hydrant: {
    name: string
    address: string
    latitude: number
    longitude: number
  }
  destination: {
    name: string
    address: string
    latitude: number
    longitude: number
  }
  customer: {
    name: string
    contactNumber: string
    address: string
  }
}

interface ImageStampDetails {
  asset: ImagePicker.ImagePickerAsset;
  location: Location.LocationObject;
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
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false)
  const [imageToStamp, setImageToStamp] = useState<ImageStampDetails | null>(null)
  const viewShotRef = useRef<ViewShot>(null)
  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  const [verification, setVerification] = useState({
    state: "idle",
    code: "",
    error: null,
  })
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [verificationId, setVerificationId] = useState<string | null>(null)

  useEffect(() => {
    global.tripId = id
    fetchTripDetails()
    initializeLocationTracking(id)

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start()

    const subscription = AppState.addEventListener("change", (nextAppState) => 
      handleAppStateChange(nextAppState, id)
    )

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
        if (!response.trip?.hydrant?.latitude || !response.trip?.destination?.latitude) {
          Alert.alert("API Error", "Location coordinates missing. Contact support.")
          setError("Missing location coordinates from API.")
        }
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

  const checkLocationProximity = async (
    target: { latitude: number; longitude: number },
    targetName: string
  ): Promise<Location.LocationObject | null> => {
    setIsVerifyingLocation(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission required.")
        return null
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const { latitude: currentLat, longitude: currentLon } = currentLocation.coords
      const distance = calculateDistance(
        currentLat,
        currentLon,
        target.latitude,
        target.longitude
      )

      if (distance <= GEOFENCE_RADIUS_KM) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        return currentLocation
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        Alert.alert(
          "Location Verification Failed",
          `You must be within 50 meters of the ${targetName}. Current distance: ~${(distance * 1000).toFixed(0)}m`
        )
        return null
      }
    } catch (error) {
      console.error("Error checking location:", error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert("Location Error", "Could not verify your location.")
      return null
    } finally {
      setIsVerifyingLocation(false)
    }
  }

  const handleOpenLocation = (latitude: number, longitude: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
    Linking.openURL(url)
  }

  const handleCall = (phoneNumber: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Linking.openURL(`tel:${phoneNumber}`)
  }

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.push("/(root)/(tabs)/home")
  }

  const handleReachedHydrant = async (photoUrl?: string) => {
    try {
      const response = await fetchAPI(
        `${process.env.EXPO_PUBLIC_API_URL}/trip/reached-hydrant?id=${id}`,
        {
          method: "POST",
          body: JSON.stringify({ photoUrl }),
        }
      )
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert("Success", "Hydrant reached status updated")
        fetchTripDetails()
      } else {
        throw new Error(response.error || "Failed to update hydrant status")
      }
    } catch (error) {
      console.error("Error updating trip status:", error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert("Error", "Failed to update hydrant status.")
    } finally {
      setUploadingImage(false)
    }
  }

  const pickImageFromCamera = async () => {
    if (!tripDetails) return

    const location = await checkLocationProximity(tripDetails.hydrant, "hydrant")
    if (!location) return

    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [4, 3],
        quality: 1,
      })

      if (!result.canceled) {
        setImageToStamp({ asset: result.assets[0], location: location })
      }
    }
  }

  const handleConfirmAndUploadImage = async () => {
    if (!viewShotRef.current || !imageToStamp) return

    setUploadingImage(true)
    
    try {
      let uri: string | undefined
      if (viewShotRef.current && typeof viewShotRef.current.capture === "function") {
        uri = await viewShotRef.current.capture()
      } else {
        throw new Error("ViewShot ref undefined")
      }

      const stampedAsset = {
        ...imageToStamp.asset,
        uri: uri,
        type: 'image/jpeg',
      }

      const link = await uploadToCloudinary(stampedAsset)
      await handleReachedHydrant(link)
    } catch (error) {
      console.error("Error uploading stamped image:", error)
      Alert.alert("Upload Error", "Failed to upload image.")
      setUploadingImage(false)
    } finally {
      setImageToStamp(null)
    }
  }

  const handleAppStateChange = (nextAppState: AppStateStatus, tripId: string) => {
    setAppState(nextAppState)
    if (appState.match(/inactive|background/) && nextAppState === "active") {
      initializeLocationTracking(tripId)
    }
  }

  const initializeLocationTracking = async (tripId: string) => {
    const success = await setupLocationTracking(tripId)
    setHasLocationPermission(success)
    if (!success) {
      Alert.alert("Permission Required", "Location permissions needed for trip tracking.")
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
    if (!tripDetails) return

    const location = await checkLocationProximity(tripDetails.destination, "destination")
    if (!location) return

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (permission.granted) {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 1,
          videoMaxDuration: 15,
        })

        if (!result.canceled) {
          setUploadingVideo(true)
          const videoUrl = await uploadToCloudinary(result.assets[0])

          const response = await fetchAPI(
            `${process.env.EXPO_PUBLIC_API_URL}/trip/water-delivered?id=${id}`,
            {
              method: "POST",
              body: JSON.stringify({ videoUrl }),
            }
          )

          if (response.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            Alert.alert("Success", "Video uploaded successfully")
            fetchTripDetails()
          } else {
            throw new Error(response.error || "Failed to upload video")
          }
        }
      }
    } catch (error) {
      console.error("Error uploading video:", error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert("Error", "Failed to upload video.")
    } finally {
      setUploadingVideo(false)
    }
  }

  const handleSendOTP = async () => {
    if (!tripDetails) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    try {
      setIsLoading(true)
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: tripDetails?.customer.contactNumber }),
      })

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setVerificationId(response.verificationId)
        setVerification({ ...verification, state: "pending" })
      } else {
        throw new Error(response.error || "Failed to send OTP")
      }
    } catch (error) {
      console.error("Error sending OTP:", error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert("Error", "Failed to send OTP.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!verificationId) {
      Alert.alert("Error", "OTP verification ID not found.")
      return
    }

    if (!verification.code || verification.code.length !== 4) {
      Alert.alert("Error", "Please enter a valid 4-digit OTP.")
      return
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)

    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId,
          otp: verification.code,
          tripId: id,
        }),
      })

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        setVerification({ ...verification, state: "success" })
        fetchTripDetails()
        setShowSuccessModal(true)
        stopLocationTracking()
      } else {
        throw new Error(response.error || "Failed to verify OTP")
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setVerification({ ...verification, state: "error", error: error.message })
    }
  }

  // Progress Step Component
  const ProgressStep = ({ 
    icon, 
    title, 
    completed, 
    active, 
    isLast 
  }: { 
    icon: string; 
    title: string; 
    completed: boolean;
    active: boolean;
    isLast?: boolean;
  }) => (
    <View className="flex-row items-center">
      <View className="items-center">
        <View 
          className={`w-12 h-12 rounded-full items-center justify-center ${
            completed ? 'bg-green-500' : active ? 'bg-blue-500' : 'bg-gray-300'
          }`}
        >
          <Ionicons 
            name={completed ? "checkmark" : icon as any} 
            size={24} 
            color="white" 
          />
        </View>
        <Text 
          className={`text-xs font-JakartaSemiBold mt-2 text-center ${
            completed || active ? 'text-gray-900' : 'text-gray-400'
          }`}
          style={{ width: 70 }}
        >
          {title}
        </Text>
      </View>
      {!isLast && (
        <View 
          className={`h-0.5 flex-1 mx-2 ${
            completed ? 'bg-green-500' : 'bg-gray-300'
          }`}
          style={{ width: 40 }}
        />
      )}
    </View>
  )

  // Location Card Component
  const LocationCard = ({ 
    icon, 
    title, 
    name, 
    address, 
    latitude, 
    longitude,
    type 
  }: {
    icon: string;
    title: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    type: 'pickup' | 'delivery';
  }) => (
    <View className={`rounded-2xl p-5 mb-4 ${
      type === 'pickup' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'
    }`}>
      <View className="flex-row items-center mb-3">
        <View 
          className={`w-10 h-10 rounded-full items-center justify-center ${
            type === 'pickup' ? 'bg-blue-500' : 'bg-green-500'
          }`}
        >
          <Ionicons name={icon as any} size={20} color="white" />
        </View>
        <Text className="text-base font-JakartaBold text-gray-900 ml-3">
          {title}
        </Text>
      </View>
      
      <Text className="text-sm font-JakartaSemiBold text-gray-900 mb-1">
        {name}
      </Text>
      <Text className="text-xs text-gray-600 font-Jakarta mb-3">
        {address}
      </Text>

      <TouchableOpacity
        onPress={() => handleOpenLocation(latitude, longitude)}
        className={`flex-row items-center justify-center py-2.5 rounded-xl ${
          type === 'pickup' ? 'bg-blue-600' : 'bg-green-600'
        }`}
        activeOpacity={0.7}
      >
        <Ionicons name="navigate" size={18} color="white" />
        <Text className="text-white font-JakartaSemiBold ml-2">
          Open in Maps
        </Text>
      </TouchableOpacity>
    </View>
  )

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 font-Jakarta mt-4">Loading trip details...</Text>
      </SafeAreaView>
    )
  }

  if (error || !tripDetails) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center px-6">
        <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={40} color="#EF4444" />
        </View>
        <Text className="text-xl font-JakartaBold text-gray-900 mb-2">
          Error Loading Trip
        </Text>
        <Text className="text-sm text-gray-600 text-center mb-6">
          {error || "No trip details found"}
        </Text>
        <CustomButton
          title="Try Again"
          onPress={() => fetchTripDetails()}
          className="w-full"
        />
        <TouchableOpacity onPress={handleGoBack} className="mt-4">
          <Text className="text-blue-600 font-JakartaSemiBold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  const tripProgress = {
    hydrantReached: !!tripDetails.photo,
    waterDelivered: !!tripDetails.video,
    otpVerified: tripDetails.status === 'completed'
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={handleGoBack} 
            className="mr-4 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-xl font-JakartaBold">
              Trip In Progress
            </Text>
            <Text className="text-blue-100 text-xs font-Jakarta mt-1">
              Booking ID: {tripDetails.booking.id}
            </Text>
          </View>
          <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center">
            <Ionicons name="navigate" size={20} color="white" />
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
          className="px-5 py-4"
        >
          {/* Progress Timeline */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-lg font-JakartaBold text-gray-900 mb-4">
              Trip Progress
            </Text>
            <View className="flex-row justify-between items-start">
              <ProgressStep
                icon="water"
                title="Reach Hydrant"
                completed={tripProgress.hydrantReached}
                active={!tripProgress.hydrantReached}
              />
              <ProgressStep
                icon="videocam"
                title="Deliver Water"
                completed={tripProgress.waterDelivered}
                active={tripProgress.hydrantReached && !tripProgress.waterDelivered}
              />
              <ProgressStep
                icon="shield-checkmark"
                title="Verify OTP"
                completed={tripProgress.otpVerified}
                active={tripProgress.waterDelivered && !tripProgress.otpVerified}
                isLast
              />
            </View>
          </View>

          {/* Trip Stats */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
            <View className="flex-row justify-between">
              <View className="flex-1 items-center border-r border-gray-100">
                <Ionicons name="calendar" size={24} color="#3B82F6" />
                <Text className="text-xs text-gray-500 font-Jakarta mt-2">
                  Journey Date
                </Text>
                <Text className="text-sm font-JakartaSemiBold text-gray-900 mt-1">
                  {new Date(tripDetails.booking.journeyDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </Text>
              </View>
              <View className="flex-1 items-center">
                <Ionicons name="speedometer" size={24} color="#8B5CF6" />
                <Text className="text-xs text-gray-500 font-Jakarta mt-2">
                  Distance
                </Text>
                <Text className="text-sm font-JakartaSemiBold text-gray-900 mt-1">
                  {tripDetails?.distance !== null 
                    ? `${tripDetails.distance.toFixed(1)} km` 
                    : "Tracking..."}
                </Text>
              </View>
            </View>
          </View>

          {/* Location Tracking Status */}
          <View className={`rounded-2xl p-4 mb-4 flex-row items-center ${
            trackingStatus ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <View className={`w-10 h-10 rounded-full items-center justify-center ${
              trackingStatus ? 'bg-green-500' : 'bg-amber-500'
            }`}>
              <Ionicons 
                name={trackingStatus ? "checkmark-circle" : "alert-circle"} 
                size={24} 
                color="white" 
              />
            </View>
            <View className="flex-1 ml-3">
              <Text className={`text-sm font-JakartaSemiBold ${
                trackingStatus ? 'text-green-900' : 'text-amber-900'
              }`}>
                Location Tracking {trackingStatus ? 'Active' : 'Inactive'}
              </Text>
              <Text className={`text-xs font-Jakarta mt-0.5 ${
                trackingStatus ? 'text-green-700' : 'text-amber-700'
              }`}>
                {trackingStatus 
                  ? 'Your location is being tracked in real-time' 
                  : 'Enable location permissions to track trip'}
              </Text>
            </View>
          </View>

          {/* Pickup Location */}
          <LocationCard
            icon="water"
            title="Pickup Location"
            name={tripDetails.hydrant.name}
            address={tripDetails.hydrant.address}
            latitude={tripDetails.hydrant.latitude}
            longitude={tripDetails.hydrant.longitude}
            type="pickup"
          />

          {/* Delivery Location */}
          <LocationCard
            icon="location"
            title="Delivery Location"
            name={tripDetails.destination.name}
            address={tripDetails.destination.address}
            latitude={tripDetails.destination.latitude}
            longitude={tripDetails.destination.longitude}
            type="delivery"
          />

          {/* Customer Info */}
          <View className="bg-white rounded-2xl p-5 mb-4 shadow-sm">
            <Text className="text-base font-JakartaBold text-gray-900 mb-4">
              Customer Details
            </Text>
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center flex-1">
                <Ionicons name="person" size={20} color="#6B7280" />
                <Text className="text-sm text-gray-900 font-JakartaSemiBold ml-3">
                  {tripDetails.customer.name}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <Ionicons name="call" size={20} color="#6B7280" />
                <Text className="text-sm text-gray-700 font-Jakarta ml-3">
                  {tripDetails.customer.contactNumber}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCall(tripDetails.customer.contactNumber)}
                className="bg-blue-600 px-4 py-2 rounded-xl"
                activeOpacity={0.7}
              >
                <View className="flex-row items-center">
                  <Ionicons name="call" size={16} color="white" />
                  <Text className="text-white font-JakartaSemiBold ml-2">Call</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Action Buttons - Fixed at Bottom */}
      <View className="bg-white px-5 py-4 border-t border-gray-200">
        {!tripDetails.photo ? (
          <CustomButton
            title={
              isVerifyingLocation 
                ? "Verifying Location..." 
                : uploadingImage 
                ? "Uploading Photo..." 
                : "📸 Reached Hydrant"
            }
            onPress={pickImageFromCamera}
            disabled={uploadingImage || isVerifyingLocation}
            className="bg-blue-600"
            IconLeft={isVerifyingLocation || uploadingImage ? () => (
              <ActivityIndicator size="small" color="white" className="mr-2" />
            ) : undefined}
          />
        ) : !tripDetails.video ? (
          <View>
            <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3 flex-row items-center">
              <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              <Text className="text-green-700 font-JakartaSemiBold ml-3">
                Photo Uploaded Successfully
              </Text>
            </View>
            <CustomButton
              title={
                isVerifyingLocation 
                  ? "Verifying Location..." 
                  : uploadingVideo 
                  ? "Uploading Video..." 
                  : "🎥 Upload Water Supply Video"
              }
              onPress={pickVideoFromCamera}
              disabled={uploadingVideo || isVerifyingLocation}
              className="bg-green-600"
              IconLeft={isVerifyingLocation || uploadingVideo ? () => (
                <ActivityIndicator size="small" color="white" className="mr-2" />
              ) : undefined}
            />
          </View>
        ) : (
          <View>
            <View className="bg-green-50 border border-green-200 rounded-xl p-4 mb-3 flex-row items-center">
              <Ionicons name="checkmark-done-circle" size={24} color="#10B981" />
              <Text className="text-green-700 font-JakartaSemiBold ml-3">
                Photo & Video Uploaded
              </Text>
            </View>
            <CustomButton
              title={isLoading ? "Sending OTP..." : "🔐 Send OTP for Verification"}
              onPress={handleSendOTP}
              disabled={isLoading}
              className="bg-orange-600"
              IconLeft={isLoading ? () => (
                <ActivityIndicator size="small" color="white" className="mr-2" />
              ) : undefined}
            />
          </View>
        )}
      </View>

      {/* Image Stamping Modal */}
      <ReactNativeModal isVisible={imageToStamp !== null}>
        <View className="bg-white rounded-2xl p-5">
          <Text className="text-xl font-JakartaBold text-gray-900 mb-4">
            Confirm Photo
          </Text>
          
          <ViewShot
            ref={viewShotRef}
            options={{ format: "jpg", quality: 0.9 }}
          >
            <View style={{
              width: width - 60,
              height: 500,
              backgroundColor: '#000',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 12,
            }}>
              <Image
                source={{ uri: imageToStamp?.asset.uri }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="cover"
              />
          
              <View style={{
                position: 'absolute',
                top: 12,
                left: 12,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}>
                <View className="flex-row items-center mb-1">
                  <Ionicons name="location" size={14} color="#10B981" />
                  <Text style={{ color: 'white', fontSize: 11, fontWeight: '600', marginLeft: 6 }}>
                    GPS Coordinates
                  </Text>
                </View>
                <Text style={{ color: 'white', fontSize: 12, fontWeight: '500' }}>
                  {imageToStamp?.location.coords.latitude.toFixed(6)}°N
                </Text>
                <Text style={{ color: 'white', fontSize: 12, fontWeight: '500' }}>
                  {imageToStamp?.location.coords.longitude.toFixed(6)}°E
                </Text>
                <View className="border-t border-white/20 mt-2 pt-2">
                  <Text style={{ color: '#93C5FD', fontSize: 11 }}>
                    {new Date(imageToStamp?.location.timestamp || Date.now())
                      .toLocaleString("en-IN", { 
                        timeZone: "Asia/Kolkata",
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                  </Text>
                </View>
              </View>
            </View>
          </ViewShot>
                  
          <View className="flex-row justify-between mt-5">
            <CustomButton
              title="Retake"
              onPress={() => setImageToStamp(null)}
              className="bg-gray-400 flex-1 mr-2"
              disabled={uploadingImage}
            />
            <CustomButton
              title={uploadingImage ? "Uploading..." : "Confirm"}
              onPress={handleConfirmAndUploadImage}
              className="bg-green-600 flex-1 ml-2"
              disabled={uploadingImage}
              IconLeft={uploadingImage ? () => (
                <ActivityIndicator size="small" color="white" className="mr-2" />
              ) : undefined}
            />
          </View>
        </View>
      </ReactNativeModal>

      {/* OTP Verification Modal */}
      <ReactNativeModal
        isVisible={verification.state === "pending"}
        onModalHide={() => {
          if (verification.state === "success") {
            setShowSuccessModal(true)
          }
        }}
      >
        <View className="bg-white px-7 py-9 rounded-3xl min-h-[380px]">
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-blue-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="lock-closed" size={32} color="#3B82F6" />
            </View>
            <Text className="font-JakartaBold text-2xl mb-2 text-center">
              Enter OTP
            </Text>
            <Text className="font-Jakarta text-gray-600 text-center">
              Code sent to {tripDetails.customer.contactNumber}
            </Text>
          </View>
          
          <InputField
            label="Verification Code"
            icon={icons.lock}
            placeholder="0000"
            value={verification.code}
            keyboardType="numeric"
            maxLength={4}
            onChangeText={(code) => setVerification({ ...verification, code })}
          />
          
          {verification.error && (
            <Text className="text-red-500 text-sm mt-2">
              {verification.error}
            </Text>
          )}
          
          <CustomButton
            title={isLoading ? "Verifying..." : "Verify OTP"}
            onPress={handleVerifyOTP}
            className="mt-5 bg-blue-600"
            disabled={isLoading}
          />
        </View>
      </ReactNativeModal>

      {/* Success Modal */}
      <ReactNativeModal isVisible={showSuccessModal}>
        <View className="bg-white px-7 py-9 rounded-3xl items-center">
          <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={60} color="#10B981" />
          </View>
          <Text className="font-JakartaBold text-3xl text-gray-900 mb-2">
            Trip Completed!
          </Text>
          <Text className="font-Jakarta text-center text-gray-600 mb-8 px-4">
            Your trip has been successfully completed and verified.
          </Text>
          <CustomButton 
            title="Back to Home" 
            onPress={() => {
              setShowSuccessModal(false)
              router.push(`/(root)/(tabs)/home`)
            }} 
            className="w-full bg-green-600"
          />
        </View>
      </ReactNativeModal>
    </SafeAreaView>
  )
}
