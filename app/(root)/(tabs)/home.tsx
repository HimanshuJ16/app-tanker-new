import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { fetchAPI } from '@/lib/fetch';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { icons, images } from "@/constants";

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
  const [isTripOngoing, setIsTripOngoing] = useState(false); // Tracks 'ongoing', 'pickup', 'delivered'
  const [isTripAccepted, setIsTripAccepted] = useState(false); // Tracks 'accepted'

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
        // --- UPDATED: Filter out cancelled bookings ---
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

  // --- UPDATED: Effect to check for both ongoing AND accepted trips ---
  useEffect(() => {
    const ongoingTripExists = bookings.some(
      (b) => b.trip && (b.trip.status === 'ongoing' || b.trip.status === 'pickup' || b.trip.status === 'delivered')
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
    // --- UPDATED: Check if a trip is ongoing OR already accepted ---
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
        Alert.alert('Success', 'Booking accepted successfully');
        onRefresh(); // Refresh data to update UI
      } else {
        Alert.alert('Error', response.error || 'Failed to accept booking');
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      Alert.alert('Error', 'Failed to accept booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (bookingId: string) => {
    // --- UPDATED: Also prevent rejecting while busy ---
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
        Alert.alert('Success', 'Booking rejected successfully');
        onRefresh(); // Refresh data
      } else {
        Alert.alert('Error', response.error || 'Failed to reject booking');
      }
    } catch (error) {
      console.error('Error rejecting booking:', error);
      Alert.alert('Error', 'Failed to reject booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTrip = async (tripId: string) => {
    // --- NEW: Check if a trip is already ongoing ---
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
        router.replace(`/trip/${tripId}` as any);
      } else {
        Alert.alert('Error', response.error || 'Failed to start trip');
      }
    } catch (error) {
      console.error('Error starting trip:', error);
      Alert.alert('Error', 'Failed to start trip. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTrip = async (tripId: string) => {
    router.replace(`/trip/${tripId}` as any);
  }

  const renderBookingItem = ({ item }: { item: Booking }) => (
    <View className="bg-white rounded-lg p-4 mb-4 shadow">
      <View className="flex-col justify-between mb-2">
        <View>
          <Text className="text-xs text-gray-600">Booking ID</Text>
          <Text className="text-sm font-semibold">{item.bookingId}</Text>
        </View>
        <View>
          <Text className="text-xs text-gray-600">Booking Date</Text>
          <Text className="text-sm font-semibold">{new Date(item.journeyDate).toLocaleDateString()}</Text>
        </View>
      </View>

      <View className="mb-2">
        <Text className="text-sm font-semibold text-blue-600">Hydrant</Text>
        <Text className="text-sm">{item.hydrant.name}</Text>
        <Text className="text-xs text-gray-600">{item.hydrant.address}</Text>
      </View>

      <View className="mb-2">
        <Text className="text-sm font-semibold text-blue-600">Destination</Text>
        <Text className="text-sm">{item.destination.name}</Text>
        <Text className="text-xs text-gray-600">{item.destination.address}</Text>
      </View>

      <View className="mb-2">
        <Text className="text-sm font-semibold text-blue-600">Customer</Text>
        <Text className="text-sm">{item.customer.name}</Text>
        <Text className="text-sm">{item.customer.contactNumber}</Text>
      </View>

      {!item.trip.tripId && (
        <View className="flex-row justify-between mt-2">
          <TouchableOpacity
            // --- UPDATED: Disable if ongoing OR accepted ---
            className={`flex-1 py-2 rounded mr-1 items-center ${
              (isTripOngoing || isTripAccepted) ? 'bg-gray-400' : 'bg-green-500'
            }`}
            onPress={() => handleAccept(item.bookingId)}
            disabled={loading || isTripOngoing || isTripAccepted}
          >
            <Text className="text-white font-semibold">Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            // --- UPDATED: Disable if ongoing OR accepted ---
            className={`flex-1 py-2 rounded ml-1 items-center ${
              (isTripOngoing || isTripAccepted) ? 'bg-gray-400' : 'bg-red-500'
            }`}
            onPress={() => handleReject(item.bookingId)}
            disabled={loading || isTripOngoing || isTripAccepted}
          >
            <Text className="text-white font-semibold">Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.trip.tripId && item.trip.status === 'accepted' && (
        <TouchableOpacity
          // --- UPDATED: Disable if *another* trip is ongoing ---
          className={`py-2 rounded mt-2 items-center ${
            isTripOngoing ? 'bg-gray-400' : 'bg-green-500'
          }`}
          onPress={() => handleStartTrip(item.trip.tripId!)}
          disabled={loading || isTripOngoing}
        >
          <Text className="text-white font-semibold">Start Trip</Text>
        </TouchableOpacity>
      )}

      {(item.trip.tripId && (item.trip.status === 'ongoing' || item.trip.status === 'pickup' || item.trip.status === 'delivered')) && (
        <TouchableOpacity
          className="bg-green-700 py-2 rounded mt-2 items-center"
          onPress={() => handleTrip(item.trip.tripId!)}
        >
          <Text className="text-white font-semibold">Ongoing Trip</Text>
        </TouchableOpacity>
      )}

      {item.trip.tripId && item.trip.status === 'completed' && (
        <TouchableOpacity
          className="bg-blue-500 py-2 rounded mt-2 items-center"
          disabled
        >
          <Text className="text-white font-semibold">Trip Finished</Text>
        </TouchableOpacity>
      )}

      {item.trip.status === 'rejected' && (
        <TouchableOpacity
          className="bg-red-300 py-2 rounded mt-2 items-center"
          disabled
        >
          <Text className="text-white font-semibold">Booking Rejected</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-100 p-4">
      <Text className="text-2xl font-bold mb-4 text-blue-600">PHED Tanker Tracking</Text>
      {bookings.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <Image
            source={images.noResult}
            style={{ width: 200, height: 200 }}
            resizeMode="contain"
          />
          <Text className="text-gray-500 text-lg mt-4">No bookings found</Text>
        </View>
      ) : (
        <FlatList
          className="mb-14"
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item.bookingId}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
};

export default Home;