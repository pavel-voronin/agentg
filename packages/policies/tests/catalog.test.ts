import { readFile } from 'node:fs/promises';

import { createPolicyServer } from '@agentg/framework/policies';
import { describe, expect, it } from 'vitest';

import { policyCatalog } from '../src/generated/policyCatalog.js';
import { createFileStore } from '../src/store.js';

describe('policy catalog', () => {
  it('loads generated policy descriptors without importing module runtimes', async () => {
    const source = await readFile(
      new URL('../src/generated/policyCatalog.ts', import.meta.url),
      'utf8'
    );

    expect(source).toContain('../../../pipelines/policies/policies.js');
    expect(source).toContain('../../../telegram/policies/policies.js');
    expect(source).not.toContain('../../../triggers/policies/policies.js');
    expect(source).not.toContain('/src/module');
    expect(source).not.toContain('/src/main');

    const server = createPolicyServer({
      catalog: policyCatalog,
      store: createFileStore({
        directory: new URL('../../../config/policies', import.meta.url).pathname
      })
    });

    await server.start();

    const kinds = await server.procedures.listPolicyKinds();
    expect(kinds.map((item) => item.kind).sort()).toEqual([
      'PipelineAutomationRule',
      'TelegramFileDownloadRule',
      'TelegramHistoryGapRestoreRule'
    ]);
  });

  it('loads real YAML policy instances and resolves Telegram file download rules', async () => {
    const server = createPolicyServer({
      catalog: policyCatalog,
      store: createFileStore({
        directory: new URL('../../../config/policies', import.meta.url).pathname
      })
    });

    await server.start();

    const kinds = await server.procedures.listPolicyKinds();
    expect(kinds.map((item) => item.kind)).toContain('TelegramFileDownloadRule');
    const value = await server.procedures.getPolicyValue({
      kind: 'TelegramFileDownloadRule'
    });

    expect(Array.isArray(value)).toBe(true);
    expect(
      Array.isArray(value) &&
        value.some(
          (rule) =>
            isRecord(rule) &&
            Array.isArray(rule.causes) &&
            rule.causes.includes('initialization') &&
            rule.causes.includes('live_update') &&
            rule.mediaKind === 'avatar' &&
            rule.maxBytes === null &&
            !Object.hasOwn(rule, 'name')
        )
    ).toBe(true);
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
