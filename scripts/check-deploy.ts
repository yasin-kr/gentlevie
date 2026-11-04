import { z } from 'zod';
import { getSubscriptionAvailability, type SubscriptionEnvironment } from '../lib/subscriptions';
import { getAuthAvailability, getEmailAvailability, type AuthEnvironment } from '../lib/auth-config';

type ConfigurationKey =
  | 'SITE_URL'
  | 'MONGODB_URI'
  | 'MONGODB_DB'
  | 'RATE_LIMIT_SECRET'
  | 'SITE_OWNER_NAME'
  | 'PRIVACY_CONTACT_EMAIL'
  | 'ADMIN_EMAIL'
  | 'BETTER_AUTH_SECRET'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_USER'
  | 'SMTP_PASS'
  | 'SMTP_FROM';

function isProductionOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname.length > 0 &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.hostname.endsWith('.localhost') &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

const validators: Record<ConfigurationKey, (value: string) => boolean> = {
  SITE_URL: isProductionOrigin,
  MONGODB_URI: (value) => /^mongodb(?:\+srv)?:\/\/\S+$/.test(value),
  MONGODB_DB: (value) => Buffer.byteLength(value, 'utf8') < 64 && !/[\/\\. "$*<>:|?\0]/.test(value),
  RATE_LIMIT_SECRET: (value) => value.length >= 32,
  SITE_OWNER_NAME: (value) => value.length > 0,
  PRIVACY_CONTACT_EMAIL: (value) => z.email().safeParse(value).success,
  ADMIN_EMAIL: (value) => z.email().safeParse(value).success,
  BETTER_AUTH_SECRET: (value) => value.length >= 32,
  SMTP_HOST: (value) => /^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(value),
  SMTP_PORT: (value) => value === '465' || value === '587',
  SMTP_USER: (value) => value.length > 0 && !/[\r\n]/.test(value),
  SMTP_PASS: (value) => value.length > 0,
  SMTP_FROM: (value) => {
    const address = value.match(/^[^<>\r\n]*<([^<>\r\n]+)>$/)?.[1] ?? value;
    return !/[\r\n]/.test(value) && z.email().safeParse(address).success;
  },
};

let valid = true;

for (const [key, validate] of Object.entries(validators) as [ConfigurationKey, (value: string) => boolean][]) {
  const value = process.env[key]?.trim();
  const status = !value ? 'MISSING' : validate(value) ? 'OK' : 'INVALID';
  console.log(`${key}: ${status}`);
  if (status !== 'OK') valid = false;
}

const environment: SubscriptionEnvironment & AuthEnvironment = { ...process.env, NODE_ENV: 'production' };
const emailReady = getEmailAvailability(environment);
const subscriptionsReady = getSubscriptionAvailability(environment) && emailReady;
const authReady = getAuthAvailability(environment);
const separateSecrets = Boolean(environment.RATE_LIMIT_SECRET && environment.BETTER_AUTH_SECRET && environment.RATE_LIMIT_SECRET !== environment.BETTER_AUTH_SECRET);
console.log(`SECRET_SEPARATION: ${separateSecrets ? 'OK' : 'INVALID'}`);
console.log(`SUBSCRIPTIONS: ${subscriptionsReady ? 'CONFIGURED' : 'NOT_CONFIGURED'}`);
console.log(`MEMBERSHIP: ${authReady ? 'CONFIGURED' : 'NOT_CONFIGURED'}`);
console.log(`EMAIL: ${emailReady ? 'CONFIGURED' : 'NOT_CONFIGURED'}`);
console.log('DATABASE_CONNECTION: NOT_TESTED');
console.log('SMTP_CONNECTION: NOT_TESTED');
const configured = valid && separateSecrets && subscriptionsReady && authReady;
console.log(`CONFIGURATION_CHECK: ${configured ? 'PASS' : 'FAIL'}`);
process.exitCode = configured ? 0 : 1;
