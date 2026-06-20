import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { defineConfig, number, string, type ConfigOf } from '@agentg/framework';
import { parseDocument } from 'yaml';

export type ProfileConfig = Readonly<{
  adapter: 'openai-compatible';
  apiKey?: string | undefined;
  apiKeyEnv?: string | undefined;
  baseUrl: string;
  maxAttempts?: number | undefined;
  maxOutputTokens?: number | undefined;
  model: string;
  temperature?: number | undefined;
  timeoutMs?: number | undefined;
}>;

const rawConfig = defineConfig({
  databaseUrl: string('DATABASE_URL'),
  host: string('HOST').optional(),
  natsUrl: string('NATS_URL'),
  port: number('PORT').default(8707),
  profilesPath: string('LLM_RUNNER_PROFILES_PATH').default('./config/llm-runner/profiles.yaml'),
  workerIntervalMs: number('LLM_RUNNER_WORKER_INTERVAL_MS').default(1_000)
});

type RawConfig = ConfigOf<typeof rawConfig>;
type ConfigSource = Record<string, unknown>;
type ConfigSourceInput = ConfigSource | readonly ConfigSource[];
type ProfileFile = Readonly<{
  profiles: Readonly<Record<string, unknown>>;
}>;

export type Config = Omit<RawConfig, 'profilesPath'> & {
  readonly profiles: Readonly<Record<string, ProfileConfig>>;
};

export function readConfig(...sources: Parameters<typeof rawConfig>): Config {
  const config = rawConfig(...sources);
  const flattenedSources = flattenSources(sources);
  return {
    databaseUrl: config.databaseUrl,
    host: config.host,
    natsUrl: config.natsUrl,
    port: config.port,
    profiles: readProfiles(config.profilesPath, flattenedSources),
    workerIntervalMs: config.workerIntervalMs
  };
}

function readProfiles(
  path: string,
  sources: readonly ConfigSource[]
): Readonly<Record<string, ProfileConfig>> {
  const resolvedPath = resolve(path);
  const yaml = parseDocument(readFileSync(resolvedPath, 'utf8'));
  if (yaml.errors.length > 0) {
    throw new Error(
      `LLM runner profiles YAML is invalid in ${resolvedPath}: ${
        yaml.errors[0]?.message ?? 'parse failed'
      }`
    );
  }
  if (yaml.warnings.length > 0) {
    throw new Error(
      `LLM runner profiles YAML is invalid in ${resolvedPath}: ${
        yaml.warnings[0]?.message ?? 'parse warning'
      }`
    );
  }
  const parsed = yaml.toJSON() as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.profiles)) {
    throw new Error('LLM runner profiles file must contain a profiles object');
  }
  return parseProfiles(
    {
      profiles: parsed.profiles
    },
    sources
  );
}

function parseProfiles(
  file: ProfileFile,
  sources: readonly ConfigSource[]
): Readonly<Record<string, ProfileConfig>> {
  const output: Record<string, ProfileConfig> = {};
  for (const [name, value] of Object.entries(file.profiles)) {
    assertName(name, 'profile');
    if (!isRecord(value)) {
      throw new Error(`profiles.${name} must be an object`);
    }
    assertAllowedFields(value, `profiles.${name}`, [
      'adapter',
      'apiKeyEnv',
      'baseUrl',
      'maxAttempts',
      'maxOutputTokens',
      'model',
      'temperature',
      'timeoutMs'
    ]);
    if (value.adapter !== 'openai-compatible') {
      throw new Error(`profiles.${name}.adapter is not supported`);
    }
    const baseUrl = requiredString(value.baseUrl, `profiles.${name}.baseUrl`);
    const model = requiredString(value.model, `profiles.${name}.model`);
    const apiKeyEnv = optionalEnvName(value.apiKeyEnv, `profiles.${name}.apiKeyEnv`);
    const apiKey = apiKeyEnv === undefined ? undefined : optionalSecret(sources, apiKeyEnv);
    const maxAttempts = positiveIntegerValue(value.maxAttempts, `profiles.${name}.maxAttempts`);
    const maxOutputTokens = positiveIntegerValue(
      value.maxOutputTokens,
      `profiles.${name}.maxOutputTokens`
    );
    const temperature = temperatureValue(value.temperature, `profiles.${name}.temperature`);
    const timeoutMs = positiveIntegerValue(value.timeoutMs, `profiles.${name}.timeoutMs`);
    output[name] = Object.freeze({
      adapter: 'openai-compatible',
      ...(apiKey === undefined ? {} : { apiKey }),
      ...(apiKeyEnv === undefined ? {} : { apiKeyEnv }),
      baseUrl,
      ...(maxAttempts === undefined ? {} : { maxAttempts }),
      ...(maxOutputTokens === undefined ? {} : { maxOutputTokens }),
      model,
      ...(temperature === undefined ? {} : { temperature }),
      ...(timeoutMs === undefined ? {} : { timeoutMs })
    });
  }
  return Object.freeze(output);
}

function assertAllowedFields(
  value: Record<string, unknown>,
  label: string,
  fields: readonly string[]
): void {
  const allowed = new Set(fields);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label}.${key} is not supported`);
    }
  }
}

function assertName(value: string, label: string): void {
  if (!/^[a-z][A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error(`LLM runner ${label} must be a named profile key: ${value}`);
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalEnvName(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const name = requiredString(value, label);
  if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
    throw new Error(`${label} must be an environment variable name`);
  }
  return name;
}

function optionalSecret(sources: readonly ConfigSource[], name: string): string | undefined {
  for (let index = sources.length - 1; index >= 0; index -= 1) {
    const value = sources[index]?.[name];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function temperatureValue(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 2) {
    throw new Error(`${label} must be a finite number between 0 and 2`);
  }
  return value;
}

function positiveIntegerValue(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flattenSources(sources: readonly ConfigSourceInput[]): ConfigSource[] {
  const output: ConfigSource[] = [];
  for (const source of sources) {
    if (isSourceArray(source)) {
      output.push(...source);
    } else {
      output.push(source);
    }
  }
  return output;
}

function isSourceArray(source: ConfigSourceInput): source is readonly ConfigSource[] {
  return Array.isArray(source);
}
