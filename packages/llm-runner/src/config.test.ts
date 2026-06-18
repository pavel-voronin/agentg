import { describe, expect, it } from 'vitest';

import { readConfig } from './config.js';

describe('LLM runner config', () => {
  it('reads profile connection and retry settings', () => {
    const config = readConfig({
      DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      LLM_RUNNER_PROFILES: JSON.stringify({
        default: {
          adapter: 'openai-compatible',
          apiKey: 'secret',
          baseUrl: 'http://provider.test/v1',
          maxAttempts: 2,
          maxOutputTokens: 100,
          model: 'gpt-test',
          temperature: 0.2,
          timeoutMs: 5000
        }
      }),
      NATS_URL: 'nats://127.0.0.1:4222'
    });

    expect(config.profiles.default).toEqual({
      adapter: 'openai-compatible',
      apiKey: 'secret',
      baseUrl: 'http://provider.test/v1',
      maxAttempts: 2,
      maxOutputTokens: 100,
      model: 'gpt-test',
      temperature: 0.2,
      timeoutMs: 5000
    });
  });

  it('rejects invalid retry settings', () => {
    expect(() =>
      readConfig({
        DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
        LLM_RUNNER_PROFILES: JSON.stringify({
          default: {
            adapter: 'openai-compatible',
            baseUrl: 'http://provider.test/v1',
            maxAttempts: 0,
            model: 'gpt-test'
          }
        }),
        NATS_URL: 'nats://127.0.0.1:4222'
      })
    ).toThrow('LLM runner retry profile fields must be positive integers');
  });
});
