import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getPublicSupabaseClient } from '@lib/supabaseClient';

export type AppPlatform = 'ios' | 'android' | 'web';

export type AppUpdatePolicy = {
  platform: AppPlatform;
  latestVersion: string;
  minimumSupportedVersion: string;
  latestBuild: string | null;
  minimumSupportedBuild: string | null;
  updateUrl: string | null;
  updateReason: string | null;
  releaseNotes: string | null;
  softUpdateMessage: string | null;
  forceUpdateMessage: string | null;
  maintenanceEnabled: boolean;
  maintenanceMessage: string | null;
};

type AppUpdatePolicyRow = {
  platform: AppPlatform;
  latest_version: string;
  minimum_supported_version: string;
  latest_build: string | null;
  minimum_supported_build: string | null;
  update_url: string | null;
  update_reason: string | null;
  release_notes: string | null;
  soft_update_message: string | null;
  force_update_message: string | null;
  maintenance_enabled: boolean | null;
  maintenance_message: string | null;
};

export type AppUpdateDecision =
  | {
      type: 'none';
      installedVersion: string;
      installedBuild: string | null;
      policy: AppUpdatePolicy | null;
    }
  | {
      type: 'soft' | 'force' | 'maintenance';
      installedVersion: string;
      installedBuild: string | null;
      policy: AppUpdatePolicy;
      message: string;
    };

export const getCurrentAppPlatform = (): AppPlatform => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS;
  }

  return 'web';
};

export const getInstalledAppVersion = () => Constants.expoConfig?.version ?? '0.0.0';

export const getInstalledAppBuild = () => {
  if (Platform.OS === 'ios') {
    return Constants.ios?.buildNumber ?? null;
  }

  if (Platform.OS === 'android') {
    return typeof Constants.android?.versionCode === 'number'
      ? String(Constants.android.versionCode)
      : null;
  }

  return null;
};

export const compareAppVersions = (left: string, right: string) => {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);
  const length = Math.max(leftParts.length, rightParts.length, 3);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) return 1;
    if (leftValue < rightValue) return -1;
  }

  return 0;
};

export const decideAppUpdate = (
  policy: AppUpdatePolicy | null,
  installedVersion = getInstalledAppVersion(),
  installedBuild = getInstalledAppBuild()
): AppUpdateDecision => {
  if (!policy) {
    return {
      type: 'none',
      installedVersion,
      installedBuild,
      policy,
    };
  }

  if (policy.maintenanceEnabled) {
    return {
      type: 'maintenance',
      installedVersion,
      installedBuild,
      policy,
      message: policy.maintenanceMessage ?? 'Shiftor Employee is undergoing maintenance. Please try again soon.',
    };
  }

  const unsupportedVersion =
    compareAppVersions(installedVersion, policy.minimumSupportedVersion) < 0;
  const unsupportedBuild =
    Boolean(policy.minimumSupportedBuild && installedBuild) &&
    compareAppVersions(installedBuild ?? '0', policy.minimumSupportedBuild ?? '0') < 0;

  if (unsupportedVersion || unsupportedBuild) {
    return {
      type: 'force',
      installedVersion,
      installedBuild,
      policy,
      message: policy.forceUpdateMessage ?? 'Please update Shiftor Employee to continue.',
    };
  }

  if (compareAppVersions(installedVersion, policy.latestVersion) < 0) {
    return {
      type: 'soft',
      installedVersion,
      installedBuild,
      policy,
      message: policy.softUpdateMessage ?? 'A newer version of Shiftor Employee is available.',
    };
  }

  return {
    type: 'none',
    installedVersion,
    installedBuild,
    policy,
  };
};

export const fetchAppUpdatePolicy = async (platform = getCurrentAppPlatform()) => {
  const client = getPublicSupabaseClient();

  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('app_update_policy')
    .select(
      'platform, latest_version, minimum_supported_version, latest_build, minimum_supported_build, update_url, update_reason, release_notes, soft_update_message, force_update_message, maintenance_enabled, maintenance_message'
    )
    .eq('platform', platform)
    .eq('enabled', true)
    .maybeSingle<AppUpdatePolicyRow>();

  if (error || !data) {
    return null;
  }

  return {
    platform: data.platform,
    latestVersion: data.latest_version,
    minimumSupportedVersion: data.minimum_supported_version,
    latestBuild: data.latest_build,
    minimumSupportedBuild: data.minimum_supported_build,
    updateUrl: data.update_url,
    updateReason: data.update_reason,
    releaseNotes: data.release_notes,
    softUpdateMessage: data.soft_update_message,
    forceUpdateMessage: data.force_update_message,
    maintenanceEnabled: data.maintenance_enabled ?? false,
    maintenanceMessage: data.maintenance_message,
  };
};

const parseVersionParts = (value: string) =>
  value
    .split(/[.-]/)
    .map((part) => Number.parseInt(part.replace(/\D.*$/g, ''), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
