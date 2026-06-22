import type { ProviderCapability } from './schema.js';

export type ModelCatalogColumnSource =
  | Readonly<{ kind: 'primaryRef' }>
  | Readonly<{ kind: 'valuePath'; path: readonly string[] }>;

export type ModelCatalogColumnFilterInput = 'dateTime' | 'enum' | 'id' | 'number' | 'text';

export type ModelCatalogColumnFilterOperator = Readonly<{
  key: 'contains' | 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'notContains';
  label: string;
  value: 'array' | 'single';
  whereKey: string;
}>;

export type ModelCatalogColumnFilter = Readonly<{
  input: ModelCatalogColumnFilterInput;
  kind: 'where';
  operators: readonly ModelCatalogColumnFilterOperator[];
  placeholder?: string | undefined;
  refOperator?: 'eq' | undefined;
  values?: readonly Readonly<{ label: string; value: string }>[] | undefined;
}>;

export type ModelCatalogColumn = Readonly<{
  filter?: ModelCatalogColumnFilter | undefined;
  format?: 'dateTime' | undefined;
  key: string;
  label: string;
  sortable?: boolean | undefined;
  source: ModelCatalogColumnSource;
}>;

export type ModelCatalogEntry = Readonly<{
  capabilities: readonly ProviderCapability[];
  columns: readonly ModelCatalogColumn[];
  model: string;
  provider: string;
}>;

function valuePath(...path: string[]): ModelCatalogColumnSource {
  return { kind: 'valuePath', path };
}

function filter(
  input: ModelCatalogColumnFilterInput,
  operators: readonly ModelCatalogColumnFilterOperator[],
  options: Omit<ModelCatalogColumnFilter, 'input' | 'kind' | 'operators'> = {}
): ModelCatalogColumnFilter {
  return {
    ...options,
    input,
    kind: 'where',
    operators
  };
}

function op(
  key: ModelCatalogColumnFilterOperator['key'],
  whereKey: string,
  value: ModelCatalogColumnFilterOperator['value'] = 'single'
): ModelCatalogColumnFilterOperator {
  const labels = {
    contains: 'contains',
    eq: '=',
    gt: '>',
    gte: '>=',
    lt: '<',
    lte: '<=',
    notContains: 'not contains'
  } as const;
  return { key, label: labels[key], value, whereKey };
}

function idFilter(
  whereKey: string,
  placeholder: string,
  refOperator?: 'eq',
  eqValue: ModelCatalogColumnFilterOperator['value'] = 'single'
): ModelCatalogColumnFilter {
  return filter(
    'id',
    [
      op('eq', whereKey, eqValue),
      op('gte', `${whereKey}Gte`),
      op('gt', `${whereKey}Gt`),
      op('lte', `${whereKey}Lte`),
      op('lt', `${whereKey}Lt`)
    ],
    { placeholder, refOperator }
  );
}

function numberFilter(whereKey: string, placeholder: string): ModelCatalogColumnFilter {
  return filter(
    'number',
    [
      op('eq', whereKey),
      op('gte', `${whereKey}Gte`),
      op('gt', `${whereKey}Gt`),
      op('lte', `${whereKey}Lte`),
      op('lt', `${whereKey}Lt`)
    ],
    { placeholder }
  );
}

function textFilter(whereKey: string, placeholder: string): ModelCatalogColumnFilter {
  return filter('text', [op('contains', whereKey), op('notContains', `${whereKey}Not`)], {
    placeholder
  });
}

function enumFilter(
  whereKey: string,
  values: readonly Readonly<{ label: string; value: string }>[]
): ModelCatalogColumnFilter {
  return filter('enum', [op('eq', whereKey)], { values });
}

const chatTypeValues = [
  { label: 'Private', value: 'private' },
  { label: 'Group', value: 'group' },
  { label: 'Channel', value: 'channel' },
  { label: 'Secret', value: 'secret' }
] as const;

const messageContentTypeValues = [
  { label: 'Unknown', value: 'unknown' },
  { label: 'Text', value: 'messageText' },
  { label: 'Photo', value: 'messagePhoto' },
  { label: 'Video', value: 'messageVideo' },
  { label: 'Document', value: 'messageDocument' },
  { label: 'Animation', value: 'messageAnimation' },
  { label: 'Audio', value: 'messageAudio' },
  { label: 'Voice note', value: 'messageVoiceNote' },
  { label: 'Video note', value: 'messageVideoNote' },
  { label: 'Sticker', value: 'messageSticker' }
] as const;

const dateTime = 'dateTime' as const;

const entries: readonly ModelCatalogEntry[] = Object.freeze([
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    columns: [
      {
        filter: idFilter('chatIds', '-1001449711572', 'eq', 'array'),
        key: 'id',
        label: 'ID',
        source: valuePath('id')
      },
      {
        filter: textFilter('titleQuery', 'coffee *chat'),
        key: 'title',
        label: 'Title',
        source: valuePath('title')
      },
      {
        filter: enumFilter('type', chatTypeValues),
        key: 'type',
        label: 'Type',
        sortable: false,
        source: valuePath('type')
      },
      {
        filter: numberFilter('unreadCount', '10'),
        key: 'unreadCount',
        label: 'Unread',
        sortable: false,
        source: valuePath('unreadCount')
      }
    ],
    model: 'telegram.chat',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    columns: [
      {
        filter: idFilter('chatId', '-1001449711572'),
        key: 'chatId',
        label: 'Chat',
        sortable: false,
        source: valuePath('chat', 'id')
      },
      {
        filter: idFilter('messageId', '5467275264'),
        key: 'telegramMessageId',
        label: 'Message',
        source: valuePath('telegramMessageId')
      },
      {
        filter: filter(
          'dateTime',
          [
            op('gte', 'messageDateGte'),
            op('gt', 'messageDateGt'),
            op('lte', 'messageDateLte'),
            op('lt', 'messageDateLt')
          ],
          { placeholder: '2026-06-22T00:00:00.000Z' }
        ),
        format: dateTime,
        key: 'messageDate',
        label: 'Date',
        source: valuePath('messageDate')
      },
      {
        filter: enumFilter('contentType', messageContentTypeValues),
        key: 'contentType',
        label: 'Type',
        sortable: false,
        source: valuePath('contentType')
      },
      {
        filter: textFilter('senderQuery', 'Alice *team'),
        key: 'senderDisplayName',
        label: 'Sender',
        sortable: false,
        source: valuePath('senderDisplayName')
      },
      {
        filter: textFilter('textQuery', 'invoice *paid'),
        key: 'text',
        label: 'Text',
        source: valuePath('text')
      }
    ],
    model: 'telegram.message',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    columns: [
      {
        filter: idFilter('userIds', '123456789', 'eq', 'array'),
        key: 'id',
        label: 'ID',
        source: valuePath('id')
      },
      {
        filter: textFilter('displayNameQuery', 'Pavel *Voronin'),
        key: 'displayName',
        label: 'Name',
        source: valuePath('displayName')
      },
      {
        filter: textFilter('firstNameQuery', 'Pavel'),
        key: 'firstName',
        label: 'First',
        sortable: false,
        source: valuePath('firstName')
      },
      {
        filter: textFilter('lastNameQuery', 'Voronin'),
        key: 'lastName',
        label: 'Last',
        sortable: false,
        source: valuePath('lastName')
      }
    ],
    model: 'telegram.user',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['get'] as const,
    columns: [],
    model: 'data.annotation',
    provider: 'data'
  }),
  Object.freeze({
    capabilities: ['get'] as const,
    columns: [],
    model: 'data.collectionItem',
    provider: 'data'
  })
]);

export function listCatalog(): readonly ModelCatalogEntry[] {
  return entries;
}

export function requireModel(model: string): ModelCatalogEntry {
  const entry = entries.find((item) => item.model === model);
  if (entry === undefined) {
    throw new Error(`Data model is not registered: ${model}`);
  }
  return entry;
}

export function requireCapability(
  model: string,
  capability: ProviderCapability
): ModelCatalogEntry {
  const entry = requireModel(model);
  if (!entry.capabilities.includes(capability)) {
    throw new Error(`Data model ${model} does not support ${capability}`);
  }
  return entry;
}
