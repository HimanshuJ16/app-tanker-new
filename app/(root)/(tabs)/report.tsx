import { SafeAreaView } from "react-native-safe-area-context";
import { 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Dimensions,
  Animated,
  Pressable
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { fetchAPI } from '@/lib/fetch';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface TripStats {
  totalTrips: number;
  completedTrips: number;
  ongoingTrips: number;
  totalDistance: number;
  totalHours: number;
  avgRating: number;
}

interface RecentTrip {
  tripId: string;
  date: string;
  from: string;
  to: string;
  status: string;
  distance: string;
}

const Report = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<TripStats>({
    totalTrips: 0,
    completedTrips: 0,
    ongoingTrips: 0,
    totalDistance: 0,
    totalHours: 0,
    avgRating: 0,
  });
  const [recentTrips, setRecentTrips] = useState<RecentTrip[]>([]);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month' | 'year'>('week');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const cardScaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    fetchReports();
    
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
      Animated.spring(cardScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchReports = async () => {
    try {
      const vehicleInfo = await SecureStore.getItemAsync('vehicleInfo');
      if (!vehicleInfo) return;
      
      const { vehicleId } = JSON.parse(vehicleInfo);
      
      // Fetch trip statistics
      const response = await fetchAPI(
        `${process.env.EXPO_PUBLIC_API_URL}/reports/stats?vehicleId=${vehicleId}&timeFilter=${timeFilter}`
      );
      
      if (response.success) {
        setStats(response.stats);
        setRecentTrips(response.recentTrips || []);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [timeFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchReports();
    setRefreshing(false);
  };

  const handleTabChange = (tab: 'overview' | 'history') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const handleFilterChange = (filter: 'week' | 'month' | 'year') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTimeFilter(filter);
  };

  // Stat Card Component with Animation
  const StatCard = ({ 
    icon, 
    label, 
    value, 
    unit, 
    color, 
    bgColor,
    trend,
    delay = 0
  }: { 
    icon: string; 
    label: string; 
    value: number | string; 
    unit?: string;
    color: string;
    bgColor: string;
    trend?: number;
    delay?: number;
  }) => {
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          delay,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          delay,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    return (
      <Animated.View 
        style={{
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        }}
      >
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          className="bg-white rounded-2xl p-4 mb-3 shadow-sm active:scale-95"
          style={{ 
            width: (width - 48) / 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 3,
          }}
        >
          <View 
            style={{ backgroundColor: bgColor }}
            className="w-12 h-12 rounded-xl items-center justify-center mb-3"
          >
            <Ionicons name={icon as any} size={24} color={color} />
          </View>
          <Text className="text-2xl font-JakartaBold text-gray-900 mb-1">
            {value}
            {unit && <Text className="text-sm text-gray-500"> {unit}</Text>}
          </Text>
          <Text className="text-xs text-gray-500 font-Jakarta">
            {label}
          </Text>
          {trend !== undefined && trend !== 0 && (
            <View className="flex-row items-center mt-2">
              <Ionicons 
                name={trend > 0 ? "trending-up" : "trending-down"} 
                size={12} 
                color={trend > 0 ? "#10B981" : "#EF4444"} 
              />
              <Text className={`text-xs font-JakartaSemiBold ml-1 ${
                trend > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {trend > 0 ? '+' : ''}{trend}%
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  // Trip History Item with Swipe Actions
  const TripHistoryItem = ({ trip, index }: { trip: RecentTrip; index: number }) => {
    const slideInAnim = useRef(new Animated.Value(50)).current;
    const fadeInAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.parallel([
        Animated.timing(slideInAnim, {
          toValue: 0,
          delay: index * 50,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeInAnim, {
          toValue: 1,
          delay: index * 50,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'completed':
          return { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' };
        case 'ongoing':
          return { bg: '#DBEAFE', text: '#2563EB', icon: 'time' };
        case 'rejected':
          return { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle' };
        default:
          return { bg: '#F3F4F6', text: '#6B7280', icon: 'ellipse' };
      }
    };

    const statusConfig = getStatusColor(trip.status);

    return (
      <Animated.View
        style={{
          transform: [{ translateX: slideInAnim }],
          opacity: fadeInAnim,
        }}
      >
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          className="bg-white rounded-2xl p-4 mb-3 shadow-sm active:bg-gray-50"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-xs text-gray-500 font-Jakarta mb-1">
                Trip #{trip.tripId.slice(-6).toUpperCase()}
              </Text>
              <Text className="text-sm text-gray-900 font-JakartaSemiBold">
                {new Date(trip.date).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View 
              style={{ backgroundColor: statusConfig.bg }}
              className="flex-row items-center px-3 py-1.5 rounded-full"
            >
              <Ionicons 
                name={statusConfig.icon as any} 
                size={12} 
                color={statusConfig.text} 
              />
              <Text 
                style={{ color: statusConfig.text }}
                className="text-xs font-JakartaSemiBold ml-1 capitalize"
              >
                {trip.status}
              </Text>
            </View>
          </View>

          <View className="space-y-2">
            <View className="flex-row items-start mb-2">
              <View className="w-6 h-6 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="water" size={14} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 font-Jakarta">From</Text>
                <Text className="text-sm text-gray-900 font-JakartaSemiBold">
                  {trip.from}
                </Text>
              </View>
            </View>

            <View className="h-4 w-0.5 bg-gray-200 ml-3" />

            <View className="flex-row items-start">
              <View className="w-6 h-6 bg-green-100 rounded-full items-center justify-center mr-3">
                <Ionicons name="location" size={14} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-xs text-gray-500 font-Jakarta">To</Text>
                <Text className="text-sm text-gray-900 font-JakartaSemiBold">
                  {trip.to}
                </Text>
              </View>
            </View>
          </View>

          {trip.distance && (
            <View className="flex-row items-center mt-3 pt-3 border-t border-gray-100">
              <Ionicons name="speedometer-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-600 font-Jakarta ml-2">
                Distance: {trip.distance} km
              </Text>
            </View>
          )}
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-100">
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-2xl font-JakartaBold text-gray-900">
                Reports & Analytics
              </Text>
              <Text className="text-sm text-gray-500 font-Jakarta mt-1">
                Track your performance and trip history
              </Text>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Add export functionality
              }}
              className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center"
            >
              <Ionicons name="download-outline" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Tab Switcher */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mt-4">
          <TouchableOpacity
            onPress={() => handleTabChange('overview')}
            className={`flex-1 py-2.5 rounded-lg ${
              activeTab === 'overview' ? 'bg-white' : 'bg-transparent'
            }`}
            activeOpacity={0.7}
            style={activeTab === 'overview' ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            } : {}}
          >
            <Text
              className={`text-center text-sm font-JakartaSemiBold ${
                activeTab === 'overview' ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleTabChange('history')}
            className={`flex-1 py-2.5 rounded-lg ${
              activeTab === 'history' ? 'bg-white' : 'bg-transparent'
            }`}
            activeOpacity={0.7}
            style={activeTab === 'history' ? {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
            } : {}}
          >
            <Text
              className={`text-center text-sm font-JakartaSemiBold ${
                activeTab === 'history' ? 'text-blue-600' : 'text-gray-600'
              }`}
            >
              History
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#3B82F6"
            colors={['#3B82F6']}
          />
        }
      >
        {activeTab === 'overview' ? (
          <View className="px-5 py-4">
            {/* Time Filter */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {(['week', 'month', 'year'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  onPress={() => handleFilterChange(filter)}
                  className={`px-5 py-2.5 rounded-full mr-2 ${
                    timeFilter === filter ? 'bg-blue-600' : 'bg-white'
                  }`}
                  style={timeFilter !== filter ? {
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  } : {}}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-sm font-JakartaSemiBold capitalize ${
                      timeFilter === filter ? 'text-white' : 'text-gray-600'
                    }`}
                  >
                    This {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Stats Grid */}
            <View className="flex-row justify-between mb-0">
              <StatCard
                icon="car-sport"
                label="Total Trips"
                value={stats.totalTrips}
                color="#3B82F6"
                bgColor="#EBF4FF"
                trend={12}
                delay={0}
              />
              <StatCard
                icon="checkmark-done-circle"
                label="Completed"
                value={stats.completedTrips}
                color="#10B981"
                bgColor="#D1FAE5"
                delay={100}
              />
            </View>

            <View className="flex-row justify-between mb-0">
              <StatCard
                icon="time"
                label="Ongoing"
                value={stats.ongoingTrips}
                color="#F59E0B"
                bgColor="#FEF3C7"
                delay={200}
              />
              <StatCard
                icon="speedometer"
                label="Distance"
                value={stats.totalDistance}
                unit="km"
                color="#8B5CF6"
                bgColor="#EDE9FE"
                trend={8}
                delay={300}
              />
            </View>

            {/* Performance Card with Gradient */}
            <Animated.View
              style={{
                transform: [{ scale: cardScaleAnim }],
                opacity: fadeAnim,
              }}
            >
              <View 
                className="bg-blue-600 rounded-2xl p-5 mb-4 overflow-hidden"
                style={{
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                {/* Decorative circles */}
                <View className="absolute -right-8 -top-8 w-32 h-32 bg-blue-500 rounded-full opacity-20" />
                <View className="absolute -left-8 -bottom-8 w-40 h-40 bg-blue-700 rounded-full opacity-20" />
                
                <Text className="text-white text-lg font-JakartaBold mb-4">
                  Performance This {timeFilter === 'week' ? 'Week' : timeFilter === 'month' ? 'Month' : 'Year'}
                </Text>
                <View className="flex-row justify-between">
                  <View>
                    <Text className="text-blue-200 text-xs font-Jakarta mb-1">
                      Total Hours
                    </Text>
                    <Text className="text-white text-2xl font-JakartaBold">
                      {stats.totalHours}h
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-blue-200 text-xs font-Jakarta mb-1">
                      Avg Rating
                    </Text>
                    <View className="flex-row items-center">
                      <Ionicons name="star" size={20} color="#FCD34D" />
                      <Text className="text-white text-2xl font-JakartaBold ml-1">
                        {stats.avgRating || '5.0'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Quick Insights */}
            <Animated.View
              style={{
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <View 
                className="bg-white rounded-2xl p-5 mb-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.06,
                  shadowRadius: 8,
                  elevation: 3,
                }}
              >
                <Text className="text-lg font-JakartaBold text-gray-900 mb-4">
                  Quick Insights
                </Text>
                
                <View className="space-y-3">
                  <View className="flex-row items-center justify-between pb-3 border-b border-gray-100">
                    <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
                        <Ionicons name="trending-up" size={20} color="#10B981" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-JakartaSemiBold text-gray-900">
                          Completion Rate
                        </Text>
                        <Text className="text-xs text-gray-500 font-Jakarta">
                          Better than last {timeFilter}
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-JakartaBold text-green-600">
                      {stats.totalTrips > 0 
                        ? Math.round((stats.completedTrips / stats.totalTrips) * 100)
                        : 0}%
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between pb-3 border-b border-gray-100">
                    <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                        <Ionicons name="time" size={20} color="#3B82F6" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-JakartaSemiBold text-gray-900">
                          Avg Trip Time
                        </Text>
                        <Text className="text-xs text-gray-500 font-Jakarta">
                          Per delivery
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-JakartaBold text-blue-600">
                      {stats.completedTrips > 0
                        ? Math.round((stats.totalHours / stats.completedTrips) * 10) / 10
                        : 0}h
                    </Text>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                      <View className="w-10 h-10 bg-purple-100 rounded-full items-center justify-center mr-3">
                        <Ionicons name="navigate" size={20} color="#8B5CF6" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-JakartaSemiBold text-gray-900">
                          Avg Distance
                        </Text>
                        <Text className="text-xs text-gray-500 font-Jakarta">
                          Per trip
                        </Text>
                      </View>
                    </View>
                    <Text className="text-lg font-JakartaBold text-purple-600">
                      {stats.completedTrips > 0
                        ? Math.round((stats.totalDistance / stats.completedTrips) * 10) / 10
                        : 0} km
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </View>
        ) : (
          <View className="px-5 py-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-JakartaBold text-gray-900">
                Recent Trips
              </Text>
              <Text className="text-sm text-gray-500 font-Jakarta">
                {recentTrips.length} trips
              </Text>
            </View>
            
            {recentTrips.length > 0 ? (
              recentTrips.map((trip, index) => (
                <TripHistoryItem key={trip.tripId} trip={trip} index={index} />
              ))
            ) : (
              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [{ scale: cardScaleAnim }],
                }}
              >
                <View className="bg-white rounded-2xl p-8 items-center">
                  <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                    <Ionicons name="document-text-outline" size={40} color="#9CA3AF" />
                  </View>
                  <Text className="text-gray-900 text-lg font-JakartaBold mb-2">
                    No Trip History
                  </Text>
                  <Text className="text-gray-500 text-sm font-Jakarta text-center">
                    Your completed trips will appear here
                  </Text>
                </View>
              </Animated.View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Report;
