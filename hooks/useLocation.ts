import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export const useLocation = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus>('undetermined');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      setStatus(newStatus);

      if (newStatus !== 'granted') {
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!cancelled) {
        setLocation(current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, status };
};
