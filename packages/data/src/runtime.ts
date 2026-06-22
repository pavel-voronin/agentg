import type { JsonValue } from '@agentg/framework';

import { listCatalog, requireCapability, requireModel } from './catalog.js';
import { parseAnnotationId, parseCollectionItemId } from './ids.js';
import type { ProviderRegistry } from './providers.js';
import {
  actionRequestSchema,
  annotationAddressSchema,
  browseAnnotationsInputSchema,
  browseCollectionInputSchema,
  collectionItemAddressSchema,
  datasetSchema,
  expandInputSchema,
  getInputSchema,
  listAnnotationsInputSchema,
  listCollectionInputSchema,
  renderInputSchema,
  selectInputSchema,
  writeAnnotationActionInputSchema,
  writeAnnotationInputSchema,
  writeCollectionItemActionInputSchema,
  writeCollectionItemInputSchema,
  type ActionResult,
  type Dataset,
  type DatasetRow,
  type ModelRef,
  type WriteAnnotationInput,
  type WriteCollectionItemInput
} from './schema.js';
import type { PageResult, Store, WriteResult } from './store.js';
import { recordWrite, timeOperation } from './telemetry.js';

const DEFAULT_PAGE_LIMIT = 25;
type BrowseWhere = Parameters<Store['browseAnnotations']>[0]['where'];

export function createRuntime(input: { providers: ProviderRegistry; store: Store }) {
  return {
    expand(rawInput: unknown) {
      const request = expandInputSchema.parse(rawInput);
      return timeOperation('expand', () =>
        routeByRows(request.sourceRef, request.from, 'expand', async (provider) =>
          input.providers.expand(provider, request)
        )
      );
    },
    async get(rawInput: unknown) {
      const request = getInputSchema.parse(rawInput);
      return timeOperation(
        'get',
        async () => {
          const entry = requireCapability(request.ref._model, 'get');
          if (entry.provider === 'data') {
            return getOwned(input.store, request.ref);
          }
          return input.providers.get(entry.provider, request);
        },
        (row) => (row === null ? 'missing' : 'ok')
      );
    },
    getAnnotation(rawInput: unknown) {
      return timeOperation(
        'get_annotation',
        () => input.store.getAnnotation(annotationAddressSchema.parse(rawInput)),
        (row) => (row === null ? 'missing' : 'ok')
      );
    },
    getCollectionItem(rawInput: unknown) {
      return timeOperation(
        'get_collection_item',
        () => input.store.getCollectionItem(collectionItemAddressSchema.parse(rawInput)),
        (row) => (row === null ? 'missing' : 'ok')
      );
    },
    browseAnnotations(rawInput: unknown) {
      const request = browseAnnotationsInputSchema.parse(rawInput);
      return timeOperation('browse_annotations', () =>
        input.store.browseAnnotations(pageInput(request))
      );
    },
    browseCollection(rawInput: unknown) {
      const request = browseCollectionInputSchema.parse(rawInput);
      return timeOperation('browse_collection', () =>
        input.store.browseCollection(pageInput(request))
      );
    },
    listAnnotations(rawInput: unknown) {
      return timeOperation('list_annotations', () =>
        input.store.listAnnotations(listAnnotationsInputSchema.parse(rawInput))
      );
    },
    listCollection(rawInput: unknown) {
      return timeOperation('list_collection', () =>
        input.store.listCollection(listCollectionInputSchema.parse(rawInput))
      );
    },
    listModels() {
      return listCatalog();
    },
    overview() {
      return timeOperation('overview', async () => ({
        catalog: listCatalog(),
        derivedStorage: await input.store.overview()
      }));
    },
    render(rawInput: unknown) {
      const request = renderInputSchema.parse(rawInput);
      return timeOperation('render', () =>
        routeByRows(request.sourceRef, request.from, 'render', async (provider) =>
          input.providers.render(provider, request)
        )
      );
    },
    async select(rawInput: unknown) {
      const request = selectInputSchema.parse(rawInput);
      return timeOperation('select', async () => {
        const entry = requireCapability(request.model, 'select');
        if (entry.provider === 'data') {
          throw new Error(`Data model ${request.model} does not support select`);
        }
        return input.providers.select(entry.provider, request);
      });
    },
    async selectPage(rawInput: unknown): Promise<PageResult<DatasetRow>> {
      const request = selectInputSchema.parse(rawInput);
      return timeOperation('select_page', async () => {
        const limit = request.limit ?? DEFAULT_PAGE_LIMIT;
        const dataset = await this.select({
          ...request,
          limit: limit + 1
        });
        return {
          hasMore: dataset.rows.length > limit,
          rows: dataset.rows.slice(0, limit)
        };
      });
    },
    writeAnnotation(rawInput: unknown, now = new Date()) {
      const request = writeAnnotationInputSchema.parse(rawInput);
      return timeOperation('write_annotation', async () => {
        const result = await input.store.writeAnnotation(request, now);
        recordWrite('annotation', request.mode, 1);
        return result;
      });
    },
    writeCollectionItem(rawInput: unknown, now = new Date()) {
      const request = writeCollectionItemInputSchema.parse(rawInput);
      return timeOperation('write_collection_item', async () => {
        const result = await input.store.writeCollectionItem(request, now);
        recordWrite('collection_item', request.mode, 1);
        return result;
      });
    },
    actionExpand(rawInput: unknown): Promise<ActionResult> {
      return timeOperation(
        'action_expand',
        () =>
          actionResult(async () => {
            const request = actionRequestSchema.parse(rawInput);
            if (request.input.rows.length === 0) {
              return emptyDataset();
            }
            const payload = expandInputSchema.omit({ from: true }).parse(request.with ?? {});
            return this.expand({
              ...payload,
              from: request.input.rows
            });
          }),
        (result) => result.status
      );
    },
    actionGet(rawInput: unknown): Promise<ActionResult> {
      return timeOperation(
        'action_get',
        () =>
          actionResult(async () => {
            const request = actionRequestSchema.parse(rawInput);
            const payload = getInputSchema.parse(request.with ?? {});
            const row = await this.get(payload);
            return row === null ? emptyDataset() : { rows: [row] };
          }),
        (result) => result.status
      );
    },
    actionRender(rawInput: unknown): Promise<ActionResult> {
      return timeOperation(
        'action_render',
        () =>
          actionResult(async () => {
            const request = actionRequestSchema.parse(rawInput);
            if (request.input.rows.length === 0) {
              return emptyDataset();
            }
            const payload = renderInputSchema.omit({ from: true }).parse(request.with ?? {});
            return this.render({
              ...payload,
              from: request.input.rows
            });
          }),
        (result) => result.status
      );
    },
    actionSelect(rawInput: unknown): Promise<ActionResult> {
      return timeOperation(
        'action_select',
        () =>
          actionResult(async () => {
            const request = actionRequestSchema.parse(rawInput);
            return this.select(selectInputSchema.parse(request.with ?? {}));
          }),
        (result) => result.status
      );
    },
    actionWriteAnnotation(rawInput: unknown, now = new Date()): Promise<ActionResult> {
      return timeOperation(
        'action_write_annotation',
        () =>
          actionResult(async () => {
            const request = actionRequestSchema.parse(rawInput);
            const payload = writeAnnotationActionInputSchema.parse(request.with ?? {});
            const writes = request.input.rows.map((row) => resolveAnnotationWrite(payload, row));
            const results: WriteResult[] = [];
            for (const write of writes) {
              results.push(await input.store.writeAnnotation(write, now));
            }
            if (writes.length > 0) {
              recordWrite('annotation', payload.mode, writes.length);
            }
            return writeDataset(request.input.rows, results, 'annotation');
          }),
        (result) => result.status
      );
    },
    actionWriteCollectionItem(rawInput: unknown, now = new Date()): Promise<ActionResult> {
      return timeOperation(
        'action_write_collection_item',
        () =>
          actionResult(async () => {
            const request = actionRequestSchema.parse(rawInput);
            const payload = writeCollectionItemActionInputSchema.parse(request.with ?? {});
            const writes = request.input.rows.map((row) => resolveCollectionWrite(payload, row));
            const results: WriteResult[] = [];
            for (const write of writes) {
              results.push(await input.store.writeCollectionItem(write, now));
            }
            if (writes.length > 0) {
              recordWrite('collection_item', payload.mode, writes.length);
            }
            return writeDataset(request.input.rows, results, 'collectionItem');
          }),
        (result) => result.status
      );
    }
  };
}

async function routeByRows(
  sourceRef: string,
  rows: readonly DatasetRow[],
  capability: 'expand' | 'render',
  operation: (provider: string) => Promise<Dataset>
): Promise<Dataset> {
  if (rows.length === 0) {
    return emptyDataset();
  }
  const model = sourceModel(sourceRef, rows);
  requireCapability(model, capability);
  const provider = requireModel(model).provider;
  if (provider === 'data') {
    throw new Error(`Data model ${model} does not support ${capability}`);
  }
  return operation(provider);
}

function pageInput(input: {
  key?: string | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
  sort?: { direction: 'asc' | 'desc'; key: string } | undefined;
  subject?: ModelRef | undefined;
  subjectModel?: string | undefined;
  where?: BrowseWhere;
}) {
  return {
    ...input,
    limit: input.limit ?? DEFAULT_PAGE_LIMIT,
    offset: input.offset ?? 0
  };
}

function sourceModel(sourceRef: string, rows: readonly DatasetRow[]): string {
  let model: string | undefined;
  for (const row of rows) {
    const ref = row.refs[sourceRef];
    if (ref === undefined) {
      throw new Error(`Dataset row is missing source ref: ${sourceRef}`);
    }
    if (model === undefined) {
      model = ref._model;
      continue;
    }
    if (model !== ref._model) {
      throw new Error(`Dataset rows carry mixed source models under ref: ${sourceRef}`);
    }
  }
  if (model === undefined) {
    throw new Error('Dataset source model is required');
  }
  return model;
}

async function getOwned(store: Store, ref: ModelRef): Promise<DatasetRow | null> {
  if (ref._model === 'data.annotation') {
    const parsed = parseAnnotationId(ref.id);
    const annotation = await store.getAnnotation({
      key: parsed.key,
      subject: {
        _model: parsed.subjectModel,
        id: parsed.subjectId
      }
    });
    return annotation === null
      ? null
      : {
          lineage: annotation.lineage,
          refs: {
            annotation: ref,
            subject: annotation.subject
          },
          value: annotation.value
        };
  }
  if (ref._model === 'data.collectionItem') {
    const parsed = parseCollectionItemId(ref.id);
    const item = await store.getCollectionItem({
      itemId: parsed.itemId,
      key: parsed.key,
      subject: {
        _model: parsed.subjectModel,
        id: parsed.subjectId
      }
    });
    return item === null
      ? null
      : {
          lineage: item.lineage,
          refs: {
            collectionItem: ref,
            subject: item.subject
          },
          value: item.value
        };
  }
  return null;
}

function resolveAnnotationWrite(
  input: {
    key: string;
    mode: 'merge' | 'replace';
    subject: { ref: string };
    value?: JsonValue | undefined;
    valueFrom?: { field: string } | undefined;
  },
  row: DatasetRow
): WriteAnnotationInput {
  return {
    key: input.key,
    lineage: row.lineage,
    mode: input.mode,
    subject: requireRowRef(row, input.subject.ref),
    value: resolveValue(input, row)
  };
}

function resolveCollectionWrite(
  input: {
    itemId?: string | undefined;
    itemIdFrom?: { field: string } | { refId: string } | undefined;
    key: string;
    mode: 'append' | 'merge' | 'replace';
    subject: { ref: string };
    value?: JsonValue | undefined;
    valueFrom?: { field: string } | undefined;
  },
  row: DatasetRow
): WriteCollectionItemInput {
  const base = {
    key: input.key,
    lineage: row.lineage,
    subject: requireRowRef(row, input.subject.ref),
    value: resolveValue(input, row)
  };
  if (input.mode === 'append') {
    return {
      ...base,
      mode: 'append'
    };
  }
  return {
    ...base,
    itemId: input.itemId ?? resolveItemId(input.itemIdFrom, row),
    mode: input.mode
  };
}

function resolveItemId(
  selector: { field: string } | { refId: string } | undefined,
  row: DatasetRow
): string {
  if (selector === undefined) {
    throw new Error('Collection write item id selector is required');
  }
  if ('refId' in selector) {
    return requireRowRef(row, selector.refId).id;
  }
  const value = requireRowField(row, selector.field);
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Dataset row field must be a non-empty string: ${selector.field}`);
  }
  return value;
}

function resolveValue(
  input: {
    value?: JsonValue | undefined;
    valueFrom?: { field: string } | undefined;
  },
  row: DatasetRow
): JsonValue {
  if (input.value !== undefined) {
    return input.value;
  }
  if (input.valueFrom !== undefined) {
    return requireRowField(row, input.valueFrom.field);
  }
  return row.value;
}

function requireRowRef(row: DatasetRow, key: string): ModelRef {
  const ref = row.refs[key];
  if (ref === undefined) {
    throw new Error(`Dataset row ref is missing: ${key}`);
  }
  return ref;
}

function requireRowField(row: DatasetRow, key: string): JsonValue {
  if (typeof row.value !== 'object' || row.value === null || Array.isArray(row.value)) {
    throw new Error(`Dataset row value is not an object for field selector: ${key}`);
  }
  if (!Object.hasOwn(row.value, key)) {
    throw new Error(`Dataset row field is missing: ${key}`);
  }
  return row.value[key] ?? null;
}

function writeDataset(
  inputRows: readonly DatasetRow[],
  results: readonly WriteResult[],
  refKey: 'annotation' | 'collectionItem'
): Dataset {
  return datasetSchema.parse({
    rows: results.map((result, index) => {
      const row = inputRows[index];
      if (row === undefined) {
        throw new Error('Write result has no source row');
      }
      return {
        lineage: row.lineage,
        refs: {
          ...row.refs,
          [refKey]: result.ref
        },
        value: result
      };
    })
  });
}

async function actionResult(operation: () => Promise<Dataset>): Promise<ActionResult> {
  try {
    return {
      dataset: await operation(),
      status: 'ready'
    };
  } catch (error) {
    return {
      error: {
        code: 'data_action_failed',
        message: error instanceof Error ? error.message : String(error)
      },
      status: 'rejected'
    };
  }
}

function emptyDataset(): Dataset {
  return {
    rows: []
  };
}
