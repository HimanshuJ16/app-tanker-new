import { Tabs } from "expo-router";
import { View, StyleSheet, Animated, Platform, GestureResponderEvent } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React, { useRef, useEffect } from "react";

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
}

const TabIcon = ({ name, focused, label }: TabIconProps) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.1 : 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: focused ? 1 : 0.7,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View 
      style={[
        styles.iconContainer,
        {
          transform: [{ scale: scaleAnim }],
          opacity: fadeAnim,
        }
      ]}
    >
      <View style={[
        styles.iconWrapper,
        focused && styles.focusedIconWrapper
      ]}>
        <Ionicons 
          name={name} 
          size={24} 
          color={focused ? "#367ff5" : "#94A3B8"} 
        />
      </View>
      {focused && (
        <Animated.View 
          style={[
            styles.activeIndicator,
            {
              opacity: fadeAnim,
            }
          ]} 
        />
      )}
    </Animated.View>
  );
};

// Use the proper type from React Navigation
const HapticTab = (props: BottomTabBarButtonProps) => {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (Platform.OS === 'ios' || Platform.OS === 'android') {
          // Add haptic feedback when pressing down on the tabs
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
      style={styles.tabButton}
    />
  );
};

export default function Layout() {
  const insets = useSafeAreaInsets();

  const tabBarHeight = Platform.select({
    ios: 49 + insets.bottom,
    android: 56 + insets.bottom,
    default: 60 + insets.bottom,
  });

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            height: tabBarHeight,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          }
        ],
        tabBarShowLabel: true,
        tabBarActiveTintColor: "#367ff5",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trips",
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              name={focused ? "map" : "map-outline"} 
              focused={focused}
              label="Trips" 
            />
          ),
          tabBarButton: HapticTab,
          tabBarAccessibilityLabel: "Trips tab",
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Reports",
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              name={focused ? "bar-chart" : "bar-chart-outline"} 
              focused={focused}
              label="Reports" 
            />
          ),
          tabBarButton: HapticTab,
          tabBarAccessibilityLabel: "Reports tab",
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon 
              name={focused ? "person" : "person-outline"} 
              focused={focused}
              label="Profile" 
            />
          ),
          tabBarButton: HapticTab,
          tabBarAccessibilityLabel: "Profile tab",
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    borderTopWidth: 0,
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'Roboto',
      default: 'System',
    }),
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: 'transparent',
  },
  focusedIconWrapper: {
    backgroundColor: '#EBF4FF',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -8,
    width: 32,
    height: 3,
    backgroundColor: '#367ff5',
    borderRadius: 2,
  },
});