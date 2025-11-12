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
import * as Haptics from 'expo-haptics';

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

// Reusable Info Card Component
const InfoCard = ({ 
  title, 
  children, 
  icon,
  iconColor = "bg-blue-500"
}: { 
  title: string; 
  children: React.ReactNode;
  icon?: string;
  iconColor?: string;
}) => (
  <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
    <View className="flex-row items-center mb-3">
      {icon && (
        <View className={`w-10 h-10 ${iconColor} rounded-full items-center justify-center mr-3`}>
          <Text className="text-xl">{icon}</Text>
        </View>
      )}
      <Text className="text-lg font-JakartaBold text-gray-800">{title}</Text>
    </View>
    {children}
  </View>
);

// Reusable Detail Row Component
const DetailRow = ({ 
  label, 
  value, 
  action, 
  actionIcon 
}: { 
  label: string; 
  value: string; 
  action?: () => void;
  actionIcon?: string;
}) => (
  <View className="mb-3">
    <Text className="text-xs text-gray-500 font-JakartaMedium mb-1">{label}</Text>
    <View className="flex-row items-center justify-between">
      <Text className="text-base text-gray-800 font-JakartaSemiBold flex-1">{value}</Text>
      {action && (
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            action();
          }}
          className="ml-3 w-10 h-10 bg-blue-100 rounded-full items-center justify-center"
        >
          <Ionicons name={actionIcon as any || "location"} size={20} color="#3b82f6" />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusColor = () => {
    switch(status.toLowerCase()) {
      case 'ongoing': return 'bg-green-100 text-green-700';
      case 'pickup': return 'bg-amber-100 text-amber-700';
      case 'delivered': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-purple-100 text-purple-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <View className={`${getStatusColor().split(' ')[0]} px-4 py-2 rounded-full self-start`}>
      <Text className={`${getStatusColor().split(' ')[1]} font-JakartaBold text-sm`}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
};

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
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [verification, setVerification] = useState({
    state: "idle",
    code: "",
    error: null,
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  // Pulse animation for tracking indicator
  useEffect(() => {
    if (trackingStatus) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [trackingStatus]);

  useEffect(() => {
    global.tripId = id;
    fetchTripDetails();
    initializeLocationTracking(id);

    const subscription = AppState.addEventListener("change", (nextAppState) => handleAppStateChange(nextAppState, id));

    return () => {
      subscription.remove();
      stopLocationTracking();
    };
  }, [id]);

  const fetchTripDetails = async () => {
    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/info?id=${id}`);

      if (response && response.success) {
        setTripDetails(response.trip);
        if (!response.trip?.hydrant?.latitude || !response.trip?.destination?.latitude) {
          Alert.alert("API Error", "Location coordinates for hydrant or destination are missing. Please contact support.");
          setError("Missing location coordinates from API.");
        }
      } else {
        throw new Error(response?.error || "Failed to fetch trip details");
      }
    } catch (error) {
      console.error("Error fetching trip details:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to verify your position.");
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude: currentLat, longitude: currentLon } = currentLocation.coords;
      const distance = calculateDistance(
        currentLat,
        currentLon,
        target.latitude,
        target.longitude
      );

      if (distance <= GEOFENCE_RADIUS_KM) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return currentLocation;
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(
          "Location Verification Failed",
          `You must be within 70 meters of the ${targetName} to perform this action.\n\nCurrent distance: ~${(distance * 1000).toFixed(0)} meters`,
          [{ text: "OK" }]
        );
        return null;
      }
    } catch (error) {
      console.error("Error checking location proximity:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Location Error", "Could not verify your current location. Please try again.");
      return null;
    } finally {
      setIsVerifyingLocation(false);
    }
  };

  const handleOpenLocation = (latitude: number, longitude: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url);
  };

  const handleCall = (phoneNumber: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(root)/(tabs)/home");
  };

  const handleReachedHydrant = async (photoUrl?: string) => {
    try {
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/reached-hydrant?id=${id}`, {
        method: "POST",
        body: JSON.stringify({ photoUrl }),
      });
      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Success", "Hydrant reached status updated");
        fetchTripDetails();
      } else {
        throw new Error(response.error || "Failed to update hydrant status");
      }
    } catch (error) {
      console.error("Error updating trip status:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to update hydrant status. Please try again.");
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
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
      console.log("Uploaded stamped image link =>", link);
      await handleReachedHydrant(link);
    } catch (error) {
      console.error("Error capturing or uploading stamped image:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const videoUrl = await uploadToCloudinary(result.assets[0]);

          const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/water-delivered?id=${id}`, {
            method: "POST",
            body: JSON.stringify({ videoUrl }),
          });

          if (response.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Water supply video uploaded successfully");
            fetchTripDetails();
          } else {
            throw new Error(response.error || "Failed to upload video");
          }
        }
      }
    } catch (error) {
      console.error("Error uploading video:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to upload video. Please try again.");
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSendOTP = async () => {
    if (!tripDetails) return;

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: tripDetails?.customer.contactNumber }),
      });

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVerificationId(response.verificationId);
        setVerification({ ...verification, state: "pending" });
      } else {
        throw new Error(response.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Failed to send OTP. Please try again.");
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
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Please enter a valid 4-digit OTP.");
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setVerification({ ...verification, state: "success" });
        fetchTripDetails();
        setShowSuccessModal(true);
        stopLocationTracking();
      } else {
        throw new Error(response.error || "Failed to verify OTP");
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setVerification({ ...verification, state: "error", error: error.message });
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center">
        <View className="bg-white p-8 rounded-3xl shadow-lg items-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text className="text-gray-700 font-JakartaSemiBold mt-4 text-lg">Loading trip details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center px-5">
        <View className="bg-white p-8 rounded-3xl shadow-lg items-center">
          <View className="w-20 h-20 bg-red-100 rounded-full items-center justify-center mb-4">
            <Text className="text-4xl">⚠️</Text>
          </View>
          <Text className="text-red-600 font-JakartaBold text-lg mb-2">Error Occurred</Text>
          <Text className="text-gray-600 font-JakartaMedium text-center mb-6">{error}</Text>
          <CustomButton 
            title="Retry"
            onPress={() => fetchTripDetails()}
            className="bg-blue-600"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!tripDetails) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 justify-center items-center px-5">
        <View className="bg-white p-8 rounded-3xl shadow-lg items-center">
          <Text className="text-gray-700 font-JakartaSemiBold text-center mb-6">
            No trip details found for trip ID: {id}
          </Text>
          <CustomButton 
            title="Go Back to Home"
            onPress={handleGoBack}
            className="bg-blue-600"
          />
        </View>
      </SafeAreaView>
    );
  }

  const getHydrantButtonText = () => {
    if (isVerifyingLocation) return "📍 Verifying Location...";
    if (uploadingImage) return "☁️ Uploading Image...";
    return "📸 Reached Hydrant";
  };

  const getVideoUploadButtonText = () => {
    if (isVerifyingLocation) return "📍 Verifying Location...";
    if (uploadingVideo) return "☁️ Uploading Video...";
    return "🎥 Upload Water Supply Video";
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex-row items-center justify-between shadow-lg">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity 
            onPress={handleGoBack} 
            className="mr-4 w-10 h-10 bg-white/20 rounded-full items-center justify-center"
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-2xl font-JakartaBold">Trip Details</Text>
            <Text className="text-blue-100 text-sm font-JakartaMedium">En-Route</Text>
          </View>
        </View>
        <StatusBadge status={tripDetails.status} />
      </View>

      <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
        {/* Trip Overview Card */}
        <InfoCard title="Trip Overview" icon="📋" iconColor="bg-blue-500">
          <DetailRow label="Booking ID" value={tripDetails.booking.id} />
          <DetailRow 
            label="Journey Date" 
            value={new Date(tripDetails.booking.journeyDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })} 
          />
        </InfoCard>

        {/* Location Tracking Status */}
        <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Animated.View 
                style={{ 
                  transform: [{ scale: pulseAnim }],
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: trackingStatus ? '#10b981' : '#6b7280',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Text className="text-xl">📍</Text>
              </Animated.View>
              <View>
                <Text className="text-lg font-JakartaBold text-gray-800">Live Tracking</Text>
                <Text className="text-sm text-gray-500 font-JakartaMedium">
                  {trackingStatus ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
            <View className={`px-3 py-1 rounded-full ${trackingStatus ? 'bg-green-100' : 'bg-gray-100'}`}>
              <Text className={`text-xs font-JakartaBold ${trackingStatus ? 'text-green-700' : 'text-gray-700'}`}>
                {trackingStatus ? "ON" : "OFF"}
              </Text>
            </View>
          </View>
          
          {/* Distance Traveled */}
          <View className="bg-gradient-to-r from-blue-50 to-blue-100 p-3 rounded-xl">
            <Text className="text-xs text-blue-700 font-JakartaMedium mb-1">Distance Traveled</Text>
            <Text className="text-2xl font-JakartaBold text-blue-900">
              {tripDetails?.distance !== null ? `${tripDetails.distance.toFixed(2)} km` : "Calculating..."}
            </Text>
          </View>
        </View>

        {/* Hydrant Information */}
        <InfoCard title="Pickup Location" icon="🚰" iconColor="bg-teal-500">
          <DetailRow label="Hydrant Name" value={tripDetails.hydrant.name} />
          <DetailRow 
            label="Address" 
            value={tripDetails.hydrant.address}
            action={() => handleOpenLocation(tripDetails.hydrant.latitude, tripDetails.hydrant.longitude)}
            actionIcon="location"
          />
        </InfoCard>

        {/* Destination Information */}
        <InfoCard title="Delivery Location" icon="🏠" iconColor="bg-green-500">
          <DetailRow label="Destination Name" value={tripDetails.destination.name} />
          <DetailRow 
            label="Customer" 
            value={tripDetails.customer.name}
          />
          <DetailRow 
            label="Contact Number" 
            value={tripDetails.customer.contactNumber}
            action={() => handleCall(tripDetails.customer.contactNumber)}
            actionIcon="call"
          />
          <DetailRow 
            label="Address" 
            value={tripDetails.destination.address}
            action={() => handleOpenLocation(tripDetails.destination.latitude, tripDetails.destination.longitude)}
            actionIcon="location"
          />
        </InfoCard>

        {/* Progress Indicators */}
        {(tripDetails.photo || tripDetails.video) && (
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-gray-100">
            <Text className="text-lg font-JakartaBold text-gray-800 mb-4">Trip Progress</Text>
            
            {tripDetails.photo && (
              <View className="flex-row items-center bg-green-50 p-3 rounded-xl mb-3 border border-green-200">
                <View className="w-10 h-10 bg-green-500 rounded-full items-center justify-center mr-3">
                  <Text className="text-xl">✓</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-green-800 font-JakartaBold">Hydrant Photo Uploaded</Text>
                  <Text className="text-green-600 text-xs font-JakartaMedium">Photo verified successfully</Text>
                </View>
              </View>
            )}

            {tripDetails.video && (
              <View className="flex-row items-center bg-blue-50 p-3 rounded-xl border border-blue-200">
                <View className="w-10 h-10 bg-blue-500 rounded-full items-center justify-center mr-3">
                  <Text className="text-xl">✓</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-blue-800 font-JakartaBold">Delivery Video Uploaded</Text>
                  <Text className="text-blue-600 text-xs font-JakartaMedium">Video verified successfully</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Spacer for bottom buttons */}
        <View className="h-24" />
      </ScrollView>

      {/* Action Buttons - Fixed at Bottom */}
      <View className="bg-white px-5 py-4 border-t border-gray-200 shadow-lg">
        {!tripDetails.photo ? (
          <TouchableOpacity
            className={`${
              uploadingImage || isVerifyingLocation ? 'bg-gray-400' : 'bg-teal-600'
            } p-4 rounded-2xl shadow-md`}
            onPress={pickImageFromCamera}
            disabled={uploadingImage || isVerifyingLocation}
            activeOpacity={0.8}
          >
            <Text className="text-white text-center font-JakartaBold text-base">
              {getHydrantButtonText()}
            </Text>
          </TouchableOpacity>
        ) : (
          <View className="space-y-3">
            {!tripDetails.video && (
              <TouchableOpacity
                className={`${
                  uploadingVideo || isVerifyingLocation ? 'bg-gray-400' : 'bg-pink-600'
                } p-4 rounded-2xl shadow-md`}
                onPress={pickVideoFromCamera}
                disabled={uploadingVideo || isVerifyingLocation}
                activeOpacity={0.8}
              >
                <Text className="text-white text-center font-JakartaBold text-base">
                  {getVideoUploadButtonText()}
                </Text>
              </TouchableOpacity>
            )}

            {tripDetails.video && (
              <TouchableOpacity
                className={`${
                  isLoading ? 'bg-gray-400' : 'bg-orange-600'
                } p-4 rounded-2xl shadow-md`}
                onPress={handleSendOTP}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text className="text-white text-center font-JakartaBold text-base">
                  {isLoading ? "📱 Sending OTP..." : "📱 Send OTP for Verification"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Image Stamping Modal */}
      <ReactNativeModal 
        isVisible={imageToStamp !== null}
        animationIn="slideInUp"
        animationOut="slideOutDown"
        backdropOpacity={0.8}
      >
        <View className="bg-white p-5 rounded-3xl">
          <Text className="text-2xl font-JakartaBold mb-4 text-center">Confirm Hydrant Photo</Text>
          
          <ViewShot
            ref={viewShotRef}
            options={{ format: "jpg", quality: 0.9 }}
          >
            <View style={{
              width: '100%',
              height: 400,
              backgroundColor: '#000',
              borderRadius: 16,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <Image
                source={{ uri: imageToStamp?.asset.uri }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="cover"
              />
          
              {/* Location Stamp */}
              <View style={{
                position: 'absolute',
                top: 16,
                left: 16,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.3)',
              }}>
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600' }}>
                  📍 Lat: {imageToStamp?.location.coords.latitude.toFixed(6)}
                </Text>
                <Text style={{ color: 'white', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                  📍 Lon: {imageToStamp?.location.coords.longitude.toFixed(6)}
                </Text>
                <Text style={{ color: 'white', fontSize: 12, marginTop: 6, opacity: 0.9 }}>
                  🕐 {new Date(imageToStamp?.location.timestamp || Date.now())
                    .toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </Text>
              </View>
            </View>
          </ViewShot>
                  
          {/* Buttons */}
          <View className="flex-row gap-3 mt-5">
            <CustomButton
              title="Retake"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setImageToStamp(null);
              }}
              className="bg-gray-400 flex-1"
              disabled={uploadingImage}
            />
            <CustomButton
              title={uploadingImage ? "Uploading..." : "Confirm & Upload"}
              onPress={handleConfirmAndUploadImage}
              className="bg-green-600 flex-1"
              disabled={uploadingImage}
            />
          </View>
          {uploadingImage && (
            <View className="mt-4 items-center">
              <ActivityIndicator size="large" color="#16a34a" />
              <Text className="text-gray-600 font-JakartaMedium mt-2">Please wait...</Text>
            </View>
          )}
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
        backdropOpacity={0.8}
      >
        <View className="bg-white px-7 py-9 rounded-3xl">
          <View className="items-center mb-6">
            <View className="w-20 h-20 bg-orange-100 rounded-full items-center justify-center mb-4">
              <Text className="text-4xl">🔐</Text>
            </View>
            <Text className="font-JakartaBold text-2xl mb-2 text-center">OTP Verification</Text>
            <Text className="font-JakartaMedium text-gray-600 text-center">
              Enter the 4-digit code sent to{'\n'}
              <Text className="font-JakartaBold text-blue-600">{tripDetails.customer.contactNumber}</Text>
            </Text>
          </View>

          <InputField
            label="Verification Code"
            icon={icons.lock}
            placeholder="0000"
            value={verification.code}
            keyboardType="numeric"
            maxLength={4}
            onChangeText={(code) => setVerification({ ...verification, code, error: null })}
            containerStyle="mb-4"
          />

          {verification.error && (
            <View className="bg-red-50 p-3 rounded-xl mb-4 border border-red-200">
              <Text className="text-red-600 text-sm font-JakartaMedium text-center">
                ⚠️ {verification.error}
              </Text>
            </View>
          )}

          <CustomButton
            title={isLoading ? "Verifying..." : "Verify & Complete Trip"}
            onPress={handleVerifyOTP}
            className="bg-orange-600 shadow-lg"
            disabled={isLoading || verification.code.length !== 4}
          />

          <TouchableOpacity 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setVerification({ ...verification, state: "idle" });
            }}
            className="mt-4 p-3"
          >
            <Text className="text-center text-gray-600 font-JakartaMedium">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ReactNativeModal>

      {/* Success Modal */}
      <ReactNativeModal 
        isVisible={showSuccessModal}
        onBackdropPress={() => setShowSuccessModal(false)}
        animationIn="zoomIn"
        animationOut="zoomOut"
      >
        <View className="bg-white px-7 py-9 rounded-3xl items-center">
          <View className="w-24 h-24 bg-green-100 rounded-full items-center justify-center mb-6">
            <Image 
              source={require("../../../assets/images/check.png")} 
              className="w-16 h-16" 
            />
          </View>
          <Text className="font-JakartaBold text-3xl mb-3 text-center">Trip Completed! 🎉</Text>
          <Text className="font-JakartaMedium text-gray-600 text-center mb-8">
            Great job! The trip has been completed successfully.
          </Text>
          <CustomButton 
            title="Back to Home" 
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowSuccessModal(false);
              router.push(`/(root)/(tabs)/home`);
            }} 
            className="w-full bg-green-600"
          />
        </View>
      </ReactNativeModal>
    </SafeAreaView>
  );
}
