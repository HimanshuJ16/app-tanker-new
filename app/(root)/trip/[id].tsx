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
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"
import { fetchAPI } from "@/lib/fetch"
import { Ionicons } from "@expo/vector-icons"
import { setupLocationTracking, stopLocationTracking, checkTrackingStatus } from "@/lib/location"
import * as ImagePicker from "expo-image-picker"
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera" // <--- Import CameraView & Hooks
import { uploadToCloudinary } from "@/lib/cloudinary"
import ReactNativeModal from "react-native-modal"
import InputField from "@/components/InputField"
import CustomButton from "@/components/CustomButton"
import { icons } from "@/constants"
import React from "react"
import * as Location from "expo-location"
import { calculateDistance } from "@/lib/distance"
import ViewShot from "react-native-view-shot"

declare global {
  var tripId: string
}

// Define the radius (in kilometers) for the geofence check
const GEOFENCE_RADIUS_KM = 0.07 // 70 meters

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
    readableId: number
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
  
  // Upload States
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false)
  
  // Image Stamp Modal State
  const [imageToStamp, setImageToStamp] = useState<ImageStampDetails | null>(null);
  const viewShotRef = useRef<ViewShot>(null);

  // OTP Verification State
  const [verification, setVerification] = useState({
    state: "idle",
    code: "",
    error: null,
  })
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [verificationId, setVerificationId] = useState<string | null>(null)

  // --- NEW: Camera Modal & Recording State ---
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();

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
        if (!response.trip?.hydrant?.latitude || !response.trip?.destination?.latitude) {
            Alert.alert("API Error", "Location coordinates for hydrant or destination are missing. Please contact support.")
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
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to verify your position.")
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
        return currentLocation 
      } else {
        Alert.alert(
          "Location Not Correct",
          `You must be within 70 meters of the ${targetName} to perform this action. You are currently ~${(
            distance * 1000
          ).toFixed(0)} meters away.`
        )
        return null 
      }
    } catch (error) {
      console.error("Error checking location proximity:", error)
      Alert.alert("Location Error", "Could not verify your current location. Please try again.")
      return null
    } finally {
      setIsVerifyingLocation(false)
    }
  }

  const handleOpenLocation = (latitude: number, longitude: number) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

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

      if (result.canceled) return;

      setImageToStamp({ asset: result.assets[0], location: location });
    }
  }

  const handleConfirmAndUploadImage = async () => {
    if (!viewShotRef.current || !imageToStamp) return;

    setUploadingImage(true);
    
    try {
      let uri: string | undefined;
      if (viewShotRef.current && typeof viewShotRef.current.capture === "function") {
        uri = await viewShotRef.current.capture();
      } else {
        throw new Error("ViewShot ref or capture method is undefined.");
      }

      const stampedAsset = {
        ...imageToStamp.asset,
        uri: uri, 
        type: 'image/jpeg', 
      };

      const link = await uploadToCloudinary(stampedAsset);
      await handleReachedHydrant(link);

    } catch (error) {
      console.error("Error capturing or uploading stamped image:", error);
      Alert.alert("Upload Error", "Failed to upload the stamped image.");
      setUploadingImage(false); 
    } finally {
      setImageToStamp(null);
    }
  };

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
      Alert.alert("Permission Required", "This app needs location permissions to track your trip.")
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

  // --- NEW: Open Custom Camera Modal ---
  const handleOpenVideoCamera = async () => {
    if (!tripDetails) return;

    // 1. Verify Location
    const location = await checkLocationProximity(tripDetails.destination, "destination");
    if (!location) return;

    // 2. Check Permissions
    if (!cameraPermission?.granted || !microphonePermission?.granted) {
      const cameraStatus = await requestCameraPermission();
      const micStatus = await requestMicrophonePermission();
      if (!cameraStatus.granted || !micStatus.granted) {
        Alert.alert("Permission Required", "Camera and Microphone permissions are needed to record video.");
        return;
      }
    }

    // 3. Open Modal
    setShowCameraModal(true);
  }

  // --- NEW: Start Recording with strict 15s limit ---
  const startRecording = async () => {
    if (cameraRef.current) {
      try {
        setIsRecording(true);
        // maxDuration stops it automatically
        const video = await cameraRef.current.recordAsync({ 
          maxDuration: 15,
        });
        
        setIsRecording(false);
        setShowCameraModal(false); 
        
        if (video?.uri) {
          handleUploadVideo(video.uri);
        }
      } catch (error) {
        console.error("Recording error:", error);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  // --- NEW: Handle Video Upload ---
  const handleUploadVideo = async (uri: string) => {
    try {
      setUploadingVideo(true);
      
      const asset = {
        uri: uri,
        type: 'video',
        mimeType: "video/mp4",
        fileName: `video_${Date.now()}.mp4`,
      };

      // @ts-ignore
      const videoUrl = await uploadToCloudinary(asset);

      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/water-delivered?id=${id}`, {
        method: "POST",
        body: JSON.stringify({ videoUrl }),
      });

      if (response.success) {
        Alert.alert("Success", "Water supply video uploaded successfully");
        fetchTripDetails();
      } else {
        throw new Error(response.error || "Failed to upload video");
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      Alert.alert("Error", "Failed to upload video. Please try again.");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSendOTP = async () => {
    if (!tripDetails) return;

    try {
      setIsLoading(true)
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: tripDetails?.customer.contactNumber }),
      })

      if (response.success) {
        setVerificationId(response.verificationId) 
        setVerification({ ...verification, state: "pending" })
      } else {
        throw new Error(response.error || "Failed to send OTP")
      }
    } catch (error) {
      console.error("Error sending OTP:", error)
      Alert.alert("Error", "Failed to send OTP. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!verificationId) {
      Alert.alert("Error", "OTP verification ID not found. Please request a new OTP.")
      return
    }

    if (!verification.code || verification.code.length !== 4) {
      Alert.alert("Error", "Please enter a valid 4-digit OTP.")
      return
    }

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
        setVerification({ ...verification, state: "success" })
        fetchTripDetails()
        setShowSuccessModal(true)
        stopLocationTracking() 
      } else {
        throw new Error(response.error || "Failed to verify OTP")
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error)
      setVerification({ ...verification, state: "error", error: error.message })
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

  const getHydrantButtonText = () => {
    if (isVerifyingLocation) return "CHECKING LOCATION...";
    if (uploadingImage) return "UPLOADING..."; 
    return "REACHED HYDRANT";
  };

  const getVideoUploadButtonText = () => {
    if (isVerifyingLocation) return "CHECKING LOCATION...";
    if (uploadingVideo) return "UPLOADING...";
    return "UPLOAD VIDEO OF WATER SUPPLY";
  };


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
          <Text className="text-gray-800">#{tripDetails.booking.readableId}</Text>
        </View>

        <View className="mb-6">
          <Text className="text-gray-600 text-sm">Journey Date</Text>
          <Text className="text-gray-800">{new Date(tripDetails.booking.journeyDate).toLocaleDateString()}</Text>
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
            <TouchableOpacity onPress={() => handleOpenLocation(tripDetails.hydrant.latitude, tripDetails.hydrant.longitude)} className="ml-2">
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
            <TouchableOpacity onPress={() => handleOpenLocation(tripDetails.destination.latitude, tripDetails.destination.longitude)} className="ml-2">
              <Ionicons name="location" size={24} color="#3b82f6" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-semibold">Location Tracking</Text>
          <Text>{hasLocationPermission ? "Enabled" : "Disabled"}</Text>
          <Text>App State: {appState}</Text>
          <Text>Tracking: {trackingStatus ? "Active" : "Inactive"}</Text>
        </View>

        <View className="mb-4">
          <Text className="text-lg font-semibold">Distance Traveled</Text>
          <Text>{tripDetails?.distance !== null ? `${tripDetails.distance.toFixed(2)} km` : "Calculating..."}</Text>
        </View>
      </ScrollView>

      <View className="flex-row justify-around p-4">
        {!tripDetails.photo ? (
          <TouchableOpacity
            className="bg-teal-500 p-4 rounded flex-1 mr-2"
            onPress={pickImageFromCamera}
            disabled={uploadingImage || isVerifyingLocation} 
          >
            <Text className="text-white text-center font-bold">
              {getHydrantButtonText()}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-1 space-y-4">
            <View className="flex-row items-center justify-center bg-green-100 p-4 rounded mb-4">
              <Image source={require("@/assets/images/check.png")} style={{ width: 24, height: 24, marginRight: 8 }} />
              <Text className="text-green-700 font-semibold">
                {!tripDetails.video ? "Photo Uploaded" : "Photo and Video Uploaded"}
              </Text>
            </View>

            {!tripDetails.video && (
              <TouchableOpacity
                className="bg-pink-500 p-4 rounded"
                onPress={handleOpenVideoCamera} // <--- UPDATED: Calls the new Camera Modal
                disabled={uploadingVideo || isVerifyingLocation} 
              >
                <Text className="text-white text-center font-bold">
                  {getVideoUploadButtonText()}
                </Text>
              </TouchableOpacity>
            )}

            {tripDetails.video && (
              <TouchableOpacity className="bg-orange-600 p-4 rounded" 
                onPress={handleSendOTP} 
                disabled={isLoading}
              >
                <Text className="text-white text-center font-bold">
                  {isLoading ? "SENDING OTP..." : "SEND OTP FOR VERIFICATION"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* --- MODAL: Camera View for Video --- */}
      <ReactNativeModal 
        isVisible={showCameraModal} 
        style={{ margin: 0 }} 
        onBackButtonPress={() => setShowCameraModal(false)}
      >
        <View className="flex-1 bg-black relative">
          <CameraView 
            ref={cameraRef}
            style={{ flex: 1 }}
            mode="video"
            facing="back"
          />
          
          {/* Close Button (Left) & Record Button (Center) */}
          <View className="absolute bottom-10 left-0 right-0 items-center justify-center flex-row">
             <TouchableOpacity 
               onPress={() => setShowCameraModal(false)}
               className="bg-gray-600 p-4 rounded-full mr-8"
               disabled={isRecording}
             >
               <Ionicons name="close" size={30} color="white" />
             </TouchableOpacity>

             <TouchableOpacity
               onPress={isRecording ? stopRecording : startRecording}
               className={`p-1 rounded-full border-4 ${isRecording ? 'border-red-500' : 'border-white'}`}
             >
               <View className={`w-16 h-16 rounded-full ${isRecording ? 'bg-red-500' : 'bg-white'}`} />
             </TouchableOpacity>
          </View>

          {/* Timer Indicator */}
          {isRecording && (
            <View className="absolute top-12 self-center bg-red-600 px-4 py-1 rounded-full">
              <Text className="text-white font-bold">Recording... (Max 15s)</Text>
            </View>
          )}
        </View>
      </ReactNativeModal>

      {/* --- MODAL: Image Stamping --- */}
      <ReactNativeModal isVisible={imageToStamp !== null}>
        <View className="bg-white p-4 rounded-lg">
          <Text className="text-lg font-bold mb-4">Confirm Image</Text>
          
          <ViewShot
            ref={viewShotRef}
            options={{ format: "jpg", quality: 0.9 }}
          >
            <View style={{
              width: 380,
              height: 500,
              backgroundColor: '#000',
              position: 'relative',
              overflow: 'hidden',
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
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}>
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                  Lat: {imageToStamp?.location.coords.latitude.toFixed(6)}
                </Text>
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                  Lon: {imageToStamp?.location.coords.longitude.toFixed(6)}
                </Text>
                <Text style={{ color: 'white', fontSize: 12, marginTop: 4, opacity: 0.9 }}>
                  {new Date(imageToStamp?.location.timestamp || Date.now())
                    .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </Text>
              </View>
            </View>
          </ViewShot>
                  
          <View className="flex-row justify-between">
            <CustomButton
              title="Retake"
              onPress={() => setImageToStamp(null)}
              className="bg-gray-400 flex-1 mr-2"
              disabled={uploadingImage}
            />
            <CustomButton
              title={uploadingImage ? "Uploading..." : "Confirm & Upload"}
              onPress={handleConfirmAndUploadImage}
              className="bg-success-500 flex-1 ml-2"
              disabled={uploadingImage}
            />
          </View>
          {uploadingImage && <ActivityIndicator size="large" color="#0000ff" className="mt-4" />}
        </View>
      </ReactNativeModal>

      {/* --- MODAL: OTP Verification --- */}
      <ReactNativeModal
        isVisible={verification.state === "pending"}
        onModalHide={() => {
          if (verification.state === "success") {
            setShowSuccessModal(true)
          }
        }}
      >
        <View className="bg-white px-7 py-9 rounded-2xl min-h-[300px]">
          <Text className="font-JakartaExtraBold text-2xl mb-2">Verification</Text>
          <Text className="font-Jakarta mb-5">We've sent a verification code to customer phone number {tripDetails.customer.contactNumber}.</Text>
          <InputField
            label={"Code"}
            icon={icons.lock}
            placeholder={"1234"}
            value={verification.code}
            keyboardType="numeric"
            onChangeText={(code) => setVerification({ ...verification, code })}
          />
          {verification.error && <Text className="text-red-500 text-sm mt-1">{verification.error}</Text>}
          <CustomButton
            title={isLoading ? "Verifying..." : "Verify OTP"}
            onPress={handleVerifyOTP}
            className="mt-5 bg-success-500"
            disabled={isLoading}
          />
        </View>
      </ReactNativeModal>

      <ReactNativeModal isVisible={showSuccessModal} onBackdropPress={() => setShowSuccessModal(false)}>
        <View className="bg-white px-7 py-9 rounded-2xl items-center">
          <Image source={require("../../../assets/images/check.png")} className="w-20 h-20 mr-2" />
          <Text className="font-JakartaExtraBold text-3xl mt-3">Success</Text>
          <Text className="font-Jakarta text-center mt-2 mb-4">Trip completed successfully.</Text>
          <CustomButton 
            title="Close" 
            onPress={() => {
              setShowSuccessModal(false);
              router.push(`/(root)/(tabs)/home`)}
            } 
            className="mt-5 bg-success-500 text-white"
          />
        </View>
      </ReactNativeModal>
    </SafeAreaView>
  )
}