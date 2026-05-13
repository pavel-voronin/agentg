import type {
  StorageReviewEntry,
  StorageSchemaConstructorDesign,
  StorageSchemaFieldDesign,
  StorageSchemaTable,
  StorageSchemaUpdateDesign,
  StorageSchemaUpdateEffectRoute,
  StorageSchemaUpdateEventRoute,
  StorageSchemaUpdateHandlerPlanStepOp
} from './storageReviewTypes.js';
import type { TdlibCallableEntity, TdlibField } from './types.js';

export type SchemaDesignCoverage = {
  covered: number;
  total: number;
};
export type SchemaDesignProgressStyle = {
  '--schema-design-progress': string;
};
export type SchemaDesignProgressKind =
  | 'embedded-constructors'
  | 'event-payloads'
  | 'extend-fields'
  | 'facet-fields'
  | 'fields'
  | 'kv-payloads'
  | 'pair-constructors'
  | 'table-fields';
export type SchemaDesignProgress = SchemaDesignCoverage & {
  kind: SchemaDesignProgressKind;
  ready: boolean;
  title: string;
};
export type SchemaDesignFieldLayout = 'grid' | 'stacked';
export type SchemaDesignLeftPane = 'types' | 'updates';
export type SchemaDesignSourceReference = {
  constructor: string;
  field?: string;
  raw: string;
  type: string;
};
export type SchemaDesignSourceFocusRequest = {
  constructor?: string;
  field?: string;
  type: string;
};
export type SchemaDesignSourceFocusTarget = SchemaDesignSourceFocusRequest & {
  id: number;
};
export type SchemaDesignSourceHoverTarget = SchemaDesignSourceFocusRequest;
export type SchemaDesignUpdateFocusRequest = {
  field?: string;
  update: string;
};
export type SchemaDesignUpdateFocusTarget = SchemaDesignUpdateFocusRequest & {
  id: number;
};
export type SchemaDesignTableColumnDestination = {
  column: string;
  sourceField: string;
  table: string;
};
export type SchemaDesignKvMapping = {
  key: string;
  keySourceFields: string[];
  keySources: SchemaDesignSourceReference[];
  table: string;
  valueColumn: string;
  valueSourceFields: string[];
  valueSources: SchemaDesignSourceReference[];
};
export type SchemaDesignTableFocusRequest = {
  column?: string;
  sourceField?: string;
  table: string;
};
export type SchemaDesignTableFocusTarget = SchemaDesignTableFocusRequest & {
  id: number;
};
export type SchemaDesignTableHoverTarget = SchemaDesignTableFocusRequest;
export type SchemaDesignUpdateDbWrite = {
  column: string;
  columnId: string;
  sourceField: string;
  table: string;
};
export type SchemaDesignUpdateTableWrite = {
  description: string;
  id: string;
  op: StorageSchemaUpdateHandlerPlanStepOp;
  stepNumber: number;
  table: string;
};
export type SchemaDesignUpdateFieldUse = {
  description: string;
  id: string;
  op: StorageSchemaUpdateHandlerPlanStepOp;
  stepNumber: number;
  table?: string;
  type?: string;
};
export type SchemaDesignUpdateFieldRouteStatus = 'gap' | 'used';
export type SchemaDesignUpdateFieldRoute = {
  dbWrites: SchemaDesignUpdateDbWrite[];
  delegatedTypes: string[];
  effects: StorageSchemaUpdateEffectRoute[];
  events: StorageSchemaUpdateEventRoute[];
  field: TdlibField;
  handlerPlanSteps: SchemaDesignUpdateFieldUse[];
  ignoredReason: string | null;
  sourceField: string;
  status: SchemaDesignUpdateFieldRouteStatus;
  tableWrites: SchemaDesignUpdateTableWrite[];
};
export type SchemaDesignUpdateProcess = {
  dbWriteCount: number;
  delegatedCount: number;
  effectCount: number;
  eventCount: number;
  fieldRoutes: SchemaDesignUpdateFieldRoute[];
  gapCount: number;
  ignoredCount: number;
  routedFieldCount: number;
  totalFieldCount: number;
  update: TdlibCallableEntity;
};

export function schemaConstructors(entry: StorageReviewEntry): StorageSchemaConstructorDesign[] {
  return entry.schemaDesign?.constructors ?? [];
}

export function schemaEntryMatchesQuery(entry: StorageReviewEntry, query: string): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length === 0) {
    return true;
  }

  const constructorValues = schemaConstructors(entry).flatMap((constructor) => [
    constructor.name,
    ...constructor.fields.flatMap((field) => [
      field.name,
      field.tdlibType,
      schemaFieldTargetLabel(field)
    ])
  ]);

  return [entry.type, entry.storage, entry.storageTarget, ...constructorValues].some((value) =>
    normalizeQuery(value).includes(normalizedQuery)
  );
}

export function schemaTableMatchesQuery(
  table: StorageSchemaTable,
  query: string,
  entries: StorageReviewEntry[] = []
): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length === 0) {
    return true;
  }
  const kvMappings = schemaKvMappingsForTable(entries, table.name);

  return [
    table.name,
    ...table.sourceTypes,
    ...table.indirectSourceTypes,
    ...table.primaryKey,
    ...table.columns.flatMap((column) => [
      column.id,
      column.name,
      column.pgType,
      column.role,
      ...column.sourceFields
    ]),
    ...kvMappings.flatMap((mapping) => [
      mapping.key,
      mapping.valueColumn,
      ...mapping.keySourceFields,
      ...mapping.valueSourceFields
    ])
  ].some((value) => normalizeQuery(value).includes(normalizedQuery));
}

export function schemaUpdateMatchesQuery(update: TdlibCallableEntity, query: string): boolean {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length === 0) {
    return true;
  }

  return [
    update.name,
    update.description,
    ...update.fields.flatMap((field) => [field.name, field.type, field.description])
  ].some((value) => normalizeQuery(value).includes(normalizedQuery));
}

export function schemaUpdateFieldCountLabel(update: TdlibCallableEntity): string {
  return `${String(update.fields.length)} ${pluralize(update.fields.length, 'field')}`;
}

export function schemaUpdateInstanceId(updateName: string): string {
  return `schema-update:${updateName}`;
}

export function schemaUpdateSlot(updateName: string): string {
  return `schema-update-card:${updateName}`;
}

export function schemaUpdateProcessForUpdate(
  update: TdlibCallableEntity,
  entries: StorageReviewEntry[],
  tables: StorageSchemaTable[],
  updateDesign: StorageSchemaUpdateDesign | undefined
): SchemaDesignUpdateProcess {
  const dbWritesBySourceField = schemaUpdateDbWritesBySourceField(update.name, tables);
  const entryTypes = new Set(entries.map((entry) => entry.type));
  const handlerPlanStepsByFieldName = schemaUpdateHandlerPlanStepsByFieldName(
    update.name,
    updateDesign
  );
  const fieldRoutes = update.fields.map((field) =>
    schemaUpdateFieldRoute(
      update.name,
      field,
      entryTypes,
      dbWritesBySourceField,
      handlerPlanStepsByFieldName,
      updateDesign
    )
  );
  const handlerPlanSteps = updateDesign?.handlerPlan?.steps ?? [];

  return {
    dbWriteCount: fieldRoutes.reduce(
      (count, route) => count + route.dbWrites.length + route.tableWrites.length,
      0
    ),
    delegatedCount: handlerPlanSteps.filter((step) => step.op === 'delegateType').length,
    effectCount: handlerPlanSteps.filter((step) => step.op === 'runEffect').length,
    eventCount: handlerPlanSteps.filter((step) => step.op === 'publishEvent').length,
    fieldRoutes,
    gapCount: fieldRoutes.filter((route) => route.status === 'gap').length,
    ignoredCount: fieldRoutes.filter((route) =>
      route.handlerPlanSteps.some((step) => step.op === 'ignoreField')
    ).length,
    routedFieldCount: fieldRoutes.filter((route) => route.status !== 'gap').length,
    totalFieldCount: fieldRoutes.length,
    update
  };
}

export function schemaCoverageForConstructors(
  constructors: StorageSchemaConstructorDesign[]
): SchemaDesignCoverage {
  return constructors.reduce(
    (coverage, constructor) => {
      for (const field of constructor.fields) {
        coverage.total += 1;
        if (field.target.kind !== 'pending') {
          coverage.covered += 1;
        }
      }
      return coverage;
    },
    { covered: 0, total: 0 }
  );
}

export function schemaProgressForEntry(entry: StorageReviewEntry): SchemaDesignProgress {
  const constructors = schemaConstructors(entry);
  const kind = schemaProgressKindForStorage(entry.storage);
  const coverage =
    kind === 'extend-fields' ||
    kind === 'facet-fields' ||
    kind === 'fields' ||
    kind === 'table-fields'
      ? schemaCoverageForConstructors(constructors)
      : schemaConstructorCoverage(constructors, entry.storage);
  const ready = schemaEntryIsReady(entry);

  return {
    ...coverage,
    kind,
    ready,
    title: schemaProgressTitle(kind, coverage)
  };
}

export function schemaCoverageLabel(coverage: SchemaDesignCoverage): string {
  return `${String(coverage.covered)} / ${String(coverage.total)}`;
}

export function schemaProgressLabel(progress: SchemaDesignProgress): string {
  return schemaCoverageLabel(progress);
}

export function schemaCoveragePercent(coverage: SchemaDesignCoverage): number {
  if (coverage.total === 0) {
    return 100;
  }

  return Math.round((coverage.covered / coverage.total) * 100);
}

export function schemaCoverageStyle(coverage: SchemaDesignCoverage): SchemaDesignProgressStyle {
  return { '--schema-design-progress': `${String(schemaCoveragePercent(coverage))}%` };
}

export function schemaProgressStyle(progress: SchemaDesignProgress): SchemaDesignProgressStyle {
  return { '--schema-design-progress': `${String(schemaCoveragePercent(progress))}%` };
}

export function schemaEntryIsReady(entry: StorageReviewEntry): boolean {
  return schemaConstructors(entry).every((constructor) =>
    constructor.fields.every((field) => field.target.kind !== 'pending')
  );
}

export function schemaConstructorCount(entry: StorageReviewEntry): number {
  return entry.schemaDesign?.constructors.length ?? 0;
}

export function schemaConstructorFieldCount(
  constructors: StorageSchemaConstructorDesign[]
): number {
  return constructors.reduce(
    (fieldCount, constructor) => fieldCount + constructor.fields.length,
    0
  );
}

export function schemaConstructorSummaryLabel(
  constructors: StorageSchemaConstructorDesign[]
): string {
  const constructorCount = constructors.length;

  return `${String(constructorCount)} ${pluralize(constructorCount, 'constructor')}`;
}

export function schemaFieldTargetLabel(field: StorageSchemaFieldDesign): string {
  const target = field.target;
  if (target.kind === 'pending') {
    return 'pending';
  }
  if (target.kind === 'constructor-payload') {
    return 'constructor payload';
  }
  if (target.kind === 'embedded-payload') {
    return 'embedded payload';
  }
  if (target.kind === 'table-column' || target.kind === 'table-ref') {
    return target.fieldId;
  }
  if (target.kind === 'embedded') {
    return `${target.table}.${target.column}`;
  }
  if (target.kind === 'dynamic') {
    return `dynamic:${target.ruleId}`;
  }
  if (target.kind === 'event-payload') {
    return `event:${target.event}`;
  }

  return `not stored:${target.reason}`;
}

export function schemaConstructorTargetLabel(
  constructor: StorageSchemaConstructorDesign
): string | null {
  const target = constructor.target;
  if (target === undefined) {
    return null;
  }
  if (target.kind === 'event') {
    return `event:${target.event}`;
  }

  const sourceFields = target.sourceFields ?? [];
  if (sourceFields.length === 0) {
    return `${target.table}.${target.valueColumn} as-is by ${target.key}`;
  }

  return `${target.table}.${target.valueColumn} from ${sourceFields.join(', ')} by ${target.key}`;
}

export function schemaTableSourceFieldCount(table: StorageSchemaTable): number {
  return new Set(table.columns.flatMap((column) => column.sourceFields)).size;
}

export function schemaTableColumnLabel(table: StorageSchemaTable): string {
  const columnCount = table.columns.length;

  return `${String(columnCount)} ${pluralize(columnCount, 'column')}`;
}

export function schemaCreateTableSql(table: StorageSchemaTable): string {
  const columnLines = table.columns.map(
    (column) =>
      `  ${schemaSqlIdentifier(column.name)} ${column.pgType}${column.nullable ? '' : ' NOT NULL'}`
  );
  const primaryKeyColumns = schemaPrimaryKeyColumnNames(table);
  const constraintLines =
    primaryKeyColumns.length === 0
      ? []
      : [`  PRIMARY KEY (${primaryKeyColumns.map(schemaSqlIdentifier).join(', ')})`];
  const foreignKeyLines = table.foreignKeys.map((foreignKey) =>
    schemaForeignKeyConstraintSql(table, foreignKey)
  );

  return [
    `CREATE TABLE ${schemaSqlIdentifier(table.name)} (`,
    [...columnLines, ...constraintLines, ...foreignKeyLines].join(',\n'),
    ');'
  ].join('\n');
}

export function schemaFieldSourceId(
  typeName: string,
  constructorName: string,
  fieldName: string
): string {
  return `${typeName}.${constructorName}.${fieldName}`;
}

export function schemaConstructorSourceId(typeName: string, constructorName: string): string {
  return `${typeName}.${constructorName}`;
}

export function schemaColumnDestinationsForSource(
  tables: StorageSchemaTable[],
  sourceField: string
): SchemaDesignTableColumnDestination[] {
  return tables.flatMap((table) =>
    table.columns
      .filter((column) => column.sourceFields.includes(sourceField))
      .map((column) => ({
        column: column.name,
        sourceField,
        table: table.name
      }))
  );
}

export function schemaFocusConstructor(
  target: SchemaDesignSourceFocusRequest | SchemaDesignSourceFocusTarget
): string | undefined {
  return Object.prototype.hasOwnProperty.call(target, 'constructor')
    ? target.constructor
    : undefined;
}

export function schemaSourceReference(sourceField: string): SchemaDesignSourceReference | null {
  const [type, constructor, ...fieldParts] = sourceField.split('.');
  if (type === undefined || constructor === undefined) {
    return null;
  }

  return {
    constructor,
    ...(fieldParts.length === 0 ? {} : { field: fieldParts.join('.') }),
    raw: sourceField,
    type
  };
}

export function schemaSourceFieldMatchesTarget(
  sourceField: string,
  target: SchemaDesignSourceHoverTarget | null
): boolean {
  const reference = schemaSourceReference(sourceField);
  if (reference === null || target === null) {
    return false;
  }

  return schemaSourceReferenceMatchesTarget(reference, target);
}

export function schemaSourceReferenceMatchesTarget(
  reference: SchemaDesignSourceReference,
  target: SchemaDesignSourceHoverTarget | null
): boolean {
  if (target === null) {
    return false;
  }
  if (reference.type !== target.type || reference.constructor !== target.constructor) {
    return false;
  }
  if (target.field === undefined) {
    return true;
  }

  return reference.field === target.field;
}

export function schemaTableTargetMatchesColumn(
  tableName: string,
  columnName: string,
  target: SchemaDesignTableHoverTarget | null
): boolean {
  if (target?.table !== tableName) {
    return false;
  }
  if (target.column === undefined) {
    return true;
  }

  return target.column === columnName;
}

export function schemaKvMappingsForTable(
  entries: StorageReviewEntry[],
  tableName: string
): SchemaDesignKvMapping[] {
  const mappings = new Map<string, SchemaDesignKvMapping>();

  for (const entry of entries) {
    for (const constructor of schemaConstructors(entry)) {
      const target = constructor.target;
      if (target?.kind !== 'kv' || target.table !== tableName) {
        continue;
      }

      const valueSourceFields =
        target.sourceFields === undefined || target.sourceFields.length === 0
          ? [schemaConstructorSourceId(entry.type, constructor.name)]
          : target.sourceFields;
      const keySourceFields = target.keySourceFields ?? [];
      const valueSources = valueSourceFields.flatMap((sourceField) => {
        const source = schemaSourceReference(sourceField);
        return source === null ? [] : [source];
      });
      const keySources = keySourceFields.flatMap((sourceField) => {
        const source = schemaSourceReference(sourceField);
        return source === null ? [] : [source];
      });
      if (valueSources.length === 0) {
        continue;
      }

      const mappingKey = [
        target.key,
        target.table,
        target.valueColumn,
        keySourceFields.join(','),
        valueSourceFields.join(',')
      ].join('|');
      mappings.set(mappingKey, {
        key: target.key,
        keySourceFields,
        keySources,
        table: target.table,
        valueColumn: target.valueColumn,
        valueSourceFields,
        valueSources
      });
    }
  }

  return [...mappings.values()];
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function schemaUpdateDbWritesBySourceField(
  updateName: string,
  tables: StorageSchemaTable[]
): Map<string, SchemaDesignUpdateDbWrite[]> {
  const result = new Map<string, SchemaDesignUpdateDbWrite[]>();
  for (const table of tables) {
    for (const column of table.columns) {
      for (const sourceField of column.sourceFields) {
        if (
          sourceField !== `Update.${updateName}` &&
          !sourceField.startsWith(`Update.${updateName}.`)
        ) {
          continue;
        }

        const existing = result.get(sourceField) ?? [];
        existing.push({
          column: column.name,
          columnId: column.id,
          sourceField,
          table: table.name
        });
        result.set(sourceField, existing);
      }
    }
  }

  return result;
}

function schemaUpdateFieldRoute(
  updateName: string,
  field: TdlibField,
  entryTypes: Set<string>,
  dbWritesBySourceField: Map<string, SchemaDesignUpdateDbWrite[]>,
  handlerPlanStepsByFieldName: Map<string, SchemaDesignUpdateFieldUse[]>,
  updateDesign: StorageSchemaUpdateDesign | undefined
): SchemaDesignUpdateFieldRoute {
  const sourceField = `Update.${updateName}.${field.name}`;
  const fieldDesign = updateDesign?.fields[field.name];
  const dbWrites = [
    ...(dbWritesBySourceField.get(sourceField) ?? []),
    ...(dbWritesBySourceField.get(`Update.${updateName}`) ?? [])
  ];
  const delegatedTypes = schemaUpdateDelegatedTypes(field.type, entryTypes);
  const events = fieldDesign?.events ?? [];
  const effects = fieldDesign?.effects ?? [];
  const handlerPlanSteps = handlerPlanStepsByFieldName.get(field.name) ?? [];
  const ignoredReason = fieldDesign?.ignored?.reason ?? null;
  const tableWrites = schemaUpdateTableWritesForField(dbWrites, handlerPlanSteps);

  return {
    dbWrites,
    delegatedTypes,
    effects,
    events,
    field,
    handlerPlanSteps,
    ignoredReason,
    sourceField,
    status: handlerPlanSteps.length === 0 ? 'gap' : 'used',
    tableWrites
  };
}

function schemaUpdateDelegatedTypes(fieldType: string, entryTypes: Set<string>): string[] {
  return [...new Set(fieldType.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [])].filter((token) =>
    entryTypes.has(token)
  );
}

function schemaUpdateHandlerPlanStepsByFieldName(
  updateName: string,
  updateDesign: StorageSchemaUpdateDesign | undefined
): Map<string, SchemaDesignUpdateFieldUse[]> {
  const result = new Map<string, SchemaDesignUpdateFieldUse[]>();
  for (const [index, step] of (updateDesign?.handlerPlan?.steps ?? []).entries()) {
    const fieldNames = new Set<string>();
    for (const sourceField of step.sourceFields) {
      const fieldName = schemaUpdateFieldNameFromSourceField(updateName, sourceField);
      if (fieldName !== null) {
        fieldNames.add(fieldName);
      }
    }
    for (const fieldName of fieldNames) {
      const fieldSteps = result.get(fieldName) ?? [];
      fieldSteps.push({
        description: step.description,
        id: step.id,
        op: step.op,
        stepNumber: index + 1,
        ...(step.table === undefined ? {} : { table: step.table }),
        ...(step.type === undefined ? {} : { type: step.type })
      });
      result.set(fieldName, fieldSteps);
    }
  }

  return result;
}

function schemaUpdateTableWritesForField(
  dbWrites: SchemaDesignUpdateDbWrite[],
  handlerPlanSteps: SchemaDesignUpdateFieldUse[]
): SchemaDesignUpdateTableWrite[] {
  const tablesWithColumnWrites = new Set(dbWrites.map((write) => write.table));
  return handlerPlanSteps
    .filter((step) => step.table !== undefined && !tablesWithColumnWrites.has(step.table))
    .map((step) => ({
      description: step.description,
      id: step.id,
      op: step.op,
      stepNumber: step.stepNumber,
      table: step.table ?? ''
    }));
}

function schemaUpdateFieldNameFromSourceField(updateName: string, sourceField: string): string | null {
  const prefix = `Update.${updateName}.`;
  if (!sourceField.startsWith(prefix)) {
    return null;
  }

  const path = sourceField.slice(prefix.length);
  const [fieldName] = path.split('.');
  return fieldName === undefined || fieldName.length === 0 ? null : fieldName;
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

function schemaConstructorCoverage(
  constructors: StorageSchemaConstructorDesign[],
  storage: string
): SchemaDesignCoverage {
  return constructors.reduce(
    (coverage, constructor) => {
      coverage.total += 1;
      if (schemaConstructorIsCovered(constructor, storage)) {
        coverage.covered += 1;
      }
      return coverage;
    },
    { covered: 0, total: 0 }
  );
}

function schemaConstructorIsCovered(
  constructor: StorageSchemaConstructorDesign,
  storage: string
): boolean {
  if (storage === 'event' && constructor.target?.kind !== 'event') {
    return false;
  }
  if (storage === 'kv' && constructor.target?.kind !== 'kv') {
    return false;
  }

  return constructor.fields.every((field) => schemaFieldIsCoveredForStorage(field, storage));
}

function schemaFieldIsCoveredForStorage(field: StorageSchemaFieldDesign, storage: string): boolean {
  if (storage === 'embedded') {
    return field.target.kind === 'embedded-payload';
  }
  if (storage === 'event') {
    return field.target.kind === 'event-payload';
  }
  if (storage === 'kv') {
    return field.target.kind === 'constructor-payload';
  }

  return field.target.kind !== 'pending';
}

function schemaProgressKindForStorage(storage: string): SchemaDesignProgressKind {
  if (storage === 'embedded') {
    return 'embedded-constructors';
  }
  if (storage === 'event') {
    return 'event-payloads';
  }
  if (storage === 'extend') {
    return 'extend-fields';
  }
  if (storage === 'facet') {
    return 'facet-fields';
  }
  if (storage === 'kv') {
    return 'kv-payloads';
  }
  if (storage === 'pair') {
    return 'pair-constructors';
  }
  if (storage === 'table') {
    return 'table-fields';
  }

  return 'fields';
}

function schemaProgressTitle(
  kind: SchemaDesignProgressKind,
  coverage: SchemaDesignCoverage
): string {
  const unitByKind: Record<SchemaDesignProgressKind, string> = {
    'embedded-constructors': 'embedded constructors',
    'event-payloads': 'event payload constructors',
    'extend-fields': 'extension fields',
    'facet-fields': 'facet fields',
    fields: 'fields',
    'kv-payloads': 'key-value constructor payloads',
    'pair-constructors': 'pair constructors',
    'table-fields': 'table fields'
  };

  return `${unitByKind[kind]} ${schemaCoverageLabel(coverage)}`;
}

function schemaPrimaryKeyColumnNames(table: StorageSchemaTable): string[] {
  const columnsById = new Map(table.columns.map((column) => [column.id, column.name]));

  return table.primaryKey.map((columnId) => columnsById.get(columnId) ?? columnId);
}

function schemaForeignKeyConstraintSql(
  table: StorageSchemaTable,
  foreignKey: StorageSchemaTable['foreignKeys'][number]
): string {
  const localColumnsById = new Map(table.columns.map((column) => [column.id, column.name]));
  const localColumns = foreignKey.columns.map(
    (columnId) => localColumnsById.get(columnId) ?? columnId
  );
  const referencedColumns = foreignKey.referencedColumns.map((columnId) =>
    schemaReferencedColumnName(foreignKey.referencedTable, columnId)
  );
  const constraintName = foreignKey.id.replaceAll('.', '_');

  return [
    `  CONSTRAINT ${schemaSqlIdentifier(constraintName)}`,
    `FOREIGN KEY (${localColumns.map(schemaSqlIdentifier).join(', ')})`,
    `REFERENCES ${schemaSqlIdentifier(foreignKey.referencedTable)}`,
    `(${referencedColumns.map(schemaSqlIdentifier).join(', ')})`
  ].join(' ');
}

function schemaReferencedColumnName(referencedTable: string, columnId: string): string {
  const prefix = `${referencedTable}.`;
  if (columnId.startsWith(prefix)) {
    return columnId.slice(prefix.length);
  }

  return columnId;
}

function schemaSqlIdentifier(identifier: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    return identifier;
  }

  return `"${identifier.replaceAll('"', '""')}"`;
}
