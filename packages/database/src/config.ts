import { loadNearestDotenv } from '@agentg/infra/dotenv';

loadNearestDotenv();

export type DatabaseCliConfig = {
  databaseUrl: string;
};

export function loadDatabaseCliConfig(env: NodeJS.ProcessEnv = process.env): DatabaseCliConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg'
  };
}
