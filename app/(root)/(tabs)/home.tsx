import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl, 
  Image,
  ActivityIndicator,
  Pressable 
} from 'react-native';
import { fetchAPI } from '@/lib/fetch';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { icons, images } from "@/constants";
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

const Home = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isTripOngoing, setIsTripOngoing] = useState(false);
  const [isTripAccepted, setIsTripAccepted] = useState(false);

  const fetchBookings = async () => {
    try {
      const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (!vehicleInfo) {
        console.error('No vehicle info found');
        return;
      }
      const { vehicleId } = JSON.parse(vehicleInfo);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/bookings?id=${vehicleId}`);
      
      if (response.success) {
        const filteredBookings = response.bookings.filter(
          (booking: Booking) => booking.status !== 'cancelled'
        );
        setBookings(filteredBookings);
      } else {
        console.error('Failed to fetch bookings:', response.error);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
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
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isTripOngoing) {
      Alert.alert('Trip Already Active', 'You must complete your current trip before accepting a new one.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    if (isTripAccepted) {
      Alert.alert('Trip Already Accepted', 'You must start or complete your currently accepted trip before accepting a new one.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);
      const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (!vehicleInfo) {
        throw new Error('No vehicle info found');
      }
      const { vehicleId } = JSON.parse(vehicleInfo);

      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/actions?id=${bookingId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept', vehicleId })
      });

      if (response.success) {
        Alert.alert('Success', 'Booking accepted successfully');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRefresh();
      } else {
        Alert.alert('Error', response.error || 'Failed to accept booking');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (bookingId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isTripOngoing || isTripAccepted) {
      Alert.alert('Trip Active', 'You cannot reject bookings while a trip is active or accepted.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);
      const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (!vehicleInfo) {
        throw new Error('No vehicle info found');
      }
      const { vehicleId } = JSON.parse(vehicleInfo);

      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/actions?id=${bookingId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject', vehicleId })
      });

      if (response.success) {
        Alert.alert('Success', 'Booking rejected successfully');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onRefresh();
      } else {
        Alert.alert('Error', response.error || 'Failed to reject booking');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Error rejecting booking:', error);
      Alert.alert('Error', 'Failed to reject booking. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async (tripId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (isTripOngoing) {
      Alert.alert('Trip Already Active', 'You already have an ongoing trip.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/start?id=${tripId}`, {
        method: 'POST'
      });

      if (response.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/trip/${tripId}` as any);
      } else {
        Alert.alert('Error', response.error || 'Failed to start trip');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip. Please try again.');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrip = async (tripId: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace(`/trip/${tripId}` as any);
  };

  // Status Badge Component
  const StatusBadge = ({ status }: { status: string }) => {
    const getStatusConfig = () => {
      switch (status) {
        case 'accepted':
          return { color: 'bg-blue-100', textColor: 'text-blue-700', icon: 'checkmark-circle', label: 'Accepted' };
        case 'ongoing':
        case 'pickup':
          return { color: 'bg-green-100', textColor: 'text-green-700', icon: 'car', label: 'In Progress' };
        case 'delivered':
          return { color: 'bg-purple-100', textColor: 'text-purple-700', icon: 'cube', label: 'Delivered' };
        case 'completed':
          return { color: 'bg-emerald-100', textColor: 'text-emerald-700', icon: 'checkmark-done-circle', label: 'Completed' };
        case 'rejected':
          return { color: 'bg-red-100', textColor: 'text-red-700', icon: 'close-circle', label: 'Rejected' };
        default:
          return { color: 'bg-gray-100', textColor: 'text-gray-700', icon: 'time', label: 'Pending' };
      }
    };

    const config = getStatusConfig();

    return (
      <View className={`${config.color} px-3 py-1.5 rounded-full flex-row items-center self-start`}>
        <Ionicons name={config.icon as any} size={14} color={config.textColor.replace('text-', '#')} />
        <Text className={`${config.textColor} text-xs font-JakartaSemiBold ml-1`}>
          {config.label}
        </Text>
      </View>
    );
  };

  const renderBookingItem = ({ item }: { item: Booking }) => (
    <Pressable
      onPress={() => item.trip.tripId && handleTrip(item.trip.tripId)}
      className="bg-white rounded-2xl p-5 mb-4 shadow-sm border border-gray-100"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* Header Section */}
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-1">
          <Text className="text-xs text-gray-500 font-Jakarta mb-1">Booking ID</Text>
          <Text className="text-base font-JakartaBold text-gray-900">#{item.bookingId.slice(-8)}</Text>
        </View>
        <StatusBadge status={item.trip?.status || 'pending'} />
      </View>

      {/* Date Section */}
      <View className="bg-blue-50 rounded-xl p-3 mb-4 flex-row items-center">
        <Ionicons name="calendar-outline" size={20} color="#3B82F6" />
        <View className="ml-3">
          <Text className="text-xs text-gray-600 font-Jakarta">Journey Date</Text>
          <Text className="text-sm font-JakartaSemiBold text-gray-900">{item.journeyDate}</Text>
        </View>
      </View>

      {/* Route Section */}
      <View className="mb-4">
        {/* Hydrant (Pickup) */}
        <View className="flex-row mb-3">
          <View className="items-center mr-3">
            <View className="w-8 h-8 bg-blue-500 rounded-full items-center justify-center">
              <Ionicons name="water" size={18} color="#fff" />
            </View>
            <View className="w-0.5 h-8 bg-gray-300 my-1" />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-Jakarta mb-1">Pickup Location</Text>
            <Text className="text-sm font-JakartaBold text-gray-900">{item.hydrant.name}</Text>
            <Text className="text-xs text-gray-600 font-Jakarta mt-0.5">{item.hydrant.address}</Text>
          </View>
        </View>

        {/* Destination */}
        <View className="flex-row">
          <View className="items-center mr-3">
            <View className="w-8 h-8 bg-green-500 rounded-full items-center justify-center">
              <Ionicons name="location" size={18} color="#fff" />
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-Jakarta mb-1">Destination</Text>
            <Text className="text-sm font-JakartaBold text-gray-900">{item.destination.name}</Text>
            <Text className="text-xs text-gray-600 font-Jakarta mt-0.5">{item.destination.address}</Text>
          </View>
        </View>
      </View>

      {/* Customer Section */}
      <View className="bg-gray-50 rounded-xl p-3 mb-4">
        <View className="flex-row items-center mb-2">
          <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
          <Text className="text-xs text-gray-600 font-JakartaSemiBold ml-2">Customer Details</Text>
        </View>
        <Text className="text-sm font-JakartaBold text-gray-900 mb-1">{item.customer.name}</Text>
        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Add call functionality here
          }}
          className="flex-row items-center"
        >
          <Ionicons name="call-outline" size={14} color="#3B82F6" />
          <Text className="text-sm text-blue-600 font-Jakarta ml-1">{item.customer.contactNumber}</Text>
        </Pressable>
      </View>

      {/* Action Buttons */}
      {!item.trip.tripId && (
        <View className="flex-row gap-3">
          <TouchableOpacity
            className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center ${
              (isTripOngoing || isTripAccepted) ? 'bg-gray-200' : 'bg-green-500'
            }`}
            onPress={() => handleAccept(item.bookingId)}
            disabled={loading || isTripOngoing || isTripAccepted}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text className="text-white font-JakartaBold ml-2">Accept</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3.5 rounded-xl items-center flex-row justify-center ${
              (isTripOngoing || isTripAccepted) ? 'bg-gray-200' : 'bg-red-500'
            }`}
            onPress={() => handleReject(item.bookingId)}
            disabled={loading || isTripOngoing || isTripAccepted}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle" size={20} color="#fff" />
            <Text className="text-white font-JakartaBold ml-2">Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.trip.tripId && item.trip.status === 'accepted' && (
        <TouchableOpacity
          className={`py-3.5 rounded-xl items-center flex-row justify-center ${
            isTripOngoing ? 'bg-gray-300' : 'bg-green-600'
          }`}
          onPress={() => handleStartTrip(item.trip.tripId!)}
          disabled={loading || isTripOngoing}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="play-circle" size={22} color="#fff" />
              <Text className="text-white font-JakartaBold text-base ml-2">Start Trip</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {(item.trip.tripId && (item.trip.status === 'ongoing' || item.trip.status === 'pickup' || item.trip.status === 'delivered')) && (
        <TouchableOpacity
          className="bg-gradient-to-r from-green-600 to-green-700 py-3.5 rounded-xl items-center flex-row justify-center"
          onPress={() => handleTrip(item.trip.tripId!)}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate-circle" size={22} color="#fff" />
          <Text className="text-white font-JakartaBold text-base ml-2">View Trip Details</Text>
        </TouchableOpacity>
      )}

      {item.trip.tripId && item.trip.status === 'completed' && (
        <View className="bg-blue-50 py-3.5 rounded-xl items-center flex-row justify-center border border-blue-200">
          <Ionicons name="checkmark-done-circle" size={22} color="#3B82F6" />
          <Text className="text-blue-600 font-JakartaBold text-base ml-2">Trip Completed</Text>
        </View>
      )}

      {item.trip.status === 'rejected' && (
        <View className="bg-red-50 py-3.5 rounded-xl items-center flex-row justify-center border border-red-200">
          <Ionicons name="close-circle" size={22} color="#EF4444" />
          <Text className="text-red-600 font-JakartaBold text-base ml-2">Booking Rejected</Text>
        </View>
      )}
    </Pressable>
  );

  const ListHeaderComponent = () => (
    <View className="mb-4">
      <Text className="text-3xl font-JakartaBold text-gray-900 mb-2">
        PHED Tanker Tracking
      </Text>
      <Text className="text-sm text-gray-600 font-Jakarta">
        {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} available
      </Text>
      {(isTripOngoing || isTripAccepted) && (
        <View className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-center">
          <Ionicons name="alert-circle" size={20} color="#F59E0B" />
          <Text className="text-amber-700 text-xs font-JakartaSemiBold ml-2 flex-1">
            You have an active trip. Complete it before accepting new bookings.
          </Text>
        </View>
      )}
    </View>
  );

  const ListEmptyComponent = () => (
    <View className="flex-1 justify-center items-center py-20">
      <View className="w-40 h-40 bg-gray-100 rounded-full items-center justify-center mb-6">
        <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
      </View>
      <Text className="text-gray-900 text-xl font-JakartaBold mb-2">No Bookings Found</Text>
      <Text className="text-gray-500 text-sm font-Jakarta text-center px-8">
        You don't have any bookings at the moment. Pull down to refresh.
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <FlatList
        data={bookings}
        renderItem={renderBookingItem}
        keyExtractor={(item) => item.bookingId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80, paddingTop: 16 }}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={true}
      />
    </SafeAreaView>
  );
};

export default Home;
