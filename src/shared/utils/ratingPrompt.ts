import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';

export type RatingMoment =
  | 'shift-confirmed'
  | 'document-uploaded'
  | 'vacation-submitted'
  | 'qr-clock-in'
  | 'qr-clock-out';

type RatingPromptCopy = {
  title: string;
  body: string;
  rateAction: string;
  feedbackAction: string;
  laterAction: string;
};

const RATING_STATE_KEY = 'shiftor:rating-prompt-state';
const MIN_SUCCESS_MOMENTS = 2;
const MIN_DAYS_BETWEEN_PROMPTS = 21;

type RatingPromptState = {
  successCount: number;
  lastPromptedAt?: string;
  ratedAt?: string;
  moments?: Partial<Record<RatingMoment, number>>;
};

const parseRatingState = (value: string | null): RatingPromptState => {
  if (!value) return { successCount: 0, moments: {} };
  try {
    const parsed = JSON.parse(value) as RatingPromptState;
    return {
      successCount: typeof parsed.successCount === 'number' ? parsed.successCount : 0,
      lastPromptedAt: parsed.lastPromptedAt,
      ratedAt: parsed.ratedAt,
      moments: parsed.moments ?? {},
    };
  } catch {
    return { successCount: 0, moments: {} };
  }
};

const getStoreUrl = () => {
  const extra = Constants.expoConfig?.extra ?? {};
  const explicitStoreUrl =
    Platform.OS === 'ios'
      ? (extra.iosAppStoreUrl as string | undefined)
      : (extra.androidPlayStoreUrl as string | undefined);
  if (explicitStoreUrl?.trim()) {
    return explicitStoreUrl.trim();
  }

  const iosAppId = (extra.iosAppStoreId as string | undefined)?.trim();
  if (Platform.OS === 'ios' && iosAppId) {
    return `itms-apps://itunes.apple.com/app/id${iosAppId}?action=write-review`;
  }

  const androidPackage = Constants.expoConfig?.android?.package;
  if (Platform.OS === 'android' && androidPackage) {
    return `market://details?id=${androidPackage}`;
  }

  return null;
};

const daysSince = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
  return (Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000);
};

const shouldPrompt = (state: RatingPromptState) => {
  if (state.ratedAt) return false;
  if (state.successCount < MIN_SUCCESS_MOMENTS) return false;
  return daysSince(state.lastPromptedAt) >= MIN_DAYS_BETWEEN_PROMPTS;
};

export const recordPositiveRatingMoment = async ({
  moment,
  copy,
  onFeedback,
}: {
  moment: RatingMoment;
  copy: RatingPromptCopy;
  onFeedback?: () => void;
}) => {
  const state = parseRatingState(await AsyncStorage.getItem(RATING_STATE_KEY));
  const nextState: RatingPromptState = {
    ...state,
    successCount: state.successCount + 1,
    moments: {
      ...state.moments,
      [moment]: (state.moments?.[moment] ?? 0) + 1,
    },
  };

  if (!shouldPrompt(nextState)) {
    await AsyncStorage.setItem(RATING_STATE_KEY, JSON.stringify(nextState));
    return;
  }

  nextState.lastPromptedAt = new Date().toISOString();
  await AsyncStorage.setItem(RATING_STATE_KEY, JSON.stringify(nextState));

  Alert.alert(copy.title, copy.body, [
    {
      text: copy.laterAction,
      style: 'cancel',
    },
    {
      text: copy.feedbackAction,
      onPress: onFeedback,
    },
    {
      text: copy.rateAction,
      onPress: () => {
        void (async () => {
          const storeUrl = getStoreUrl();
          if (storeUrl) {
            await Linking.openURL(storeUrl).catch(() => null);
          }
          const ratedState = parseRatingState(await AsyncStorage.getItem(RATING_STATE_KEY));
          await AsyncStorage.setItem(
            RATING_STATE_KEY,
            JSON.stringify({ ...ratedState, ratedAt: new Date().toISOString() })
          );
        })();
      },
    },
  ]);
};
