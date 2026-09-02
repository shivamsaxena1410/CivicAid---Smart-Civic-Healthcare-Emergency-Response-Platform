/**
 * Fail-fast environment validation.
 *
 * Wired into `ConfigModule.forRoot({ validate })`, so a misconfigured
 * deployment crashes at bootstrap with an actionable message instead of
 * silently falling back to a hardcoded default.
 *
 * This exists because the inherited code had committed JWT secrets as
 * `||` fallbacks in three separate places (auth.service, auth.module,
 * jwt.strategy). Anyone with read access to the repository could mint valid
 * ADMIN access tokens against any deployment that happened to be missing its
 * environment variables. The fallbacks are gone; this module makes their
 * absence a startup failure rather than a silent downgrade.
 *
 * Deliberately hand-written rather than pulling in Joi or class-validator
 * plumbing: the rule set is small, and a plain function keeps the failure
 * message specific and dependency-free.
 */

/** Minimum entropy we accept for an HMAC signing key, in characters. */
const MIN_SECRET_LENGTH = 32;

/**
 * Secrets that have appeared in the repository's source or .env.example at any
 * point. These are public by definition and must never sign a real token, in
 * any environment — including local development, since a dev machine that
 * accepts a known-key token is still a machine that accepts a forged token.
 */
const COMPROMISED_SECRETS: readonly string[] = [
  'civicconnect_dev_access_jwt_secret_key_2026',
  'civicconnect_dev_refresh_jwt_secret_key_2026',
  'civicconnect_super_secret_access_jwt_key_2026_production',
  'civicconnect_super_secret_refresh_jwt_key_2026_production',
];

/** Placeholder prefixes that indicate the operator never filled the value in. */
const PLACEHOLDER_MARKERS: readonly string[] = ['CHANGE_ME', 'changeme', 'your-secret', 'xxx'];

export interface ValidatedEnv extends Record<string, unknown> {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
  BCRYPT_SALT_ROUNDS: number;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_MARKERS.some((marker) => value.toLowerCase().includes(marker.toLowerCase()));
}

/**
 * Validates a single JWT signing secret and returns the problems found.
 * Never includes the secret itself in an error message.
 */
function validateSecret(name: string, value: string | undefined): string[] {
  const errors: string[] = [];

  if (!value || value.trim().length === 0) {
    errors.push(
      `${name} is not set. Generate one with:  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
    );
    return errors;
  }

  if (value.length < MIN_SECRET_LENGTH) {
    errors.push(`${name} is too short (${value.length} chars); at least ${MIN_SECRET_LENGTH} are required.`);
  }

  if (COMPROMISED_SECRETS.includes(value)) {
    errors.push(
      `${name} is set to a value that is committed in this repository's history and is therefore public. Generate a fresh secret.`,
    );
  }

  if (isPlaceholder(value)) {
    errors.push(`${name} still contains a placeholder value. Replace it with a real generated secret.`);
  }

  return errors;
}

function parsePositiveInt(name: string, raw: string | undefined, fallback: number, errors: string[]): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${name} must be a positive integer, received "${raw}".`);
    return fallback;
  }
  return parsed;
}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];
  const get = (key: string): string | undefined => {
    const value = config[key];
    return typeof value === 'string' ? value : value === undefined ? undefined : String(value);
  };

  const nodeEnv = get('NODE_ENV') ?? 'development';
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of development | test | production, received "${nodeEnv}".`);
  }

  const databaseUrl = get('DATABASE_URL');
  if (!databaseUrl || databaseUrl.trim().length === 0) {
    errors.push('DATABASE_URL is not set. Copy backend/.env.example to backend/.env and fill it in.');
  } else if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL must be a PostgreSQL connection string (postgresql://...). PostGIS is required.');
  }

  const accessSecret = get('JWT_ACCESS_SECRET');
  const refreshSecret = get('JWT_REFRESH_SECRET');
  errors.push(...validateSecret('JWT_ACCESS_SECRET', accessSecret));
  errors.push(...validateSecret('JWT_REFRESH_SECRET', refreshSecret));

  // Reusing one key for both token types means a refresh token is accepted
  // wherever an access token is, which defeats the short access-token lifetime.
  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different values.');
  }

  const port = parsePositiveInt('PORT', get('PORT'), 4000, errors);

  // bcrypt cost. AGENTS.md mandates 12; the inherited code hardcoded 10.
  const bcryptRounds = parsePositiveInt('BCRYPT_SALT_ROUNDS', get('BCRYPT_SALT_ROUNDS'), 12, errors);
  if (bcryptRounds < 10 || bcryptRounds > 15) {
    errors.push(`BCRYPT_SALT_ROUNDS must be between 10 and 15, received ${bcryptRounds}.`);
  }

  if (errors.length > 0) {
    throw new Error(
      [
        '',
        '─────────────────────────────────────────────────────────────',
        ' CivicConnect API failed to start: invalid environment.',
        '─────────────────────────────────────────────────────────────',
        ...errors.map((e) => `  • ${e}`),
        '─────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  }

  return {
    ...config,
    NODE_ENV: nodeEnv,
    PORT: port,
    DATABASE_URL: databaseUrl as string,
    JWT_ACCESS_SECRET: accessSecret as string,
    JWT_REFRESH_SECRET: refreshSecret as string,
    JWT_ACCESS_EXPIRATION: get('JWT_ACCESS_EXPIRATION') ?? '15m',
    JWT_REFRESH_EXPIRATION: get('JWT_REFRESH_EXPIRATION') ?? '7d',
    BCRYPT_SALT_ROUNDS: bcryptRounds,
  };
}
