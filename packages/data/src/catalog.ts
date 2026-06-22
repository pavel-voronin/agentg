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

const entries: readonly ModelCatalogEntry[] = Object.freeze([
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    columns: [],
    model: 'telegram.chat',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    columns: [],
    model: 'telegram.message',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    columns: [],
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
