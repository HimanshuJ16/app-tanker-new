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

export const sendLocationUpdate = async (location: Location.LocationObject, tripId: string) => {
  try {
    const response = await fetchAPI(`${process.env.EXPO_PUBLIC_API_URL}/trip/location?id=${tripId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude,
        speed: location.coords.speed,
        heading: location.coords.heading,
      }),
    })

    if (response && response.success) {
      console.log("Location updated successfully")
    } else {
      console.error("Failed to update location:", response?.error || "Unknown error")
    }
  } catch (error) {
    console.error("Error sending location update:", error)
  }
}

export const setupLocationTracking = async (tripId: string): Promise<boolean> => {
  try {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync()
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync()

    if (foregroundStatus !== "granted" || backgroundStatus !== "granted") {
      return false
    }

    await Location.startLocationUpdatesAsync(LOCATION_TRACKING, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 10,
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

TaskManager.defineTask(LOCATION_TRACKING, async ({ data, error }) => {
  if (error) {
    console.error("Error in background location task:", error)
    return
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] }
    if (locations && locations.length > 0) {
      console.log("Background location update:", locations[0])
      await sendLocationUpdate(locations[0], global.tripId)
    }
  }
})

