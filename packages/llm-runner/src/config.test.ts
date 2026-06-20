import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readConfig } from './config.js';

describe('LLM runner config', () => {
  const directories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      directories.map((directory) => rm(directory, { force: true, recursive: true }))
    );
    directories.length = 0;
  });

  it('reads profile connection and retry settings from YAML', async () => {
    const profilesPath = await profilesFile(`
profiles:
  default:
    adapter: openai-compatible
    apiKeyEnv: TEST_LLM_API_KEY
    baseUrl: http://provider.test/v1
    maxAttempts: 2
    maxOutputTokens: 100
    model: gpt-test
    temperature: 0.2
    timeoutMs: 5000
`);

    const config = readConfig({
      DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      LLM_RUNNER_PROFILES_PATH: profilesPath,
      NATS_URL: 'nats://127.0.0.1:4222',
      TEST_LLM_API_KEY: 'secret'
    });

    expect(config.profiles.default).toEqual({
      adapter: 'openai-compatible',
      apiKey: 'secret',
      apiKeyEnv: 'TEST_LLM_API_KEY',
      baseUrl: 'http://provider.test/v1',
      maxAttempts: 2,
      maxOutputTokens: 100,
      model: 'gpt-test',
      temperature: 0.2,
      timeoutMs: 5000
    });
  });

  it('does not require profile secrets while reading config', async () => {
    const profilesPath = await profilesFile(`
profiles:
  default:
    adapter: openai-compatible
    apiKeyEnv: TEST_LLM_API_KEY
    baseUrl: http://provider.test/v1
    model: gpt-test
`);

    const config = readConfig({
      DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
      LLM_RUNNER_PROFILES_PATH: profilesPath,
      NATS_URL: 'nats://127.0.0.1:4222'
    });

    expect(config.profiles.default).toEqual({
      adapter: 'openai-compatible',
      apiKeyEnv: 'TEST_LLM_API_KEY',
      baseUrl: 'http://provider.test/v1',
      model: 'gpt-test'
    });
  });

  it('rejects direct profile secrets in YAML', async () => {
    const profilesPath = await profilesFile(`
profiles:
  default:
    adapter: openai-compatible
    apiKey: secret
    baseUrl: http://provider.test/v1
    model: gpt-test
`);

    expect(() =>
      readConfig({
        DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
        LLM_RUNNER_PROFILES_PATH: profilesPath,
        NATS_URL: 'nats://127.0.0.1:4222'
      })
    ).toThrow('profiles.default.apiKey is not supported');
  });

  it('rejects invalid retry settings', async () => {
    const profilesPath = await profilesFile(`
profiles:
  default:
    adapter: openai-compatible
    baseUrl: http://provider.test/v1
    maxAttempts: 0
    model: gpt-test
`);

    expect(() =>
      readConfig({
        DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
        LLM_RUNNER_PROFILES_PATH: profilesPath,
        NATS_URL: 'nats://127.0.0.1:4222'
      })
    ).toThrow('profiles.default.maxAttempts must be a positive safe integer');
  });

  it('rejects invalid numeric runtime settings', async () => {
    await expectInvalidProfile(
      `
profiles:
  default:
    adapter: openai-compatible
    baseUrl: http://provider.test/v1
    maxOutputTokens: -10
    model: gpt-test
`,
      'profiles.default.maxOutputTokens must be a positive safe integer'
    );
    await expectInvalidProfile(
      `
profiles:
  default:
    adapter: openai-compatible
    baseUrl: http://provider.test/v1
    model: gpt-test
    temperature: 3
`,
      'profiles.default.temperature must be a finite number between 0 and 2'
    );
    await expectInvalidProfile(
      `
profiles:
  default:
    adapter: openai-compatible
    baseUrl: http://provider.test/v1
    model: gpt-test
    timeoutMs: 0
`,
      'profiles.default.timeoutMs must be a positive safe integer'
    );
  });

  async function expectInvalidProfile(content: string, message: string): Promise<void> {
    const profilesPath = await profilesFile(content);

    expect(() =>
      readConfig({
        DATABASE_URL: 'postgres://agentg:agentg@127.0.0.1:5432/agentg',
        LLM_RUNNER_PROFILES_PATH: profilesPath,
        NATS_URL: 'nats://127.0.0.1:4222'
      })
    ).toThrow(message);
  }

  async function profilesFile(content: string): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'agentg-llm-runner-'));
    directories.push(directory);
    const path = join(directory, 'profiles.yaml');
    await writeFile(path, content.trimStart(), 'utf8');
    return path;
  }
});
