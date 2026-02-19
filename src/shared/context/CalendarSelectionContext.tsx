import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseStoredCalendarSelection,
  toggleCalendarSelectionInList,
  type ImportedCalendar,
} from '@shared/utils/calendarSelectionUtils';

type CalendarSelectionContextValue = {
  selectedCalendars: ImportedCalendar[];
  toggleCalendarSelection: (calendar: ImportedCalendar) => void;
  clearImportedCalendars: () => void;
};

const CalendarSelectionContext = createContext<CalendarSelectionContextValue | undefined>(undefined);

type Props = {
  children: ReactNode;
};

const STORAGE_KEY = 'employee-portal:selected-calendars';

export const CalendarSelectionProvider = ({ children }: Props) => {
  const [selectedCalendars, setSelectedCalendars] = useState<ImportedCalendar[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const toggleCalendarSelection = useCallback((calendar: ImportedCalendar) => {
    setSelectedCalendars((prev) => toggleCalendarSelectionInList(prev, calendar));
  }, []);

  const clearImportedCalendars = useCallback(() => {
    setSelectedCalendars([]);
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && isMounted) {
          const parsed = parseStoredCalendarSelection(raw);
          setSelectedCalendars(parsed);
        }
      } catch (error) {
        console.error('Failed to load calendar selections', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(selectedCalendars)).catch((error) => {
      console.error('Failed to persist calendar selections', error);
    });
  }, [hydrated, selectedCalendars]);

  const value = useMemo(
    () => ({ selectedCalendars, toggleCalendarSelection, clearImportedCalendars }),
    [selectedCalendars, toggleCalendarSelection, clearImportedCalendars]
  );

  return (
    <CalendarSelectionContext.Provider value={value}>
      {children}
    </CalendarSelectionContext.Provider>
  );
};

export const useCalendarSelection = () => {
  const context = useContext(CalendarSelectionContext);
  if (!context) {
    throw new Error('useCalendarSelection must be used within a CalendarSelectionProvider');
  }
  return context;
};
