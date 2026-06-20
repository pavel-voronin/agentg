import { toJsonValue } from '@agentg/framework';

import type { ProfileConfig } from '../config.js';
import type { ProcessingInput, ProcessingOutput, ProfileRunner } from './types.js';

export function createConfiguredProfileRunner(input: {
  profiles: Readonly<Record<string, ProfileConfig>>;
}): ProfileRunner {
  return {
    hasProfile(profile) {
      return input.profiles[profile] !== undefined;
    },
    async process(request) {
      const profile = input.profiles[request.profile];
      if (profile === undefined) {
        throw new Error(`LLM profile is not configured: ${request.profile}`);
      }
      return runOpenAiCompatible(profile, request);
    }
  };
}

async function runOpenAiCompatible(
  profile: ProfileConfig,
  request: ProcessingInput
): Promise<ProcessingOutput> {
  const maxAttempts = profile.maxAttempts ?? 1;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runOpenAiCompatibleAttempt(profile, request);
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function runOpenAiCompatibleAttempt(
  profile: ProfileConfig,
  request: ProcessingInput
): Promise<ProcessingOutput> {
  if (profile.apiKeyEnv !== undefined && profile.apiKey === undefined) {
    throw new Error(`LLM profile secret is not configured: ${profile.apiKeyEnv}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, profile.timeoutMs ?? 60_000);
  timeout.unref();

  try {
    const response = await fetch(endpoint(profile.baseUrl), {
      body: JSON.stringify({
        messages: [
          {
            content: request.prompt,
            role: 'system'
          },
          {
            content: JSON.stringify(request.row),
            role: 'user'
          }
        ],
        model: profile.model,
        ...(profile.maxOutputTokens === undefined ? {} : { max_tokens: profile.maxOutputTokens }),
        ...(profile.temperature === undefined ? {} : { temperature: profile.temperature })
      }),
      headers: {
        ...(profile.apiKey === undefined ? {} : { authorization: `Bearer ${profile.apiKey}` }),
        'content-type': 'application/json'
      },
      method: 'POST',
      signal: controller.signal
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new Error(providerHttpError(response.status, rawBody));
    }
    const body = parseProviderJson(rawBody);
    return {
      text: extractContent(body),
      payload: toJsonValue(body)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function endpoint(baseUrl: string): string {
  return new URL('chat/completions', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

function providerHttpError(status: number, rawBody: string): string {
  const summary = bodySummary(rawBody);
  return summary.length === 0
    ? `LLM provider returned HTTP ${String(status)}`
    : `LLM provider returned HTTP ${String(status)}: ${summary}`;
}

function parseProviderJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch (error) {
    throw new Error(
      `LLM provider response is not valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error }
    );
  }
}

function bodySummary(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (trimmed.length === 0) {
    return '';
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const message = providerErrorMessage(parsed);
    return bounded(message ?? JSON.stringify(parsed));
  } catch {
    return bounded(trimmed);
  }
}

function providerErrorMessage(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const error = (value as { error?: unknown }).error;
  if (typeof error === 'string') {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }
  return undefined;
}

function bounded(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= 300 ? normalized : `${normalized.slice(0, 300)}...`;
}

function extractContent(value: unknown): string {
  if (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { choices?: unknown }).choices)
  ) {
    const [first] = (value as { choices: unknown[] }).choices;
    if (
      typeof first === 'object' &&
      first !== null &&
      typeof (first as { message?: { content?: unknown } }).message?.content === 'string'
    ) {
      return (first as { message: { content: string } }).message.content;
    }
  }
  throw new Error('LLM provider response has no message content');
}
