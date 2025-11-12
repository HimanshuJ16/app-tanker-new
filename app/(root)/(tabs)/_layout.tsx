import { Tabs } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, TouchableOpacityProps } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React from "react";

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
}

const TabIcon = ({ name, focused }: TabIconProps) => (
  <View style={[styles.iconContainer, focused && styles.focusedIconContainer]}>
    <Ionicons 
      name={name} 
      size={24} 
      color={focused ? "white" : "#93C5FD"} 
    />
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
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          }
        ],
        tabBarShowLabel: true,
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "#93C5FD",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Trips",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="map-outline" focused={focused} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as TouchableOpacityProps)}
              style={styles.tabButton}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="report"
        options={{
          title: "Reports",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="bar-chart-outline" focused={focused} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as TouchableOpacityProps)}
              style={styles.tabButton}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-outline" focused={focused} />
          ),
          tabBarButton: (props) => (
            <TouchableOpacity
              {...(props as TouchableOpacityProps)}
              style={styles.tabButton}
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    padding: 2,
    borderRadius: 20,
  },
  focusedIconContainer: {
    backgroundColor: '#72a4f7',
  },
});