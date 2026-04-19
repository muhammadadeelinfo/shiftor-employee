import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useLanguage } from '@shared/context/LanguageContext';
import { useTheme } from '@shared/themeContext';

type BackButtonProps = {
  label?: string;
  onPress?: () => void;
  fallbackHref?: Href;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function BackButton({
  label,
  onPress,
  fallbackHref,
  disabled = false,
  style,
}: BackButtonProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const resolvedLabel = label ?? t('commonBack');

  const handlePress = () => {
    if (disabled) return;
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={resolvedLabel}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.surfaceMuted,
          borderColor: theme.borderSoft,
          opacity: disabled ? 0.52 : 1,
        },
        pressed && !disabled ? styles.buttonPressed : null,
        style,
      ]}
    >
      <Ionicons name="chevron-back" size={18} color={theme.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
    width: 42,
    height: 42,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.88,
  },
});
