import { Alert, Linking } from 'react-native';
import Constants from 'expo-constants';
import { SUPPORT_EMAIL, SUPPORT_FALLBACK_URL } from '@shared/utils/support';

export const getLegalLinks = () => {
  const baseSiteUrl = SUPPORT_FALLBACK_URL.replace(/\/+$/, '');

  return {
    privacyPolicyUrl:
      ((Constants.expoConfig?.extra?.legalPrivacyUrl as string | undefined)?.trim() ||
        `${baseSiteUrl}/privacy#mobile`),
    termsUrl:
      ((Constants.expoConfig?.extra?.legalTermsUrl as string | undefined)?.trim() ||
        `${baseSiteUrl}/terms#mobile`),
    supportPageUrl:
      ((Constants.expoConfig?.extra?.legalSupportUrl as string | undefined)?.trim() ||
        `${baseSiteUrl}/support#mobile`),
  };
};

export const openExternalUrlWithFallback = async ({
  title,
  url,
  fallbackUrl,
  unableToOpenMessage,
}: {
  title: string;
  url: string;
  fallbackUrl?: string;
  unableToOpenMessage: string;
}) => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
    if (fallbackUrl) {
      const fallbackSupported = await Linking.canOpenURL(fallbackUrl);
      if (fallbackSupported) {
        await Linking.openURL(fallbackUrl);
        return;
      }
    }
    Alert.alert(title, `${unableToOpenMessage}\n${SUPPORT_EMAIL}`);
  } catch {
    Alert.alert(title, `${unableToOpenMessage}\n${SUPPORT_EMAIL}`);
  }
};
