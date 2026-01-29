import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './theme/colors';

type ThemeName = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeName;
  theme: typeof lightTheme;
  setMode: (mode: ThemeName) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const THEME_STORAGE_KEY = 'employee-portal-theme-mode';
  const getColorScheme = () => (typeof Appearance?.getColorScheme === 'function' ? Appearance.getColorScheme() : null);
  const getInitialMode = () => (getColorScheme() === 'dark' ? 'dark' : 'light');
  const [mode, setModeState] = useState<ThemeName>(getInitialMode);
  const [userPreference, setUserPreference] = useState<ThemeName | null>(null);
  const theme = useMemo(() => (mode === 'dark' ? darkTheme : lightTheme), [mode]);

  useEffect(() => {
    if (typeof Appearance?.addChangeListener !== 'function') return undefined;
    const listener = Appearance.addChangeListener(({ colorScheme }) => {
      if (userPreference !== null) return;
      setModeState(colorScheme === 'dark' ? 'dark' : 'light');
    });
    return () => listener.remove();
  }, [userPreference]);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        if (!isMounted) return;
        if (stored === 'dark' || stored === 'light') {
          setUserPreference(stored);
          setModeState(stored);
        } else {
          setUserPreference(null);
        }
      })
      .catch(() => {
        if (isMounted) setUserPreference(null);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const setMode = useCallback(
    (newMode: ThemeName) => {
      setUserPreference(newMode);
      setModeState(newMode);
      AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => {
        /* ignore */
      });
    },
    [setModeState]
  );

  const value = useMemo(
    () => ({
      mode,
      theme,
      setMode,
    }),
    [mode, theme, setMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('ThemeProvider is missing');
  }
  return context;
};
