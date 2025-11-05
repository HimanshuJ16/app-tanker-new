import * as Location from "expo-location"
import * as TaskManager from "expo-task-manager"
import { fetchAPI } from "@/lib/fetch"

export const LOCATION_TRACKING = "location-tracking"

export interface ExtendedLocationOptions extends Location.LocationOptions {
  foregroundService?: {
    notificationTitle: string
    notificationBody: string
  }
}

/**
 * Sends the location update to ONE place:
 * 1. The WebSocket broadcast server (for live tracking).
 * The socket server will then be responsible for saving to the DB.
 */
export const sendLocationUpdate = async (location: Location.LocationObject, tripId: string) => {
  const locationData = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    altitude: location.coords.altitude,
    speed: location.coords.speed,
    heading: location.coords.heading,
  };

  // 1. Send to WebSocket server to broadcast live
  try {
    // We use standard fetch here because it's a different server
    const broadcastResponse = await fetch(`${process.env.EXPO_PUBLIC_SOCKET_SERVER_URL}/broadcast/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: tripId,
        location: locationData,
      }),
    });
    
    if (broadcastResponse.ok) {
      console.log("Location broadcasted successfully");
    } else {
      console.error("Failed to broadcast location:", await broadcastResponse.text());
    }
  } catch (error) {
    console.error("Error broadcasting location:", error);
  }
};

export const setupLocationTracking = async (tripId: string): Promise<boolean> => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync()
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()

    if (foregroundStatus !== "granted" || backgroundStatus !== "granted") {
      return false
    }

    await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000, // 10 seconds
      distanceInterval: 10,  // 10 meters
      foregroundService: {
        notificationTitle: "Trip Tracking Active",
        notificationBody: "Your location is being tracked for the current trip",
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
    })

    console.log("Location tracking started successfully.")
    return true
  } catch (error) {
    console.error("Error setting up location tracking:", error)
    return false
  }
}

export const stopLocationTracking = async (): Promise<void> => {
  try {
    await Location.stopLocationUpdatesAsync(LOCATION_TRACKING)
    console.log("Location tracking stopped")
  } catch (error) {
    console.error("Error stopping location tracking:", error)
  }
}

export const checkTrackingStatus = async (): Promise<boolean> => {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(LOCATION_TRACKING)
  const isTracking = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING)
  return isRegistered && isTracking
}

// This TaskManager definition is the core of the background tracking
TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error("Error in background location task:", error)
    return
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }
    if (locations && locations.length > 0) {
      // global.tripId is set in the `[id].tsx` component.
      if (global.tripId) {
        console.log("Background location update:", locations[0].coords);
        await sendLocationUpdate(locations[0], global.tripId);
      } else {
        console.warn("Background task running but global.tripId is not set.");
      }
    }
  }
})