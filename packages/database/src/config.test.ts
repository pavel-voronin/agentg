import { describe, expect, it } from 'vitest';

import { loadDatabaseCliConfig } from './config.js';

describe('loadDatabaseCliConfig', () => {
  it('uses local development defaults', () => {
    const config = loadDatabaseCliConfig({});

    expect(config).toMatchObject({
      databaseUrl: 'postgres://agentg:agentg@localhost:5432/agentg'
    });
  });
});
