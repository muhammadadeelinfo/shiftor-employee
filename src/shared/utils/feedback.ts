import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeedbackCategory =
  | 'login'
  | 'shift-missing'
  | 'qr'
  | 'documents'
  | 'vacation'
  | 'monthly-hours'
  | 'other';

export type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  message: string;
  userId?: string | null;
  email?: string | null;
  source?: string;
  createdAt: string;
};

export const FEEDBACK_QUEUE_STORAGE_KEY = 'shiftor:feedback-queue';

export const feedbackCategories: FeedbackCategory[] = [
  'login',
  'shift-missing',
  'qr',
  'documents',
  'vacation',
  'monthly-hours',
  'other',
];

const parseFeedbackQueue = (value: string | null): FeedbackEntry[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as FeedbackEntry[]) : [];
  } catch {
    return [];
  }
};

export const buildFeedbackEntry = ({
  category,
  message,
  userId,
  email,
  source = 'support',
}: Omit<FeedbackEntry, 'id' | 'createdAt'>): FeedbackEntry => ({
  id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  category,
  message: message.trim(),
  userId,
  email,
  source,
  createdAt: new Date().toISOString(),
});

export const saveFeedbackEntry = async (entry: FeedbackEntry) => {
  const current = parseFeedbackQueue(await AsyncStorage.getItem(FEEDBACK_QUEUE_STORAGE_KEY));
  const next = [entry, ...current].slice(0, 50);
  await AsyncStorage.setItem(FEEDBACK_QUEUE_STORAGE_KEY, JSON.stringify(next));
  return entry;
};

export const buildFeedbackEmailBody = (entry: FeedbackEntry, categoryLabel: string) =>
  [
    `Category: ${categoryLabel}`,
    `Source: ${entry.source ?? 'support'}`,
    entry.email ? `User email: ${entry.email}` : null,
    entry.userId ? `User ID: ${entry.userId}` : null,
    `Created: ${entry.createdAt}`,
    '',
    entry.message,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
