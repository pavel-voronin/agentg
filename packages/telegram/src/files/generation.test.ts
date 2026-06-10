import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { afterEach, describe, expect, it, vi } from 'vitest';

const dns = vi.hoisted(() => ({
  lookup: vi.fn()
}));

const http = vi.hoisted(() => ({
  request: vi.fn()
}));
const https = vi.hoisted(() => ({
  request: vi.fn()
}));
const logs = vi.hoisted(() => [] as Record<string, unknown>[]);
const telemetry = vi.hoisted(() => ({
  incrementTelemetryCounter: vi.fn(),
  setTelemetryGauge: vi.fn(),
  timeTelemetrySpan: vi.fn(
    async (_input: unknown, operation: () => Promise<unknown>): Promise<unknown> => operation()
  )
}));

vi.mock('node:dns/promises', () => ({
  lookup: dns.lookup
}));

vi.mock('node:http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:http')>();
  return {
    ...actual,
    request: http.request
  };
});

vi.mock('node:https', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:https')>();
  return {
    ...actual,
    request: https.request
  };
});

vi.mock('@agentg/framework', async (importOriginal) => {
  const framework = await importOriginal<typeof import('@agentg/framework')>();
  return {
    ...framework,
    createLogger: () => ({
      warn(entry: Record<string, unknown>) {
        logs.push(entry);
      }
    }),
    incrementTelemetryCounter: telemetry.incrementTelemetryCounter,
    logError: (error: unknown) => ({
      'error.type': error instanceof Error ? error.name : typeof error,
      error
    }),
    setTelemetryGauge: telemetry.setTelemetryGauge,
    timeTelemetrySpan: telemetry.timeTelemetrySpan
  };
});

import { assertSafeGeneratedFileUrl, runFileGeneration } from './generation.js';
import type { FileGenerationStartUpdate, FileSubsystemOptions } from './runtime.js';

describe('Telegram file generation', () => {
  afterEach(() => {
    dns.lookup.mockReset();
    http.request.mockReset();
    https.request.mockReset();
    logs.length = 0;
    telemetry.incrementTelemetryCounter.mockReset();
    telemetry.timeTelemetrySpan.mockClear();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('rejects localhost generation URLs before DNS lookup', async () => {
    await expect(assertSafeGeneratedFileUrl(new URL('http://localhost/file'))).rejects.toThrow(
      'Blocked Telegram generated file URL target'
    );
    expect(dns.lookup).not.toHaveBeenCalled();
  });

  it('rejects generation URLs that resolve to private addresses', async () => {
    dns.lookup.mockResolvedValue([{ address: '10.0.0.7', family: 4 }]);

    await expect(assertSafeGeneratedFileUrl(new URL('https://example.test/file'))).rejects.toThrow(
      'Blocked Telegram generated file URL target'
    );
  });

  it('rejects generation URLs with mixed public and private DNS answers', async () => {
    dns.lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.7', family: 4 }
    ]);

    await expect(assertSafeGeneratedFileUrl(new URL('https://example.test/file'))).rejects.toThrow(
      'Blocked Telegram generated file URL target'
    );
  });

  it('rejects generation URLs that resolve to IPv4-mapped IPv6 addresses', async () => {
    dns.lookup.mockResolvedValue([{ address: '::ffff:127.0.0.1', family: 6 }]);

    await expect(assertSafeGeneratedFileUrl(new URL('https://example.test/file'))).rejects.toThrow(
      'Blocked Telegram generated file URL target'
    );
  });

  it('rejects generation URLs that resolve to hex IPv4-mapped IPv6 addresses', async () => {
    dns.lookup.mockResolvedValue([{ address: '::ffff:c0a8:1', family: 6 }]);

    await expect(assertSafeGeneratedFileUrl(new URL('https://example.test/file'))).rejects.toThrow(
      'Blocked Telegram generated file URL target'
    );
  });

  it('rejects generation URLs with bracketed IPv6 loopback hosts', async () => {
    dns.lookup.mockResolvedValue([{ address: '::1', family: 6 }]);

    await expect(assertSafeGeneratedFileUrl(new URL('http://[::1]/file'))).rejects.toThrow(
      'Blocked Telegram generated file URL target'
    );
    expect(dns.lookup).toHaveBeenCalledWith('::1', {
      all: true,
      verbatim: true
    });
  });

  it('rejects non-HTTP generation URLs before opening a request', async () => {
    const finishFileGeneration = vi.fn(() => Promise.resolve());

    await runFileGeneration(
      generationOptions(finishFileGeneration),
      {
        ...generationUpdate(),
        original_path: 'file:///etc/passwd'
      },
      new AbortController().signal
    );

    expect(http.request).not.toHaveBeenCalled();
    expect(https.request).not.toHaveBeenCalled();
    expect(finishFileGeneration).toHaveBeenCalledWith(
      {
        error: {
          _: 'error',
          code: 500,
          message: 'Unsupported Telegram generated file URL protocol: file:'
        },
        generationId: '42'
      },
      {
        priority: 16
      }
    );
  });

  it('rejects redirect targets before fetching the redirected URL', async () => {
    dns.lookup.mockImplementation((hostname: string) =>
      Promise.resolve([
        {
          address: hostname === 'example.test' ? '93.184.216.34' : '127.0.0.1',
          family: 4
        }
      ])
    );
    https.request.mockImplementation((options: unknown, callback: (response: Readable) => void) => {
      queueMicrotask(() => {
        callback(
          Object.assign(
            new Readable({
              read() {
                this.push(null);
              }
            }),
            {
              headers: {
                location: 'http://127.0.0.1/internal'
              },
              statusCode: 302
            }
          )
        );
      });
      return requestHandle();
    });
    const finishFileGeneration = vi.fn(() => Promise.resolve());
    const options = generationOptions(finishFileGeneration);

    await runFileGeneration(options, generationUpdate(), new AbortController().signal);

    expect(https.request).toHaveBeenCalledTimes(1);
    expect(http.request).not.toHaveBeenCalled();
    expect(https.request.mock.calls[0]?.[0]).toMatchObject({
      headers: {
        Host: 'example.test'
      },
      hostname: '93.184.216.34',
      servername: 'example.test'
    });
    expect(finishFileGeneration).toHaveBeenCalledWith(
      {
        error: {
          _: 'error',
          code: 500,
          message: 'Blocked Telegram generated file URL target'
        },
        generationId: '42'
      },
      {
        priority: 16
      }
    );
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith(
      'telegram.file.generation.outcomes',
      1,
      {
        'telegram.file.generation.failure.reason': 'blocked_url',
        'telegram.file.generation.outcome': 'failed'
      }
    );
    expect(logs).toEqual([
      expect.objectContaining({
        event: 'telegram.file_generation_failed',
        reason: 'blocked_url'
      })
    ]);
    expect(JSON.stringify(telemetry.incrementTelemetryCounter.mock.calls)).not.toContain(
      '127.0.0.1'
    );
  });

  it('fails generated downloads when content length exceeds the configured size limit', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    https.request.mockImplementation((options: unknown, callback: (response: Readable) => void) => {
      queueMicrotask(() => {
        callback(
          Object.assign(
            new Readable({
              read() {
                this.push(null);
              }
            }),
            {
              headers: {
                'content-length': '9'
              },
              statusCode: 200
            }
          )
        );
      });
      return requestHandle();
    });
    const finishFileGeneration = vi.fn(() => Promise.resolve());

    await runFileGeneration(
      {
        ...generationOptions(finishFileGeneration),
        generationMaxBytes: 8
      },
      generationUpdate(),
      new AbortController().signal
    );

    expect(finishFileGeneration).toHaveBeenCalledWith(
      {
        error: {
          _: 'error',
          code: 500,
          message: 'Telegram generated file exceeds maximum allowed size'
        },
        generationId: '42'
      },
      {
        priority: 16
      }
    );
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith(
      'telegram.file.generation.outcomes',
      1,
      {
        'telegram.file.generation.failure.reason': 'size_limit',
        'telegram.file.generation.outcome': 'failed'
      }
    );
  });

  it('fails chunked generated downloads when the body exceeds the configured size limit', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    https.request.mockImplementation((options: unknown, callback: (response: Readable) => void) => {
      queueMicrotask(() => {
        callback(
          Object.assign(Readable.from([Buffer.from('123456789')]), {
            headers: {},
            statusCode: 200
          })
        );
      });
      return requestHandle();
    });
    const directory = await mkdtemp(join(tmpdir(), 'agentg-generation-'));
    const destinationPath = join(directory, 'generated-file');
    const finishFileGeneration = vi.fn(() => Promise.resolve());

    try {
      await runFileGeneration(
        {
          ...generationOptions(finishFileGeneration),
          generationMaxBytes: 8
        },
        {
          ...generationUpdate(),
          destination_path: destinationPath
        },
        new AbortController().signal
      );

      expect(finishFileGeneration).toHaveBeenCalledWith(
        {
          error: {
            _: 'error',
            code: 500,
            message: 'Telegram generated file exceeds maximum allowed size'
          },
          generationId: '42'
        },
        {
          priority: 16
        }
      );
      await expectFileMissing(destinationPath);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('removes generated destination files when a streaming download fails', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    https.request.mockImplementation((options: unknown, callback: (response: Readable) => void) => {
      queueMicrotask(() => {
        callback(
          Object.assign(
            new Readable({
              read() {
                this.push(Buffer.from('partial'));
                this.destroy(new Error('stream failed'));
              }
            }),
            {
              headers: {},
              statusCode: 200
            }
          )
        );
      });
      return requestHandle();
    });
    const directory = await mkdtemp(join(tmpdir(), 'agentg-generation-'));
    const destinationPath = join(directory, 'generated-file');
    const finishFileGeneration = vi.fn(() => Promise.resolve());

    try {
      await runFileGeneration(
        generationOptions(finishFileGeneration),
        {
          ...generationUpdate(),
          destination_path: destinationPath
        },
        new AbortController().signal
      );

      expect(finishFileGeneration).toHaveBeenCalledWith(
        {
          error: {
            _: 'error',
            code: 500,
            message: 'Telegram generated file write failed'
          },
          generationId: '42'
        },
        {
          priority: 16
        }
      );
      await expectFileMissing(destinationPath);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('fails generated downloads that exceed the configured timeout', async () => {
    vi.useFakeTimers();
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    https.request.mockImplementation((options: unknown) => {
      const handle = requestHandle();
      const signal = (options as { signal?: AbortSignal }).signal;
      signal?.addEventListener('abort', () => {
        handle.handlers.get('error')?.(new Error('aborted'));
      });
      return handle;
    });
    const finishFileGeneration = vi.fn(() => Promise.resolve());
    const generation = runFileGeneration(
      {
        ...generationOptions(finishFileGeneration),
        generationDownloadTimeoutMs: 1
      },
      generationUpdate(),
      new AbortController().signal
    );

    await vi.advanceTimersByTimeAsync(1);
    await generation;

    expect(finishFileGeneration).toHaveBeenCalledWith(
      {
        error: {
          _: 'error',
          code: 500,
          message: 'Telegram generated file download timed out'
        },
        generationId: '42'
      },
      {
        priority: 16
      }
    );
    expect(telemetry.incrementTelemetryCounter).toHaveBeenCalledWith(
      'telegram.file.generation.outcomes',
      1,
      {
        'telegram.file.generation.failure.reason': 'timeout',
        'telegram.file.generation.outcome': 'failed'
      }
    );
  });
});

function generationUpdate(): FileGenerationStartUpdate {
  return {
    _: 'updateFileGenerationStart',
    conversion: '#url#',
    destination_path: '/tmp/agentg-generated-file',
    generation_id: '42',
    original_path: 'https://example.test/file'
  };
}

function requestHandle() {
  const handlers = new Map<string, (error: Error) => void>();
  const handle = {
    end: vi.fn(),
    handlers,
    on: vi.fn((event: string, handler: (error: Error) => void) => {
      handlers.set(event, handler);
      return handle;
    })
  };
  return handle;
}

async function expectFileMissing(path: string): Promise<void> {
  await expect(access(path)).rejects.toMatchObject({
    code: 'ENOENT'
  });
}

function generationOptions(
  finishFileGeneration: (input: unknown, options: unknown) => Promise<void> = vi.fn(() =>
    Promise.resolve()
  )
): FileSubsystemOptions {
  return {
    tdlib: {
      finishFileGeneration,
      setFileGenerationProgress: vi.fn(() => Promise.resolve())
    }
  } as unknown as FileSubsystemOptions;
}
