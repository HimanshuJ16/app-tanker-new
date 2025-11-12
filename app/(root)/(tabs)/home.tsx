import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image, Animated } from 'react-native';
import { fetchAPI } from '@/lib/fetch';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { icons, images } from "@/constants";
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

// Booking Card Component with improved UI
const BookingCard = ({ 
  item, 
  onAccept, 
  onReject, 
  onStartTrip, 
  onViewTrip, 
  loading, 
  isTripOngoing, 
  isTripAccepted 
}: { 
  item: Booking; 
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onStartTrip: (id: string) => void;
  onViewTrip: (id: string) => void;
  loading: boolean;
  isTripOngoing: boolean;
  isTripAccepted: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = new Animated.Value(1);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const getStatusColor = () => {
    if (item.trip.status === 'completed') return 'bg-blue-100 border-blue-500';
    if (item.trip.status === 'ongoing' || item.trip.status === 'pickup' || item.trip.status === 'delivered') return 'bg-green-100 border-green-500';
    if (item.trip.status === 'accepted') return 'bg-amber-100 border-amber-500';
    if (item.trip.status === 'rejected') return 'bg-red-100 border-red-500';
    return 'bg-white border-gray-200';
  };

  const getStatusText = () => {
    if (item.trip.status === 'completed') return 'Completed';
    if (item.trip.status === 'ongoing') return 'Ongoing';
    if (item.trip.status === 'pickup') return 'Pickup';
    if (item.trip.status === 'delivered') return 'Delivered';
    if (item.trip.status === 'accepted') return 'Accepted';
    if (item.trip.status === 'rejected') return 'Rejected';
    return 'Pending';
  };

  return (
    <Animated.View 
      style={{ transform: [{ scale: scaleAnim }] }}
      className={`${getStatusColor()} rounded-2xl p-4 mb-4 shadow-md border-l-4`}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-1">
          <Text className="text-xs text-gray-500 font-JakartaMedium">Booking ID</Text>
          <Text className="text-base font-JakartaBold text-gray-800">{item.bookingId}</Text>
        </View>
        <View className="bg-blue-600 px-3 py-1 rounded-full">
          <Text className="text-white text-xs font-JakartaBold">{getStatusText()}</Text>
        </View>
      </View>

      {/* Journey Date */}
      <View className="mb-3 bg-gray-50 p-2 rounded-lg">
        <Text className="text-xs text-gray-500 font-JakartaMedium">Journey Date</Text>
        <Text className="text-sm font-JakartaSemiBold text-gray-800">{item.journeyDate}</Text>
      </View>

      {/* Route Visualization */}
      <View className="mb-3">
        {/* Hydrant */}
        <View className="flex-row items-start mb-2">
          <View className="w-8 h-8 bg-blue-500 rounded-full items-center justify-center mr-3">
            <Text className="text-white font-JakartaBold text-xs">H</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-JakartaMedium">Pickup - Hydrant</Text>
            <Text className="text-sm font-JakartaSemiBold text-gray-800">{item.hydrant.name}</Text>
            <Text className="text-xs text-gray-600">{item.hydrant.address}</Text>
          </View>
        </View>

        {/* Connection Line */}
        <View className="w-0.5 h-6 bg-gray-300 ml-4 mb-2" />

        {/* Destination */}
        <View className="flex-row items-start">
          <View className="w-8 h-8 bg-green-500 rounded-full items-center justify-center mr-3">
            <Text className="text-white font-JakartaBold text-xs">D</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 font-JakartaMedium">Destination</Text>
            <Text className="text-sm font-JakartaSemiBold text-gray-800">{item.destination.name}</Text>
            <Text className="text-xs text-gray-600">{item.destination.address}</Text>
          </View>
        </View>
      </View>

      {/* Customer Info - Collapsible */}
      <TouchableOpacity 
        onPress={() => setExpanded(!expanded)}
        className="bg-gray-50 p-3 rounded-lg mb-3"
      >
        <View className="flex-row justify-between items-center">
          <Text className="text-sm font-JakartaBold text-gray-800">Customer Details</Text>
          <Text className="text-gray-500">{expanded ? '▼' : '▶'}</Text>
        </View>
        {expanded && (
          <View className="mt-2 pt-2 border-t border-gray-200">
            <Text className="text-sm font-JakartaSemiBold text-gray-800">{item.customer.name}</Text>
            <Text className="text-sm text-blue-600 font-JakartaMedium">{item.customer.contactNumber}</Text>
            <Text className="text-xs text-gray-600 mt-1">{item.customer.address}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Action Buttons */}
      {!item.trip.tripId && (
        <View className="flex-row gap-2 mt-2">
          <TouchableOpacity
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className={`flex-1 py-3 rounded-xl items-center flex-row justify-center ${
              (isTripOngoing || isTripAccepted) ? 'bg-gray-300' : 'bg-green-500'
            }`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onAccept(item.bookingId);
            }}
            disabled={loading || isTripOngoing || isTripAccepted}
          >
            <Text className="text-white text-lg mr-1">✓</Text>
            <Text className="text-white font-JakartaBold">Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-3 rounded-xl items-center flex-row justify-center ${
              (isTripOngoing || isTripAccepted) ? 'bg-gray-300' : 'bg-red-500'
            }`}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onReject(item.bookingId);
            }}
            disabled={loading || isTripOngoing || isTripAccepted}
          >
            <Text className="text-white text-lg mr-1">✗</Text>
            <Text className="text-white font-JakartaBold">Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.trip.tripId && item.trip.status === 'accepted' && (
        <TouchableOpacity
          className={`py-3 rounded-xl mt-2 items-center ${
            isTripOngoing ? 'bg-gray-300' : 'bg-green-600'
          }`}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            onStartTrip(item.trip.tripId!);
          }}
          disabled={loading || isTripOngoing}
        >
          <Text className="text-white font-JakartaBold text-base">▶ Start Trip</Text>
        </TouchableOpacity>
      )}

      {(item.trip.tripId && (item.trip.status === 'ongoing' || item.trip.status === 'pickup' || item.trip.status === 'delivered')) && (
        <TouchableOpacity
          className="bg-green-700 py-3 rounded-xl mt-2 items-center"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onViewTrip(item.trip.tripId!);
          }}
        >
          <Text className="text-white font-JakartaBold text-base">🚛 View Ongoing Trip</Text>
        </TouchableOpacity>
      )}

      {item.trip.tripId && item.trip.status === 'completed' && (
        <View className="bg-blue-100 py-3 rounded-xl mt-2 items-center border border-blue-300">
          <Text className="text-blue-700 font-JakartaBold text-base">✓ Trip Completed</Text>
        </View>
      )}

      {item.trip.status === 'rejected' && (
        <View className="bg-red-100 py-3 rounded-xl mt-2 items-center border border-red-300">
          <Text className="text-red-700 font-JakartaBold text-base">✗ Booking Rejected</Text>
        </View>
      )}
    </Animated.View>
  );
};

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
    if (isTripOngoing) {
      Alert.alert('Trip Already Active', 'You must complete your current trip before accepting a new one.');
      return;
    }
    if (isTripAccepted) {
      Alert.alert('Trip Already Accepted', 'You must start or complete your currently accepted trip before accepting a new one.');
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
      Alert.alert('Trip Active', 'You cannot reject bookings while a trip is active or accepted.');
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
  };

  const handleStartTrip = async (tripId: string) => {
    if (isTripOngoing) {
      Alert.alert('Trip Already Active', 'You already have an ongoing trip.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/start?id=${tripId}`, {
        method: 'POST'
      });

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
    router.replace(`/trip/${tripId}` as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 bg-blue-600">
        <Text className="text-3xl font-JakartaBold text-white">PHED Tanker</Text>
        <Text className="text-sm font-JakartaMedium text-blue-100">Tracking System</Text>
      </View>

      {/* Stats Bar */}
      <View className="flex-row px-5 py-3 bg-white border-b border-gray-100">
        <View className="flex-1 items-center">
          <Text className="text-2xl font-JakartaBold text-blue-600">{bookings.length}</Text>
          <Text className="text-xs font-JakartaMedium text-gray-500">Total</Text>
        </View>
        <View className="flex-1 items-center border-l border-r border-gray-200">
          <Text className="text-2xl font-JakartaBold text-amber-600">
            {bookings.filter(b => b.trip.status === 'accepted').length}
          </Text>
          <Text className="text-xs font-JakartaMedium text-gray-500">Accepted</Text>
        </View>
        <View className="flex-1 items-center">
          <Text className="text-2xl font-JakartaBold text-green-600">
            {bookings.filter(b => b.trip.status === 'ongoing' || b.trip.status === 'pickup').length}
          </Text>
          <Text className="text-xs font-JakartaMedium text-gray-500">Ongoing</Text>
        </View>
      </View>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Image
            source={images.noResult}
            style={{ width: 200, height: 200 }}
            resizeMode="contain"
          />
          <Text className="text-gray-800 text-xl font-JakartaBold mt-4">No Bookings Found</Text>
          <Text className="text-gray-500 text-sm font-JakartaMedium mt-2 text-center">
            Pull down to refresh or check back later
          </Text>
          <TouchableOpacity 
            onPress={onRefresh}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-full"
          >
            <Text className="text-white font-JakartaBold">Refresh Now</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          className="px-4 pt-4"
          contentContainerStyle={{ paddingBottom: 100 }}
          data={bookings}
          renderItem={({ item }) => (
            <BookingCard 
              item={item}
              onAccept={handleAccept}
              onReject={handleReject}
              onStartTrip={handleStartTrip}
              onViewTrip={handleTrip}
              loading={loading}
              isTripOngoing={isTripOngoing}
              isTripAccepted={isTripAccepted}
            />
          )}
          keyExtractor={(item) => item.bookingId}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              tintColor="#2563eb"
              colors={['#2563eb']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default Home;
