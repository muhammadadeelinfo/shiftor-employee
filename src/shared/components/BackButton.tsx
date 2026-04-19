import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
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
      <Text style={[styles.label, { color: theme.textPrimary }]} numberOfLines={1}>
        {resolvedLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
