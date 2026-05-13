export type TdlibField = {
  description: string;
  name: string;
  type: string;
};

export type TdlibEntityKind = 'constructor' | 'function' | 'scalar' | 'type' | 'update';

export type TdlibBaseEntity = {
  description: string;
  id: string;
  kind: TdlibEntityKind;
  name: string;
};

export type TdlibCallableEntity = TdlibBaseEntity & {
  fields: TdlibField[];
  kind: 'constructor' | 'function' | 'update';
  resultType: string;
};

export type TdlibTypeEntity = TdlibBaseEntity & {
  constructorNames: string[];
  kind: 'type';
};

export type TdlibScalarEntity = TdlibBaseEntity & {
  kind: 'scalar';
};

export type TdlibEntity = TdlibCallableEntity | TdlibScalarEntity | TdlibTypeEntity;

export type TdlibExplorerSchema = {
  constructors: Omit<TdlibCallableEntity, 'id'>[];
  counts: {
    constructors: number;
    fields: number;
    functions: number;
    scalars: number;
    types: number;
    updates: number;
  };
  functions: Omit<TdlibCallableEntity, 'id'>[];
  generatedAt: string;
  scalars: Omit<TdlibScalarEntity, 'id'>[];
  schema: {
    commit: string;
    sha256: string;
    url: string;
  };
  types: Omit<TdlibTypeEntity, 'id'>[];
  updates: Omit<TdlibCallableEntity, 'id'>[];
  version: number;
};

export type SearchEntryKind = TdlibEntityKind | 'field';

export type TdlibUsageKind = 'function' | 'type' | 'update';

export type TdlibUsageItem = {
  direct: boolean;
  entityId: string;
  name: string;
  viaTypes: string[];
};

export type TdlibUsageGroup = {
  direct: TdlibUsageItem[];
  indirect: TdlibUsageItem[];
  kind: TdlibUsageKind;
};

export type TdlibTypeUsageLandscape = {
  functions: TdlibUsageGroup;
  types: TdlibUsageGroup;
  updates: TdlibUsageGroup;
};

export type SearchEntry = {
  entityId: string;
  fieldName?: string;
  id: string;
  kind: SearchEntryKind;
  label: string;
  rank: number;
  ownerName?: string;
  score: number;
  summary: string;
};

export type TypeReferenceToken = {
  entityId: string | null;
  key: string;
  text: string;
};

export type CardInstance = {
  entityId: string;
  focusField?: string;
  instanceId: string;
};

export type ExplorerColumn = {
  card?: CardInstance;
  columnId: string;
};

export type HoverPreview = {
  entityId: string;
  left: number;
  top: number;
};
