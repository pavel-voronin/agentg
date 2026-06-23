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
        offset: 2,
        sort: { direction: 'desc', key: 'primaryRef' },
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
      offset: 2,
      sort: { direction: 'desc', key: 'primaryRef' },
      where: { readState: 'unread' }
    });
  });

  it('routes provider-owned page selects with one extra row for hasMore', async () => {
    const providers = {
      ...providerRegistry(),
      select: vi.fn(() =>
        Promise.resolve({
          rows: [
            {
              lineage: [{ _model: 'telegram.chat', id: '10' }],
              refs: { chat: { _model: 'telegram.chat', id: '10' } },
              value: { id: '10' }
            },
            {
              lineage: [{ _model: 'telegram.chat', id: '20' }],
              refs: { chat: { _model: 'telegram.chat', id: '20' } },
              value: { id: '20' }
            }
          ]
        })
      )
    };
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });

    await expect(
      runtime.selectPage({
        limit: 1,
        model: 'telegram.chat',
        offset: 25,
        sort: { direction: 'asc', key: 'title' }
      })
    ).resolves.toMatchObject({
      hasMore: true,
      rows: [
        {
          refs: { chat: { _model: 'telegram.chat', id: '10' } }
        }
      ]
    });
    expect(vi.mocked(providers.select)).toHaveBeenCalledWith('telegram', {
      limit: 2,
      model: 'telegram.chat',
      offset: 25,
      sort: { direction: 'asc', key: 'title' }
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

  it('returns model catalog and derived storage overview without provider calls', async () => {
    const providers = providerRegistry();
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });
    const firstSubject = { _model: 'telegram.chat', id: '10' };
    const secondSubject = { _model: 'telegram.user', id: '20' };

    await runtime.writeAnnotation(
      {
        key: 'summary',
        mode: 'replace',
        subject: firstSubject,
        value: { text: 'first' }
      },
      new Date('2026-01-01T00:00:00.000Z')
    );
    await runtime.writeAnnotation(
      {
        key: 'tag',
        mode: 'replace',
        subject: secondSubject,
        value: 'candidate'
      },
      new Date('2026-01-01T00:00:01.000Z')
    );
    await runtime.writeCollectionItem(
      {
        itemId: 'item-1',
        key: 'subjects',
        mode: 'replace',
        subject: firstSubject,
        value: { title: 'Data' }
      },
      new Date('2026-01-01T00:00:02.000Z')
    );

    const overview = await runtime.overview();
    expect(overview).toMatchObject({
      catalog: [
        { model: 'telegram.chat', provider: 'telegram' },
        { model: 'telegram.message', provider: 'telegram' },
        { model: 'telegram.user', provider: 'telegram' },
        { model: 'data.annotation', provider: 'data' },
        { model: 'data.collectionItem', provider: 'data' }
      ],
      derivedStorage: {
        annotations: {
          byKey: [
            {
              count: 1,
              key: 'summary',
              latestUpdatedAt: '2026-01-01T00:00:00.000Z',
              subjectCount: 1
            },
            {
              count: 1,
              key: 'tag',
              latestUpdatedAt: '2026-01-01T00:00:01.000Z',
              subjectCount: 1
            }
          ],
          bySubjectModel: [
            { count: 1, subjectCount: 1, subjectModel: 'telegram.chat' },
            { count: 1, subjectCount: 1, subjectModel: 'telegram.user' }
          ],
          recent: [
            {
              key: 'tag',
              ref: { _model: 'data.annotation', id: 'telegram.user:20:tag' },
              subject: secondSubject,
              updatedAt: '2026-01-01T00:00:01.000Z'
            },
            {
              key: 'summary',
              ref: { _model: 'data.annotation', id: 'telegram.chat:10:summary' },
              subject: firstSubject,
              updatedAt: '2026-01-01T00:00:00.000Z'
            }
          ],
          totalItems: 2
        },
        collectionItems: {
          byKey: [
            {
              count: 1,
              key: 'subjects',
              latestUpdatedAt: '2026-01-01T00:00:02.000Z',
              subjectCount: 1
            }
          ],
          bySubjectModel: [{ count: 1, subjectCount: 1, subjectModel: 'telegram.chat' }],
          recent: [
            {
              itemId: 'item-1',
              key: 'subjects',
              ref: { _model: 'data.collectionItem', id: 'telegram.chat:10:subjects:item-1' },
              subject: firstSubject,
              updatedAt: '2026-01-01T00:00:02.000Z'
            }
          ],
          totalItems: 1
        }
      }
    });
    expect(
      overview.catalog.find((entry) => entry.model === 'telegram.chat')?.columns[0]?.filter
    ).toMatchObject({
      input: 'id',
      kind: 'where',
      operators: [
        { key: 'eq', value: 'array', whereKey: 'chatIds' },
        { key: 'gte', whereKey: 'chatIdsGte' },
        { key: 'gt', whereKey: 'chatIdsGt' },
        { key: 'lte', whereKey: 'chatIdsLte' },
        { key: 'lt', whereKey: 'chatIdsLt' }
      ],
      placeholder: '-1001449711572',
      refOperator: 'eq'
    });
    expect(
      overview.catalog
        .find((entry) => entry.model === 'telegram.message')
        ?.columns.map((column) => ({
          filter: {
            input: column.filter?.input,
            operators: column.filter?.operators.map((operator) => operator.key)
          },
          key: column.key,
          label: column.label
        }))
    ).toEqual([
      {
        filter: {
          input: 'id',
          operators: ['eq', 'gte', 'gt', 'lte', 'lt']
        },
        key: 'chatId',
        label: 'Chat'
      },
      {
        filter: { input: 'id', operators: ['eq', 'gte', 'gt', 'lte', 'lt'] },
        key: 'telegramMessageId',
        label: 'Message'
      },
      {
        filter: { input: 'dateTime', operators: ['gte', 'gt', 'lte', 'lt'] },
        key: 'messageDate',
        label: 'Date'
      },
      { filter: { input: 'enum', operators: ['eq'] }, key: 'contentType', label: 'Type' },
      {
        filter: { input: 'text', operators: ['contains', 'notContains'] },
        key: 'senderDisplayName',
        label: 'Sender'
      },
      {
        filter: { input: 'text', operators: ['contains', 'notContains'] },
        key: 'text',
        label: 'Text'
      }
    ]);
    expect(vi.mocked(providers.select)).not.toHaveBeenCalled();
    expect(vi.mocked(providers.get)).not.toHaveBeenCalled();
    expect(vi.mocked(providers.expand)).not.toHaveBeenCalled();
    expect(vi.mocked(providers.render)).not.toHaveBeenCalled();
  });

  it('browses derived storage rows by key without provider calls', async () => {
    const providers = providerRegistry();
    const runtime = createRuntime({
      providers,
      store: createMemoryStore()
    });
    const firstSubject = { _model: 'telegram.chat', id: '10' };
    const secondSubject = { _model: 'telegram.user', id: '20' };

    await runtime.writeAnnotation(
      {
        key: 'summary',
        mode: 'replace',
        subject: firstSubject,
        value: { text: 'first' }
      },
      new Date('2026-01-01T00:00:00.000Z')
    );
    await runtime.writeAnnotation(
      {
        key: 'summary',
        mode: 'replace',
        subject: secondSubject,
        value: { text: 'second' }
      },
      new Date('2026-01-01T00:00:01.000Z')
    );
    await runtime.writeAnnotation(
      {
        key: 'tag',
        mode: 'replace',
        subject: firstSubject,
        value: 'hidden'
      },
      new Date('2026-01-01T00:00:02.000Z')
    );
    await runtime.writeCollectionItem(
      {
        itemId: 'item-1',
        key: 'subjects',
        mode: 'replace',
        subject: firstSubject,
        value: { title: 'first' }
      },
      new Date('2026-01-01T00:00:00.000Z')
    );
    await runtime.writeCollectionItem(
      {
        itemId: 'item-2',
        key: 'subjects',
        mode: 'replace',
        subject: secondSubject,
        value: { title: 'second' }
      },
      new Date('2026-01-01T00:00:01.000Z')
    );

    await expect(
      runtime.browseAnnotations({ key: 'summary', limit: 1, offset: 0 })
    ).resolves.toMatchObject({
      hasMore: true,
      rows: [
        {
          subject: secondSubject,
          value: { text: 'second' }
        }
      ],
      total: 2
    });
    await expect(
      runtime.browseAnnotations({
        key: 'summary',
        limit: 1,
        offset: 0,
        sort: { direction: 'asc', key: 'subject' }
      })
    ).resolves.toMatchObject({
      rows: [
        {
          subject: firstSubject,
          value: { text: 'first' }
        }
      ],
      total: 2
    });
    await expect(
      runtime.browseAnnotations({ key: 'summary', subject: firstSubject })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          subject: firstSubject,
          value: { text: 'first' }
        }
      ],
      total: 1
    });
    await expect(
      runtime.browseAnnotations({ key: 'summary', subjectModel: 'telegram.chat' })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          subject: firstSubject,
          value: { text: 'first' }
        }
      ],
      total: 1
    });
    await expect(
      runtime.browseAnnotations({
        key: 'summary',
        where: {
          subjectQuery: 'telegram.chat:10',
          valueNotQuery: 'second',
          updatedAtGte: '2026-01-01T00:00:00.000Z',
          updatedAtLt: '2026-01-01T00:00:01.000Z',
          valueQuery: 'fir*'
        }
      })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          subject: firstSubject,
          value: { text: 'first' }
        }
      ],
      total: 1
    });
    await expect(
      runtime.browseCollection({ key: 'subjects', limit: 1, offset: 1 })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          itemId: 'item-1',
          subject: firstSubject,
          value: { title: 'first' }
        }
      ],
      total: 2
    });
    await expect(
      runtime.browseCollection({
        key: 'subjects',
        limit: 1,
        offset: 0,
        sort: { direction: 'desc', key: 'itemId' }
      })
    ).resolves.toMatchObject({
      rows: [
        {
          itemId: 'item-2',
          subject: secondSubject
        }
      ],
      total: 2
    });
    await expect(
      runtime.browseCollection({ key: 'subjects', subject: secondSubject })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          itemId: 'item-2',
          subject: secondSubject,
          value: { title: 'second' }
        }
      ],
      total: 1
    });
    await expect(
      runtime.browseCollection({ key: 'subjects', subjectModel: 'telegram.chat' })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          itemId: 'item-1',
          subject: firstSubject,
          value: { title: 'first' }
        }
      ],
      total: 1
    });
    await expect(
      runtime.browseCollection({
        key: 'subjects',
        where: {
          itemIdQuery: 'item-2',
          subjectNotQuery: 'telegram.chat:10',
          updatedAtGte: '2026-01-01T00:00:01.000Z',
          valueQuery: 'sec*'
        }
      })
    ).resolves.toMatchObject({
      hasMore: false,
      rows: [
        {
          itemId: 'item-2',
          subject: secondSubject,
          value: { title: 'second' }
        }
      ],
      total: 1
    });
    expect(vi.mocked(providers.select)).not.toHaveBeenCalled();
    expect(vi.mocked(providers.get)).not.toHaveBeenCalled();
    expect(vi.mocked(providers.expand)).not.toHaveBeenCalled();
    expect(vi.mocked(providers.render)).not.toHaveBeenCalled();
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

  it('writes one collection item per input row and replaces by address', async () => {
    const runtime = createRuntime({
      providers: providerRegistry(),
      store: createMemoryStore()
    });
    const input = {
      rows: [
        {
          lineage: [{ _model: 'telegram.chat', id: '10' }],
          refs: { chat: { _model: 'telegram.chat', id: '10' } },
          value: { summary: 'first' }
        },
        {
          lineage: [{ _model: 'telegram.chat', id: '20' }],
          refs: { chat: { _model: 'telegram.chat', id: '20' } },
          value: { summary: 'second' }
        }
      ]
    };

    await expect(
      runtime.actionWriteCollectionItem({
        input,
        node: { id: 'save', runId: 'run-1' },
        with: {
          itemId: '2026-06-21',
          key: 'dailyUnreadSummaries',
          mode: 'replace',
          subject: { ref: 'chat' },
          valueFrom: { field: 'summary' }
        }
      })
    ).resolves.toMatchObject({
      dataset: {
        rows: [
          {
            refs: {
              chat: { _model: 'telegram.chat', id: '10' },
              collectionItem: {
                _model: 'data.collectionItem',
                id: 'telegram.chat:10:dailyUnreadSummaries:2026-06-21'
              }
            }
          },
          {
            refs: {
              chat: { _model: 'telegram.chat', id: '20' },
              collectionItem: {
                _model: 'data.collectionItem',
                id: 'telegram.chat:20:dailyUnreadSummaries:2026-06-21'
              }
            }
          }
        ]
      },
      status: 'ready'
    });

    await runtime.actionWriteCollectionItem({
      input: {
        rows: [
          {
            lineage: [{ _model: 'telegram.chat', id: '10' }],
            refs: { chat: { _model: 'telegram.chat', id: '10' } },
            value: { summary: 'first updated' }
          }
        ]
      },
      node: { id: 'save', runId: 'run-2' },
      with: {
        itemId: '2026-06-21',
        key: 'dailyUnreadSummaries',
        mode: 'replace',
        subject: { ref: 'chat' },
        valueFrom: { field: 'summary' }
      }
    });

    await expect(
      runtime.listCollection({
        key: 'dailyUnreadSummaries',
        subject: { _model: 'telegram.chat', id: '10' }
      })
    ).resolves.toMatchObject([
      {
        itemId: '2026-06-21',
        value: 'first updated'
      }
    ]);
    await expect(
      runtime.listCollection({
        key: 'dailyUnreadSummaries',
        subject: { _model: 'telegram.chat', id: '20' }
      })
    ).resolves.toMatchObject([
      {
        itemId: '2026-06-21',
        value: 'second'
      }
    ]);
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
