import { rm } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const generation = vi.hoisted(() => ({
  runs: [] as { generationId: number | string; signal: AbortSignal }[]
}));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rm: vi.fn(() => Promise.resolve())
  };
});

vi.mock('./generation.js', () => ({
  runFileGeneration: vi.fn(
    (
      _options: unknown,
      update: { generation_id: number | string },
      signal: AbortSignal
    ): Promise<void> => {
      generation.runs.push({
        generationId: update.generation_id,
        signal
      });
      return new Promise((resolve) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
    }
  )
}));

import { useFiles } from './index.js';
import type { FileGenerationStartUpdate, FileSubsystemOptions } from './runtime.js';

describe('Telegram file generation runtime', () => {
  beforeEach(() => {
    generation.runs.length = 0;
    vi.mocked(rm).mockClear();
  });

  it('aborts active file generation and removes the destination on stop', async () => {
    const runtime = useFiles({} as FileSubsystemOptions);

    runtime.files.startFileGeneration(generationUpdate('42', '/tmp/agentg-generated-file'));

    expect(generation.runs).toHaveLength(1);
    expect(generation.runs[0]?.signal.aborted).toBe(false);

    await runtime.files.stopFileGeneration('42');

    expect(generation.runs[0]?.signal.aborted).toBe(true);
    expect(rm).toHaveBeenCalledWith('/tmp/agentg-generated-file', { force: true });
  });

  it('aborts an older generation with the same ID before starting the replacement', () => {
    const runtime = useFiles({} as FileSubsystemOptions);

    runtime.files.startFileGeneration(generationUpdate('42', '/tmp/agentg-generated-file-a'));
    runtime.files.startFileGeneration(generationUpdate('42', '/tmp/agentg-generated-file-b'));

    expect(generation.runs).toHaveLength(2);
    expect(generation.runs[0]?.signal.aborted).toBe(true);
    expect(generation.runs[1]?.signal.aborted).toBe(false);
  });
});

function generationUpdate(
  generationId: string,
  destinationPath: string
): FileGenerationStartUpdate {
  return {
    _: 'updateFileGenerationStart',
    conversion: '#url#',
    destination_path: destinationPath,
    generation_id: generationId,
    original_path: 'https://example.test/file'
  };
}
