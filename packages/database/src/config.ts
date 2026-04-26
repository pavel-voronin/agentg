import 'dotenv/config';

export type DatabaseCliConfig = {
  appMode: 'migrate' | 'smoke';
  databaseUrl: string;
};

export function loadDatabaseCliConfig(env: NodeJS.ProcessEnv = process.env): DatabaseCliConfig {
  return {
    appMode: parseAppMode(env.APP_MODE),
    databaseUrl: env.DATABASE_URL ?? 'postgres://agentg:agentg@localhost:5432/agentg'
  };
}

function parseAppMode(value: string | undefined): DatabaseCliConfig['appMode'] {
  if (value === undefined || value === 'smoke') {
    return 'smoke';
  }

  if (value === 'migrate') {
    return value;
  }

  throw new Error(`APP_MODE must be "migrate" or "smoke", received "${value}"`);
}
