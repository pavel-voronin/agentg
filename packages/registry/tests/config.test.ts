import { describe, expect, it } from 'vitest';

import { readConfig } from '../src/config.js';

describe('registry runner config', () => {
  it('reads flat process config', () => {
    expect(
      readConfig({
        HOST: '127.0.0.1',
        NATS_URL: 'nats://127.0.0.1:4222',
        PORT: '8701'
      })
    ).toEqual({
      host: '127.0.0.1',
      natsUrl: 'nats://127.0.0.1:4222',
      port: 8701
    });
  });
});
