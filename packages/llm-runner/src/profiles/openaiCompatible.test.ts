import { afterEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { createConfiguredProfileRunner } from './openaiCompatible.js';

describe('OpenAI-compatible profile runner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses configured provider connection and request instructions', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(successResponse('summary'));
    const runner = createConfiguredProfileRunner({
      profiles: {
        default: {
          adapter: 'openai-compatible',
          apiKey: 'secret-token',
          baseUrl: 'http://provider.test/v1',
          maxOutputTokens: 100,
          model: 'gpt-test',
          temperature: 0.2,
          timeoutMs: 1000
        }
      }
    });

    await expect(runner.process(processingRequest())).resolves.toEqual({
      payload: {
        choices: [
          {
            message: {
              content: 'summary'
            }
          }
        ]
      },
      text: 'summary'
    });

    const call = fetchCall(fetchMock);
    expect(call.url).toBe('http://provider.test/v1/chat/completions');
    expect(call.headers).toMatchObject({
      authorization: 'Bearer secret-token',
      'content-type': 'application/json'
    });
    expect(call.body).toMatchObject({
      max_tokens: 100,
      messages: [
        {
          content: 'Summarize only these messages.',
          role: 'system'
        },
        {
          role: 'user'
        }
      ],
      model: 'gpt-test',
      temperature: 0.2
    });
    const userMessage = call.body.messages[1];
    if (userMessage === undefined || typeof userMessage.content !== 'string') {
      throw new Error('Expected provider user message');
    }
    expect(JSON.parse(userMessage.content)).toEqual({
      lineage: [{ _model: 'telegram.chat', id: '10' }],
      refs: {
        chat: { _model: 'telegram.chat', id: '10' }
      },
      value: 'hello'
    });
  });

  it('retries provider calls with the same request payload', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'busy' }), { status: 500 }))
      .mockResolvedValueOnce(successResponse('retry summary'));
    const runner = createConfiguredProfileRunner({
      profiles: {
        default: {
          adapter: 'openai-compatible',
          baseUrl: 'http://provider.test/v1',
          maxAttempts: 2,
          model: 'gpt-test'
        }
      }
    });

    await expect(runner.process(processingRequest())).resolves.toMatchObject({
      text: 'retry summary'
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchCall(fetchMock, 0).body).toEqual(fetchCall(fetchMock, 1).body);
  });

  it('rejects invalid provider responses before normalization succeeds', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [] }), { status: 200 })
    );
    const runner = createConfiguredProfileRunner({
      profiles: {
        default: {
          adapter: 'openai-compatible',
          baseUrl: 'http://provider.test/v1',
          model: 'gpt-test'
        }
      }
    });

    await expect(runner.process(processingRequest())).rejects.toThrow(
      'LLM provider response has no message content'
    );
  });

  it('reports provider HTTP status before parsing provider body as JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>bad gateway</html>', { status: 502 })
    );
    const runner = createConfiguredProfileRunner({
      profiles: {
        default: {
          adapter: 'openai-compatible',
          baseUrl: 'http://provider.test/v1',
          model: 'gpt-test'
        }
      }
    });

    await expect(runner.process(processingRequest())).rejects.toThrow(
      'LLM provider returned HTTP 502: <html>bad gateway</html>'
    );
  });

  it('rejects profile calls with unresolved secret references', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const runner = createConfiguredProfileRunner({
      profiles: {
        default: {
          adapter: 'openai-compatible',
          apiKeyEnv: 'TEST_LLM_API_KEY',
          baseUrl: 'http://provider.test/v1',
          model: 'gpt-test'
        }
      }
    });

    await expect(runner.process(processingRequest())).rejects.toThrow(
      'LLM profile secret is not configured: TEST_LLM_API_KEY'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function processingRequest() {
  return {
    profile: 'default',
    prompt: 'Summarize only these messages.',
    row: {
      lineage: [{ _model: 'telegram.chat', id: '10' }],
      refs: {
        chat: { _model: 'telegram.chat', id: '10' }
      },
      value: 'hello'
    }
  };
}

function successResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content
          }
        }
      ]
    }),
    { status: 200 }
  );
}

function fetchCall(
  fetchMock: MockInstance<typeof fetch>,
  index = 0
): {
  body: Record<string, unknown> & {
    messages: { content: unknown; role: string }[];
  };
  headers: Record<string, string>;
  url: string;
} {
  const call = fetchMock.mock.calls[index];
  if (call === undefined) {
    throw new Error(`Missing fetch call ${String(index)}`);
  }
  const [url, init] = call;
  if (typeof url !== 'string' || init === undefined || typeof init.body !== 'string') {
    throw new Error('Unexpected fetch call shape');
  }
  return {
    body: JSON.parse(init.body) as Record<string, unknown> & {
      messages: { content: unknown; role: string }[];
    },
    headers: init.headers as Record<string, string>,
    url
  };
}
