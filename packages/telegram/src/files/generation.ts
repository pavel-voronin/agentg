import { createWriteStream } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { error$Input } from 'tdlib-types';

import { priorities } from '../tdlib/priority.js';
import type { FileGenerationStartUpdate, FileSubsystemOptions } from './runtime.js';

export async function runFileGeneration(
  options: FileSubsystemOptions,
  update: FileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  try {
    if (update.conversion !== '#url#') {
      throw new Error(`Unsupported Telegram file generation conversion: ${update.conversion}`);
    }

    await downloadGeneratedFileFromUrl(options, update, signal);
    if (signal.aborted) {
      return;
    }
    await finishFileGeneration(options, update.generation_id, null);
  } catch (error) {
    if (signal.aborted) {
      return;
    }
    await finishFileGeneration(options, update.generation_id, {
      _: 'error',
      code: 500,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function downloadGeneratedFileFromUrl(
  options: FileSubsystemOptions,
  update: FileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  const url = new URL(update.original_path);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported Telegram generated file URL protocol: ${url.protocol}`);
  }

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Telegram generated file download failed with HTTP ${String(response.status)}`);
  }
  if (response.body === null) {
    throw new Error('Telegram generated file download returned an empty body');
  }

  const expectedSize = response.headers.get('content-length');
  await setFileGenerationProgress(options, update.generation_id, {
    expectedSize: expectedSize === null ? 0 : Number.parseInt(expectedSize, 10),
    localPrefixSize: 0
  });

  await mkdir(dirname(update.destination_path), { recursive: true });
  const source = Readable.fromWeb(response.body);
  await pipeline(source, createWriteStream(update.destination_path), { signal });

  const generated = await stat(update.destination_path);
  await setFileGenerationProgress(options, update.generation_id, {
    expectedSize: generated.size,
    localPrefixSize: generated.size
  });
}

async function setFileGenerationProgress(
  options: FileSubsystemOptions,
  generationId: number | string,
  input: {
    expectedSize: number;
    localPrefixSize: number;
  }
): Promise<void> {
  await options.tdlib.setFileGenerationProgress(
    {
      expectedSize: safeFileGenerationSize(input.expectedSize),
      generationId,
      localPrefixSize: safeFileGenerationSize(input.localPrefixSize)
    },
    {
      priority: priorities.normal
    }
  );
}

async function finishFileGeneration(
  options: FileSubsystemOptions,
  generationId: number | string,
  error: error$Input | null
): Promise<void> {
  await options.tdlib.finishFileGeneration(
    {
      error,
      generationId
    },
    {
      priority: priorities.normal
    }
  );
}

function safeFileGenerationSize(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
