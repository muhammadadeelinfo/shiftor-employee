import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

type PermissionStatus = 'undetermined' | 'granted' | 'denied';

type LocationObject = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
};

export const useLocation = () => {
  const [location, setLocation] = useState<LocationObject | null>(null);
  const [status, setStatus] = useState<PermissionStatus>('undetermined');
  const enableLocationInDev = Boolean(Constants.expoConfig?.extra?.enableLocationInDev);

  useEffect(() => {
    let cancelled = false;
    const skipLocationInDev = __DEV__ && !enableLocationInDev;

    (async () => {
      if (skipLocationInDev) {
        if (!cancelled) {
          setStatus('denied');
        }
        return;
      }

      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        if (!cancelled) {
          setStatus('denied');
        }
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (current) => {
          if (cancelled) return;
          setStatus('granted');
          setLocation({
            coords: current.coords,
            timestamp: current.timestamp,
          });
        },
        () => {
          if (!cancelled) {
            setStatus('denied');
          }
        },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 }
      );
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, status };
};
