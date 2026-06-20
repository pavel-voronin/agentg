import type { ProviderCapability } from './schema.js';

export type ModelCatalogEntry = Readonly<{
  capabilities: readonly ProviderCapability[];
  model: string;
  provider: string;
}>;

const entries: readonly ModelCatalogEntry[] = Object.freeze([
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    model: 'telegram.chat',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    model: 'telegram.message',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['select', 'get', 'expand', 'render'] as const,
    model: 'telegram.user',
    provider: 'telegram'
  }),
  Object.freeze({
    capabilities: ['get'] as const,
    model: 'data.annotation',
    provider: 'data'
  }),
  Object.freeze({
    capabilities: ['get'] as const,
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
