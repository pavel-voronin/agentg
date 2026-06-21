import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { postgres, type PostgresResource } from '@agentg/framework';

import * as schema from './schema.js';

export type DatabaseResource = PostgresResource<typeof schema>;
export type Database = DatabaseResource['db'];

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export function createDatabase(url: string): DatabaseResource {
  return postgres({
    migrations: {
      folder: resolve(packageRoot, 'drizzle'),
      table: '__drizzle_migrations_pipelines'
    },
    schema,
    url
  });
}
