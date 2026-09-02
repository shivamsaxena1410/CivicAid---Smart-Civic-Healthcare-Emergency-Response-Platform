import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Replaces the `prisma` key in package.json, which 6.19.3 warns is deprecated
 * and slated for removal in Prisma 7:
 *
 *   warn The configuration property `package.json#prisma` is deprecated and
 *   will be removed in Prisma 7. Please migrate to a Prisma config file.
 *
 * Note the shape: the seed command lives under `migrations.seed` here, not at
 * the top level as it did in package.json. The flat `{ schema, seed }` form is
 * the legacy package.json shape and is not what this file accepts.
 */

/**
 * Load backend/.env ourselves.
 *
 * The moment this config file exists, the Prisma CLI stops loading .env. It
 * says so explicitly:
 *
 *   Loaded Prisma config from prisma.config.ts.
 *   Prisma config detected, skipping environment variable loading.
 *   Error: Environment variable not found: DATABASE_URL.
 *
 * That breaks the CLI *and* `prisma db seed`, which spawns `tsx prisma/seed.ts`
 * as a child process that inherits this process's environment.
 *
 * `process.loadEnvFile` is Node's own .env parser (built in since 20.12). Using
 * it rather than `import 'dotenv/config'` keeps this file dependency-free:
 * dotenv is currently only a transitive package under @nestjs/config, and
 * having DATABASE_URL resolution silently depend on someone else's dependency
 * tree is exactly the kind of thing that breaks on a fresh install.
 *
 * Resolved against this file's own directory, not process.cwd(), so the config
 * keeps working if Prisma is ever invoked from somewhere other than backend/.
 */
const envPath = path.join(__dirname, '.env');
try {
  process.loadEnvFile(envPath);
} catch {
  // No .env (CI, container with real env vars already exported). Not fatal —
  // the schema's env("DATABASE_URL") will fail with its own clear message if
  // the variable is genuinely absent.
}

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
    seed: 'tsx prisma/seed.ts',
  },
});
