import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, TouchableOpacityProps } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from "react";
import * as Haptics from 'expo-haptics';

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  label: string;
}

const TabIcon = ({ name, focused, label }: TabIconProps) => (
  <View style={styles.iconWrapper}>
    <View style={[styles.iconContainer, focused && styles.focusedIconContainer]}>
      <Ionicons
        name={name}
        size={27}
        color={focused ? "#fff" : "#60a5fa"}
      />
    </View>
    <Text style={[
      styles.tabLabel,
      { color: focused ? '#fff' : '#93c5fd', fontWeight: focused ? 'bold' : 'normal' }
    ]}>
      {label}
    </Text>
    {focused && <View style={styles.activeDot} />}
  </View>
);

export default function Layout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: [
          styles.tabBar,
          {
            height: 64 + insets.bottom,
            paddingBottom: insets.bottom + 4,
          }
        ],
        tabBarShowLabel: false,
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "#93c5fd",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trips",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="map-outline" focused={focused} label="Trips" />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as TouchableOpacityProps)}
              style={styles.tabButton}
              activeOpacity={0.85}
              onPress={(e) => {
                if (!props.accessibilityState?.selected) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                if (props.onPress) props.onPress(e);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Reports",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart-outline" focused={focused} label="Reports" />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as TouchableOpacityProps)}
              style={styles.tabButton}
              activeOpacity={0.85}
              onPress={(e) => {
                if (!props.accessibilityState?.selected) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                if (props.onPress) props.onPress(e);
              }}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-outline" focused={focused} label="Profile" />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as TouchableOpacityProps)}
              style={styles.tabButton}
              activeOpacity={0.85}
              onPress={(e) => {
                if (!props.accessibilityState?.selected) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                if (props.onPress) props.onPress(e);
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#367ff5',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    borderTopWidth: 0,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
    flex: 1,
    position: 'relative'
  },
  iconContainer: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#367ff5'
  },
  focusedIconContainer: {
    backgroundColor: '#2563eb',
    shadowColor: "#93c5fd",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  tabLabel: {
    marginTop: 2,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  activeDot: {
    width: 8,
    height: 8,
    backgroundColor: '#fff',
    borderRadius: 4,
    position: 'absolute',
    bottom: -12,
    alignSelf: 'center',
  }
});
