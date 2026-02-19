import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { PrimaryButton } from '@shared/components/PrimaryButton';
import { useTheme } from '@shared/themeContext';
import { useAuth } from '@hooks/useSupabaseAuth';
import { useNotifications } from '@shared/context/NotificationContext';
import { languageDefinitions, useLanguage } from '@shared/context/LanguageContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@lib/supabaseClient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { layoutTokens } from '@shared/theme/layout';
import { useRouter } from 'expo-router';
import { openAddressInMaps } from '@shared/utils/maps';

const normalizeContactString = (value?: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const capitalizeFirstLetter = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return value;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

type EmployeeProfile = Record<string, unknown>;

const isMissingColumnError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === '42703';

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

const getStringField = (source?: Record<string, unknown>, key?: string) => {
  if (!source || !key) return undefined;
  const value = source[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const formatMetadataAddress = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;
  const addressCandidate = metadata.address;
  if (typeof addressCandidate === 'string' && addressCandidate.trim()) {
    return addressCandidate.trim();
  }
  if (addressCandidate && typeof addressCandidate === 'object') {
    const addressParts = [
      'line1',
      'line2',
      'street',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'postal_code',
      'postalCode',
      'country',
    ]
      .map((key) => getStringField(addressCandidate as Record<string, unknown>, key))
      .filter((part): part is string => Boolean(part));
    if (addressParts.length) {
      return addressParts.join(', ');
    }
  }
  const fallbackParts = [
    'street',
    'city',
    'state',
    'postal_code',
    'postalCode',
    'country',
    'location',
  ]
    .map((key) => getStringField(metadata, key))
    .filter((part): part is string => Boolean(part));
  return fallbackParts.length ? fallbackParts.join(', ') : undefined;
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
    .map((key) => getStringField(profile, key))
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
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isIOS = Platform.OS === 'ios';
  const employeeId = user?.id;
  const metadata = user?.user_metadata;
  const metadataRecord =
    metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : undefined;
  const {
    data: employeeRecord,
  } = useQuery({
    queryKey: [
      'employeeProfile',
      employeeId,
      user?.email,
      metadataRecord?.employee_id,
      metadataRecord?.employeeId,
      metadataRecord?.profile_id,
      metadataRecord?.profileId,
    ],
    queryFn: () =>
      employeeId ? fetchEmployeeProfile(employeeId, user?.email, metadataRecord) : null,
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
  const handleSignOut = () => {
    signOut();
  };
  const handleComingSoon = (label: string) => {
    Alert.alert(label, 'This feature is coming soon.');
  };
  const contentContainerStyle = [
    styles.content,
    { paddingBottom: 28 + insets.bottom + tabBarHeight },
  ];
  const noValueLabel = t('notProvided');
  const contactFields = [
    { label: t('emailLabel'), value: user?.email ?? noValueLabel, icon: 'mail-outline' as const },
    { label: t('phoneLabel'), value: contactPhone ?? noValueLabel, icon: 'call-outline' as const },
    {
      label: t('addressLabel'),
      value: contactAddress ?? noValueLabel,
      icon: 'location-outline' as const,
      mapAddress: contactAddress,
    },
  ];
  const heroGradientColors: [string, string, ...string[]] = [
    theme.heroGradientStart,
    theme.heroGradientEnd,
    theme.surfaceMuted,
  ];
  const initials = profileName(user)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
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
              <View style={styles.heroHeader}>
                <View style={styles.heroIdentity}>
                  <View style={[styles.avatar, { backgroundColor: theme.primary }, isIOS && styles.avatarIOS]}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View>
                    <Text style={[styles.profileGreeting, { color: theme.textPrimary }, isIOS && styles.profileGreetingIOS]}>
                      {t('profileGreeting', { name: profileName(user) })}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: theme.primaryAccent }, isIOS && styles.statusBadgeIOS]}>
                  <Text style={styles.statusBadgeText}>{translatedStatus}</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        }
        renderItem={() => (
          <View style={[styles.body, isIOS && styles.bodyIOS]}>
            <View
              style={[
                styles.sectionCard,
                styles.sectionCardFirst,
                { backgroundColor: theme.surface, borderColor: theme.borderSoft },
                isIOS && styles.sectionCardIOS,
              ]}
            >
              <Text style={[styles.sectionHeading, { color: theme.textPrimary }]}>{t('accountSnapshot')}</Text>
              <View style={styles.infoGrid}>
                {[
                  { label: t('emailVerifiedLabel'), value: user?.email_confirmed_at ? t('yes') : t('pending') },
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
                      <Text style={[styles.contactValue, { color: theme.textPrimary }]}>{field.value}</Text>
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
                {t('securitySectionTitle')}
              </Text>
              <View style={styles.toolsList}>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => handleComingSoon(t('securityResetPassword'))}
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
                  onPress={() => handleComingSoon(t('securityManageSessions'))}
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
                  onPress={() => handleComingSoon(t('securityEnable2fa'))}
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
                  onPress={() => handleComingSoon(t('supportHelpCenter'))}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="help-circle-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('supportHelpCenter')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toolsRow, { borderColor: theme.borderSoft }]}
                  onPress={() => handleComingSoon(t('supportLegal'))}
                >
                  <View style={[styles.toolsIconWrap, { backgroundColor: theme.surfaceMuted }]}>
                    <Ionicons name="document-text-outline" size={16} color={theme.primary} />
                  </View>
                  <Text style={[styles.toolsLabel, { color: theme.textPrimary }]}>
                    {t('supportLegal')}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <PrimaryButton
                title={t('signOut')}
                onPress={handleSignOut}
                style={[styles.button, isIOS && styles.buttonIOS]}
              />
              <TouchableOpacity onPress={handleSignOut}>
                <Text style={[styles.link, { color: theme.primary }]}>{t('switchAccount')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleComingSoon(t('supportDeleteAccount'))}>
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
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    letterSpacing: -0.1,
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
  contactMapButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginLeft: 10,
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
