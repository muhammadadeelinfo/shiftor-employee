import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Constants from 'expo-constants';
import { supabase, supabaseStorageBucket } from '@lib/supabaseClient';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useTheme } from '@shared/themeContext';
import { useLanguage } from '@shared/context/LanguageContext';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { splitAddressIntoLabelMeta } from '@shared/utils/address';
import DateTimePicker from '@react-native-community/datetimepicker';

type EmployeeProfile = Record<string, unknown>;
type AddressSuggestion = { value: string; label: string; meta: string };
type ParsedMobile = { dialCode: string; localNumber: string };
type DialCodeOption = { country: string; code: string };
const getProfilePhotoCacheKey = (userId: string) => `employee-profile-photo:${userId}`;
const getCanonicalPublicStorageUrl = (baseUrl: string, bucket: string, path: string) =>
  `${baseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;

const DIAL_CODE_OPTIONS: DialCodeOption[] = [
  { country: 'Germany', code: '+49' },
  { country: 'United States', code: '+1' },
  { country: 'United Kingdom', code: '+44' },
  { country: 'Pakistan', code: '+92' },
  { country: 'India', code: '+91' },
  { country: 'France', code: '+33' },
  { country: 'Spain', code: '+34' },
  { country: 'Italy', code: '+39' },
  { country: 'Netherlands', code: '+31' },
  { country: 'Belgium', code: '+32' },
  { country: 'Austria', code: '+43' },
  { country: 'Switzerland', code: '+41' },
  { country: 'Poland', code: '+48' },
  { country: 'Turkey', code: '+90' },
  { country: 'United Arab Emirates', code: '+971' },
  { country: 'Saudi Arabia', code: '+966' },
  { country: 'Canada', code: '+1' },
  { country: 'Australia', code: '+61' },
  { country: 'New Zealand', code: '+64' },
  { country: 'South Africa', code: '+27' },
  { country: 'Brazil', code: '+55' },
  { country: 'Mexico', code: '+52' },
  { country: 'Singapore', code: '+65' },
  { country: 'Malaysia', code: '+60' },
];

const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['42703', 'PGRST204', 'PGRST202'].includes(String((error as { code?: string }).code ?? ''));

const isPermissionDeniedError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    code === '42501' ||
    code === 'PGRST301' ||
    /permission denied/i.test(message) ||
    /not allowed/i.test(message)
  );
};

const extractMissingColumnName = (error: unknown): string | null => {
  if (!error || typeof error !== 'object') return null;
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  if (!message) return null;

  const patterns = [
    /column\s+['"]?([a-zA-Z0-9_]+)['"]?\s+does not exist/i,
    /Could not find the ['"]([a-zA-Z0-9_]+)['"] column/i,
    /schema cache.*['"]([a-zA-Z0-9_]+)['"]/i,
  ];
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const getStringField = (source?: Record<string, unknown>, key?: string) => {
  if (!source || !key) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const fetchEmployeeProfile = async (
  employeeId: string,
  email?: string | null,
  metadata?: Record<string, unknown>
): Promise<EmployeeProfile | null> => {
  if (!supabase) return null;

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
    if (seenLookups.has(dedupeKey)) continue;
    seenLookups.add(dedupeKey);
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq(lookup.column, lookup.value)
      .limit(1);

    if (error) {
      if (isMissingColumnError(error)) continue;
      console.warn('Failed to load employee profile', error);
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as EmployeeProfile;
    }
  }

  return null;
};

const pickUpdateColumn = (
  record: EmployeeProfile | null | undefined,
  candidates: string[]
) => {
  if (!record) return candidates[0];
  for (const candidate of candidates) {
    if (candidate in record) return candidate;
  }
  return candidates[0];
};

const updateEmployeeProfileRecord = async (
  employeeRecord: EmployeeProfile | null | undefined,
  userId: string,
  email: string | null | undefined,
  updates: {
    firstName: string;
    lastName: string;
    fullName: string;
    phone: string;
    address: string;
    dob: string;
    photoUrl: string | null;
    photoPath: string | null;
  }
) => {
  if (!supabase) return;

  const rpcParams = {
    first_name: updates.firstName || null,
    last_name: updates.lastName || null,
    full_name: updates.fullName || null,
    mobile_number: updates.phone || null,
    address_text: updates.address || null,
    birth_date: updates.dob || null,
    profile_photo_url: updates.photoUrl || null,
    profile_photo_path: updates.photoPath || null,
  };
  const { error: rpcError } = await supabase.rpc('update_employee_self_profile', rpcParams);
  if (!rpcError) {
    return;
  }
  if (!isMissingColumnError(rpcError) && !/function .* does not exist/i.test(String((rpcError as { message?: unknown })?.message ?? ''))) {
    if (isPermissionDeniedError(rpcError)) {
      return;
    }
    throw rpcError;
  }

  const firstNameColumn = pickUpdateColumn(employeeRecord, ['firstName', 'first_name', 'name']);
  const lastNameColumn = pickUpdateColumn(employeeRecord, ['lastName', 'last_name']);
  const fullNameColumn = pickUpdateColumn(employeeRecord, ['name', 'full_name']);
  const phoneColumn = pickUpdateColumn(employeeRecord, ['mobile', 'phone', 'phone_number', 'phoneNumber']);
  const addressColumn = pickUpdateColumn(employeeRecord, [
    'address',
    'full_address',
    'fullAddress',
    'street_address',
    'streetAddress',
    'location',
  ]);
  const dobColumn = pickUpdateColumn(employeeRecord, ['dob', 'dateOfBirth', 'date_of_birth', 'birthDate']);
  const photoColumn = pickUpdateColumn(employeeRecord, ['photoUrl', 'photo_url', 'avatarUrl', 'avatar_url']);
  const photoPathColumn = pickUpdateColumn(employeeRecord, ['photoPath', 'photo_path', 'avatarPath', 'avatar_path']);

  const basePayload: Record<string, string | null> = {
    [firstNameColumn]: updates.firstName || null,
    ...(lastNameColumn ? { [lastNameColumn]: updates.lastName || null } : {}),
    [fullNameColumn]: updates.fullName || null,
    [phoneColumn]: updates.phone || null,
    [addressColumn]: updates.address || null,
    [dobColumn]: updates.dob || null,
    [photoColumn]: updates.photoUrl || null,
    [photoPathColumn]: updates.photoPath || null,
  };

  const lookupCandidates: Array<{ column: string; value: string | undefined }> = [
    { column: 'id', value: getStringField(employeeRecord ?? undefined, 'id') ?? userId },
    { column: 'employeeId', value: getStringField(employeeRecord ?? undefined, 'employeeId') ?? userId },
    { column: 'employee_id', value: getStringField(employeeRecord ?? undefined, 'employee_id') ?? userId },
    { column: 'userId', value: getStringField(employeeRecord ?? undefined, 'userId') ?? userId },
    { column: 'user_id', value: getStringField(employeeRecord ?? undefined, 'user_id') ?? userId },
    { column: 'auth_user_id', value: getStringField(employeeRecord ?? undefined, 'auth_user_id') ?? userId },
    { column: 'authUserId', value: getStringField(employeeRecord ?? undefined, 'authUserId') ?? userId },
    { column: 'email', value: email ?? undefined },
  ];

  const seen = new Set<string>();
  for (const lookup of lookupCandidates) {
    if (!lookup.value) continue;
    const dedupeKey = `${lookup.column}:${lookup.value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const mutablePayload = { ...basePayload };
    let attempts = 0;
    while (attempts < 8 && Object.keys(mutablePayload).length > 0) {
      attempts += 1;
      const { error } = await supabase
        .from('employees')
        .update(mutablePayload)
        .eq(lookup.column, lookup.value);

      if (!error) return;
      if (!isMissingColumnError(error)) {
        if (isPermissionDeniedError(error)) {
          return;
        }
        console.warn('Failed to update employee profile record', error);
        throw error;
      }
      const missingColumn = extractMissingColumnName(error);
      if (missingColumn && missingColumn in mutablePayload) {
        delete mutablePayload[missingColumn];
        continue;
      }
      break;
    }
  }
};

const getReadableErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const value = (error as Record<string, unknown>).message;
    if (typeof value === 'string' && value.trim()) return value;
  }
  return fallback;
};

const toDateOnlyString = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(year, month - 1, day);
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return candidate;
};

const parseMobileWithDialCode = (value: string): ParsedMobile => {
  const trimmed = value.trim();
  if (!trimmed) return { dialCode: '', localNumber: '' };
  const normalized = trimmed.replace(/\s+/g, ' ');
  const plusMatch = normalized.match(/^(\+\d{1,4})\s*(.*)$/);
  if (plusMatch) {
    return {
      dialCode: plusMatch[1],
      localNumber: plusMatch[2]?.trim() ?? '',
    };
  }
  const doubleZeroMatch = normalized.match(/^(00\d{1,4})\s*(.*)$/);
  if (doubleZeroMatch) {
    return {
      dialCode: `+${doubleZeroMatch[1].slice(2)}`,
      localNumber: doubleZeroMatch[2]?.trim() ?? '',
    };
  }
  return { dialCode: '', localNumber: normalized };
};

const sanitizeDialCodeInput = (value: string) => {
  const compact = value.replace(/\s+/g, '');
  const prefixed = compact.startsWith('+') ? compact : `+${compact.replace(/\+/g, '')}`;
  const digitsOnly = prefixed.replace(/[^\d+]/g, '');
  const withoutExtraPlus = `+${digitsOnly.replace(/\+/g, '')}`;
  return withoutExtraPlus.slice(0, 5);
};

const sanitizeLocalMobileInput = (value: string) =>
  value.replace(/[^\d\s\-()./]/g, '').replace(/\s+/g, ' ').trimStart();

export default function ProfileEditScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();
  const metadataRecord =
    user?.user_metadata && typeof user.user_metadata === 'object'
      ? (user.user_metadata as Record<string, unknown>)
      : undefined;

  const { data: employeeRecord } = useQuery({
    queryKey: [
      'employeeProfile',
      user?.id,
      user?.email,
      metadataRecord?.employee_id,
      metadataRecord?.employeeId,
      metadataRecord?.profile_id,
      metadataRecord?.profileId,
    ],
    queryFn: () =>
      user?.id ? fetchEmployeeProfile(user.id, user.email, metadataRecord) : null,
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  const currentName =
    getStringField(employeeRecord ?? undefined, 'full_name') ??
    getStringField(employeeRecord ?? undefined, 'firstName') ??
    getStringField(employeeRecord ?? undefined, 'first_name') ??
    getStringField(employeeRecord ?? undefined, 'name') ??
    getStringField(metadataRecord, 'full_name') ??
    '';
  const fallbackFirstFromFullName =
    currentName.split(' ').filter(Boolean).slice(0, -1).join(' ') || currentName;
  const fallbackLastFromFullName = currentName.split(' ').filter(Boolean).slice(1).join(' ');
  const currentFirstName =
    getStringField(employeeRecord ?? undefined, 'firstName') ??
    getStringField(employeeRecord ?? undefined, 'first_name') ??
    getStringField(metadataRecord, 'first_name') ??
    fallbackFirstFromFullName;
  const currentLastName =
    getStringField(employeeRecord ?? undefined, 'lastName') ??
    getStringField(employeeRecord ?? undefined, 'last_name') ??
    getStringField(metadataRecord, 'last_name') ??
    fallbackLastFromFullName;
  const currentPhone =
    getStringField(employeeRecord ?? undefined, 'mobile') ??
    getStringField(employeeRecord ?? undefined, 'phone') ??
    getStringField(employeeRecord ?? undefined, 'phone_number') ??
    getStringField(metadataRecord, 'phone') ??
    getStringField(metadataRecord, 'phone_number') ??
    getStringField(metadataRecord, 'phoneNumber') ??
    '';
  const metadataAddressString =
    typeof metadataRecord?.address === 'string'
      ? metadataRecord.address.trim()
      : getStringField(
          metadataRecord?.address && typeof metadataRecord.address === 'object'
            ? (metadataRecord.address as Record<string, unknown>)
            : undefined,
          'formatted'
        );
  const fallbackCurrentAddress =
    getStringField(employeeRecord ?? undefined, 'address') ??
    getStringField(employeeRecord ?? undefined, 'full_address') ??
    getStringField(employeeRecord ?? undefined, 'fullAddress') ??
    getStringField(employeeRecord ?? undefined, 'street_address') ??
    getStringField(employeeRecord ?? undefined, 'streetAddress') ??
    getStringField(employeeRecord ?? undefined, 'location') ??
    metadataAddressString ??
    getStringField(metadataRecord, 'full_address') ??
    '';
  const currentAddress = fallbackCurrentAddress;
  const currentDob =
    getStringField(employeeRecord ?? undefined, 'dob') ??
    getStringField(employeeRecord ?? undefined, 'dateOfBirth') ??
    getStringField(employeeRecord ?? undefined, 'date_of_birth') ??
    getStringField(employeeRecord ?? undefined, 'birthDate') ??
    getStringField(metadataRecord, 'dob') ??
    '';
  const supabaseBaseUrl = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)?.trim();
  const deterministicPhotoPath = user?.id ? `employees/${user.id}/avatar/latest.jpg` : null;
  const deterministicPhotoUrl =
    supabaseBaseUrl && deterministicPhotoPath
      ? getCanonicalPublicStorageUrl(supabaseBaseUrl, supabaseStorageBucket, deterministicPhotoPath)
      : null;
  const currentPhotoUrl =
    getStringField(employeeRecord ?? undefined, 'photoUrl') ??
    getStringField(employeeRecord ?? undefined, 'photo_url') ??
    getStringField(employeeRecord ?? undefined, 'avatarUrl') ??
    getStringField(employeeRecord ?? undefined, 'avatar_url') ??
    getStringField(metadataRecord, 'photoUrl') ??
    getStringField(metadataRecord, 'photo_url') ??
    getStringField(metadataRecord, 'avatar_url') ??
    deterministicPhotoUrl ??
    null;
  const currentPhotoPath =
    getStringField(employeeRecord ?? undefined, 'photoPath') ??
    getStringField(employeeRecord ?? undefined, 'photo_path') ??
    getStringField(employeeRecord ?? undefined, 'avatarPath') ??
    getStringField(employeeRecord ?? undefined, 'avatar_path') ??
    getStringField(metadataRecord, 'photoPath') ??
    getStringField(metadataRecord, 'photo_path') ??
    getStringField(metadataRecord, 'avatar_path') ??
    deterministicPhotoPath ??
    null;

  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const initialParsedPhone = parseMobileWithDialCode(currentPhone);
  const [dialCode, setDialCode] = useState(initialParsedPhone.dialCode || '+49');
  const [mobileNumber, setMobileNumber] = useState(initialParsedPhone.localNumber);
  const [address, setAddress] = useState(currentAddress);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [dob, setDob] = useState(currentDob);
  const [dobModalVisible, setDobModalVisible] = useState(false);
  const [dobDraftDate, setDobDraftDate] = useState<Date>(parseDateOnly(currentDob) ?? new Date(2000, 0, 1));
  const [dialCodeModalVisible, setDialCodeModalVisible] = useState(false);
  const [dialCodeQuery, setDialCodeQuery] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(currentPhotoUrl);
  const [photoPath, setPhotoPath] = useState<string | null>(currentPhotoPath);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setFirstName(currentFirstName);
    setLastName(currentLastName);
    const parsedPhone = parseMobileWithDialCode(currentPhone);
    setDialCode(parsedPhone.dialCode || '+49');
    setMobileNumber(parsedPhone.localNumber);
    setAddress(currentAddress);
    setDob(currentDob);
    setDobDraftDate(parseDateOnly(currentDob) ?? new Date(2000, 0, 1));
    setPhotoUri(currentPhotoUrl);
    setPhotoPath(currentPhotoPath);
    setPhotoDirty(false);
  }, [
    currentFirstName,
    currentLastName,
    currentPhone,
    currentAddress,
    currentDob,
    currentPhotoUrl,
    currentPhotoPath,
  ]);

  useEffect(() => {
    const query = address.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('addressdetails', '0');
        url.searchParams.set('limit', '5');
        url.searchParams.set('accept-language', language === 'de' ? 'de' : 'en');
        const response = await fetch(url.toString(), {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          setAddressSuggestions([]);
          return;
        }
        const payload = (await response.json()) as Array<{ display_name?: string }>;
        const suggestions = payload
          .map((item) => (typeof item.display_name === 'string' ? item.display_name.trim() : ''))
          .filter(Boolean)
          .slice(0, 5)
          .map((value) => {
            const parts = splitAddressIntoLabelMeta(value);
            return { value, label: parts.label, meta: parts.meta };
          });
        setAddressSuggestions(suggestions);
      } catch {
        setAddressSuggestions([]);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [address, language]);

  const handleSave = async () => {
    if (!user?.id) {
      Alert.alert(t('profileEditTitle'), t('authClientUnavailable'));
      return;
    }
    if (!supabase) {
      Alert.alert(t('profileEditTitle'), t('authClientUnavailable'));
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedName = `${normalizedFirstName} ${normalizedLastName}`.trim();
    const normalizedDialCode = sanitizeDialCodeInput(dialCode).trim();
    const normalizedMobile = mobileNumber.trim();
    const normalizedPhone = [normalizedDialCode, normalizedMobile].filter(Boolean).join(' ').trim();
    const normalizedAddress = address.trim();
    const normalizedDob = dob.trim();
    let finalPhotoUrl: string | null = currentPhotoUrl;
    let finalPhotoPath: string | null = currentPhotoPath;

    try {
      setSaving(true);
      if (photoDirty) {
        if (!photoUri) {
          finalPhotoUrl = null;
          finalPhotoPath = null;
        } else if (photoUri.startsWith('http://') || photoUri.startsWith('https://')) {
          finalPhotoUrl = photoUri;
        } else {
          setUploadingPhoto(true);
          const uploaded = await uploadProfilePhoto(photoUri);
          finalPhotoUrl = uploaded.publicUrl;
          finalPhotoPath = uploaded.path;
          setPhotoPath(uploaded.path);
          setUploadingPhoto(false);
        }
      }
      const metadataPatch: Record<string, unknown> = {
        ...(user.user_metadata ?? {}),
        first_name: normalizedFirstName || null,
        last_name: normalizedLastName || null,
        full_name: normalizedName || null,
        phone: normalizedPhone || null,
        address: normalizedAddress || null,
        dob: normalizedDob || null,
        photoUrl: finalPhotoUrl,
        photo_url: finalPhotoUrl,
        avatar_url: finalPhotoUrl,
        photoPath: finalPhotoPath,
        photo_path: finalPhotoPath,
        avatar_path: finalPhotoPath,
        photo_updated_at: Date.now(),
      };
      const { error: metadataError } = await supabase.auth.updateUser({ data: metadataPatch });
      if (metadataError) throw metadataError;
      queryClient.setQueryData(['authUserMetadata', user.id], metadataPatch);
      await queryClient.invalidateQueries({ queryKey: ['authUserMetadata', user.id] });

      try {
        await updateEmployeeProfileRecord(employeeRecord, user.id, user.email, {
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          fullName: normalizedName,
          phone: normalizedPhone,
          address: normalizedAddress,
          dob: normalizedDob,
          photoUrl: finalPhotoUrl,
          photoPath: finalPhotoPath,
        });
      } catch (profileError) {
        if (!isPermissionDeniedError(profileError)) {
          throw profileError;
        }
      }
      const persistedLocalPhotoUri = photoUri
        ? await persistProfilePhotoLocally(photoUri, user.id)
        : null;
      const photoCacheKey = getProfilePhotoCacheKey(user.id);
      const photoCachePayload = {
        url: finalPhotoUrl ?? null,
        path: finalPhotoPath ?? null,
        localUri: persistedLocalPhotoUri ?? null,
      };
      if (finalPhotoUrl || finalPhotoPath || persistedLocalPhotoUri) {
        await AsyncStorage.setItem(photoCacheKey, JSON.stringify(photoCachePayload));
        queryClient.setQueryData(['profilePhotoCache', user.id], photoCachePayload);
        await queryClient.invalidateQueries({ queryKey: ['profilePhotoCache', user.id] });
      } else {
        await AsyncStorage.removeItem(photoCacheKey);
        queryClient.setQueryData(['profilePhotoCache', user.id], null);
        await queryClient.invalidateQueries({ queryKey: ['profilePhotoCache', user.id] });
      }
      setPhotoUri(finalPhotoUrl ?? null);
      setPhotoPath(finalPhotoPath ?? null);
      setPhotoDirty(false);

      queryClient.setQueriesData({ queryKey: ['employeeProfile'] }, (existing: unknown) => {
        if (!existing || typeof existing !== 'object') return existing;
        return {
          ...(existing as Record<string, unknown>),
          firstName: normalizedFirstName || null,
          first_name: normalizedFirstName || null,
          lastName: normalizedLastName || null,
          last_name: normalizedLastName || null,
          name: normalizedName || null,
          full_name: normalizedName || null,
          mobile: normalizedPhone || null,
          phone: normalizedPhone || null,
          address: normalizedAddress || null,
          dob: normalizedDob || null,
          date_of_birth: normalizedDob || null,
          photoUrl: finalPhotoUrl,
          photo_url: finalPhotoUrl,
          avatar_url: finalPhotoUrl,
          photoPath: finalPhotoPath,
          photo_path: finalPhotoPath,
          avatar_path: finalPhotoPath,
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['profilePhotoSignedUrl'] });
      await queryClient.invalidateQueries({ queryKey: ['employeeProfile'] });
      Alert.alert(t('profileEditTitle'), t('profileEditSaved'), [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(t('profileEditTitle'), getReadableErrorMessage(error, t('authUnableSignIn')));
    } finally {
      setUploadingPhoto(false);
      setSaving(false);
    }
  };

  const openDobModal = () => {
    setDobDraftDate(parseDateOnly(dob) ?? new Date(2000, 0, 1));
    setDobModalVisible(true);
  };

  const handleDobConfirm = () => {
    setDob(toDateOnlyString(dobDraftDate));
    setDobModalVisible(false);
  };
  const filteredDialCodes = DIAL_CODE_OPTIONS.filter((option) => {
    const q = dialCodeQuery.trim().toLowerCase();
    if (!q) return true;
    return option.country.toLowerCase().includes(q) || option.code.includes(q);
  });
  const profileInitials = `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.trim().toUpperCase() || 'ME';

  const getImageExtension = (uri: string) => {
    const match = uri.toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
    return match?.[1] && match[1].length <= 5 ? match[1] : 'jpg';
  };

  const persistProfilePhotoLocally = async (uri: string, userId: string) => {
    if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    const baseDir = FileSystem.documentDirectory;
    if (!baseDir) return uri;
    const extension = getImageExtension(uri);
    const destination = `${baseDir}profile-photo-${userId}.${extension}`;
    try {
      await FileSystem.copyAsync({ from: uri, to: destination });
      return destination;
    } catch {
      return uri;
    }
  };

  const uploadProfilePhoto = async (
    uri: string
  ): Promise<{ publicUrl: string; path: string }> => {
    if (!supabase || !user?.id) {
      throw new Error(t('authClientUnavailable'));
    }
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG }
    );
    const path = `employees/${user.id}/avatar/latest.jpg`;
    const response = await fetch(manipulated.uri);
    const buffer = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage.from(supabaseStorageBucket).upload(path, buffer, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    if (uploadError) {
      throw uploadError;
    }
    const supabaseBaseUrl = (Constants.expoConfig?.extra?.supabaseUrl as string | undefined)?.trim();
    const canonicalPublicUrl = supabaseBaseUrl
      ? getCanonicalPublicStorageUrl(supabaseBaseUrl, supabaseStorageBucket, path)
      : supabase.storage.from(supabaseStorageBucket).getPublicUrl(path).data.publicUrl;
    return { publicUrl: canonicalPublicUrl, path };
  };

  const pickProfilePhoto = async () => {
    if (saving || uploadingPhoto) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profileEditTitle'), t('profileEditPhotoPermissionDenied'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    const pickedUri = result.assets[0]?.uri;
    if (!pickedUri) return;
    setPhotoUri(pickedUri);
    setPhotoDirty(true);
  };

  const removeProfilePhoto = () => {
    setPhotoUri(null);
    setPhotoPath(null);
    setPhotoDirty(true);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}>
          <TouchableOpacity
            style={[styles.backRow, { borderColor: theme.borderSoft }]}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
            <Text style={[styles.backText, { color: theme.textSecondary }]}>{t('commonCancel') || 'Back'}</Text>
          </TouchableOpacity>

          <Text style={[styles.title, { color: theme.textPrimary }]}>{t('profileEditTitle')}</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{t('profileEditHint')}</Text>
          <View style={styles.photoRow}>
            <View style={[styles.photoFrame, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
              ) : (
                <Text style={[styles.photoFallbackText, { color: theme.textPrimary }]}>{profileInitials}</Text>
              )}
            </View>
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.photoButton, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                onPress={() => void pickProfilePhoto()}
                disabled={saving || uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <Ionicons name="image-outline" size={15} color={theme.primary} />
                )}
                <Text style={[styles.photoButtonText, { color: theme.textPrimary }]}>
                  {t('profileEditPhotoChange')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoButton, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                onPress={removeProfilePhoto}
                disabled={saving || uploadingPhoto || !photoUri}
              >
                <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.photoButtonText, { color: theme.textSecondary }]}>
                  {t('profileEditPhotoRemove')}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.photoHint, { color: theme.textSecondary }]}>
                {t('profileEditPhotoHint')}
              </Text>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profileEditFirstNamePlaceholder')}</Text>
          <View style={[styles.inputWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('profileEditFirstNamePlaceholder')}
              placeholderTextColor={theme.textPlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!saving}
              style={[styles.input, { color: theme.textPrimary }]}
            />
          </View>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profileEditLastNamePlaceholder')}</Text>
          <View style={[styles.inputWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('profileEditLastNamePlaceholder')}
              placeholderTextColor={theme.textPlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!saving}
              style={[styles.input, { color: theme.textPrimary }]}
            />
          </View>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('emailLabel')}</Text>
          <View style={[styles.inputWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <TextInput
              value={user?.email ?? ''}
              editable={false}
              style={[styles.input, styles.readonlyInput, { color: theme.textSecondary }]}
            />
          </View>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profileEditPhonePlaceholder')}</Text>
          <View style={styles.mobileRow}>
            <View
              style={[
                styles.inputWrap,
                styles.dialCodeWrap,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
              ]}
            >
              <TouchableOpacity
                style={styles.dialCodeSelector}
                onPress={() => setDialCodeModalVisible(true)}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.dialCodeSelectorText, { color: theme.textPrimary }]}
                >
                  {dialCode || t('profileEditDialCodePlaceholder')}
                </Text>
                <Ionicons name="chevron-down" size={15} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.inputWrap,
                styles.mobileNumberWrap,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft },
              ]}
            >
              <TextInput
                value={mobileNumber}
                onChangeText={(value) => setMobileNumber(sanitizeLocalMobileInput(value))}
                placeholder={t('profileEditMobilePlaceholder')}
                placeholderTextColor={theme.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                editable={!saving}
                style={[styles.input, { color: theme.textPrimary }]}
              />
            </View>
          </View>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profileEditDobPlaceholder')}</Text>
          <TouchableOpacity
            disabled={saving}
            onPress={openDobModal}
            activeOpacity={0.85}
            style={[styles.inputWrap, styles.dobTrigger, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}
          >
            <Text style={[styles.input, styles.dobTriggerText, { color: dob ? theme.textPrimary : theme.textPlaceholder }]}>
              {dob || t('profileEditDobPlaceholder')}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t('profileEditAddressPlaceholder')}</Text>
          <View style={[styles.inputWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder={t('profileEditAddressPlaceholder')}
              placeholderTextColor={theme.textPlaceholder}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!saving}
              style={[styles.input, { color: theme.textPrimary }]}
            />
          </View>
          {addressSuggestions.length > 0 ? (
            <View style={[styles.suggestionList, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}>
              {addressSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.value}
                  style={[styles.suggestionItem, { borderColor: theme.borderSoft }]}
                  onPress={() => {
                    setAddress(suggestion.value);
                    setAddressSuggestions([]);
                  }}
                >
                  <Text style={[styles.suggestionMain, { color: theme.textPrimary }]}>{suggestion.label}</Text>
                  {suggestion.meta ? (
                    <Text style={[styles.suggestionMeta, { color: theme.textSecondary }]}>{suggestion.meta}</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          <PrimaryButton title={t('profileEditSave')} onPress={() => void handleSave()} loading={saving} />
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={dobModalVisible}
        animationType="slide"
        onRequestClose={() => setDobModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDobModalVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.borderSoft }]} />
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{t('profileEditDobPlaceholder')}</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {toDateOnlyString(dobDraftDate)}
            </Text>
            <DateTimePicker
              value={dobDraftDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              themeVariant="dark"
              textColor="#FFFFFF"
              accentColor={theme.primary}
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  setDobDraftDate(selectedDate);
                }
              }}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}
                onPress={() => setDobModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>{t('commonCancel') || 'Cancel'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary, { backgroundColor: theme.primary }]}
                onPress={handleDobConfirm}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonPrimaryText]}>OK</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal
        transparent
        visible={dialCodeModalVisible}
        animationType="slide"
        onRequestClose={() => setDialCodeModalVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDialCodeModalVisible(false)}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.borderSoft }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={[styles.modalHandle, { backgroundColor: theme.borderSoft }]} />
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{t('profileEditDialCodeTitle')}</Text>
            <View style={[styles.inputWrap, { backgroundColor: theme.surfaceMuted, borderColor: theme.borderSoft }]}>
              <TextInput
                value={dialCodeQuery}
                onChangeText={setDialCodeQuery}
                placeholder={t('profileEditDialCodeSearchPlaceholder')}
                placeholderTextColor={theme.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, { color: theme.textPrimary }]}
              />
            </View>
            <View style={[styles.dialCodeListWrap, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted }]}>
              <FlatList
                data={filteredDialCodes}
                keyExtractor={(item, idx) => `${item.country}-${item.code}-${idx}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.dialCodeRow, { borderColor: theme.borderSoft }]}
                    onPress={() => {
                      setDialCode(item.code);
                      setDialCodeModalVisible(false);
                      setDialCodeQuery('');
                    }}
                  >
                    <Text style={[styles.dialCodeCountry, { color: theme.textPrimary }]}>{item.country}</Text>
                    <Text style={[styles.dialCodeCode, { color: theme.textSecondary }]}>{item.code}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
            <TouchableOpacity
              style={[styles.modalButton, { borderColor: theme.borderSoft, backgroundColor: theme.surfaceMuted, marginTop: 10 }]}
              onPress={() => {
                setDialCodeModalVisible(false);
                setDialCodeQuery('');
              }}
            >
              <Text style={[styles.modalButtonText, { color: theme.textSecondary }]}>{t('commonCancel') || 'Cancel'}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  backRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  backText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    marginBottom: 14,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  photoFrame: {
    width: 84,
    height: 84,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoFallbackText: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  photoActions: {
    flex: 1,
    gap: 8,
  },
  photoButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  photoHint: {
    fontSize: 11,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 2,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  input: {
    minHeight: 44,
    fontSize: 14,
  },
  dobTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dobTriggerText: {
    flex: 1,
    paddingTop: 12,
  },
  readonlyInput: {
    opacity: 0.9,
  },
  mobileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dialCodeWrap: {
    width: 98,
    paddingHorizontal: 10,
  },
  mobileNumberWrap: {
    flex: 1,
  },
  dialCodeSelector: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  dialCodeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  suggestionList: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  suggestionItem: {
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
  },
  modalHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalActions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  dialCodeListWrap: {
    borderWidth: 1,
    borderRadius: 12,
    maxHeight: 260,
    overflow: 'hidden',
  },
  dialCodeRow: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  dialCodeCountry: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dialCodeCode: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonPrimary: {
    borderWidth: 0,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonPrimaryText: {
    color: '#fff',
  },
});
