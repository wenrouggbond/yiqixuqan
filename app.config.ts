import type { ExpoConfig } from 'expo/config';

const { parseProjectEnv } = require('@expo/env');
const envFileValues = parseProjectEnv(process.cwd(), { mode: 'production', silent: true }).env;
const PLACEHOLDER_TOKENS = ['example.com', 'support@example.com', 'yourbrand', 'com.example'];

function getEnvValue(key: string) {
  return (process.env[key] ?? envFileValues[key] ?? '').trim();
}

function isPlaceholderValue(value: string) {
  return PLACEHOLDER_TOKENS.some((token) => value.includes(token));
}

function isProductionBuild() {
  return getEnvValue('APP_ENV') === 'production' || getEnvValue('EAS_BUILD_PROFILE') === 'production';
}

function getConfigValue(key: string, fallback: string, requiredInProduction = false) {
  const rawValue = getEnvValue(key);
  const value = rawValue || fallback;

  if (requiredInProduction && isProductionBuild() && (!rawValue || isPlaceholderValue(value))) {
    throw new Error(`${key} 未配置正式值，无法执行 production 构建。`);
  }

  return value;
}

const appName = getEnvValue('EXPO_PUBLIC_APP_NAME') || '一起选';
const slug = 'couple-meal-app';
const version = '1.0.0';
const iosBundleId = getConfigValue('EXPO_PUBLIC_IOS_BUNDLE_ID', 'com.example.couplemealapp', true);
const androidPackage = getConfigValue('EXPO_PUBLIC_ANDROID_PACKAGE', 'com.example.couplemealapp', true);
const supportEmail = getConfigValue('EXPO_PUBLIC_SUPPORT_EMAIL', 'support@example.com', true);
const privacyPolicyUrl = getConfigValue('EXPO_PUBLIC_PRIVACY_POLICY_URL', 'https://example.com/privacy', true);
const easProjectId = '09d5d3f1-00bd-44c8-b4b0-a55565dbea22';

const config: ExpoConfig = {
  name: appName,
  slug,
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  scheme: 'couplemealapp',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f6efe3',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: iosBundleId,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: androidPackage,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#f6efe3',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    supportEmail,
    privacyPolicyUrl,
    ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
  },
};

export default config;
