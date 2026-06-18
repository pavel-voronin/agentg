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
            content: request.instructions,
            role: 'system'
          },
          {
            content: JSON.stringify({
              contentRefs: request.contentRefs,
              payload: request.payload,
              sourceRefs: request.sourceRefs
            }),
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

    const body = await response.json();
    if (!response.ok) {
      throw new Error(`LLM provider returned HTTP ${String(response.status)}`);
    }
    return {
      body: extractContent(body),
      payload: toJsonValue(body)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function endpoint(baseUrl: string): string {
  return new URL('chat/completions', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
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
