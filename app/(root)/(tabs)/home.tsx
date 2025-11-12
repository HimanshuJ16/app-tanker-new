import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl, 
  Image,
  Animated,
  ActivityIndicator,
  Dimensions,
  Platform
} from 'react-native';
import { fetchAPI } from '@/lib/fetch';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { icons, images } from "@/constants";
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface Booking {
  bookingId: string;
  journeyDate: string;
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
  status: string;
  trip: {
    tripId: string;
    status: string;
  };
}

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'accepted':
        return { color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle', label: 'Accepted' };
      case 'ongoing':
      case 'pickup':
        return { color: '#3B82F6', bg: '#DBEAFE', icon: 'time', label: 'In Progress' };
      case 'completed':
        return { color: '#8B5CF6', bg: '#EDE9FE', icon: 'checkmark-done-circle', label: 'Completed' };
      case 'rejected':
        return { color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle', label: 'Rejected' };
      case 'delivered':
        return { color: '#059669', bg: '#D1FAE5', icon: 'car', label: 'Delivered' };
      default:
        return { color: '#F59E0B', bg: '#FEF3C7', icon: 'alert-circle', label: 'Pending' };
    }
  };

  const config = getStatusConfig();

  return (
    <View 
      style={{ backgroundColor: config.bg }}
      className="flex-row items-center px-3 py-1.5 rounded-full"
    >
      <Ionicons name={config.icon as any} size={14} color={config.color} />
      <Text style={{ color: config.color }} className="text-xs font-JakartaSemiBold ml-1">
        {config.label}
      </Text>
    </View>
  );
};

// Info Row Component
const InfoRow = ({ 
  icon, 
  title, 
  subtitle, 
  accent 
}: { 
  icon: string; 
  title: string; 
  subtitle: string;
  accent?: string;
}) => (
  <View className="flex-row items-start mb-3">
    <View 
      style={{ backgroundColor: accent ? `${accent}15` : '#F3F4F6' }}
      className="w-10 h-10 rounded-full items-center justify-center mr-3"
    >
      <Ionicons 
        name={icon as any} 
        size={20} 
        color={accent || '#6B7280'} 
      />
    </View>
    <View className="flex-1">
      <Text className="text-xs text-gray-500 font-Jakarta mb-0.5">{title}</Text>
      <Text className="text-sm text-gray-900 font-JakartaSemiBold">{subtitle}</Text>
    </View>
  </View>
);

const Home = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTripOngoing, setIsTripOngoing] = useState(false);
  const [isTripAccepted, setIsTripAccepted] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchBookings = async () => {
    try {
      const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (!vehicleInfo) {
        console.error('No vehicle info found');
        return;
      }
      const { vehicleId } = JSON.parse(vehicleInfo);
      const response = await fetchAPI(
        `${process.env.EXPO_PUBLIC_API_URL}/bookings?id=${vehicleId}`
      );
      
      if (response.success) {
        const filteredBookings = response.bookings.filter(
          (booking: Booking) => booking.status !== 'cancelled'
        );
        setBookings(filteredBookings);
        
        // Animate cards in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      } else {
        console.error('Failed to fetch bookings:', response.error);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to fetch bookings. Please try again.');
    } finally {
      setInitialLoad(false);
    }
  };
  
  useEffect(() => {
    onRefresh();
  }, []);

  useEffect(() => {
    const ongoingTripExists = bookings.some(
      (b) => b.trip && (b.trip.status === 'ongoing' || b.trip.status === 'pickup')
    );
    setIsTripOngoing(ongoingTripExists);

    const acceptedTripExists = bookings.some(
      (b) => b.trip && b.trip.status === 'accepted'
    );
    setIsTripAccepted(acceptedTripExists);
  }, [bookings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const handleAccept = async (bookingId: string) => {
    if (isTripOngoing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Trip Already Active', 
        'You must complete your current trip before accepting a new one.'
      );
      return;
    }
    if (isTripAccepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Trip Already Accepted', 
        'You must start or complete your currently accepted trip before accepting a new one.'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      setLoading(true);
      const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (!vehicleInfo) {
        throw new Error('No vehicle info found');
      }
      const { vehicleId } = JSON.parse(vehicleInfo);

      const response = await fetchAPI(
        `${process.env.EXPO_PUBLIC_API_URL}/trip/actions?id=${bookingId}`,
        {
          method: 'POST',
          body: JSON.stringify({ action: 'accept', vehicleId })
        }
      );

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Booking accepted successfully');
        onRefresh();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', response.error || 'Failed to accept booking');
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (isTripOngoing || isTripAccepted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'Trip Active', 
        'You cannot reject bookings while a trip is active or accepted.'
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Confirm Rejection',
      'Are you sure you want to reject this booking?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
              if (!vehicleInfo) {
                throw new Error('No vehicle info found');
              }
              const { vehicleId } = JSON.parse(vehicleInfo);

              const response = await fetchAPI(
                `${process.env.EXPO_PUBLIC_API_URL}/trip/actions?id=${bookingId}`,
                {
                  method: 'POST',
                  body: JSON.stringify({ action: 'reject', vehicleId })
                }
              );

              if (response.success) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'Booking rejected successfully');
                onRefresh();
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Error', response.error || 'Failed to reject booking');
              }
            } catch (error) {
              console.error('Error rejecting booking:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to reject booking. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleStartTrip = async (tripId: string) => {
    if (isTripOngoing) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Trip Already Active', 'You already have an ongoing trip.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      setLoading(true);
      const response = await fetchAPI(
        `${process.env.EXPO_PUBLIC_API_URL}/trip/start?id=${tripId}`,
        {
          method: 'POST'
        }
      );

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/trip/${tripId}` as any);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Error', response.error || 'Failed to start trip');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to start trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrip = async (tripId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace(`/trip/${tripId}` as any);
  };

  const renderBookingItem = ({ item, index }: { item: Booking; index: number }) => {
    const cardAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 100,
        useNativeDriver: true,
      }).start();
    }, []);

    return (
      <Animated.View
        style={{
          opacity: cardAnim,
          transform: [
            {
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              }),
            },
          ],
        }}
        className="bg-white rounded-2xl p-5 mb-4 shadow-lg"
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={`Booking ${item.bookingId}`}
      >
        {/* Header with ID and Status */}
        <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-100">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-Jakarta mb-1">Booking ID</Text>
            <Text className="text-base font-JakartaBold text-gray-900">
              #{item.bookingId}
            </Text>
          </View>
          <StatusBadge status={item.trip?.status || 'pending'} />
        </View>

        {/* Journey Date */}
        <View className="bg-blue-50 rounded-xl p-3 mb-4 flex-row items-center">
          <Ionicons name="calendar" size={18} color="#3B82F6" />
          <View className="ml-3">
            <Text className="text-xs text-gray-600 font-Jakarta">Journey Date</Text>
            <Text className="text-sm font-JakartaSemiBold text-gray-900">
              {new Date(item.journeyDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </Text>
          </View>
        </View>

        {/* Route Information */}
        <View className="mb-4">
          <InfoRow
            icon="water"
            title="Pickup Location"
            subtitle={item.hydrant.name}
            accent="#3B82F6"
          />
          <View className="ml-5 mb-2">
            <Text className="text-xs text-gray-500 font-Jakarta">
              {item.hydrant.address}
            </Text>
          </View>

          <View className="flex-row items-center ml-5 mb-3">
            <View className="w-0.5 h-6 bg-gray-300" />
          </View>

          <InfoRow
            icon="location"
            title="Delivery Location"
            subtitle={item.destination.name}
            accent="#10B981"
          />
          <View className="ml-5 mb-4">
            <Text className="text-xs text-gray-500 font-Jakarta">
              {item.destination.address}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <Text className="text-xs text-gray-600 font-JakartaSemiBold mb-2 uppercase tracking-wide">
            Customer Details
          </Text>
          <View className="flex-row items-center mb-2">
            <Ionicons name="person" size={16} color="#6B7280" />
            <Text className="text-sm font-JakartaSemiBold text-gray-900 ml-2">
              {item.customer.name}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Ionicons name="call" size={16} color="#6B7280" />
            <Text className="text-sm text-gray-700 font-Jakarta ml-2">
              {item.customer.contactNumber}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        {!item.trip.tripId && (
          <View className="flex-row space-x-3">
            <TouchableOpacity
              className={`flex-1 py-3.5 rounded-xl items-center justify-center mr-2 ${
                isTripOngoing || isTripAccepted ? 'bg-gray-300' : 'bg-green-500'
              }`}
              onPress={() => handleAccept(item.bookingId)}
              disabled={loading || isTripOngoing || isTripAccepted}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Accept booking"
            >
              <View className="flex-row items-center">
                <Ionicons 
                  name="checkmark-circle" 
                  size={20} 
                  color="white" 
                />
                <Text className="text-white font-JakartaBold ml-2">Accept</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-3.5 rounded-xl items-center justify-center ml-2 ${
                isTripOngoing || isTripAccepted ? 'bg-gray-300' : 'bg-red-500'
              }`}
              onPress={() => handleReject(item.bookingId)}
              disabled={loading || isTripOngoing || isTripAccepted}
              activeOpacity={0.7}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Reject booking"
            >
              <View className="flex-row items-center">
                <Ionicons 
                  name="close-circle" 
                  size={20} 
                  color="white" 
                />
                <Text className="text-white font-JakartaBold ml-2">Reject</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {item.trip.tripId && item.trip.status === 'accepted' && (
          <TouchableOpacity
            className={`py-4 rounded-xl items-center ${
              isTripOngoing ? 'bg-gray-300' : 'bg-gradient-to-r from-green-500 to-emerald-600'
            }`}
            style={{
              backgroundColor: isTripOngoing ? '#D1D5DB' : '#10B981',
            }}
            onPress={() => handleStartTrip(item.trip.tripId!)}
            disabled={loading || isTripOngoing}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons name="play-circle" size={22} color="white" />
              <Text className="text-white font-JakartaBold text-base ml-2">
                Start Trip
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {item.trip.tripId && 
         (item.trip.status === 'ongoing' || 
          item.trip.status === 'pickup' || 
          item.trip.status === 'delivered') && (
          <TouchableOpacity
            className="bg-blue-600 py-4 rounded-xl items-center"
            onPress={() => handleTrip(item.trip.tripId!)}
            activeOpacity={0.7}
          >
            <View className="flex-row items-center">
              <Ionicons name="navigate-circle" size={22} color="white" />
              <Text className="text-white font-JakartaBold text-base ml-2">
                View Trip Details
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {item.trip.tripId && item.trip.status === 'completed' && (
          <View className="bg-purple-100 py-4 rounded-xl items-center border border-purple-200">
            <View className="flex-row items-center">
              <Ionicons name="checkmark-done-circle" size={22} color="#8B5CF6" />
              <Text className="text-purple-700 font-JakartaBold text-base ml-2">
                Trip Completed
              </Text>
            </View>
          </View>
        )}

        {item.trip.status === 'rejected' && (
          <View className="bg-red-100 py-4 rounded-xl items-center border border-red-200">
            <View className="flex-row items-center">
              <Ionicons name="close-circle" size={22} color="#EF4444" />
              <Text className="text-red-700 font-JakartaBold text-base ml-2">
                Booking Rejected
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  // Loading State
  if (initialLoad) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text className="text-gray-600 font-Jakarta mt-4">Loading bookings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-2xl font-JakartaBold text-gray-900">
              My Trips
            </Text>
            <Text className="text-sm font-Jakarta text-gray-500 mt-1">
              {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} available
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRefresh}
            className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center"
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {/* Active Status Indicator */}
        {(isTripOngoing || isTripAccepted) && (
          <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3 flex-row items-center">
            <Ionicons name="information-circle" size={20} color="#F59E0B" />
            <Text className="text-amber-800 text-xs font-JakartaSemiBold ml-2 flex-1">
              {isTripOngoing 
                ? 'You have an ongoing trip' 
                : 'Complete your accepted trip to accept new bookings'}
            </Text>
          </View>
        )}
      </View>

      {/* List Content */}
      {bookings.length === 0 ? (
        <Animated.View 
          style={{ opacity: fadeAnim }}
          className="flex-1 justify-center items-center px-8"
        >
          <Image
            source={images.noResult}
            style={{ width: 240, height: 240 }}
            resizeMode="contain"
          />
          <Text className="text-gray-900 text-xl font-JakartaBold mt-6 text-center">
            No Bookings Found
          </Text>
          <Text className="text-gray-500 text-sm font-Jakarta mt-2 text-center">
            New booking requests will appear here. Pull down to refresh.
          </Text>
          <TouchableOpacity
            onPress={onRefresh}
            className="bg-blue-600 px-6 py-3 rounded-xl mt-6"
            activeOpacity={0.7}
          >
            <Text className="text-white font-JakartaSemiBold">Refresh</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.bookingId}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Platform.OS === 'ios' ? 90 : 80,
          }}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={5}
          windowSize={10}
          initialNumToRender={3}
        />
      )}

      {/* Loading Overlay */}
      {loading && (
        <View className="absolute inset-0 bg-black/20 items-center justify-center">
          <View className="bg-white rounded-2xl p-6 items-center">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-700 font-JakartaSemiBold mt-3">Processing...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

export default Home;
