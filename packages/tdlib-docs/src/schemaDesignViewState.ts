import type { SchemaDesignFieldLayout, SchemaDesignLeftPane } from './schemaDesignView.js';

export const schemaDesignViewStateStorageKey = 'tdlib-docs:schema-design:v1';

export type SchemaDesignViewState = {
  expandedReviewKeys: string[];
  expandedTableNames: string[];
  expandedTypeNames: string[];
  expandedUpdateNames: string[];
  filterText: string;
  leftPane: SchemaDesignLeftPane;
  tableScrollTop: number;
  typeScrollTop: number;
  updateFieldLayout: SchemaDesignFieldLayout;
  updateScrollTop: number;
  version: 1;
};

export type SchemaDesignViewStateStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function createDefaultSchemaDesignViewState(): SchemaDesignViewState {
  return {
    expandedReviewKeys: [],
    expandedTableNames: [],
    expandedTypeNames: [],
    expandedUpdateNames: [],
    filterText: '',
    leftPane: 'types',
    tableScrollTop: 0,
    typeScrollTop: 0,
    updateFieldLayout: 'grid',
    updateScrollTop: 0,
    version: 1
  };
}

export function readSchemaDesignViewState(
  storage: SchemaDesignViewStateStorage | null = browserStorage()
): SchemaDesignViewState {
  if (storage === null) {
    return createDefaultSchemaDesignViewState();
  }

  try {
    const rawValue = storage.getItem(schemaDesignViewStateStorageKey);
    if (rawValue === null) {
      return createDefaultSchemaDesignViewState();
    }

    return normalizeSchemaDesignViewState(JSON.parse(rawValue));
  } catch {
    return createDefaultSchemaDesignViewState();
  }
}

export function persistSchemaDesignViewState(
  state: SchemaDesignViewState,
  storage: SchemaDesignViewStateStorage | null = browserStorage()
): void {
  if (storage === null) {
    return;
  }

  try {
    storage.setItem(schemaDesignViewStateStorageKey, JSON.stringify(state));
  } catch {
    // Browser storage can be unavailable in private or restricted file contexts.
  }
}

function normalizeSchemaDesignViewState(value: unknown): SchemaDesignViewState {
  if (!isRecord(value) || value.version !== 1) {
    return createDefaultSchemaDesignViewState();
  }

  return {
    expandedReviewKeys: normalizeStringList(value.expandedReviewKeys),
    expandedTableNames: normalizeStringList(value.expandedTableNames),
    expandedTypeNames: normalizeStringList(value.expandedTypeNames),
    expandedUpdateNames: normalizeStringList(value.expandedUpdateNames),
    filterText: typeof value.filterText === 'string' ? value.filterText : '',
    leftPane: normalizeLeftPane(value.leftPane),
    tableScrollTop: normalizeScrollTop(value.tableScrollTop),
    typeScrollTop: normalizeScrollTop(value.typeScrollTop),
    updateFieldLayout: normalizeFieldLayout(value.updateFieldLayout),
    updateScrollTop: normalizeScrollTop(value.updateScrollTop),
    version: 1
  };
}

function normalizeLeftPane(value: unknown): SchemaDesignLeftPane {
  return value === 'updates' ? 'updates' : 'types';
}

function normalizeFieldLayout(value: unknown): SchemaDesignFieldLayout {
  return value === 'stacked' ? 'stacked' : 'grid';
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === 'string'))];
}

function normalizeScrollTop(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

function browserStorage(): SchemaDesignViewStateStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
