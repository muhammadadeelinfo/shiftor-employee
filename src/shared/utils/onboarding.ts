const ONBOARDING_STORAGE_KEY = 'shiftor-employee-onboarding-complete';

type StorageReader = {
  getItem: (key: string) => Promise<string | null>;
};

type StorageWriter = {
  setItem: (key: string, value: string) => Promise<void>;
};

export const getOnboardingStorageKey = () => ONBOARDING_STORAGE_KEY;

export const loadOnboardingCompletion = async (storage: StorageReader) => {
  const value = await storage.getItem(ONBOARDING_STORAGE_KEY);
  return value === 'true';
};

export const saveOnboardingCompletion = async (storage: StorageWriter) => {
  await storage.setItem(ONBOARDING_STORAGE_KEY, 'true');
};
