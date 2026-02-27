import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useNotifications } from '@shared/context/NotificationContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { languageDefinitions } from '@shared/utils/languageUtils';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase, supabaseStorageBucket } from '@lib/supabaseClient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { layoutTokens } from '@shared/theme/layout';
import { useRouter } from 'expo-router';
import { openAddressInMaps } from '@shared/utils/maps';
import {
  shouldStackForCompactWidth,
} from '@shared/utils/responsiveLayout';
import {
  buildSupportMailto,
  SUPPORT_EMAIL,
  SUPPORT_FALLBACK_URL,
} from '@shared/utils/support';
import Constants from 'expo-constants';
import { formatAddress } from '@shared/utils/address';

const normalizeContactString = (value?: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const capitalizeFirstLetter = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

type EmployeeProfile = Record<string, unknown>;
type CompanySummary = Record<string, unknown>;
const getProfilePhotoCacheKey = (userId: string) => `employee-profile-photo:${userId}`;
const getCanonicalPublicStorageUrl = (baseUrl: string, bucket: string, path: string) =>
  `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
const deriveStoragePathFromUrl = (url: string | null | undefined, bucket: string) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const markerPublic = `/storage/v1/object/public/${bucket}/`;
    const markerSign = `/storage/v1/object/sign/${bucket}/`;
    const markerRender = `/storage/v1/render/image/public/${bucket}/`;
    const path = parsed.pathname;
    if (path.includes(markerPublic)) {
      return decodeURIComponent(path.split(markerPublic)[1] || '').trim() || null;
    }
    if (path.includes(markerSign)) {
      return decodeURIComponent(path.split(markerSign)[1] || '').trim() || null;
    }
    if (path.includes(markerRender)) {
      return decodeURIComponent(path.split(markerRender)[1] || '').trim() || null;
    }
    return null;
  } catch {
    return null;
  }
};

const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42703';

const isMissingFunctionError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return code === '42883' || code === 'PGRST202' || /function .* does not exist/i.test(message);
};

const isRpcSignatureMismatchError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /Could not find the function/i.test(message) ||
    /request_employee_company_link/i.test(message)
  );
};

const getReadableErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (error && typeof error === 'object') {
    const knownKeys = ['message', 'error_description', 'details', 'hint'] as const;
    for (const key of knownKeys) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }
  return fallback;
};

const fetchEmployeeProfile = async (
  employeeId: string,
  email?: string | null,
  metadata?: Record<string, unknown>
): Promise<EmployeeProfile | null> => {
  if (!supabase) {
    console.warn('Supabase client not configured; skipping employee profile fetch.');
    return null;
  }

  const candidateLookups: Array<{ column: string; value: string }> = [
    { column: 'id', value: employeeId },
    { column: 'employeeId', value: employeeId },
    { column: 'employee_id', value: employeeId },
    { column: 'userId', value: employeeId },
    { column: 'user_id', value: employeeId },
    { column: 'auth_user_id', value: employeeId },
    { column: 'authUserId', value: employeeId },
    { column: 'profile_id', value: employeeId },
    { column: 'profileId', value: employeeId },
  ];
  if (email) {
    candidateLookups.push({ column: 'email', value: email });
  }
  const metadataEmployeeIdCandidates = [
    getStringField(metadata, 'employee_id'),
    getStringField(metadata, 'employeeId'),
    getStringField(metadata, 'profile_id'),
    getStringField(metadata, 'profileId'),
  ].filter((value): value is string => Boolean(value));
  metadataEmployeeIdCandidates.forEach((value) => {
    candidateLookups.push({ column: 'id', value });
    candidateLookups.push({ column: 'employee_id', value });
    candidateLookups.push({ column: 'employeeId', value });
  });

  const seenLookups = new Set<string>();
  for (const lookup of candidateLookups) {
    const dedupeKey = `${lookup.column}:${lookup.value}`;
    if (seenLookups.has(dedupeKey)) {
      continue;
    }
    seenLookups.add(dedupeKey);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq(lookup.column, lookup.value)
      .limit(1);

    if (error) {
      if (isMissingColumnError(error)) {
        continue;
      }
      console.warn('Failed to load employee profile', error);
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as EmployeeProfile;
    }
  }

  return null;
};

const fetchCompanySummary = async (companyId: string): Promise<CompanySummary | null> => {
  if (!supabase) {
    return null;
  }
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'get_employee_current_company_profile',
    { target_company_id: companyId }
  );
  if (!rpcError && rpcData && typeof rpcData === 'object' && !Array.isArray(rpcData)) {
    return rpcData as CompanySummary;
  }
  if (rpcError && !isMissingFunctionError(rpcError)) {
    console.warn('Failed to load company summary via RPC', rpcError);
  }

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingColumnError(error)) {
      return null;
    }
    console.warn('Failed to load company summary', error);
    return null;
  }
  if (!data || typeof data !== 'object') {
    return null;
  }
  return data as CompanySummary;
};

const requestCompanyLink = async (joinCode: string, fullName: string) => {
  if (!supabase) {
    throw new Error('Supabase client not configured');
  }
  const attempts: Array<Record<string, unknown>> = [
    { join_code: joinCode, full_name: fullName },
    { join_code: joinCode },
  ];

  let lastSignatureError: unknown = null;
  for (const params of attempts) {
    const { data, error } = await supabase.rpc('request_employee_company_link', params);
    if (!error) {
      return data;
    }
    if (isRpcSignatureMismatchError(error)) {
      lastSignatureError = error;
      continue;
    }
    throw error;
  }

  if (lastSignatureError) {
    throw lastSignatureError;
  }
  throw new Error('Failed to request company link.');
};

const getStringField = (source?: Record<string, unknown>, key?: string) => {
  if (!source || !key) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const formatAddressParts = (parts: {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
}) => {
  const streetLine = [parts.street, parts.houseNumber].filter(Boolean).join(' ').trim();
  const cityLine = [parts.postalCode, parts.city].filter(Boolean).join(' ').trim();
  return [streetLine, cityLine, parts.state, parts.country].filter(Boolean).join(', ');
};

const formatMetadataAddress = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;
  const addressCandidate = metadata.address;
  if (typeof addressCandidate === 'string' && addressCandidate.trim()) {
    return addressCandidate.trim();
  }
  if (addressCandidate && typeof addressCandidate === 'object') {
    const structured = formatAddressParts({
      street:
        getStringField(addressCandidate as Record<string, unknown>, 'street') ??
        getStringField(addressCandidate as Record<string, unknown>, 'line1') ??
        getStringField(addressCandidate as Record<string, unknown>, 'addressLine1'),
      houseNumber:
        getStringField(addressCandidate as Record<string, unknown>, 'house_number') ??
        getStringField(addressCandidate as Record<string, unknown>, 'houseNumber'),
      postalCode:
        getStringField(addressCandidate as Record<string, unknown>, 'postal_code') ??
        getStringField(addressCandidate as Record<string, unknown>, 'postalCode'),
      city: getStringField(addressCandidate as Record<string, unknown>, 'city'),
      state: getStringField(addressCandidate as Record<string, unknown>, 'state'),
      country: getStringField(addressCandidate as Record<string, unknown>, 'country'),
    });
    if (structured) return structured;
  }
  const fallbackStructured = formatAddressParts({
    street: getStringField(metadata, 'street'),
    houseNumber: getStringField(metadata, 'house_number') ?? getStringField(metadata, 'houseNumber'),
    postalCode: getStringField(metadata, 'postal_code') ?? getStringField(metadata, 'postalCode'),
    city: getStringField(metadata, 'city'),
    state: getStringField(metadata, 'state'),
    country: getStringField(metadata, 'country'),
  });
  if (fallbackStructured) return fallbackStructured;
  return getStringField(metadata, 'location');
};

const getPhoneNumber = (metadata?: Record<string, unknown>) =>
  getStringField(metadata, 'phone') ??
  getStringField(metadata, 'phone_number') ??
  getStringField(metadata, 'mobile') ??
  getStringField(metadata, 'phoneNumber');

const getNestedString = (source: unknown, path: string[]): string | undefined => {
  let cursor: unknown = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== 'object' || !(key in (cursor as Record<string, unknown>))) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.trim() ? cursor.trim() : undefined;
};

const getProfilePhone = (profile?: EmployeeProfile | null) => {
  if (!profile) return undefined;
  const direct = [
    'mobile',
    'phone',
    'phone_number',
    'phoneNumber',
    'telephone',
    'contact_phone',
    'contactPhone',
  ]
    .map((key) => getStringField(profile, key))
    .find(Boolean);
  return direct ?? undefined;
};

const getProfileAddress = (profile?: EmployeeProfile | null) => {
  if (!profile) return undefined;
  const direct = [
    'address',
    'full_address',
    'fullAddress',
    'location',
    'street_address',
    'streetAddress',
  ]
    .map((key) => getStringField(profile, key))
    .find(Boolean);
  if (direct) return direct;

  return formatAddressParts({
    street:
      getStringField(profile, 'street') ??
      getStringField(profile, 'line1') ??
      getStringField(profile, 'addressLine1'),
    houseNumber: getStringField(profile, 'house_number') ?? getStringField(profile, 'houseNumber'),
    postalCode: getStringField(profile, 'postal_code') ?? getStringField(profile, 'postalCode'),
    city: getStringField(profile, 'city'),
    state: getStringField(profile, 'state'),
    country: getStringField(profile, 'country'),
  });
};

const getLinkedCompanyId = (
  profile?: EmployeeProfile | null,
  metadata?: Record<string, unknown>
) => {
  const profileCompanyId =
    getStringField(profile ?? undefined, 'companyId') ??
    getStringField(profile ?? undefined, 'company_id');
  if (profileCompanyId) {
    return profileCompanyId;
  }
  return getStringField(metadata, 'companyId') ?? getStringField(metadata, 'company_id');
};

const getCompanyAddress = (source?: Record<string, unknown> | null) => {
  if (!source) return undefined;
  const direct = [
    'address',
    'full_address',
    'fullAddress',
    'street_address',
    'streetAddress',
    'location',
  ]
    .map((key) => getStringField(source, key))
    .find(Boolean);
  if (direct) return direct;

  const composed = [
    'line1',
    'line2',
    'street',
    'city',
    'state',
    'postal_code',
    'postalCode',
    'country',
  ]
    .map((key) => getStringField(source, key))
    .filter((part): part is string => Boolean(part));
  return composed.length ? composed.join(', ') : undefined;
};

const getEmployeeCompanyAddress = (source?: Record<string, unknown> | null) => {
  if (!source) return undefined;

  const direct = [
    'companyAddress',
    'company_address',
    'companyFullAddress',
    'company_full_address',
    'companyStreetAddress',
    'company_street_address',
    'companyLocation',
    'company_location',
  ]
    .map((key) => getStringField(source, key))
    .find(Boolean);
  if (direct) return direct;

  const composed = [
    'companyLine1',
    'company_line1',
    'companyLine2',
    'company_line2',
    'companyStreet',
    'company_street',
    'companyCity',
    'company_city',
    'companyState',
    'company_state',
    'companyPostalCode',
    'company_postal_code',
    'companyCountry',
    'company_country',
  ]
    .map((key) => getStringField(source, key))
    .filter((part): part is string => Boolean(part));

  return composed.length ? composed.join(', ') : undefined;
};

const getMetadataPhoneDeep = (metadata?: Record<string, unknown>) =>
  getPhoneNumber(metadata) ??
  getNestedString(metadata, ['contact', 'phone']) ??
  getNestedString(metadata, ['contact', 'mobile']) ??
  getNestedString(metadata, ['profile', 'phone']) ??
  getNestedString(metadata, ['profile', 'mobile']);

const getMetadataAddressDeep = (metadata?: Record<string, unknown>) =>
  formatMetadataAddress(metadata) ??
  getNestedString(metadata, ['contact', 'address']) ??
  getNestedString(metadata, ['profile', 'address']) ??
  getNestedString(metadata, ['address', 'formatted']);

const profileName = (user: ReturnType<typeof useAuth>['user'] | null) => {
  if (!user) return 'Guest';
  const metadataName = user.user_metadata?.full_name;
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return capitalizeFirstLetter(metadataName);
  }
  return capitalizeFirstLetter(user.email?.split('@')[0] ?? 'Employee');
};

const shiftStatus = (metadata?: Record<string, unknown> | null) => {
  if (!metadata) return 'Active';
  const customStatus = metadata?.status;
  if (typeof customStatus === 'string' && customStatus.trim()) {
    return customStatus;
  }
  return 'Active';
};

export default function AccountScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { width, height } = useWindowDimensions();
  const isLargeTablet = width >= 1024;
  const isIOS = Platform.OS === 'ios';
  const shouldStackHeroHeader = shouldStackForCompactWidth(width);
  const employeeId = user?.id;
  const metadata = user?.user_metadata;
  const metadataRecord =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : undefined;
  const { data: freshAuthMetadata } = useQuery({
    queryKey: ['authUserMetadata', user?.id],
    queryFn: async () => {
      if (!supabase || !user?.id) return null;
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      const fresh = data.user?.user_metadata;
      return fresh && typeof fresh === 'object' ? (fresh as Record<string, unknown>) : null;
    },
    enabled: Boolean(user?.id && supabase),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const mergedMetadataRecord = {
    ...(metadataRecord ?? {}),
    ...(freshAuthMetadata ?? {}),
  } as Record<string, unknown>;
  const {
    data: employeeRecord,
  } = useQuery({
    queryKey: [
      'employeeProfile',
      employeeId,
      user?.email,
      mergedMetadataRecord?.employee_id,
      mergedMetadataRecord?.employeeId,
      mergedMetadataRecord?.profile_id,
      mergedMetadataRecord?.profileId,
    ],
    queryFn: () =>
      employeeId ? fetchEmployeeProfile(employeeId, user?.email, mergedMetadataRecord) : null,
    enabled: !!employeeId,
    staleTime: 60_000,
  });
  const status = shiftStatus(user?.user_metadata);
  const translatedStatus = status === 'Active' ? t('statusActive') : status;
  const contactPhone =
    normalizeContactString(getProfilePhone(employeeRecord)) ??
    normalizeContactString(user?.phone) ??
    getMetadataPhoneDeep(metadata);
  const contactAddress =
    normalizeContactString(getProfileAddress(employeeRecord)) ?? getMetadataAddressDeep(metadata);
  const linkedCompanyId = getLinkedCompanyId(employeeRecord, mergedMetadataRecord);
  const { data: companySummary } = useQuery({
    queryKey: ['companySummary', linkedCompanyId],
    queryFn: () => (linkedCompanyId ? fetchCompanySummary(linkedCompanyId) : null),
    enabled: Boolean(linkedCompanyId),
    staleTime: 60_000,
  });
  const requestedCompanyCode = getStringField(mergedMetadataRecord, 'requested_company_code');
  const [joinCode, setJoinCode] = useState(requestedCompanyCode ?? '');
  const joinCodeInputRef = useRef<TextInput | null>(null);
  const [linkingCompany, setLinkingCompany] = useState(false);
  const canRequestCompanyAccess = Boolean(user?.id);
  const isSwitchFlow = Boolean(linkedCompanyId);
  const currentCompanyName =
    getStringField(companySummary ?? undefined, 'name') ??
    getStringField(employeeRecord ?? undefined, 'companyName') ??
    getStringField(employeeRecord ?? undefined, 'company_name') ??
    t('companyUnknownName');
  const currentCompanyLogoUrl =
    getStringField(companySummary ?? undefined, 'logo_url') ??
    getStringField(companySummary ?? undefined, 'logoUrl') ??
    getStringField(companySummary ?? undefined, 'logo') ??
    getStringField(employeeRecord ?? undefined, 'companyLogoUrl') ??
    getStringField(employeeRecord ?? undefined, 'company_logo_url') ??
    getStringField(employeeRecord ?? undefined, 'companyLogo') ??
    getStringField(employeeRecord ?? undefined, 'company_logo');
  const currentCompanyAddress =
    getCompanyAddress(companySummary ?? undefined) ??
    getEmployeeCompanyAddress(employeeRecord ?? undefined) ??
    t('notProvided');
  const currentCompanyAddressParts = formatAddress(currentCompanyAddress);
  const currentCompanyInitials = currentCompanyName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const handleSignOut = () => {
    signOut();
  };
  const handleResetPassword = async () => {
    const email = user?.email?.trim();
    if (!email) {
      Alert.alert(t('securityResetPassword'), t('notProvided'));
      return;
    }
    if (!supabase) {
      Alert.alert(t('securityResetPassword'), t('authClientUnavailable'));
      return;
    }
    const redirectUrl =
      (Constants.expoConfig?.extra?.authRedirectUrl as string | undefined)?.trim() || undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) {
      Alert.alert(t('securityResetPassword'), error.message);
      return;
    }
    Alert.alert(t('securityResetPassword'), t('securityResetLinkSent', { email }));
  };
  const handleManageSessions = async () => {
    if (!supabase) {
      Alert.alert(t('securityManageSessions'), t('authClientUnavailable'));
      return;
    }
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    if (error) {
      Alert.alert(t('securityManageSessions'), error.message);
      return;
    }
    Alert.alert(t('securityManageSessions'), t('securitySessionsSignedOutOthers'));
  };
  const handleCheckTwoFactor = async () => {
    if (!supabase) {
      Alert.alert(t('securityEnable2fa'), t('authClientUnavailable'));
      return;
    }
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const factors = [...(data?.all ?? [])];
      const verifiedCount = factors.filter((factor) => factor.status === 'verified').length;
      if (verifiedCount > 0) {
        Alert.alert(t('securityEnable2fa'), t('security2faEnabled', { count: verifiedCount }));
        return;
      }
      Alert.alert(t('securityEnable2fa'), t('security2faNotVerified'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('security2faStatusCheckFailed');
      Alert.alert(t('securityEnable2fa'), message);
    }
  };
  const openExternalUrl = async (title: string, url: string, fallbackUrl?: string) => {
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
      Alert.alert(title, `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    } catch {
      Alert.alert(title, `${t('unableOpenLinkDevice')}\n${SUPPORT_EMAIL}`);
    }
  };
  const baseSiteUrl = SUPPORT_FALLBACK_URL.replace(/\/+$/, '');
  const privacyPolicyUrl =
    ((Constants.expoConfig?.extra?.legalPrivacyUrl as string | undefined)?.trim() || `${baseSiteUrl}/privacy#mobile`);
  const termsUrl =
    ((Constants.expoConfig?.extra?.legalTermsUrl as string | undefined)?.trim() || `${baseSiteUrl}/terms#mobile`);
  const supportPageUrl =
    ((Constants.expoConfig?.extra?.legalSupportUrl as string | undefined)?.trim() || `${baseSiteUrl}/support#mobile`);
  const handlePrivacyPolicy = async () => {
    await openExternalUrl(t('aboutPrivacyPolicy'), privacyPolicyUrl, SUPPORT_FALLBACK_URL);
  };
  const handleTerms = async () => {
    await openExternalUrl(t('aboutTerms'), termsUrl, SUPPORT_FALLBACK_URL);
  };
  const handleHelpCenter = async () => {
    await openExternalUrl(t('supportHelpCenter'), supportPageUrl, SUPPORT_FALLBACK_URL);
  };
  const confirmCompanySwitch = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        t('companySwitchConfirmTitle'),
        t('companySwitchConfirmBody'),
        [
          { text: t('commonCancel') || 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: t('commonContinue') || 'Continue', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  const handleRequestCompanyAccess = async () => {
    const normalizedJoinCode = joinCode.trim().toUpperCase();
    if (!normalizedJoinCode) {
      Alert.alert(t('companyLinkTitle'), t('companyLinkEnterCodeBody'));
      return;
    }
    if (!supabase) {
      Alert.alert(t('companyLinkTitle'), t('authClientUnavailable'));
      return;
    }
    if (isSwitchFlow) {
      const confirmed = await confirmCompanySwitch();
      if (!confirmed) {
        return;
      }
    }

    try {
      setLinkingCompany(true);
      const fullName = getStringField(mergedMetadataRecord, 'full_name') ?? profileName(user);
      const data = await requestCompanyLink(normalizedJoinCode, fullName);
      const refreshAfterAlert = () => {
        setJoinCode('');
        void queryClient.invalidateQueries({ queryKey: ['employeeProfile'] });
        void queryClient.invalidateQueries({ queryKey: ['companySummary'] });
      };

      const payload = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
      const status = typeof payload.status === 'string' ? payload.status : null;
      const requestedAction =
        typeof payload.requestedAction === 'string' ? payload.requestedAction : 'join';
      const ok = payload.ok === true;
      const showLinkAlert = (message: string) =>
        Alert.alert(t('companyLinkTitle'), message, [
          { text: 'OK', onPress: refreshAfterAlert },
        ]);

      if (status === 'invalid_code') {
        showLinkAlert(t('companyLinkInvalidCodeBody'));
        return;
      }
      if (status === 'active') {
        showLinkAlert(t('companyLinkAlreadyActiveBody'));
        return;
      }
      if (status === 'code_expired') {
        showLinkAlert(t('companyLinkCodeExpiredBody'));
        return;
      }
      if (status === 'code_exhausted') {
        showLinkAlert(t('companyLinkCodeExhaustedBody'));
        return;
      }
      if (status === 'rate_limited') {
        showLinkAlert(t('companyLinkRateLimitedBody'));
        return;
      }

      if (ok) {
        showLinkAlert(
          requestedAction === 'switch'
            ? t('companyLinkSwitchRequestedBody')
            : t('companyLinkRequestedBody')
        );
      }
    } catch (error) {
      Alert.alert(
        t('companyLinkTitle'),
        getReadableErrorMessage(error, t('authUnableSignIn')),
        [{ text: 'OK', onPress: () => setJoinCode('') }]
      );
    } finally {
      setLinkingCompany(false);
    }
  };
  const handleDeleteAccount = async () => {
    const email = user?.email?.trim() || '';
    await openExternalUrl(
      t('supportDeleteAccount'),
      buildSupportMailto(
        'Delete my account',
        `Please delete my account${email ? ` for ${email}` : ''}.`
      ),
      SUPPORT_FALLBACK_URL
    );
  };
  const contentContainerStyle = [
    styles.content,
    { paddingBottom: 28 + insets.bottom + tabBarHeight },
  ];
  const noValueLabel = t('notProvided');
  const addressParts = formatAddress(contactAddress);
  const contactFields: Array<{
    label: string;
    value: string;
    icon: 'mail-outline' | 'call-outline' | 'location-outline';
    mapAddress?: string;
    valueLines?: string[];
  }> = [
    { label: t('emailLabel'), value: user?.email ?? noValueLabel, icon: 'mail-outline' as const },
    { label: t('phoneLabel'), value: contactPhone ?? noValueLabel, icon: 'call-outline' as const },
    {
      label: t('addressLabel'),
      value: contactAddress ?? noValueLabel,
      icon: 'location-outline' as const,
      mapAddress: contactAddress,
      valueLines: addressParts ? [addressParts.label, addressParts.meta] : undefined,
    },
  ];
  const heroGradientColors: [string, string, ...string[]] = [
    theme.heroGradientStart,
    theme.heroGradientEnd,
    theme.surfaceMuted,
  ];
  const appName =
    ((Constants.expoConfig?.name as string | undefined)?.trim() || 'Shiftor Employee');
  const appVersion = ((Constants.expoConfig?.version as string | undefined)?.trim() || '1.0.0');
  const iosBuildNumber = ((Constants.expoConfig?.ios?.buildNumber as string | undefined)?.trim() || '');
  const androidBuildCode =
    typeof Constants.expoConfig?.android?.versionCode === 'number'
      ? String(Constants.expoConfig.android.versionCode)
      : '';
  const appBuild = iosBuildNumber || androidBuildCode;
  const appVersionLabel = appBuild ? `${appVersion} (${appBuild})` : appVersion;
  const initials = profileName(user)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const profilePhotoUrl =
    getStringField(employeeRecord ?? undefined, 'photoUrl') ??
    getStringField(employeeRecord ?? undefined, 'photo_url') ??
    getStringField(employeeRecord ?? undefined, 'avatarUrl') ??
    getStringField(employeeRecord ?? undefined, 'avatar_url') ??
    getStringField(mergedMetadataRecord, 'photoUrl') ??
    getStringField(mergedMetadataRecord, 'photo_url') ??
    getStringField(mergedMetadataRecord, 'avatar_url');
  const profilePhotoPath =
    getStringField(employeeRecord ?? undefined, 'photoPath') ??
    getStringField(employeeRecord ?? undefined, 'photo_path') ??
    getStringField(employeeRecord ?? undefined, 'avatarPath') ??
    getStringField(employeeRecord ?? undefined, 'avatar_path') ??
    getStringField(mergedMetadataRecord, 'photoPath') ??
    getStringField(mergedMetadataRecord, 'photo_path') ??
    getStringField(mergedMetadataRecord, 'avatar_path');
  const profilePhotoUpdatedAt =
    getStringField(employeeRecord ?? undefined, 'photo_updated_at') ??
    getStringField(mergedMetadataRecord, 'photo_updated_at');
  const deterministicProfilePhotoPath = user?.id ? `employees/${user.id}/avatar/latest.jpg` : null;
  const supabaseBaseUrl = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)?.trim();
  const deterministicProfilePhotoPublicUrl =
    supabaseBaseUrl && deterministicProfilePhotoPath
      ? getCanonicalPublicStorageUrl(supabaseBaseUrl, supabaseStorageBucket, deterministicProfilePhotoPath)
      : null;
  const { data: cachedProfilePhoto } = useQuery({
    queryKey: ['profilePhotoCache', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const raw = await AsyncStorage.getItem(getProfilePhotoCacheKey(user.id));
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as { url?: string | null; path?: string | null; localUri?: string | null };
        return parsed;
      } catch {
        return null;
      }
    },
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const effectiveProfilePhotoPath =
    profilePhotoPath ??
    deterministicProfilePhotoPath ??
    cachedProfilePhoto?.path ??
    deriveStoragePathFromUrl(profilePhotoUrl, supabaseStorageBucket) ??
    deriveStoragePathFromUrl(cachedProfilePhoto?.url ?? null, supabaseStorageBucket) ??
    null;
  const profilePhotoPublicUrlFromPath = useMemo(() => {
    if (!supabase || !effectiveProfilePhotoPath) return null;
    const { data } = supabase.storage.from(supabaseStorageBucket).getPublicUrl(effectiveProfilePhotoPath);
    return data?.publicUrl ?? null;
  }, [effectiveProfilePhotoPath]);
  const { data: profilePhotoSignedUrl } = useQuery({
    queryKey: ['profilePhotoSignedUrl', effectiveProfilePhotoPath],
    queryFn: async () => {
      if (!supabase || !effectiveProfilePhotoPath) return null;
      const { data, error } = await supabase.storage
        .from(supabaseStorageBucket)
        .createSignedUrl(effectiveProfilePhotoPath, 60 * 60 * 24);
      if (error) return null;
      return data.signedUrl;
    },
    enabled: Boolean(supabase && effectiveProfilePhotoPath),
    staleTime: 30 * 60_000,
  });
  const appendVersionQuery = (url: string | null) => {
    if (!url || !profilePhotoUpdatedAt) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(profilePhotoUpdatedAt)}`;
  };
  const profilePhotoCandidates = useMemo(
    () =>
      [
        appendVersionQuery(deterministicProfilePhotoPublicUrl),
        appendVersionQuery(profilePhotoSignedUrl),
        appendVersionQuery(profilePhotoUrl),
        appendVersionQuery(profilePhotoPublicUrlFromPath),
        appendVersionQuery(cachedProfilePhoto?.url ?? null),
        cachedProfilePhoto?.localUri ?? null,
      ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index),
    [
      profilePhotoSignedUrl,
      profilePhotoUrl,
      profilePhotoPublicUrlFromPath,
      deterministicProfilePhotoPublicUrl,
      cachedProfilePhoto?.url,
      cachedProfilePhoto?.localUri,
      profilePhotoUpdatedAt,
    ]
  );
  const [avatarSourceIndex, setAvatarSourceIndex] = useState(0);
  useEffect(() => {
    setAvatarSourceIndex(0);
  }, [profilePhotoCandidates.join('|')]);
  const resolvedProfilePhotoUrl =
    avatarSourceIndex >= 0 ? profilePhotoCandidates[avatarSourceIndex] ?? null : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <FlatList
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        alwaysBounceVertical
        bounces
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        scrollEnabled
        directionalLockEnabled
        keyboardDismissMode="on-drag"
        scrollIndicatorInsets={
          isIOS ? { bottom: tabBarHeight + insets.bottom } : undefined
        }
        ListFooterComponent={<View style={[styles.footerSpacer, { height: tabBarHeight + insets.bottom }]} />}
        data={[{ key: 'account' }]}
        keyExtractor={(item) => item.key}
        ListHeaderComponentStyle={styles.headerSpacing}
        ListHeaderComponent={
          <View style={styles.constrained}>
            <LinearGradient
              colors={heroGradientColors}
              style={[
                styles.headerGradient,
                styles.headerGlass,
                { paddingTop: isIOS ? 14 : 16 },
              ]}
              start={[0, 0]}
              end={[1, 1]}
            >
              <View style={styles.heroGlow} />
              <View
                style={[
                  styles.heroCard,
                  { backgroundColor: 'rgba(255,255,255,0.06)' },
                  isIOS && styles.heroCardIOS,
                ]}
              >
                <View style={[styles.heroHeader, shouldStackHeroHeader ? styles.heroHeaderCompact : null]}>
                  <View style={styles.heroIdentity}>
                    <View style={[styles.avatar, { backgroundColor: theme.primary }, isIOS && styles.avatarIOS]}>
                      {resolvedProfilePhotoUrl ? (
                        <Image
                          source={{ uri: resolvedProfilePhotoUrl }}
                          style={styles.avatarImage}
                          resizeMode="cover"
                          onError={() => {
                            setAvatarSourceIndex((current) => {
                              const next = current + 1;
                              return next < profilePhotoCandidates.length ? next : -1;
                            });
                          }}
                        />
                      ) : (
                        <Text style={styles.avatarText}>{initials}</Text>
                      )}
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.profileGreeting,
                          { color: theme.textPrimary },
                          isIOS && styles.profileGreetingIOS,
                        ]}
                      >
                        {t('profileGreeting', { name: profileName(user) })}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: theme.primaryAccent },
                      isIOS && styles.statusBadgeIOS,
                      shouldStackHeroHeader ? styles.statusBadgeCompact : null,
                    ]}
                  >
                    <Text style={styles.statusBadgeText}>{translatedStatus}</Text>
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>
        }
        renderItem={() => (
          <View
            style={[
              styles.body,
              styles.constrained,
              isIOS && styles.bodyIOS,
            ]}
          >
            <View
              style={[
                styles.sectionCard,
                styles.sectionCardFirst,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <View style={styles.sectionHeadingRow}>
                <Text style={[styles.sectionHeading, styles.sectionHeadingInRow, { color: theme.textPrimary }]}>
                  {t('accountSnapshot')}
                </Text>
                <TouchableOpacity
                  style={[styles.sectionActionChip, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                  onPress={() => router.push('/profile-edit')}
                >
                  <Ionicons name="create-outline" size={14} color={theme.primary} />
                  <Text style={[styles.sectionActionText, { color: theme.primary }]}>{t('profileEditButton')}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.infoGrid}>
                {[
                  { label: t('emailVerifiedLabel'), value: user?.email_confirmed_at ? t('yes') : t('pending') },
                  {
                    label: t('notificationsSectionTitle'),
                    value: unreadCount > 0 ? `${unreadCount}` : t('notificationsPanelEmpty'),
                  },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={[
                      styles.infoCard,
                      { backgroundColor: theme.surfaceMuted },
                      isIOS && styles.infoCardIOS,
                    ]}
                  >
                    <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
                    <Text style={[styles.infoValue, { color: theme.textPrimary }]}>{stat.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.contactList}>
                <Text style={[styles.contactSectionTitle, { color: theme.textSecondary }]}>{t('contactInformation')}</Text>
                {contactFields.map((field) => (
                  <View
                    key={field.label}
                    style={[
                      styles.contactRow,
                      { borderColor: theme.borderSoft },
                      isIOS && styles.contactRowIOS,
                    ]}
                  >
                    <View
                      style={[
                        styles.contactIconWrap,
                        { backgroundColor: theme.surfaceMuted },
                        isIOS && styles.contactIconWrapIOS,
                      ]}
                    >
                      <Ionicons name={field.icon} size={16} color={theme.primary} />
                    </View>
                    <View style={styles.contactContent}>
                      <Text style={[styles.contactLabel, { color: theme.textSecondary }]}>{field.label}</Text>
                      {field.valueLines?.length ? (
                        <View>
                          <Text style={[styles.contactValue, { color: theme.textPrimary }]}>
                            {field.valueLines[0]}
                          </Text>
                          {field.valueLines[1] ? (
                            <Text style={[styles.contactValueSecondary, { color: theme.textSecondary }]}>
                              {field.valueLines[1]}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={[styles.contactValue, { color: theme.textPrimary }]}>{field.value}</Text>
                      )}
                    </View>
                    {field.mapAddress ? (
                      <TouchableOpacity
                        style={[
                          styles.contactMapButton,
                          {
                            backgroundColor: theme.surfaceMuted,
                            borderColor: theme.borderSoft,
                          },
                        ]}
                        onPress={() => openAddressInMaps(field.mapAddress)}
                        accessibilityRole="button"
                        accessibilityLabel={t('openInMaps')}
                      >
                        <Ionicons name="map-outline" size={15} color={theme.info} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
            {canRequestCompanyAccess ? (
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                  isIOS && styles.sectionCardIOS,
                ]}
              >
                <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                  {isSwitchFlow ? t('companySwitchSectionTitle') : t('companyJoinSectionTitle')}
                </Text>
                {isSwitchFlow ? (
                  <View>
                    <Text style={[styles.contactSectionTitle, { color: theme.textSecondary }]}>
                      {t('companyCurrentInfoLabel')}
                    </Text>
                    <View
                      style={[
                        styles.companyInfoCard,
                        { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                      ]}
                    >
                      <View style={[styles.companyProfileTop, { borderColor: theme.borderSoft }]}>
                        <View style={[styles.companyLogoFrame, { borderColor: theme.borderSoft }]}>
                          {currentCompanyLogoUrl ? (
                            <Image
                              source={{ uri: currentCompanyLogoUrl }}
                              style={styles.companyLogoPreview}
                              resizeMode="contain"
                            />
                          ) : (
                            <Text style={[styles.companyLogoFallbackText, { color: theme.textPrimary }]}>
                              {currentCompanyInitials || 'CO'}
                            </Text>
                          )}
                        </View>
                        <View style={styles.companyProfileBody}>
                          <Text style={[styles.companyProfileLabel, { color: theme.textSecondary }]}>
                            {t('companyCurrentNameLabel')}
                          </Text>
                          <Text style={[styles.companyProfileName, { color: theme.textPrimary }]}>
                            {currentCompanyName}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.companyAddressRow, { borderColor: theme.borderSoft }]}>
                        <Text style={[styles.companyProfileLabel, { color: theme.textSecondary }]}>
                          {t('companyCurrentAddressLabel')}
                        </Text>
                        {currentCompanyAddressParts ? (
                          <View>
                            <Text style={[styles.companyAddressValue, { color: theme.textPrimary }]}>
                              {currentCompanyAddressParts.label}
                            </Text>
                            {currentCompanyAddressParts.meta ? (
                              <Text style={[styles.companyAddressValueSecondary, { color: theme.textSecondary }]}>
                                {currentCompanyAddressParts.meta}
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <Text style={[styles.companyAddressValue, { color: theme.textPrimary }]}>
                            {currentCompanyAddress}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ) : null}
                <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                  {isSwitchFlow ? t('companySwitchSectionHint') : t('companyJoinSectionHint')}
                </Text>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => joinCodeInputRef.current?.focus()}
                  disabled={linkingCompany}
                  style={[
                    styles.companyJoinInputWrap,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
                  ]}
                >
                  <TextInput
                    ref={joinCodeInputRef}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder={t('companyJoinCodePlaceholder')}
                    placeholderTextColor={theme.textPlaceholder}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    autoComplete="off"
                    editable={!linkingCompany}
                    returnKeyType="done"
                    style={[styles.companyJoinInput, { color: theme.textPrimary }]}
                  />
                </TouchableOpacity>
                {requestedCompanyCode ? (
                  <Text style={[styles.companyJoinPendingText, { color: theme.textSecondary }]}>
                    {t('companyJoinPendingHint')}
                  </Text>
                ) : null}
                <PrimaryButton
                  title={isSwitchFlow ? t('companySwitchRequestButton') : t('companyJoinRequestButton')}
                  onPress={() => void handleRequestCompanyAccess()}
                  loading={linkingCompany}
                />
              </View>
            ) : null}

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('securitySectionTitle')}
              </Text>
              <View style={styles.toolsList}>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => void handleResetPassword()}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="key-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('securityResetPassword')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => void handleManageSessions()}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="phone-portrait-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('securityManageSessions')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => void handleCheckTwoFactor()}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('securityEnable2fa')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('notificationsSectionTitle')}
              </Text>
              <View style={styles.toolsList}>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => router.push('/notifications')}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="notifications-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('notificationsPush')}
                  </Text>
                  {unreadCount > 0 ? (
                    <View style={styles.toolsBadge}>
                      <Text style={styles.toolsBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                    </View>
                  ) : null}
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('aboutSectionTitle')}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                {t('aboutSectionHint')}
              </Text>
              <View style={styles.aboutMetaList}>
                {[
                  { label: t('aboutAppName'), value: appName },
                  { label: t('aboutVersion'), value: appVersionLabel },
                ].map((entry) => (
                  <View key={entry.label} style={[styles.aboutMetaRow, { borderColor: theme.borderSoft }]}>
                    <Text style={[styles.aboutMetaLabel, { color: theme.textSecondary }]}>{entry.label}</Text>
                    <Text style={[styles.aboutMetaValue, { color: theme.textPrimary }]}>{entry.value}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.toolsList}>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => void handlePrivacyPolicy()}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="shield-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('aboutPrivacyPolicy')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => void handleTerms()}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="document-text-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('aboutTerms')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('preferencesTitle')}
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                {t('preferencesLanguageHint')}
              </Text>
              <View style={styles.preferenceGroup}>
                <Text style={[styles.preferenceLabel, { color: theme.textSecondary }]}>
                  {t('languageLabel')}
                </Text>
                <View
                  style={[
                    styles.languageToggleList,
                    {
                      backgroundColor: theme.surfaceMuted,
                      borderColor: theme.borderSoft,
                    },
                  ]}
                >
                  {languageDefinitions.map((definition) => {
                    const isActive = language === definition.code;
                    return (
                      <TouchableOpacity
                        key={definition.code}
                        onPress={() => setLanguage(definition.code)}
                        style={[
                          styles.languageToggleItem,
                          {
                            backgroundColor: isActive ? theme.surface : 'transparent',
                            borderColor: isActive ? theme.primary : 'transparent',
                          },
                          isActive && styles.languageToggleItemActive,
                        ]}
                      >
                        {isActive ? (
                          <LinearGradient
                            colors={[`${theme.primary}22`, `${theme.primaryAccent}33`]}
                            start={[0, 0]}
                            end={[1, 1]}
                            style={styles.languageActiveGradient}
                            pointerEvents="none"
                          />
                        ) : null}
                        <View style={styles.languageChipLeft}>
                          <Text style={styles.languageFlag}>{definition.flag}</Text>
                          <Text
                            style={[
                              styles.languageShortLabel,
                              { color: isActive ? theme.primary : theme.textPrimary },
                            ]}
                          >
                            {t(definition.labelKey)}
                          </Text>
                        </View>
                        {isActive ? <Ionicons name="checkmark-circle" size={16} color={theme.primary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <Text style={[styles.sectionHint, { color: theme.textSecondary }]}>
                {t('preferencesCalendarHint')}
              </Text>
              <View style={styles.toolsList}>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => router.push('/calendar-settings')}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="flash-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('calendarSettingsTitle')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[
                styles.sectionCard,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>
                {t('supportSectionTitle')}
              </Text>
              <View style={styles.toolsList}>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => void handleHelpCenter()}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="help-circle-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('supportHelpCenter')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <PrimaryButton
                title={t('signOut')}
                onPress={handleSignOut}
                style={[styles.button, isIOS && styles.buttonIOS]}
              />
              <TouchableOpacity onPress={() => void handleDeleteAccount()}>
                <Text style={[styles.link, styles.destructiveLink, { color: theme.fail }]}>
                  {t('supportDeleteAccount')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  constrained: {
    width: '100%',
    alignSelf: 'center',
  },
  headerGradient: {
    paddingHorizontal: layoutTokens.screenHorizontal + 8,
    paddingTop: 18,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
  },
  headerGlass: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    bottom: -20,
    left: 28,
    right: 28,
    height: 90,
    borderRadius: 50,
    backgroundColor: 'rgba(129, 140, 248, 0.25)',
    opacity: 0.4,
    shadowColor: '#818cf8',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 30,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  heroIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#312e81',
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
  },
  avatarIOS: {
    width: 52,
    height: 52,
    borderRadius: 20,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  profileGreeting: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  profileGreetingIOS: {
    fontSize: 26,
    letterSpacing: 0.2,
  },
  statusBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  statusBadgeCompact: {
    alignSelf: 'flex-start',
  },
  statusBadgeIOS: {
    paddingVertical: 7,
    paddingHorizontal: 18,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 18,
    gap: 10,
    flexWrap: 'wrap',
  },
  heroCard: {
    padding: 16,
    borderRadius: 24,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#020617',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14,
  },
  heroCardIOS: {
    padding: 16,
    borderRadius: 28,
    marginTop: -2,
  },
  profileInfo: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  profileInfoLeft: {
    flex: 1,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileInfoRight: {
    flex: 1,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroMeta: {
    flex: 1,
    fontSize: 12,
    letterSpacing: 0.3,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 48,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  headerSpacing: {
    marginBottom: 12,
  },
  footerSpacer: {
    width: '100%',
  },
  body: {
    paddingHorizontal: layoutTokens.screenHorizontal,
    paddingTop: layoutTokens.screenTop,
  },
  bodyIOS: {
    paddingTop: 6,
  },
  sectionCard: {
    borderRadius: 24,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#27315a99',
    shadowColor: '#020617',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 8,
  },
  sectionCardIOS: {
    borderRadius: 28,
    padding: 22,
  },
  sectionCardFirst: {
    marginTop: 6,
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -0.1,
  },
  sectionHeadingInRow: {
    marginBottom: 0,
  },
  sectionActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
    marginTop: -2,
    marginBottom: 10,
  },
  toolsList: {
    marginTop: 2,
  },
  toolsRow: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toolsIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsLabel: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  toolsBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 18,
    padding: 14,
  },
  infoCardIOS: {
    borderRadius: 20,
    padding: 16,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactList: {
    marginTop: 12,
  },
  contactSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 12,
  },
  contactRowIOS: {
    paddingVertical: 12,
  },
  contactIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactIconWrapIOS: {
    width: 36,
    height: 36,
    borderRadius: 13,
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  contactValueSecondary: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  contactMapButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 10,
  },
  aboutMetaList: {
    borderTopWidth: 1,
    marginTop: 2,
  },
  aboutMetaRow: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  aboutMetaLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  aboutMetaValue: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  companyInfoCard: {
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  companyProfileTop: {
    borderBottomWidth: 1,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  companyLogoFrame: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyLogoPreview: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
  },
  companyLogoFallbackText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  companyProfileBody: {
    flex: 1,
    minWidth: 0,
  },
  companyProfileLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.45,
    marginBottom: 2,
  },
  companyProfileName: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
  },
  companyAddressRow: {
    paddingTop: 10,
    paddingBottom: 4,
    gap: 6,
  },
  companyAddressValue: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    textAlign: 'left',
  },
  companyAddressValueSecondary: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    marginTop: 2,
    textAlign: 'left',
  },
  companyJoinInputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  companyJoinInput: {
    minHeight: 44,
    fontSize: 14,
  },
  companyJoinPendingText: {
    fontSize: 12,
    marginBottom: 10,
  },
  preferenceGroup: {
    marginBottom: 16,
  },
  toolsPreferenceGroup: {
    marginTop: 16,
    marginBottom: 0,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  preferenceLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  togglePill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togglePillActive: {
    borderWidth: 0,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleLabelActive: {
    color: '#fff',
  },
  languageToggleList: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
  },
  languageToggleItem: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 42,
    borderWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  languageToggleItemActive: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  languageActiveGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 10,
  },
  languageChipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languageFlag: {
    fontSize: 15,
  },
  languageShortLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    marginTop: 12,
  },
  buttonIOS: {
    marginTop: 14,
  },
  link: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  destructiveLink: {
    marginTop: 10,
  },
});
