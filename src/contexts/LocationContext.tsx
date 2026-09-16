// LocationContext.tsx
import { createContext, useContext, createSignal, onMount } from "solid-js";
import type { JSX } from "solid-js";

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface LocationContextValue {
  userLocation: () => UserLocation | null;
  isLoadingLocation: () => boolean;
  error: () => string | null;
  requestLocation: () => Promise<void>;
  permissionStatus: () => string | null;
}

const LocationContext = createContext<LocationContextValue>();

export function useUserLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}

interface LocationProviderProps {
  children: JSX.Element;
}

/** GeolocationPositionError codes. Do not rely on `instanceof` — Safari often throws DOMException. */
const GEO_PERMISSION_DENIED = 1;
const GEO_POSITION_UNAVAILABLE = 2;
const GEO_TIMEOUT = 3;

function geolocationFailure(err: unknown): { message: string; denied: boolean } {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? Number((err as { code: unknown }).code)
      : Number.NaN;

  if (code === GEO_PERMISSION_DENIED) {
    return { message: "Location access was denied by the user.", denied: true };
  }
  if (code === GEO_POSITION_UNAVAILABLE) {
    return { message: "Location information is unavailable.", denied: false };
  }
  if (code === GEO_TIMEOUT) {
    return { message: "The request to get your location timed out.", denied: false };
  }
  if (err instanceof Error && err.message) {
    return { message: err.message, denied: false };
  }
  return { message: "Failed to get location.", denied: false };
}

export function LocationProvider(props: LocationProviderProps) {
  const [userLocation, setUserLocation] = createSignal<UserLocation | null>(null);
  const [isLoadingLocation, setisLoadingLocation] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [permissionStatus, setPermissionStatus] = createSignal<string | null>(null);

  const isGeolocationSupported = "geolocation" in navigator;

  // Function to request location and trigger the browser prompt
  const requestLocation = async () => {
    if (!isGeolocationSupported) {
      const message = "Geolocation is not supported by your browser.";
      setError(message);
      throw new Error(message);
    }

    setisLoadingLocation(true);
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000, // 10 seconds timeout
          maximumAge: 0, // No cached position
        });
      });

      const coords: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      setUserLocation(coords);
      setPermissionStatus("granted");
    } catch (err) {
      const { message, denied } = geolocationFailure(err);
      if (denied) {
        setPermissionStatus("denied");
      }
      setError(message);
      throw new Error(message);
    } finally {
      setisLoadingLocation(false);
    }
  };

  // Initialize permission status and listen for changes (without auto-requesting)
  onMount(() => {
    if (!isGeolocationSupported) {
      setError("Geolocation is not supported by your browser.");
      return;
    }

    if ("permissions" in navigator) {
      navigator.permissions.query({ name: "geolocation" }).then((permission) => {
        setPermissionStatus(permission.state);
        // Only auto-fetch if permission was already granted previously
        // This avoids triggering the browser prompt on page load
        if (permission.state === "granted") {
          void requestLocation().catch(() => {});
        }

        // Listen for permission changes
        permission.onchange = () => {
          setPermissionStatus(permission.state);
          if (permission.state === "granted") {
            void requestLocation().catch(() => {});
          }
        };
      });
    }
  });

  const contextValue: LocationContextValue = {
    userLocation,
    isLoadingLocation,
    error,
    requestLocation,
    permissionStatus,
  };

  return <LocationContext.Provider value={contextValue}>{props.children}</LocationContext.Provider>;
}
