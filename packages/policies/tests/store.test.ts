import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { POLICY_API_VERSION, type PolicyDocument } from '@agentg/framework/policies';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileStore } from '../src/store.js';

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'agentg-policies-'));
});

afterEach(async () => {
  await rm(directory, { force: true, recursive: true });
});

describe('file policy store', () => {
  it('writes and reads YAML documents by canonical identity path', async () => {
    const store = createFileStore({ directory });
    const document = policyDocument('alphaEnabled');

    await store.set(document);

    await expect(
      readFile(join(directory, 'sample-rule', 'alphaEnabled.yaml'), 'utf8')
    ).resolves.toContain('kind: SampleRule');
    await expect(store.loadAll()).resolves.toEqual([document]);
  });

  it('rejects path and document identity mismatch on startup', async () => {
    await mkdir(join(directory, 'sample-rule'), { recursive: true });
    await writeFile(
      join(directory, 'sample-rule', 'wrongName.yaml'),
      [
        `apiVersion: ${POLICY_API_VERSION}`,
        'kind: SampleRule',
        'metadata:',
        '  name: alphaEnabled',
        'spec:',
        '  mode: enabled'
      ].join('\n'),
      'utf8'
    );

    await expect(createFileStore({ directory }).loadAll()).rejects.toThrow(
      'Policy path identity mismatch'
    );
  });

  it('removes only policy temp files on startup', async () => {
    await mkdir(join(directory, 'sample-rule'), { recursive: true });
    await writeFile(join(directory, 'sample-rule', 'unrelated.tmp'), 'keep me', 'utf8');
    await writeFile(
      join(directory, 'sample-rule', 'alphaEnabled.yaml.agentg-1-1.tmp'),
      'remove me',
      'utf8'
    );

    await expect(createFileStore({ directory }).loadAll()).resolves.toEqual([]);
    await expect(readFile(join(directory, 'sample-rule', 'unrelated.tmp'), 'utf8')).resolves.toBe(
      'keep me'
    );
    await expect(
      readFile(join(directory, 'sample-rule', 'alphaEnabled.yaml.agentg-1-1.tmp'), 'utf8')
    ).rejects.toThrow();
  });

  it('rejects YAML warnings on startup', async () => {
    await mkdir(join(directory, 'sample-rule'), { recursive: true });
    await writeFile(
      join(directory, 'sample-rule', 'alphaEnabled.yaml'),
      [
        `apiVersion: ${POLICY_API_VERSION}`,
        'kind: SampleRule',
        'metadata:',
        '  name: alphaEnabled',
        'spec: !custom',
        '  mode: enabled'
      ].join('\n'),
      'utf8'
    );

    await expect(createFileStore({ directory }).loadAll()).rejects.toThrow(
      'Policy YAML is invalid'
    );
  });
});

function policyDocument(name: string): PolicyDocument {
  return {
    apiVersion: POLICY_API_VERSION,
    kind: 'SampleRule',
    metadata: {
      name
    },
    spec: {
      mode: 'enabled'
    }
  };
}
