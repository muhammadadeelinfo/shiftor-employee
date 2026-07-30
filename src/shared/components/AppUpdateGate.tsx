import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  type AppUpdateDecision,
  decideAppUpdate,
  fetchAppUpdatePolicy,
  getInstalledAppBuild,
  getInstalledAppVersion,
} from '@shared/appVersion/updatePolicy';
import { useTheme } from '@shared/themeContext';

export function AppUpdateGate({ children }: PropsWithChildren) {
  const { theme } = useTheme();
  const [decision, setDecision] = useState<AppUpdateDecision>(() => ({
    type: 'none',
    installedVersion: getInstalledAppVersion(),
    installedBuild: getInstalledAppBuild(),
    policy: null,
  }));
  const [dismissedSoftVersion, setDismissedSoftVersion] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isOpeningStore, setIsOpeningStore] = useState(false);

  const checkForUpdate = useCallback(async () => {
    setIsChecking(true);
    try {
      const policy = await fetchAppUpdatePolicy();
      setDecision(decideAppUpdate(policy));
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkForUpdate();
      }
    });

    return () => subscription.remove();
  }, [checkForUpdate]);

  const openStore = useCallback(async () => {
    if (decision.type === 'none' || !decision.policy.updateUrl || isOpeningStore) {
      return;
    }

    setIsOpeningStore(true);
    try {
      await Linking.openURL(decision.policy.updateUrl);
    } finally {
      setIsOpeningStore(false);
    }
  }, [decision, isOpeningStore]);

  if (decision.type === 'force' || decision.type === 'maintenance') {
    const isMaintenance = decision.type === 'maintenance';

    return (
      <SafeAreaView style={[styles.blockingScreen, { backgroundColor: theme.background }]}>
        <View style={[styles.blockingCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceElevated }]}>
            <Ionicons
              name={isMaintenance ? 'construct-outline' : 'arrow-up-circle-outline'}
              size={34}
              color={theme.primary}
            />
          </View>
          <Text style={[styles.blockingTitle, { color: theme.textPrimary }]}>
            {isMaintenance ? 'Maintenance in progress' : 'Update required'}
          </Text>
          <Text style={[styles.blockingText, { color: theme.textSecondary }]}>{decision.message}</Text>
          {decision.policy.updateReason ? (
            <Text style={[styles.reasonText, { color: theme.textPrimary }]}>
              {decision.policy.updateReason}
            </Text>
          ) : null}
          {!isMaintenance ? (
            <Text style={[styles.versionText, { color: theme.textSecondary }]}>
              Installed {decision.installedVersion}
              {decision.installedBuild ? ` (${decision.installedBuild})` : ''} · Required{' '}
              {decision.policy.minimumSupportedVersion}
              {decision.policy.minimumSupportedBuild ? ` (${decision.policy.minimumSupportedBuild})` : ''}
            </Text>
          ) : null}
          {!isMaintenance && decision.policy.updateUrl ? (
            <TouchableOpacity
              accessibilityLabel="Open app store update"
              onPress={openStore}
              activeOpacity={0.82}
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}>
              {isOpeningStore ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonLabel}>Update now</Text>
              )}
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            accessibilityLabel={isMaintenance ? 'Check maintenance status again' : 'Check update status again'}
            onPress={() => void checkForUpdate()}
            activeOpacity={0.82}
            style={[styles.secondaryButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <Text style={[styles.secondaryButtonLabel, { color: theme.textPrimary }]}>
              {isChecking ? 'Checking...' : 'Try again'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showSoftPrompt =
    decision.type === 'soft' && dismissedSoftVersion !== decision.policy.latestVersion;

  return (
    <>
      {children}
      <Modal
        visible={showSoftPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (decision.type === 'soft') {
            setDismissedSoftVersion(decision.policy.latestVersion);
          }
        }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.surfaceElevated }]}>
              <Ionicons name="sparkles-outline" size={22} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>New version available</Text>
            <Text style={[styles.modalText, { color: theme.textSecondary }]}>
              {decision.type === 'soft' ? decision.message : ''}
            </Text>
            {decision.type === 'soft' && decision.policy.updateReason ? (
              <Text style={[styles.reasonText, { color: theme.textPrimary }]}>
                {decision.policy.updateReason}
              </Text>
            ) : null}
            {decision.type === 'soft' && decision.policy.releaseNotes ? (
              <Text style={[styles.releaseNotesText, { color: theme.textSecondary }]}>
                {decision.policy.releaseNotes}
              </Text>
            ) : null}
            {decision.type === 'soft' ? (
              <Text style={[styles.versionText, { color: theme.textSecondary }]}>
                Installed {decision.installedVersion}
                {decision.installedBuild ? ` (${decision.installedBuild})` : ''} · Latest{' '}
                {decision.policy.latestVersion}
                {decision.policy.latestBuild ? ` (${decision.policy.latestBuild})` : ''}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                accessibilityLabel="Dismiss update prompt"
                onPress={() => {
                  if (decision.type === 'soft') {
                    setDismissedSoftVersion(decision.policy.latestVersion);
                  }
                }}
                activeOpacity={0.82}
                style={[styles.modalButton, styles.secondaryButton, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
                <Text style={[styles.secondaryButtonLabel, { color: theme.textPrimary }]}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Open app store update"
                disabled={decision.type !== 'soft' || !decision.policy.updateUrl}
                onPress={openStore}
                activeOpacity={0.82}
                style={[
                  styles.modalButton,
                  styles.primaryButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: decision.type !== 'soft' || !decision.policy.updateUrl ? 0.5 : 1,
                  },
                ]}>
                <Text style={styles.primaryButtonLabel}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  blockingScreen: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  blockingCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockingTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  blockingText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  releaseNotesText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  versionText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryButtonLabel: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryButtonLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.64)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    gap: 14,
  },
  modalIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
  },
  modalText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
  },
});
