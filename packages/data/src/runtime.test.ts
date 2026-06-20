import { describe, expect, it, vi } from 'vitest';

import type { ProviderRegistry } from './providers.js';
import { createRuntime } from './runtime.js';
import { createMemoryStore } from './store.js';

describe('data runtime', () => {
  it('lists initial models and routes provider-owned select calls', async () => {
    const providers = providerRegistry();
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });

    expect(runtime.listModels().map((entry) => entry.model)).toEqual([
      'telegram.chat',
      'telegram.message',
      'telegram.user',
      'data.annotation',
      'data.collectionItem'
    ]);
    await expect(
      runtime.select({
        limit: 1,
        model: 'telegram.chat',
        where: { readState: 'unread' }
      })
    ).resolves.toEqual({
      rows: [
        {
          lineage: [{ _model: 'telegram.chat', id: '10' }],
          refs: { chat: { _model: 'telegram.chat', id: '10' } },
          value: { id: '10' }
        }
      ]
    });
    const select = vi.mocked(providers.select);
    expect(select).toHaveBeenCalledWith('telegram', {
      limit: 1,
      model: 'telegram.chat',
      where: { readState: 'unread' }
    });
  });

  it('rejects unknown models before provider calls', async () => {
    const providers = providerRegistry();
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });

    await expect(runtime.select({ model: 'unknown.model' })).rejects.toThrow(
      'Data model is not registered: unknown.model'
    );
    const select = vi.mocked(providers.select);
    expect(select).not.toHaveBeenCalled();
  });

  it('rejects unsupported data-owned capabilities before provider calls', async () => {
    const providers = providerRegistry();
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });

    await expect(runtime.select({ model: 'data.annotation' })).rejects.toThrow(
      'Data model data.annotation does not support select'
    );
    const select = vi.mocked(providers.select);
    expect(select).not.toHaveBeenCalled();
  });

  it('routes provider-owned get, expand, and render calls', async () => {
    const chatRow = {
      lineage: [{ _model: 'telegram.chat', id: '10' }],
      refs: { chat: { _model: 'telegram.chat', id: '10' } },
      value: { id: '10' }
    };
    const providers = {
      ...providerRegistry(),
      get: vi.fn(() => Promise.resolve(chatRow))
    };
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });

    await expect(runtime.get({ ref: { _model: 'telegram.chat', id: '10' } })).resolves.toEqual(
      chatRow
    );
    await expect(
      runtime.expand({
        from: [chatRow],
        relation: 'messages',
        sourceRef: 'chat'
      })
    ).resolves.toEqual({ rows: [] });
    await expect(
      runtime.render({
        format: 'text',
        from: [
          {
            lineage: [],
            refs: { message: { _model: 'telegram.message', id: '10:1' } },
            value: { text: 'hello' }
          }
        ],
        sourceRef: 'message'
      })
    ).resolves.toEqual({ rows: [] });

    expect(vi.mocked(providers.get)).toHaveBeenCalledWith('telegram', {
      ref: { _model: 'telegram.chat', id: '10' }
    });
    expect(vi.mocked(providers.expand)).toHaveBeenCalledWith('telegram', {
      from: [chatRow],
      relation: 'messages',
      sourceRef: 'chat'
    });
    expect(vi.mocked(providers.render)).toHaveBeenCalledWith('telegram', {
      format: 'text',
      from: [
        {
          lineage: [],
          refs: { message: { _model: 'telegram.message', id: '10:1' } },
          value: { text: 'hello' }
        }
      ],
      sourceRef: 'message'
    });
  });

  it('validates source refs for expand and render routing', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });

    await expect(
      runtime.expand({
        from: [{ lineage: [], refs: {}, value: null }],
        relation: 'messages',
        sourceRef: 'chat'
      })
    ).rejects.toThrow('Dataset row is missing source ref: chat');
    await expect(
      runtime.render({
        format: 'text',
        from: [
          {
            lineage: [],
            refs: { message: { _model: 'telegram.message', id: '10:1' } },
            value: 'one'
          },
          {
            lineage: [],
            refs: { message: { _model: 'telegram.chat', id: '10' } },
            value: 'two'
          }
        ],
        sourceRef: 'message'
      })
    ).rejects.toThrow('Dataset rows carry mixed source models under ref: message');
  });

  it('writes schema-free annotations and supports replace and merge', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });
    const subject = { _model: 'telegram.chat', id: '10' };

    await runtime.writeAnnotation({
      key: 'summary',
      mode: 'replace',
      subject,
      value: { text: 'first' }
    });
    await runtime.writeAnnotation({
      key: 'summary',
      mode: 'merge',
      subject,
      value: { score: 1 }
    });

    await expect(runtime.getAnnotation({ key: 'summary', subject })).resolves.toMatchObject({
      key: 'summary',
      subject,
      value: {
        score: 1,
        text: 'first'
      }
    });
  });

  it('keeps escaped annotation ref ids reversible and collision-free', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });
    const firstSubject = { _model: 'telegram.chat', id: 'chat:1' };
    const secondSubject = { _model: 'telegram.chat', id: 'chat:1:summary' };

    const first = await runtime.writeAnnotation({
      key: 'summary:daily',
      mode: 'replace',
      subject: firstSubject,
      value: 'first'
    });
    const second = await runtime.writeAnnotation({
      key: 'daily',
      mode: 'replace',
      subject: secondSubject,
      value: 'second'
    });

    expect(first.ref.id).toBe('telegram.chat:chat%3A1:summary%3Adaily');
    expect(second.ref.id).toBe('telegram.chat:chat%3A1%3Asummary:daily');
    await expect(runtime.get({ ref: first.ref })).resolves.toMatchObject({
      refs: {
        annotation: first.ref,
        subject: firstSubject
      },
      value: 'first'
    });
    await expect(runtime.get({ ref: second.ref })).resolves.toMatchObject({
      refs: {
        annotation: second.ref,
        subject: secondSubject
      },
      value: 'second'
    });
    await expect(
      runtime.getAnnotation({ key: 'summary:daily', subject: firstSubject })
    ).resolves.toMatchObject({ value: 'first' });
    await expect(
      runtime.getAnnotation({ key: 'daily', subject: secondSubject })
    ).resolves.toMatchObject({ value: 'second' });
    await expect(runtime.listAnnotations({ subject: firstSubject })).resolves.toMatchObject([
      {
        key: 'summary:daily',
        value: 'first'
      }
    ]);
  });

  it('writes and reads collection items by address and returned ref', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });
    const subject = { _model: 'telegram.chat', id: 'chat:1' };

    const written = await runtime.writeCollectionItem({
      itemId: 'message:42',
      key: 'subjects:daily',
      mode: 'replace',
      subject,
      value: { title: 'Data' }
    });
    await runtime.writeCollectionItem({
      itemId: 'message:42',
      key: 'subjects:daily',
      mode: 'merge',
      subject,
      value: { score: 1 }
    });

    expect(written.ref.id).toBe('telegram.chat:chat%3A1:subjects%3Adaily:message%3A42');
    await expect(runtime.get({ ref: written.ref })).resolves.toMatchObject({
      refs: {
        collectionItem: written.ref,
        subject
      },
      value: {
        score: 1,
        title: 'Data'
      }
    });
    await expect(runtime.listCollection({ key: 'subjects:daily', subject })).resolves.toMatchObject(
      [
        {
          itemId: 'message:42',
          value: {
            score: 1,
            title: 'Data'
          }
        }
      ]
    );
  });

  it('rejects merge writes when incoming or existing values are not objects', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });
    const subject = { _model: 'telegram.chat', id: '10' };

    await expect(
      runtime.writeAnnotation({
        key: 'missing',
        mode: 'merge',
        subject,
        value: { score: 1 }
      })
    ).rejects.toThrow('Data merge mode requires existing and incoming JSON object values');
    await runtime.writeAnnotation({
      key: 'summary',
      mode: 'replace',
      subject,
      value: 'text'
    });
    await expect(
      runtime.writeAnnotation({
        key: 'summary',
        mode: 'merge',
        subject,
        value: { score: 1 }
      })
    ).rejects.toThrow('Data merge mode requires existing and incoming JSON object values');
    await runtime.writeAnnotation({
      key: 'summary',
      mode: 'replace',
      subject,
      value: { text: 'ok' }
    });
    await expect(
      runtime.writeAnnotation({
        key: 'summary',
        mode: 'merge',
        subject,
        value: null
      })
    ).rejects.toThrow('Data merge mode requires existing and incoming JSON object values');
  });

  it('preflights write action selectors before writing', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });

    const result = await runtime.actionWriteAnnotation({
      input: {
        rows: [
          {
            lineage: [],
            refs: { chat: { _model: 'telegram.chat', id: '10' } },
            value: { summary: 'ok' }
          },
          {
            lineage: [],
            refs: {},
            value: { summary: 'missing ref' }
          }
        ]
      },
      node: { id: 'save', runId: 'run-1' },
      with: {
        key: 'summary',
        mode: 'replace',
        subject: { ref: 'chat' },
        valueFrom: { field: 'summary' }
      }
    });

    expect(result).toMatchObject({
      error: {
        code: 'data_action_failed'
      },
      status: 'rejected'
    });
    await expect(
      runtime.getAnnotation({
        key: 'summary',
        subject: { _model: 'telegram.chat', id: '10' }
      })
    ).resolves.toBeNull();
  });

  it('returns empty datasets for missing get and empty write actions', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });

    await expect(
      runtime.actionGet({
        input: { rows: [] },
        node: { id: 'read', runId: 'run-1' },
        with: { ref: { _model: 'telegram.chat', id: 'missing' } }
      })
    ).resolves.toEqual({
      dataset: { rows: [] },
      status: 'ready'
    });
    await expect(
      runtime.actionWriteCollectionItem({
        input: { rows: [] },
        node: { id: 'save', runId: 'run-1' },
        with: {
          key: 'subjects',
          mode: 'append',
          subject: { ref: 'chat' }
        }
      })
    ).resolves.toEqual({
      dataset: { rows: [] },
      status: 'ready'
    });
  });

  it('returns rejected action results for provider failures', async () => {
    const runtime = createRuntime({
      providers: {
        ...providerRegistry(),
        select: vi.fn(() => Promise.reject(new Error('provider failed')))
      },
      store: createMemoryStore()
    });

    await expect(
      runtime.actionSelect({
        input: { rows: [] },
        node: { id: 'chats', runId: 'run-1' },
        with: { model: 'telegram.chat' }
      })
    ).resolves.toEqual({
      error: {
        code: 'data_action_failed',
        message: 'provider failed'
      },
      status: 'rejected'
    });
  });

  it('rejects invalid collection write action shapes without writing', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });
    const input = {
      rows: [
        {
          lineage: [],
          refs: { chat: { _model: 'telegram.chat', id: '10' } },
          value: { title: 'topic' }
        }
      ]
    };

    await expect(
      runtime.actionWriteCollectionItem({
        input,
        node: { id: 'save', runId: 'run-1' },
        with: {
          itemId: 'manual',
          key: 'subjects',
          mode: 'append',
          subject: { ref: 'chat' }
        }
      })
    ).resolves.toMatchObject({
      error: { code: 'data_action_failed' },
      status: 'rejected'
    });
    await expect(
      runtime.actionWriteCollectionItem({
        input,
        node: { id: 'save', runId: 'run-1' },
        with: {
          key: 'subjects',
          mode: 'replace',
          subject: { ref: 'chat' }
        }
      })
    ).resolves.toMatchObject({
      error: { code: 'data_action_failed' },
      status: 'rejected'
    });
    await expect(
      runtime.listCollection({
        key: 'subjects',
        subject: { _model: 'telegram.chat', id: '10' }
      })
    ).resolves.toEqual([]);
  });
});

function providerRegistry(): ProviderRegistry {
  return {
    expand: vi.fn(() => Promise.resolve({ rows: [] })),
    get: vi.fn(() => Promise.resolve(null)),
    render: vi.fn(() => Promise.resolve({ rows: [] })),
    select: vi.fn(() =>
      Promise.resolve({
        rows: [
          {
            lineage: [{ _model: 'telegram.chat', id: '10' }],
            refs: { chat: { _model: 'telegram.chat', id: '10' } },
            value: { id: '10' }
          }
        ]
      })
    )
  };
}
