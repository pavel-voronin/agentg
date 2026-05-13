import rawSchema from './data/tdlib-schema.json' with { type: 'json' };
import type {
  SearchEntry,
  SearchEntryKind,
  TdlibCallableEntity,
  TdlibEntity,
  TdlibEntityKind,
  TdlibExplorerSchema,
  TdlibTypeEntity,
  TdlibTypeUsageLandscape,
  TdlibUsageGroup,
  TdlibUsageItem,
  TdlibUsageKind,
  TypeReferenceToken
} from './types.js';

const schema = rawSchema as TdlibExplorerSchema;
const entityOrder: TdlibEntityKind[] = ['type', 'function', 'update', 'constructor', 'scalar'];
const searchKindRank: Record<SearchEntryKind, number> = {
  function: 0,
  type: 1,
  update: 2,
  constructor: 3,
  field: 4,
  scalar: 5
};
const exactLabelMatchScore = 3_000_000;
const caseInsensitiveLabelMatchScore = 2_000_000;
const normalizedLabelMatchScore = 1_000_000;
const ignoredUsageTypes = new Set(['Update', 'Updates']);

export const kindLabels: Record<SearchEntryKind, string> = {
  constructor: 'constructor',
  field: 'field',
  function: 'procedure',
  scalar: 'scalar',
  type: 'type',
  update: 'update'
};

export const tdlibSource = schema.schema;
export const tdlibCounts = schema.counts;

export const entities = buildEntities();
export const entityById = new Map(entities.map((entity) => [entity.id, entity]));
export const entityIdByName = buildEntityNameIndex();
const scalarNames = new Set(schema.scalars.map((entity) => entity.name));
const constructorEntities = entities.filter(
  (entity): entity is TdlibCallableEntity =>
    entity.kind === 'constructor' || entity.kind === 'update'
);
const typeEntities = entities.filter((entity): entity is TdlibTypeEntity => entity.kind === 'type');
export const updateEntities = entities
  .filter((entity): entity is TdlibCallableEntity => entity.kind === 'update')
  .sort((left, right) => left.name.localeCompare(right.name));
const constructorByName = new Map(constructorEntities.map((entity) => [entity.name, entity]));
const constructorsByType = buildConstructorsByType();
export const referencesByName = buildReferencesByName();
export const typeUsageLandscapesByName = buildTypeUsageLandscapesByName();
export const searchEntries = buildSearchEntries();

export function searchTdlib(query: string): SearchEntry[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  return searchEntries
    .map((entry) => ({ ...entry, score: scoreEntry(trimmed, entry) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.rank - right.rank ||
        left.label.length - right.label.length ||
        left.label.localeCompare(right.label)
    )
    .slice(0, 80);
}

export function resolveEntityId(name: string): string | null {
  return entityIdByName.get(name) ?? null;
}

export function tokenizeTypeReference(typeName: string): TypeReferenceToken[] {
  return tokenizeType(typeName).map((token, index) => ({
    entityId: resolveStaticEntityId(token),
    key: `${token}:${String(index)}`,
    text: token
  }));
}

export function isCallableEntity(entity: TdlibEntity): entity is TdlibCallableEntity {
  return ['constructor', 'function', 'update'].includes(entity.kind);
}

export function shortText(value: string, maxLength = 160): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function buildEntities(): TdlibEntity[] {
  return [
    ...schema.types.map((entity) => ({ ...entity, id: entityId(entity.kind, entity.name) })),
    ...schema.constructors.map((entity) => ({ ...entity, id: entityId(entity.kind, entity.name) })),
    ...schema.updates.map((entity) => ({ ...entity, id: entityId(entity.kind, entity.name) })),
    ...schema.functions.map((entity) => ({ ...entity, id: entityId(entity.kind, entity.name) })),
    ...schema.scalars.map((entity) => ({ ...entity, id: entityId(entity.kind, entity.name) }))
  ];
}

function buildEntityNameIndex(): Map<string, string> {
  const index = new Map<string, string>();

  for (const kind of entityOrder) {
    for (const entity of entities.filter((item) => item.kind === kind)) {
      if (!index.has(entity.name)) {
        index.set(entity.name, entity.id);
      }
    }
  }

  return index;
}

function buildConstructorsByType(): Map<string, TdlibCallableEntity[]> {
  const index = new Map<string, TdlibCallableEntity[]>();
  for (const constructor of constructorEntities) {
    index.set(constructor.resultType, [...(index.get(constructor.resultType) ?? []), constructor]);
  }

  return new Map(
    [...index.entries()].map(([typeName, constructors]) => [
      typeName,
      constructors.sort((left, right) => left.name.localeCompare(right.name))
    ])
  );
}

function buildReferencesByName(): Map<string, string[]> {
  const index = new Map<string, Set<string>>();

  for (const entity of entities) {
    if (!isCallableEntity(entity)) {
      continue;
    }

    for (const field of entity.fields) {
      for (const token of tokenizeType(field.type)) {
        const ids = index.get(token) ?? new Set<string>();
        ids.add(entity.id);
        index.set(token, ids);
      }
    }

    for (const token of tokenizeType(entity.resultType)) {
      const ids = index.get(token) ?? new Set<string>();
      ids.add(entity.id);
      index.set(token, ids);
    }
  }

  return new Map([...index.entries()].map(([name, ids]) => [name, [...ids].sort()]));
}

function buildTypeUsageLandscapesByName(): Map<string, TdlibTypeUsageLandscape> {
  const updateUsages = buildCallableTypeUsageIndex(
    entities.filter((entity): entity is TdlibCallableEntity => entity.kind === 'update'),
    false
  );
  const functionUsages = buildCallableTypeUsageIndex(
    entities.filter((entity): entity is TdlibCallableEntity => entity.kind === 'function'),
    true
  );
  const typeUsages = buildTypeTypeUsageIndex();
  const landscapes = new Map<string, TdlibTypeUsageLandscape>();

  for (const type of typeEntities) {
    landscapes.set(type.name, {
      functions: usageGroup('function', functionUsages.get(type.name)),
      types: usageGroup('type', typeUsages.get(type.name)),
      updates: usageGroup('update', updateUsages.get(type.name))
    });
  }

  return landscapes;
}

function buildCallableTypeUsageIndex(
  callables: TdlibCallableEntity[],
  includeResultType: boolean
): Map<string, TdlibUsageItem[]> {
  const index = new Map<string, Map<string, TdlibUsageItem>>();

  for (const callable of callables) {
    const usage = reachableTypeUsageFromCallable(callable, includeResultType);
    for (const item of usage.values()) {
      recordEntityUsage(index, item.name, callable, item.direct, item.viaTypes);
    }
  }

  return compactUsageIndex(index);
}

function reachableTypeUsageFromCallable(
  callable: TdlibCallableEntity,
  includeResultType: boolean
): Map<string, Omit<TdlibUsageItem, 'entityId'>> {
  const usage = new Map<string, Omit<TdlibUsageItem, 'entityId'>>();
  const expanded = new Set<string>();
  const queue = callable.fields.map((field) => ({
    direct: true,
    typeName: field.type,
    viaType: undefined as string | undefined
  }));

  if (includeResultType) {
    queue.push({
      direct: true,
      typeName: callable.resultType,
      viaType: undefined
    });
  }

  while (queue.length > 0) {
    const item = queue.shift();
    if (item === undefined) {
      continue;
    }

    const typeName = unwrapVector(item.typeName);
    if (scalarNames.has(typeName) || isIgnoredUsageType(typeName)) {
      continue;
    }

    const constructor = constructorByName.get(typeName);
    if (constructor !== undefined) {
      if (isIgnoredUsageType(constructor.resultType)) {
        continue;
      }

      recordTypeUsage(usage, constructor.resultType, item.direct, item.viaType);
      if (expanded.has(typeName)) {
        continue;
      }
      expanded.add(typeName);
      for (const field of constructor.fields) {
        queue.push({
          direct: false,
          typeName: field.type,
          viaType: constructor.resultType
        });
      }
      continue;
    }

    const constructors = constructorsByType.get(typeName) ?? [];
    if (constructors.length === 0) {
      continue;
    }
    recordTypeUsage(usage, typeName, item.direct, item.viaType);
    if (expanded.has(typeName)) {
      continue;
    }
    expanded.add(typeName);
    for (const variant of constructors) {
      queue.push({
        direct: false,
        typeName: variant.name,
        viaType: item.viaType
      });
    }
  }

  return usage;
}

function buildTypeTypeUsageIndex(): Map<string, TdlibUsageItem[]> {
  const documentedTypes = new Set(
    typeEntities.map((entity) => entity.name).filter((typeName) => !isIgnoredUsageType(typeName))
  );
  const graph = new Map<string, string[]>();

  for (const type of typeEntities) {
    if (isIgnoredUsageType(type.name)) {
      continue;
    }

    const children = new Set<string>();
    for (const constructorName of type.constructorNames) {
      const constructor = constructorByName.get(constructorName);
      if (constructor === undefined) {
        continue;
      }

      for (const field of constructor.fields) {
        const childType = objectTypeFor(field.type);
        if (childType !== null && documentedTypes.has(childType)) {
          children.add(childType);
        }
      }
    }
    graph.set(type.name, [...children].sort());
  }

  const index = new Map<string, Map<string, TdlibUsageItem>>();
  for (const sourceType of typeEntities) {
    if (isIgnoredUsageType(sourceType.name)) {
      continue;
    }

    const reachableTypes = new Set([sourceType.name]);
    const queue = [sourceType.name];

    while (queue.length > 0) {
      const typeName = queue.shift();
      if (typeName === undefined) {
        continue;
      }

      for (const childType of graph.get(typeName) ?? []) {
        if (!reachableTypes.has(childType)) {
          reachableTypes.add(childType);
          queue.push(childType);
        }
      }
    }

    for (const parentType of reachableTypes) {
      for (const childType of graph.get(parentType) ?? []) {
        if (childType === sourceType.name) {
          continue;
        }
        recordEntityUsage(
          index,
          childType,
          sourceType,
          parentType === sourceType.name,
          parentType === sourceType.name ? [] : [parentType]
        );
      }
    }
  }

  return compactUsageIndex(index);
}

function compactUsageIndex(
  index: Map<string, Map<string, TdlibUsageItem>>
): Map<string, TdlibUsageItem[]> {
  return new Map(
    [...index.entries()].map(([typeName, usages]) => [
      typeName,
      [...usages.values()].sort((left, right) => left.name.localeCompare(right.name))
    ])
  );
}

function usageGroup(kind: TdlibUsageKind, usages: TdlibUsageItem[] = []): TdlibUsageGroup {
  const direct = usages.filter((usage) => usage.direct);
  const directEntityIds = new Set(direct.map((usage) => usage.entityId));
  return {
    direct,
    indirect: usages.filter((usage) => !usage.direct && !directEntityIds.has(usage.entityId)),
    kind
  };
}

function recordEntityUsage(
  index: Map<string, Map<string, TdlibUsageItem>>,
  targetType: string,
  source: TdlibEntity,
  direct: boolean,
  viaTypes: string[]
): void {
  if (isIgnoredUsageType(targetType)) {
    return;
  }
  if (viaTypes.some((typeName) => isIgnoredUsageType(typeName))) {
    return;
  }

  let targetUsages = index.get(targetType);
  if (targetUsages === undefined) {
    targetUsages = new Map();
    index.set(targetType, targetUsages);
  }

  const existing = targetUsages.get(source.id);
  if (existing === undefined) {
    targetUsages.set(source.id, {
      direct,
      entityId: source.id,
      name: source.name,
      viaTypes: [...viaTypes].sort()
    });
    return;
  }

  existing.direct = existing.direct || direct;
  existing.viaTypes = [...new Set([...existing.viaTypes, ...viaTypes])].sort();
}

function recordTypeUsage(
  usages: Map<string, Omit<TdlibUsageItem, 'entityId'>>,
  typeName: string,
  direct: boolean,
  viaType: string | undefined
): void {
  if (!entityIdByName.has(typeName)) {
    return;
  }
  if (isIgnoredUsageType(typeName)) {
    return;
  }
  if (viaType !== undefined && isIgnoredUsageType(viaType)) {
    return;
  }

  const existing = usages.get(typeName);
  if (existing === undefined) {
    usages.set(typeName, {
      direct,
      name: typeName,
      viaTypes: viaType === undefined ? [] : [viaType]
    });
    return;
  }

  existing.direct = existing.direct || direct;
  if (viaType !== undefined) {
    existing.viaTypes = [...new Set([...existing.viaTypes, viaType])].sort();
  }
}

function objectTypeFor(type: string): string | null {
  const unwrapped = unwrapVector(type);
  if (scalarNames.has(unwrapped) || isIgnoredUsageType(unwrapped)) {
    return null;
  }

  const constructor = constructorByName.get(unwrapped);
  if (constructor !== undefined) {
    return isIgnoredUsageType(constructor.resultType) ? null : constructor.resultType;
  }

  return constructorsByType.has(unwrapped) && !isIgnoredUsageType(unwrapped) ? unwrapped : null;
}

function buildSearchEntries(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  for (const entity of entities) {
    const summary = entitySummary(entity);
    entries.push({
      entityId: entity.id,
      id: entity.id,
      kind: entity.kind,
      label: entity.name,
      rank: searchKindRank[entity.kind],
      score: 0,
      summary
    });

    if (!isCallableEntity(entity)) {
      continue;
    }

    for (const field of entity.fields) {
      entries.push({
        entityId: entity.id,
        fieldName: field.name,
        id: `field:${entity.id}:${field.name}`,
        kind: 'field',
        label: field.name,
        ownerName: entity.name,
        rank: searchKindRank.field,
        score: 0,
        summary: `${entity.name}.${field.name}: ${field.type}`
      });
    }
  }

  return entries;
}

function entitySummary(entity: TdlibEntity): string {
  if (entity.kind === 'type') {
    return `${String(entity.constructorNames.length)} constructors`;
  }

  if (entity.kind === 'scalar') {
    return entity.description;
  }

  return `${String(entity.fields.length)} fields -> ${entity.resultType}`;
}

function tokenizeType(typeName: string): string[] {
  return typeName.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [];
}

function unwrapVector(typeName: string): string {
  let value = typeName.trim();
  const vectorTypePattern = /^vector<(.+)>$/;
  let match = vectorTypePattern.exec(value);
  while (match?.[1] !== undefined) {
    value = match[1].trim();
    match = vectorTypePattern.exec(value);
  }
  return value;
}

function resolveStaticEntityId(name: string): string | null {
  if (scalarNames.has(name)) {
    return null;
  }

  const entityId = resolveEntityId(name);
  const entity = entityId === null ? undefined : entityById.get(entityId);
  return entity?.kind === 'scalar' ? null : entityId;
}

function isIgnoredUsageType(typeName: string): boolean {
  return ignoredUsageTypes.has(typeName);
}

function scoreEntry(query: string, entry: SearchEntry): number {
  return scoreFullLabelMatch(query, entry.label) || scoreFuzzy(query, entry.label);
}

function scoreFullLabelMatch(query: string, value: string): number {
  if (query === value) {
    return exactLabelMatchScore;
  }

  if (query.toLowerCase() === value.toLowerCase()) {
    return caseInsensitiveLabelMatchScore;
  }

  return normalize(query) === normalize(value) ? normalizedLabelMatchScore : 0;
}

function scoreFuzzy(query: string, value: string): number {
  const needle = normalize(query);
  const haystack = normalize(value);
  if (needle.length === 0 || haystack.length === 0) {
    return 0;
  }

  let score = 0;
  let cursor = 0;
  let previousIndex = -1;

  for (const char of needle) {
    const index = findSearchChar(value, char, cursor);
    if (index === -1) {
      return 0;
    }

    score += 12;
    if (index === 0) {
      score += 10;
    }
    if (previousIndex + 1 === index) {
      score += 8;
    }
    if (isBoundary(value, index)) {
      score += 6;
    }

    score -= Math.max(0, index - cursor);
    previousIndex = index;
    cursor = index + 1;
  }

  if (haystack.startsWith(needle)) {
    score += 40;
  }
  if (haystack === needle) {
    score += 80;
  }

  return score - Math.max(0, haystack.length - needle.length) / 8;
}

function findSearchChar(value: string, needle: string, cursor: number): number {
  for (let index = cursor; index < value.length; index += 1) {
    const char = value[index];
    if (char !== undefined && /[a-z0-9]/i.test(char) && char.toLowerCase() === needle) {
      return index;
    }
  }

  return -1;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isBoundary(value: string, index: number): boolean {
  const current = value[index];
  const previous = value[index - 1];
  return (
    index === 0 ||
    previous === '_' ||
    previous === '.' ||
    previous === '-' ||
    (previous !== undefined &&
      current !== undefined &&
      previous.toLowerCase() === previous &&
      current.toUpperCase() === current)
  );
}

function entityId(kind: TdlibEntityKind, name: string): string {
  return `${kind}:${name}`;
}
