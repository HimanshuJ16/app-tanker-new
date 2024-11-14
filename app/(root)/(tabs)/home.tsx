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
        setBookings(response.bookings);
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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBookings();
    setRefreshing(false);
  };

  const handleAccept = async (bookingId: string) => {
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
        setBookings(prevBookings =>
          prevBookings.map(booking =>
            booking.bookingId === bookingId
              ? { ...booking, status: 'accepted', tripId: response.tripId }
              : booking
          )
        );
        onRefresh();
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
    try {
      setLoading(true);
      const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/actions?id=${bookingId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject' })
      });

      if (response.success) {
        Alert.alert('Success', 'Booking rejected successfully');
        setBookings(prevBookings =>
          prevBookings.map(booking =>
            booking.bookingId === bookingId
              ? { ...booking, status: 'rejected' }
              : booking
          )
        );
        onRefresh();
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
          <Text className="text-sm font-semibold">{item.journeyDate}</Text>
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

      {item.status === 'approved' && !item.trip.tripId && (
        <View className="flex-row justify-between mt-2">
          <TouchableOpacity
            className="flex-1 bg-green-500 py-2 rounded mr-1 items-center"
            onPress={() => handleAccept(item.bookingId)}
          >
            <Text className="text-white font-semibold">Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 bg-red-500 py-2 rounded ml-1 items-center"
            onPress={() => handleReject(item.bookingId)}
          >
            <Text className="text-white font-semibold">Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.trip.tripId && item.trip.status === 'in_progress' && (
        <TouchableOpacity
          className="bg-green-500 py-2 rounded mt-2 items-center"
          onPress={() => handleStartTrip(item.trip.tripId!)}
        >
          <Text className="text-white font-semibold">Start Trip</Text>
        </TouchableOpacity>
      )}

      {item.trip.tripId && item.trip.status === 'ongoing' && (
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

      {item.status === 'rejected' && (
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