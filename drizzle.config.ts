import 'dotenv/config';

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg'
  },
  dialect: 'postgresql',
  out: './drizzle',
  schema: './packages/database/src/schema.ts',
  strict: true,
  verbose: true
});
