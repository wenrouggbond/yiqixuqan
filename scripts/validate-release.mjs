import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseProjectEnv } = require('@expo/env');

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '..');
const requiredKeys = [
  'EXPO_PUBLIC_IOS_BUNDLE_ID',
  'EXPO_PUBLIC_ANDROID_PACKAGE',
  'EXPO_PUBLIC_SUPPORT_EMAIL',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
  'EXPO_PUBLIC_EAS_PROJECT_ID',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];
const placeholders = ['example.com', 'support@example.com', 'yourbrand', 'com.example'];
const parsedProjectEnv = parseProjectEnv(root, { mode: 'production', silent: true });
const envFileValues = parsedProjectEnv.env;
const detectedEnvFiles = parsedProjectEnv.files.map((filePath) => path.basename(filePath));
const errors = [];
const warnings = [];

function getValue(key) {
  return (process.env[key] ?? envFileValues[key] ?? '').trim();
}

function formatMissingSource(key) {
  return `${key}（未在 process.env 或 Expo 支持的 .env 文件中找到）`;
}

function hasProcessEnvValue(key) {
  return typeof process.env[key] === 'string' && process.env[key].trim().length > 0;
}

function hasFileEnvValue(key) {
  return typeof envFileValues[key] === 'string' && envFileValues[key].trim().length > 0;
}

function getSourceSummaries() {
  const processEnvCount = requiredKeys.filter((key) => hasProcessEnvValue(key)).length;
  const fileEnvCount = requiredKeys.filter((key) => !hasProcessEnvValue(key) && hasFileEnvValue(key)).length;
  const summaries = [];

  if (processEnvCount > 0) {
    summaries.push(`${processEnvCount} 个必填变量来自 process.env`);
  }

  if (fileEnvCount > 0) {
    summaries.push(`${fileEnvCount} 个必填变量来自本地 .env 文件`);
  }

  return summaries;
}

for (const key of requiredKeys) {
  if (!getValue(key)) {
    errors.push(`缺少环境变量：${formatMissingSource(key)}`);
  }
}

const iosBundleId = getValue('EXPO_PUBLIC_IOS_BUNDLE_ID');
const androidPackage = getValue('EXPO_PUBLIC_ANDROID_PACKAGE');
const supportEmail = getValue('EXPO_PUBLIC_SUPPORT_EMAIL');
const privacyPolicyUrl = getValue('EXPO_PUBLIC_PRIVACY_POLICY_URL');
const easProjectId = getValue('EXPO_PUBLIC_EAS_PROJECT_ID');
const supabaseUrl = getValue('EXPO_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = getValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const sourceSummaries = getSourceSummaries();

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeSupabaseAnonKey(value) {
  return value.length >= 100 && value.split('.').length === 3;
}

function validateExpoConfigEvaluation() {
  const windowsCommandPath = process.env.ComSpec || `${process.env.SystemRoot || 'C:\\Windows'}\\System32\\cmd.exe`;
  const result =
    process.platform === 'win32'
      ? spawnSync(windowsCommandPath, ['/d', '/s', '/c', 'npx expo config --json'], {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            APP_ENV: 'production',
            EAS_BUILD_PROFILE: 'production',
          },
        })
      : spawnSync('npx', ['expo', 'config', '--json'], {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            APP_ENV: 'production',
            EAS_BUILD_PROFILE: 'production',
          },
        });

  if (result.error) {
    const detail = [result.error.message, result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    errors.push(`Expo production 配置求值失败。${detail ? `\n${detail}` : ''}`);
    return;
  }

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
    errors.push(`Expo production 配置求值失败。${detail ? `\n${detail}` : ''}`);
  }
}

if (detectedEnvFiles.length === 0) {
  warnings.push('还没有发现 Expo 支持的本地环境变量文件，当前仅检测到了 .env.example 或进程环境变量。');
} else {
  warnings.push(`Expo 已加载 ${detectedEnvFiles.length} 个环境变量文件。`);
}

if (sourceSummaries.length > 0) {
  warnings.push('当前必填变量来源统计：');
  warnings.push(...sourceSummaries);
}

if (iosBundleId && !/^[a-zA-Z0-9.-]+$/.test(iosBundleId)) {
  errors.push('iOS Bundle ID 格式不正确，应类似 com.yourbrand.couplemealapp');
}

if (androidPackage && !/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(androidPackage)) {
  errors.push('Android package 格式不正确，应类似 com.yourbrand.couplemealapp');
}

if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
  errors.push('支持邮箱格式不正确。');
}

if (easProjectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(easProjectId)) {
  errors.push('EAS project id 格式不正确，应为 UUID。');
}

if (privacyPolicyUrl && !/^https:\/\/.+/i.test(privacyPolicyUrl)) {
  errors.push('隐私政策地址必须是 https:// 开头。');
}

if (supabaseUrl && !isValidUrl(supabaseUrl)) {
  errors.push('Supabase URL 格式不正确，必须是有效的 https:// 地址。');
}

if (supabaseAnonKey && !looksLikeSupabaseAnonKey(supabaseAnonKey)) {
  errors.push('Supabase anon key 格式不正确。');
}

for (const [key, value] of [
  ['EXPO_PUBLIC_IOS_BUNDLE_ID', iosBundleId],
  ['EXPO_PUBLIC_ANDROID_PACKAGE', androidPackage],
  ['EXPO_PUBLIC_SUPPORT_EMAIL', supportEmail],
  ['EXPO_PUBLIC_PRIVACY_POLICY_URL', privacyPolicyUrl],
  ['EXPO_PUBLIC_SUPABASE_URL', supabaseUrl],
]) {
  if (value && placeholders.some((token) => value.includes(token))) {
    errors.push(`${key} 仍然是占位值，请替换成你自己的正式配置。`);
  }
}

if (errors.length === 0) {
  validateExpoConfigEvaluation();
}

if (errors.length > 0) {
  console.error('\n发布校验未通过：\n');
  for (const error of errors) {
    console.error(`- ${error}`);
  }

  if (warnings.length > 0) {
    console.error('\n补充提示：\n');
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  console.error('\n建议先参考 docs/APP_STORE_CHECKLIST.md 和 .env.example 完成配置。\n');
  process.exit(1);
}

console.log('\n发布校验通过。\n');

if (warnings.length > 0) {
  console.log('补充提示：\n');
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
  console.log();
}
