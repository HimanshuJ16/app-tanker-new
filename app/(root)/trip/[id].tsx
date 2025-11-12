import { useEffect, useState, useRef } from "react";
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
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { fetchAPI } from "@/lib/fetch";
import { Ionicons } from "@expo/vector-icons";
import { setupLocationTracking, stopLocationTracking, checkTrackingStatus } from "@/lib/location";
import * as ImagePicker from "expo-image-picker";
import { uploadToCloudinary } from "@/lib/cloudinary";
import ReactNativeModal from "react-native-modal";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import { icons } from "@/constants";
import React from "react";
import * as Location from "expo-location";
import { calculateDistance } from "@/lib/distance";
import ViewShot from "react-native-view-shot";
import * as Haptics from "expo-haptics";
import { LinearGradient } from 'expo-linear-gradient';

declare global {
  var tripId: string;
}

const GEOFENCE_RADIUS_KM = 0.07; // 70 meters

interface TripDetails {
  tripId: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
  distance: number | null;
  photo: string | null;
  video: string | null;
  booking: {
    id: string;
    journeyDate: string;
    status: string;
  };
  hydrant: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  customer: {
    name: string;
    contactNumber: string;
    address: string;
  };
}

interface ImageStampDetails {
  asset: ImagePicker.ImagePickerAsset;
  location: Location.LocationObject;
}

export default function Trip() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tripDetails, setTripDetails] = useState<TripDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [trackingStatus, setTrackingStatus] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isVerifyingLocation, setIsVerifyingLocation] = useState(false);
  const [imageToStamp, setImageToStamp] = useState<ImageStampDetails | null>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [verification, setVerification] = useState({
    state: "idle",
    code: "",
    error: null,
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  useEffect(() => {
    global.tripId = id;
    fetchTripDetails();
    initializeLocationTracking(id);

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: getProgressValue(),
        duration: 800,
        useNativeDriver: false,
      }),
    ]).start();

    const subscription = AppState.addEventListener("change", (nextAppState) =>
      handleAppStateChange(nextAppState, id)
    );

    return () => {
      subscription.remove();
      stopLocationTracking();
    };
  }, [id]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: getProgressValue(),
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [tripDetails]);

  const getProgressValue = () => {
    if (!tripDetails) return 0;
    if (tripDetails.photo && tripDetails.video) return 1;
    if (tripDetails.photo) return 0.66;
    return 0.33;
  };

  const getProgressPercentage = () => {
    return Math.round(getProgressValue() * 100);
  };

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/info?id=${id}`);

      if (response && response.success) {
        setTripDetails(response.trip);
        if (!response.trip?.hydrant?.latitude || !response.trip?.destination?.latitude) {
          Alert.alert(
            "API Error",
            "Location coordinates for hydrant or destination are missing. Please contact support."
          );
          setError("Missing location coordinates from API.");
        }
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

  const checkLocationProximity = async (
    target: { latitude: number; longitude: number },
    targetName: string
  ): Promise<Location.LocationObject | null> => {
    setIsVerifyingLocation(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to verify your position.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude: currentLat, longitude: currentLon } = currentLocation.coords;
      const distance = calculateDistance(currentLat, currentLon, target.latitude, target.longitude);

      if (distance <= GEOFENCE_RADIUS_KM) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return currentLocation;
      } else {
        Alert.alert(
          "Location Not Correct",
          `You must be within 70 meters of the ${targetName} to perform this action. You are currently ~${(
            distance * 1000
          ).toFixed(0)} meters away.`
        );
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return null;
      }
    } catch (error) {
      console.error("Error checking location proximity:", error);
      Alert.alert("Location Error", "Could not verify your current location. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return null;
    } finally {
      setIsVerifyingLocation(false);
    }
  };

  const handleOpenLocation = async (latitude: number, longitude: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const handleCall = async (phoneNumber: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleGoBack = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(root)/(tabs)/home");
  };

  const handleReachedHydrant = async (photoUrl?: string) => {
    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/reached-hydrant?id=${id}`, {
        method: "POST",
        body: JSON.stringify({ photoUrl }),
      });
      if (response.success) {
        Alert.alert("Success", "Hydrant reached status updated");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchTripDetails();
      } else {
        throw new Error(response.error || "Failed to update hydrant status");
      }
    } catch (error) {
      console.error("Error updating trip status:", error);
      Alert.alert("Error", "Failed to update hydrant status. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploadingImage(false);
    }
  };

  const pickImageFromCamera = async () => {
    if (!tripDetails) return;

    const location = await checkLocationProximity(tripDetails.hydrant, "hydrant");
    if (!location) return;

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setImageToStamp({ asset: result.assets[0], location: location });
      }
    }
  };

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
        type: "image/jpeg",
      };

      const link = await uploadToCloudinary(stampedAsset);
      console.log("Uploaded stamped image link =>", link);

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
    setAppState(nextAppState);

    if (appState.match(/inactive|background/) && nextAppState === "active") {
      console.log("App has moved to the foreground, ensuring location tracking is active.");
      initializeLocationTracking(tripId);
    } else if (appState === "active" && nextAppState.match(/inactive|background/)) {
      console.log("App has moved to the background, continuing location tracking.");
    }
  };

  const initializeLocationTracking = async (tripId: string) => {
    const success = await setupLocationTracking(tripId);
    setHasLocationPermission(success);
    if (!success) {
      Alert.alert(
        "Permission Required",
        "This app needs location permissions to track your trip, including when the app is in the background."
      );
    }
    setTrackingStatus(success);
  };

  useEffect(() => {
    const updateTrackingStatus = async () => {
      const status = await checkTrackingStatus();
      setTrackingStatus(status);
    };
    updateTrackingStatus();
  }, []);

  const pickVideoFromCamera = async () => {
    if (!tripDetails) return;

    const location = await checkLocationProximity(tripDetails.destination, "destination");
    if (!location) return;

    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.granted) {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 1,
          videoMaxDuration: 15,
        });

        if (!result.canceled) {
          setUploadingVideo(true);
          const videoUrl = await uploadToCloudinary(result.assets[0]);

          const response = await fetchAPI(
            `${process.env.EXPO_PUBLIC_API_URL}/trip/water-delivered?id=${id}`,
            {
              method: "POST",
              body: JSON.stringify({ videoUrl }),
            }
          );

          if (response.success) {
            Alert.alert("Success", "Water supply video uploaded successfully");
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchTripDetails();
          } else {
            throw new Error(response.error || "Failed to upload video");
          }
        }
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      Alert.alert("Error", "Failed to upload video. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSendOTP = async () => {
    if (!tripDetails) return;

    try {
      setIsLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: tripDetails?.customer.contactNumber }),
      });

      if (response.success) {
        setVerificationId(response.verificationId);
        setVerification({ ...verification, state: "pending" });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(response.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      Alert.alert("Error", "Failed to send OTP. Please try again.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!verificationId) {
      Alert.alert("Error", "OTP verification ID not found. Please request a new OTP.");
      return;
    }

    if (!verification.code || verification.code.length !== 4) {
      Alert.alert("Error", "Please enter a valid 4-digit OTP.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
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
      });

      if (response.success) {
        setVerification({ ...verification, state: "success" });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        fetchTripDetails();
        setShowSuccessModal(true);
        stopLocationTracking();
      } else {
        throw new Error(response.error || "Failed to verify OTP");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      setVerification({ ...verification, state: "error", error: error.message });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  // Progress Step Component
  const ProgressStep = ({
    number,
    title,
    completed,
    active,
  }: {
    number: number;
    title: string;
    completed: boolean;
    active: boolean;
  }) => (
    <View className="items-center flex-1">
      <View
        className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${
          completed ? "bg-green-500" : active ? "bg-blue-600" : "bg-gray-300"
        }`}
        style={{
          shadowColor: completed ? "#10B981" : active ? "#3B82F6" : "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: completed || active ? 0.4 : 0,
          shadowRadius: 4,
          elevation: completed || active ? 4 : 0,
        }}
      >
        {completed ? (
          <Ionicons name="checkmark" size={24} color="#fff" />
        ) : (
          <Text className="text-white font-JakartaBold">{number}</Text>
        )}
      </View>
      <Text
        className={`text-xs text-center font-Jakarta ${
          completed || active ? "text-gray-900 font-JakartaSemiBold" : "text-gray-500"
        }`}
      >
        {title}
      </Text>
    </View>
  );

  // Info Card Component
  const InfoCard = ({
    icon,
    title,
    content,
    onPress,
    iconColor = "#3B82F6",
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    content: string;
    onPress?: () => void;
    iconColor?: string;
  }) => (
    <View
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="w-12 h-12 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${iconColor}15` }}
        >
          <Ionicons name={icon} size={24} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text className="text-xs text-gray-500 font-Jakarta mb-1">{title}</Text>
          <Text className="text-sm text-gray-900 font-JakartaSemiBold">{content}</Text>
        </View>
        {onPress && (
          <TouchableOpacity
            onPress={onPress}
            className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center ml-2"
          >
            <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text className="text-gray-600 font-Jakarta mt-4">Loading trip details...</Text>
      </SafeAreaView>
    );
  }

  if (error || !tripDetails) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center px-6">
        <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
          <Ionicons name="alert-circle" size={40} color="#EF4444" />
        </View>
        <Text className="text-red-600 font-JakartaBold text-lg mb-2">Error Loading Trip</Text>
        <Text className="text-gray-600 font-Jakarta text-center mb-6">{error || "No trip details found"}</Text>
        <CustomButton title="Retry" onPress={fetchTripDetails} className="bg-blue-600" />
        <CustomButton
          title="Go Back"
          onPress={handleGoBack}
          className="bg-gray-200 mt-3"
          textVariant="secondary"
        />
      </SafeAreaView>
    );
  }

  const getHydrantButtonText = () => {
    if (isVerifyingLocation) return "VERIFYING LOCATION...";
    if (uploadingImage) return "UPLOADING...";
    return "CAPTURE AT HYDRANT";
  };

  const getVideoUploadButtonText = () => {
    if (isVerifyingLocation) return "VERIFYING LOCATION...";
    if (uploadingVideo) return "UPLOADING...";
    return "RECORD WATER SUPPLY";
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Gradient Header */}
      <View
        className="px-5 pt-4 pb-6"
        style={{
          backgroundColor: '#1E40AF',
        }}
      >
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            onPress={handleGoBack}
            className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-2xl font-JakartaBold">Trip In Progress</Text>
            <Text className="text-blue-200 text-sm font-Jakarta mt-1">
              Booking #{tripDetails.booking.id.slice(-8).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View className="bg-white/20 rounded-full h-2 overflow-hidden mb-2">
          <Animated.View
            style={{
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
              height: "100%",
              backgroundColor: "#10B981",
            }}
          />
        </View>
        <Text className="text-white text-xs font-JakartaSemiBold text-right">
          {getProgressPercentage()}% Complete
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        <Animated.View style={{ opacity: fadeAnim }} className="px-5 py-4">
          {/* Progress Steps */}
          <View
            className="bg-white rounded-2xl p-5 mb-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center mb-6">
              <ProgressStep number={1} title="Start Trip" completed={true} active={false} />
              <View className="flex-1 h-0.5 bg-gray-300 mx-2" />
              <ProgressStep
                number={2}
                title="At Hydrant"
                completed={!!tripDetails.photo}
                active={!tripDetails.photo}
              />
              <View className="flex-1 h-0.5 bg-gray-300 mx-2" />
              <ProgressStep
                number={3}
                title="Delivered"
                completed={!!tripDetails.video}
                active={!!tripDetails.photo && !tripDetails.video}
              />
            </View>

            {/* Current Step Info */}
            <View className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <View className="flex-row items-center mb-2">
                <Ionicons name="information-circle" size={20} color="#3B82F6" />
                <Text className="text-blue-900 font-JakartaSemiBold ml-2">Next Step</Text>
              </View>
              <Text className="text-blue-700 text-sm font-Jakarta">
                {!tripDetails.photo
                  ? "Navigate to hydrant and capture photo when you arrive"
                  : !tripDetails.video
                  ? "Deliver water and record a video at destination"
                  : "Complete trip verification with customer OTP"}
              </Text>
            </View>
          </View>

          {/* Trip Stats */}
          <View className="flex-row mb-4">
            <View
              className="flex-1 bg-white rounded-2xl p-4 mr-2 items-center"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mb-2">
                <Ionicons name="navigate" size={24} color="#8B5CF6" />
              </View>
              <Text className="text-2xl font-JakartaBold text-gray-900">
                {tripDetails?.distance !== null ? tripDetails.distance.toFixed(2) : "--"}
              </Text>
              <Text className="text-xs text-gray-500 font-Jakarta">km traveled</Text>
            </View>
            <View
              className="flex-1 bg-white rounded-2xl p-4 ml-2 items-center"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View className="w-12 h-12 bg-green-100 rounded-full items-center justify-center mb-2">
                <Ionicons name="pulse" size={24} color="#10B981" />
              </View>
              <Text className="text-2xl font-JakartaBold text-gray-900">
                {trackingStatus ? "Active" : "Inactive"}
              </Text>
              <Text className="text-xs text-gray-500 font-Jakarta">GPS Tracking</Text>
            </View>
          </View>

          {/* Locations Section */}
          <View className="mb-4">
            <Text className="text-lg font-JakartaBold text-gray-900 mb-3">Route Details</Text>

            {/* Hydrant */}
            <View
              className="bg-white rounded-2xl p-4 mb-3"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View className="flex-row items-start mb-3">
                <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="water" size={22} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 font-Jakarta mb-1">Pickup Location</Text>
                  <Text className="text-base text-gray-900 font-JakartaBold mb-1">
                    {tripDetails.hydrant.name}
                  </Text>
                  <Text className="text-sm text-gray-600 font-Jakarta">{tripDetails.hydrant.address}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() =>
                  handleOpenLocation(tripDetails.hydrant.latitude, tripDetails.hydrant.longitude)
                }
                className="bg-blue-600 py-3 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text className="text-white font-JakartaSemiBold ml-2">Navigate to Hydrant</Text>
              </TouchableOpacity>
            </View>

            {/* Destination */}
            <View
              className="bg-white rounded-2xl p-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View className="flex-row items-start mb-3">
                <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="location" size={22} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 font-Jakarta mb-1">Delivery Location</Text>
                  <Text className="text-base text-gray-900 font-JakartaBold mb-1">
                    {tripDetails.destination.name}
                  </Text>
                  <Text className="text-sm text-gray-600 font-Jakarta">
                    {tripDetails.destination.address}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() =>
                  handleOpenLocation(tripDetails.destination.latitude, tripDetails.destination.longitude)
                }
                className="bg-green-600 py-3 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="navigate" size={18} color="#fff" />
                <Text className="text-white font-JakartaSemiBold ml-2">Navigate to Destination</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Customer Info */}
          <View className="mb-4">
            <Text className="text-lg font-JakartaBold text-gray-900 mb-3">Customer Details</Text>
            <View
              className="bg-white rounded-2xl p-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.05,
                shadowRadius: 3,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center mb-3 pb-3 border-b border-gray-100">
                <View className="w-12 h-12 bg-purple-100 rounded-full items-center justify-center mr-3">
                  <Ionicons name="person" size={24} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 font-Jakarta">Customer Name</Text>
                  <Text className="text-base text-gray-900 font-JakartaSemiBold">
                    {tripDetails.customer.name}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleCall(tripDetails.customer.contactNumber)}
                className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl"
              >
                <View className="flex-row items-center flex-1">
                  <Ionicons name="call" size={20} color="#3B82F6" />
                  <Text className="text-blue-600 font-JakartaSemiBold ml-2">
                    {tripDetails.customer.contactNumber}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View
        className="absolute bottom-0 left-0 right-0 bg-white pt-4 pb-6 px-5 border-t border-gray-100"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 10,
        }}
      >
        {!tripDetails.photo ? (
          <TouchableOpacity
            className={`py-4 rounded-2xl flex-row items-center justify-center ${
              uploadingImage || isVerifyingLocation ? "bg-gray-400" : "bg-blue-600"
            }`}
            onPress={pickImageFromCamera}
            disabled={uploadingImage || isVerifyingLocation}
            style={{
              shadowColor: "#3B82F6",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: uploadingImage || isVerifyingLocation ? 0 : 0.3,
              shadowRadius: 8,
              elevation: uploadingImage || isVerifyingLocation ? 0 : 5,
            }}
          >
            {uploadingImage || isVerifyingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={24} color="#fff" />
            )}
            <Text className="text-white font-JakartaBold text-base ml-2">{getHydrantButtonText()}</Text>
          </TouchableOpacity>
        ) : (
          <View>
            {!tripDetails.video ? (
              <TouchableOpacity
                className={`py-4 rounded-2xl flex-row items-center justify-center ${
                  uploadingVideo || isVerifyingLocation ? "bg-gray-400" : "bg-green-600"
                }`}
                onPress={pickVideoFromCamera}
                disabled={uploadingVideo || isVerifyingLocation}
                style={{
                  shadowColor: "#10B981",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: uploadingVideo || isVerifyingLocation ? 0 : 0.3,
                  shadowRadius: 8,
                  elevation: uploadingVideo || isVerifyingLocation ? 0 : 5,
                }}
              >
                {uploadingVideo || isVerifyingLocation ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="videocam" size={24} color="#fff" />
                )}
                <Text className="text-white font-JakartaBold text-base ml-2">
                  {getVideoUploadButtonText()}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className={`py-4 rounded-2xl flex-row items-center justify-center ${
                  isLoading ? "bg-gray-400" : "bg-orange-600"
                }`}
                onPress={handleSendOTP}
                disabled={isLoading}
                style={{
                  shadowColor: "#EA580C",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: isLoading ? 0 : 0.3,
                  shadowRadius: 8,
                  elevation: isLoading ? 0 : 5,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="shield-checkmark" size={24} color="#fff" />
                )}
                <Text className="text-white font-JakartaBold text-base ml-2">
                  {isLoading ? "SENDING..." : "VERIFY WITH CUSTOMER OTP"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Success Indicators */}
            {tripDetails.photo && (
              <View className="flex-row items-center justify-center bg-green-50 py-2 px-4 rounded-xl mt-3">
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text className="text-green-700 font-JakartaSemiBold ml-2 text-sm">
                  {tripDetails.video ? "Photo & Video Uploaded" : "Photo Uploaded"}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Image Stamping Modal */}
      <ReactNativeModal
        isVisible={imageToStamp !== null}
        animationIn="zoomIn"
        animationOut="zoomOut"
        backdropOpacity={0.8}
        useNativeDriver={true}
      >
        <View className="bg-white rounded-3xl p-5 overflow-hidden">
          <Text className="text-2xl font-JakartaBold text-gray-900 mb-4 text-center">
            Confirm Location Photo
          </Text>

          <ViewShot ref={viewShotRef} options={{ format: "jpg", quality: 0.9 }}>
            <View
              style={{
                width: "100%",
                aspectRatio: 4 / 3,
                backgroundColor: "#000",
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
              }}
            >
              <Image
                source={{ uri: imageToStamp?.asset.uri }}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                }}
                resizeMode="cover"
              />

              {/* Location Stamp Overlay */}
              <View
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  backgroundColor: "rgba(0, 0, 0, 0.75)",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                }}
              >
                <View className="flex-row items-center mb-1">
                  <Ionicons name="location" size={14} color="#3B82F6" />
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600", marginLeft: 4 }}>
                    GPS Coordinates
                  </Text>
                </View>
                <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>
                  {imageToStamp?.location.coords.latitude.toFixed(6)}° N
                </Text>
                <Text style={{ color: "white", fontSize: 13, fontWeight: "600" }}>
                  {imageToStamp?.location.coords.longitude.toFixed(6)}° E
                </Text>
                <Text style={{ color: "#93C5FD", fontSize: 11, marginTop: 6 }}>
                  {new Date(imageToStamp?.location.timestamp || Date.now()).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </Text>
              </View>
            </View>
          </ViewShot>

          {uploadingImage && (
            <View className="items-center my-4">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-600 font-Jakarta mt-2">Uploading image...</Text>
            </View>
          )}

          <View className="flex-row gap-3 mt-5">
            <CustomButton
              title="Retake"
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setImageToStamp(null);
              }}
              className="bg-gray-200 flex-1"
              textVariant="secondary"
              disabled={uploadingImage}
            />
            <CustomButton
              title={uploadingImage ? "Uploading..." : "Confirm & Upload"}
              onPress={handleConfirmAndUploadImage}
              className="bg-blue-600 flex-1"
              disabled={uploadingImage}
              IconLeft={() =>
                uploadingImage ? null : <Ionicons name="cloud-upload" size={20} color="#fff" />
              }
            />
          </View>
        </View>
      </ReactNativeModal>

      {/* OTP Verification Modal */}
      <ReactNativeModal
        isVisible={verification.state === "pending"}
        onModalHide={() => {
          if (verification.state === "success") {
            setShowSuccessModal(true);
          }
        }}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.7}
        useNativeDriver={true}
      >
        <View className="bg-white px-6 py-8 rounded-3xl">
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-orange-100 rounded-full items-center justify-center mb-4">
              <Ionicons name="shield-checkmark" size={32} color="#EA580C" />
            </View>
            <Text className="font-JakartaBold text-2xl text-gray-900 text-center">
              Customer Verification
            </Text>
            <Text className="font-Jakarta text-gray-600 text-center mt-2 leading-5">
              Enter the 4-digit OTP sent to {tripDetails.customer.contactNumber}
            </Text>
          </View>

          <InputField
            label="Verification Code"
            icon={icons.lock}
            placeholder="0000"
            value={verification.code}
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={(code) => setVerification({ ...verification, code, error: null })}
          />

          {verification.error && (
            <View className="bg-red-50 p-3 rounded-xl mt-3 flex-row items-center">
              <Ionicons name="alert-circle" size={20} color="#EF4444" />
              <Text className="text-red-600 text-sm ml-2 flex-1 font-Jakarta">{verification.error}</Text>
            </View>
          )}

          <CustomButton
            title={isLoading ? "Verifying..." : "Verify & Complete Trip"}
            onPress={handleVerifyOTP}
            className="mt-6 bg-orange-600"
            disabled={isLoading || verification.code.length !== 4}
            IconLeft={() =>
              isLoading ? <ActivityIndicator size="small" color="#fff" /> : null
            }
          />
        </View>
      </ReactNativeModal>

      {/* Success Modal */}
      <ReactNativeModal
        isVisible={showSuccessModal}
        animationIn="zoomIn"
        animationOut="zoomOut"
        backdropOpacity={0.8}
        useNativeDriver={true}
      >
        <View className="bg-white px-8 py-10 rounded-3xl items-center">
          <View className="w-28 h-28 bg-green-100 rounded-full items-center justify-center mb-6">
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
          </View>
          <Text className="font-JakartaBold text-3xl text-gray-900 mb-3 text-center">
            Trip Completed!
          </Text>
          <Text className="font-Jakarta text-gray-600 text-center mb-8 leading-6">
            Your water delivery has been successfully completed and verified.
          </Text>
          <CustomButton
            title="Back to Home"
            onPress={async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowSuccessModal(false);
              router.push(`/(root)/(tabs)/home`);
            }}
            className="w-full bg-green-600"
            IconRight={() => <Ionicons name="arrow-forward" size={20} color="#fff" />}
          />
        </View>
      </ReactNativeModal>
    </SafeAreaView>
  );
}
