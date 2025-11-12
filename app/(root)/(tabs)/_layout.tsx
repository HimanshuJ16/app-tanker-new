import { Tabs } from "expo-router";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Platform 
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useRef } from "react";
import * as Haptics from 'expo-haptics';

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
}

const TabIcon = ({ name, focused, label }: TabIconProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (focused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Animate scale and position
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1.2,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: -4,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.6,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  return (
    <View style={styles.tabItemContainer}>
      <Animated.View
        style={[
          styles.iconWrapper,
          focused && styles.focusedIconWrapper,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: translateYAnim },
            ],
          },
        ]}
      >
        <Ionicons 
          name={name} 
          size={24} 
          color={focused ? "#FFFFFF" : "#93C5FD"} 
        />
        {focused && (
          <View style={styles.activeIndicator} />
        )}
      </Animated.View>
      <Animated.Text
        style={[
          styles.tabLabel,
          { opacity: opacityAnim },
          focused && styles.focusedTabLabel,
        ]}
      >
        {label}
      </Animated.Text>
    </View>
  );
};

export default function Layout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom + 8,
          },
        ],
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#93C5FD",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trips",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="map" focused={focused} label="Trips" />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Reports",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart" focused={focused} label="Reports" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person" focused={focused} label="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1E40AF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderTopWidth: 0,
    paddingTop: 8,
  },
  tabItemContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  focusedIconWrapper: {
    backgroundColor: '#3B82F6',
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#93C5FD',
    marginTop: 4,
  },
  focusedTabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
