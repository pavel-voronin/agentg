import type {
  StorageReviewEntry,
  StorageReviewState,
  StorageSchemaTable,
  StorageSchemaUpdateEffectKind,
  StorageSchemaUpdateEffectRoute,
  StorageSchemaUpdateEventRoute,
  StorageSchemaUpdateHandlerPlan,
  StorageSchemaUpdateHandlerPlanStep
} from './storageReviewTypes.js';
import type { TdlibCallableEntity, TdlibExplorerSchema, TdlibTypeEntity } from './types.js';

type TdlibCallableSchemaEntity = Omit<TdlibCallableEntity, 'id'>;
type TdlibTypeSchemaEntity = Omit<TdlibTypeEntity, 'id'>;
type StorageSchemaTableColumn = StorageSchemaTable['columns'][number];

const supportedColumnRoles = new Set(['data', 'foreign-key', 'primary-key']);
const supportedMaturities = new Set([1, 2, 3]);
const supportedUpdateEffectKinds = new Set<StorageSchemaUpdateEffectKind>([
  'cache-invalidation',
  'file-download',
  'file-system',
  'other'
]);
const supportedUpdateHandlerPlanStatuses = new Set(['draft', 'ready']);
const supportedUpdateHandlerPlanStepOps = new Set([
  'delegateType',
  'deleteRows',
  'ignoreField',
  'publishEvent',
  'replaceRows',
  'replaceTable',
  'returnWhen',
  'runEffect',
  'upsertTable'
]);
const supportedPgTypes = new Set([
  'bigint',
  'boolean',
  'bytea',
  'double precision',
  'integer',
  'jsonb',
  'text',
  'timestamp with time zone'
]);

export type SchemaDesignValidationIssue = {
  message: string;
  path: string;
};

export type SchemaDesignValidationOptions = {
  requireCompleteUpdateDesigns?: boolean;
};

type SchemaDesignValidationContext = {
  columnById: Map<string, StorageSchemaTableColumn>;
  columnIds: Set<string>;
  constructorsByName: Map<string, TdlibCallableSchemaEntity>;
  entryTypes: Set<string>;
  foreignKeysByColumnId: Map<string, StorageSchemaTable['foreignKeys']>;
  functionsByName: Map<string, TdlibCallableSchemaEntity>;
  scalarNames: Set<string>;
  sourceFieldUsages: Map<string, SchemaDesignSourceFieldUsage[]>;
  tableByColumnId: Map<string, StorageSchemaTable>;
  tablesByName: Map<string, StorageSchemaTable>;
  tablesBySourceType: Map<string, StorageSchemaTable[]>;
  typesByName: Map<string, TdlibTypeSchemaEntity>;
  updatesByName: Map<string, TdlibCallableSchemaEntity>;
};

type ResolvedCallableField = {
  fieldType: string;
};

type SchemaDesignSourceFieldUsage = {
  columnId: string;
  tableName: string;
};

export function validateSchemaDesignState(
  state: StorageReviewState,
  schema: TdlibExplorerSchema,
  options: SchemaDesignValidationOptions = {}
): SchemaDesignValidationIssue[] {
  const context = createValidationContext(state, schema);
  const issues: SchemaDesignValidationIssue[] = [];
  const requireCompleteUpdateDesigns = options.requireCompleteUpdateDesigns ?? true;

  validateTables(state.tables ?? [], context, issues);
  validateEntries(state.entries, context, issues);
  validateUpdateDesigns(state, context, issues, requireCompleteUpdateDesigns);

  return issues;
}

function createValidationContext(
  state: StorageReviewState,
  schema: TdlibExplorerSchema
): SchemaDesignValidationContext {
  const tables = state.tables ?? [];

  return {
    columnById: createColumnById(tables),
    columnIds: new Set(tables.flatMap((table) => table.columns.map((column) => column.id))),
    constructorsByName: new Map(
      schema.constructors.map((constructor) => [constructor.name, constructor])
    ),
    entryTypes: new Set(state.entries.map((entry) => entry.type)),
    foreignKeysByColumnId: createForeignKeysByColumnId(tables),
    functionsByName: new Map(schema.functions.map((fn) => [fn.name, fn])),
    scalarNames: new Set(schema.scalars.map((scalar) => scalar.name)),
    sourceFieldUsages: createSourceFieldUsages(tables),
    tableByColumnId: createTableByColumnId(tables),
    tablesByName: new Map(tables.map((table) => [table.name, table])),
    tablesBySourceType: createTablesBySourceType(tables),
    typesByName: new Map(schema.types.map((type) => [type.name, type])),
    updatesByName: new Map(schema.updates.map((update) => [update.name, update]))
  };
}

function createColumnById(tables: StorageSchemaTable[]): Map<string, StorageSchemaTableColumn> {
  const result = new Map<string, StorageSchemaTableColumn>();
  for (const table of tables) {
    for (const column of table.columns) {
      result.set(column.id, column);
    }
  }

  return result;
}

function createTableByColumnId(tables: StorageSchemaTable[]): Map<string, StorageSchemaTable> {
  const result = new Map<string, StorageSchemaTable>();
  for (const table of tables) {
    for (const column of table.columns) {
      result.set(column.id, table);
    }
  }

  return result;
}

function createSourceFieldUsages(
  tables: StorageSchemaTable[]
): Map<string, SchemaDesignSourceFieldUsage[]> {
  const result = new Map<string, SchemaDesignSourceFieldUsage[]>();
  for (const table of tables) {
    for (const column of table.columns) {
      for (const sourceField of column.sourceFields) {
        const existing = result.get(sourceField) ?? [];
        existing.push({ columnId: column.id, tableName: table.name });
        result.set(sourceField, existing);
      }
    }
  }

  return result;
}

function createTablesBySourceType(tables: StorageSchemaTable[]): Map<string, StorageSchemaTable[]> {
  const result = new Map<string, StorageSchemaTable[]>();
  for (const table of tables) {
    for (const sourceType of table.sourceTypes) {
      const existing = result.get(sourceType) ?? [];
      existing.push(table);
      result.set(sourceType, existing);
    }
  }

  return result;
}

function createForeignKeysByColumnId(
  tables: StorageSchemaTable[]
): Map<string, StorageSchemaTable['foreignKeys']> {
  const result = new Map<string, StorageSchemaTable['foreignKeys']>();
  for (const table of tables) {
    for (const foreignKey of table.foreignKeys) {
      for (const columnId of foreignKey.columns) {
        const existing = result.get(columnId) ?? [];
        existing.push(foreignKey);
        result.set(columnId, existing);
      }
    }
  }

  return result;
}

function validateTables(
  tables: StorageSchemaTable[],
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const tableNames = new Set<string>();

  for (const table of tables) {
    const tablePath = `tables.${table.name}`;
    if (tableNames.has(table.name)) {
      addIssue(issues, tablePath, `duplicate table ${table.name}`);
    }
    tableNames.add(table.name);

    validateUniqueList(table.sourceTypes, `${tablePath}.sourceTypes`, 'source type', issues);
    validateUniqueList(
      table.indirectSourceTypes,
      `${tablePath}.indirectSourceTypes`,
      'indirect source type',
      issues
    );
    validateUniqueList(table.primaryKey, `${tablePath}.primaryKey`, 'primary key column', issues);

    const tableColumnIds = new Set(table.columns.map((column) => column.id));
    const tableColumnNames = new Set<string>();
    const declaredColumnIds = new Set<string>();
    const primaryKeyColumnIds = new Set(table.primaryKey);
    const foreignKeyColumnIds = new Set(
      table.foreignKeys.flatMap((foreignKey) => foreignKey.columns)
    );

    for (const sourceType of table.sourceTypes) {
      if (!context.typesByName.has(sourceType)) {
        addIssue(issues, `${tablePath}.sourceTypes`, `unknown source type ${sourceType}`);
      } else if (!context.entryTypes.has(sourceType)) {
        addIssue(
          issues,
          `${tablePath}.sourceTypes`,
          `source type ${sourceType} has no storage review entry`
        );
      }
    }
    for (const sourceType of table.indirectSourceTypes) {
      if (!context.typesByName.has(sourceType)) {
        addIssue(
          issues,
          `${tablePath}.indirectSourceTypes`,
          `unknown indirect source type ${sourceType}`
        );
      } else if (!context.entryTypes.has(sourceType)) {
        addIssue(
          issues,
          `${tablePath}.indirectSourceTypes`,
          `indirect source type ${sourceType} has no storage review entry`
        );
      }
      if (table.sourceTypes.includes(sourceType)) {
        addIssue(
          issues,
          `${tablePath}.indirectSourceTypes`,
          `indirect source type ${sourceType} duplicates direct source type`
        );
      }
    }

    for (const primaryKeyColumn of table.primaryKey) {
      if (!tableColumnIds.has(primaryKeyColumn)) {
        addIssue(
          issues,
          `${tablePath}.primaryKey`,
          `unknown primary key column ${primaryKeyColumn}`
        );
      }
    }

    for (const column of table.columns) {
      const columnPath = `${tablePath}.columns.${column.name}`;
      if (tableColumnNames.has(column.name)) {
        addIssue(issues, columnPath, `duplicate column name ${table.name}.${column.name}`);
      }
      tableColumnNames.add(column.name);
      if (declaredColumnIds.has(column.id)) {
        addIssue(issues, columnPath, `duplicate column id ${column.id}`);
      }
      declaredColumnIds.add(column.id);
      if (column.id !== `${table.name}.${column.name}`) {
        addIssue(issues, `${columnPath}.id`, `column id must be ${table.name}.${column.name}`);
      }
      if (!supportedPgTypes.has(column.pgType)) {
        addIssue(issues, `${columnPath}.pgType`, `unsupported pgType ${column.pgType}`);
      }
      if (!supportedColumnRoles.has(column.role)) {
        addIssue(issues, `${columnPath}.role`, `unsupported column role ${column.role}`);
      }
      if (primaryKeyColumnIds.has(column.id) && column.role !== 'primary-key') {
        addIssue(
          issues,
          `${columnPath}.role`,
          `primary key column ${column.id} must have primary-key role`
        );
      }
      if (column.role === 'primary-key' && !primaryKeyColumnIds.has(column.id)) {
        addIssue(
          issues,
          `${columnPath}.role`,
          `primary-key column ${column.id} must be listed in primaryKey`
        );
      }
      if (column.keyRule !== undefined) {
        validateColumnKeyRule(columnPath, column, context, issues);
      }
      if (column.sourceFields.length === 0) {
        addIssue(issues, `${columnPath}.sourceFields`, 'table columns must declare sourceFields');
      }
      validateUniqueList(column.sourceFields, `${columnPath}.sourceFields`, 'source field', issues);
      for (const sourceField of column.sourceFields) {
        validateSourceField(sourceField, `${columnPath}.sourceFields`, context, issues);
        validateTableSourceFieldOwner(table, column, sourceField, columnPath, context, issues);
      }
      if (column.role === 'foreign-key' && !foreignKeyColumnIds.has(column.id)) {
        addIssue(issues, `${columnPath}.role`, `foreign-key column ${column.id} lacks foreign key`);
      }
    }

    const foreignKeyIds = new Set<string>();
    for (const foreignKey of table.foreignKeys) {
      const foreignKeyPath = `${tablePath}.foreignKeys.${foreignKey.id}`;
      if (foreignKeyIds.has(foreignKey.id)) {
        addIssue(issues, foreignKeyPath, `duplicate foreign key ${foreignKey.id}`);
      }
      foreignKeyIds.add(foreignKey.id);
      if (foreignKey.sourceFields.length === 0) {
        addIssue(issues, `${foreignKeyPath}.sourceFields`, 'foreign key must declare sourceFields');
      }
      validateUniqueList(
        foreignKey.sourceFields,
        `${foreignKeyPath}.sourceFields`,
        'source field',
        issues
      );
      validateForeignKey(table, tableColumnIds, foreignKey, foreignKeyPath, context, issues);
    }
  }
}

function validateUniqueList(
  items: string[],
  path: string,
  itemLabel: string,
  issues: SchemaDesignValidationIssue[]
): void {
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item)) {
      addIssue(issues, path, `duplicate ${itemLabel} ${item}`);
    }
    seen.add(item);
  }
}

function validateTableSourceFieldOwner(
  table: StorageSchemaTable,
  column: StorageSchemaTableColumn,
  sourceField: string,
  columnPath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const ownerType = sourceFieldOwnerType(sourceField);
  if (ownerType === null || ownerType === 'Function' || ownerType === 'Update') {
    return;
  }
  if (!context.entryTypes.has(ownerType)) {
    return;
  }
  if (table.sourceTypes.includes(ownerType) || table.indirectSourceTypes.includes(ownerType)) {
    return;
  }

  addIssue(
    issues,
    `${columnPath}.sourceFields`,
    `source field ${sourceField} requires ${ownerType} in ${table.name}.sourceTypes or indirectSourceTypes`
  );
}

function validateForeignKey(
  table: StorageSchemaTable,
  tableColumnIds: Set<string>,
  foreignKey: StorageSchemaTable['foreignKeys'][number],
  foreignKeyPath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (!foreignKey.id.startsWith(`${table.name}.`)) {
    addIssue(issues, `${foreignKeyPath}.id`, `foreign key id must start with ${table.name}.`);
  }
  if (foreignKey.columns.length === 0) {
    addIssue(issues, `${foreignKeyPath}.columns`, 'foreign key must name local columns');
  }
  if (foreignKey.referencedColumns.length === 0) {
    addIssue(
      issues,
      `${foreignKeyPath}.referencedColumns`,
      'foreign key must name referenced columns'
    );
  }
  if (foreignKey.columns.length !== foreignKey.referencedColumns.length) {
    addIssue(issues, foreignKeyPath, 'foreign key local and referenced column counts must match');
  }

  const referencedTable = context.tablesByName.get(foreignKey.referencedTable);
  if (referencedTable === undefined) {
    addIssue(
      issues,
      `${foreignKeyPath}.referencedTable`,
      `unknown table ${foreignKey.referencedTable}`
    );
  }
  const referencedColumnIds = new Set(referencedTable?.columns.map((column) => column.id) ?? []);

  for (const columnId of foreignKey.columns) {
    if (!tableColumnIds.has(columnId)) {
      addIssue(issues, `${foreignKeyPath}.columns`, `unknown local column ${columnId}`);
      continue;
    }
    const column = table.columns.find((item) => item.id === columnId);
    if (column?.role !== 'foreign-key' && column?.role !== 'primary-key') {
      addIssue(
        issues,
        `${foreignKeyPath}.columns`,
        `foreign key column ${columnId} must be primary-key or foreign-key`
      );
    }
  }
  for (const columnId of foreignKey.referencedColumns) {
    if (!columnId.startsWith(`${foreignKey.referencedTable}.`)) {
      addIssue(
        issues,
        `${foreignKeyPath}.referencedColumns`,
        `referenced column ${columnId} must belong to ${foreignKey.referencedTable}`
      );
      continue;
    }
    if (!referencedColumnIds.has(columnId)) {
      addIssue(
        issues,
        `${foreignKeyPath}.referencedColumns`,
        `unknown referenced column ${columnId}`
      );
    }
  }
  for (const sourceField of foreignKey.sourceFields) {
    validateSourceField(sourceField, `${foreignKeyPath}.sourceFields`, context, issues);
  }
}

function validateColumnKeyRule(
  columnPath: string,
  column: StorageSchemaTable['columns'][number],
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const rule = column.keyRule;
  if (rule === undefined) {
    return;
  }

  if (column.nullable) {
    addIssue(issues, `${columnPath}.keyRule`, 'derived key columns must be not null');
  }
  const type = context.typesByName.get(rule.type);
  if (type === undefined) {
    addIssue(issues, `${columnPath}.keyRule.type`, `unknown key rule type ${rule.type}`);
    return;
  }

  const caseNames = new Set(Object.keys(rule.cases));
  for (const constructorName of type.constructorNames) {
    if (!caseNames.has(constructorName)) {
      addIssue(issues, `${columnPath}.keyRule.cases`, `missing key rule case ${constructorName}`);
    }
  }
  for (const [constructorName, template] of Object.entries(rule.cases)) {
    if (!type.constructorNames.includes(constructorName)) {
      addIssue(
        issues,
        `${columnPath}.keyRule.cases.${constructorName}`,
        `${constructorName} does not belong to ${rule.type}`
      );
      continue;
    }
    validateConstructorKeyTemplate(
      constructorName,
      template,
      `${columnPath}.keyRule.cases.${constructorName}`,
      context,
      issues
    );
  }
}

function validateConstructorKeyTemplate(
  constructorName: string,
  template: string,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const constructor = context.constructorsByName.get(constructorName);
  if (constructor === undefined) {
    addIssue(issues, path, `unknown key rule constructor ${constructorName}`);
    return;
  }

  for (const match of template.matchAll(/<([^<>]+)>/g)) {
    const fieldName = match[1];
    if (fieldName === undefined || fieldName.trim().length === 0) {
      addIssue(issues, path, `invalid key rule placeholder ${match[0]}`);
      continue;
    }
    const field = constructor.fields.find((item) => item.name === fieldName);
    if (field === undefined) {
      addIssue(issues, path, `unknown key rule placeholder ${constructorName}.${fieldName}`);
      continue;
    }
    if (!context.scalarNames.has(field.type)) {
      addIssue(
        issues,
        path,
        `key rule placeholder ${constructorName}.${fieldName} must resolve to a scalar field`
      );
    }
  }
}

function validateEntries(
  entries: StorageReviewEntry[],
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  for (const entry of entries) {
    const entryPath = `entries.${entry.type}`;
    const tdlibType = context.typesByName.get(entry.type);
    if (tdlibType === undefined) {
      addIssue(issues, entryPath, `unknown TDLib type ${entry.type}`);
      continue;
    }

    const schemaDesign = entry.schemaDesign;
    if (schemaDesign === undefined) {
      addIssue(issues, `${entryPath}.schemaDesign`, `${entry.type} must declare schemaDesign`);
      continue;
    }

    const declaredConstructorNames = new Set<string>();
    for (const constructorName of tdlibType.constructorNames) {
      if (!schemaDesign.constructors.some((constructor) => constructor.name === constructorName)) {
        addIssue(issues, `${entryPath}.constructors`, `missing constructor ${constructorName}`);
      }
    }

    for (const constructor of schemaDesign.constructors) {
      const constructorPath = `${entryPath}.constructors.${constructor.name}`;
      if (declaredConstructorNames.has(constructor.name)) {
        addIssue(issues, constructorPath, `duplicate constructor ${constructor.name}`);
      }
      declaredConstructorNames.add(constructor.name);
      if (!tdlibType.constructorNames.includes(constructor.name)) {
        addIssue(issues, constructorPath, `constructor does not belong to ${entry.type}`);
        continue;
      }

      const tdlibConstructor = context.constructorsByName.get(constructor.name);
      if (tdlibConstructor === undefined) {
        addIssue(issues, constructorPath, `unknown TDLib constructor ${constructor.name}`);
        continue;
      }

      validateConstructorFields(
        entry.storage,
        entry.type,
        constructor.name,
        constructorPath,
        constructor.fields,
        tdlibConstructor,
        context,
        issues
      );
      if (entry.storage === 'kv') {
        validateKvConstructorTarget(entry, constructor, constructorPath, context, issues);
      }
      if (entry.storage === 'event') {
        validateEventConstructorTarget(entry, constructor, constructorPath, issues);
      } else if (constructor.target?.kind === 'event') {
        addIssue(
          issues,
          `${constructorPath}.target`,
          'event constructor target is only valid for event storage'
        );
      }
      if (entry.storage !== 'kv' && constructor.target?.kind === 'kv') {
        addIssue(
          issues,
          `${constructorPath}.target`,
          'kv constructor target is only valid for kv storage'
        );
      }
      if (entry.storage === 'extend') {
        validateExtendConstructorTarget(entry, constructor, constructorPath, context, issues);
      }
      if (entry.storage === 'facet') {
        validateFacetConstructorTarget(entry, constructor, constructorPath, context, issues);
      }
    }
  }
}

function validateUpdateDesigns(
  state: StorageReviewState,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[],
  requireCompleteUpdateDesigns: boolean
): void {
  const updateDesigns = state.updateDesigns ?? {};
  if (requireCompleteUpdateDesigns) {
    for (const update of context.updatesByName.values()) {
      const updateDesign = updateDesigns[update.name];
      if (updateDesign === undefined) {
        addIssue(issues, `updateDesigns.${update.name}`, `missing update design ${update.name}`);
      } else if (updateDesign.handlerPlan === undefined) {
        addIssue(
          issues,
          `updateDesigns.${update.name}.handlerPlan`,
          `missing handler plan for update ${update.name}`
        );
      }
    }
  }

  for (const [updateName, updateDesign] of Object.entries(updateDesigns)) {
    const updatePath = `updateDesigns.${updateName}`;
    const update = context.updatesByName.get(updateName);
    if (update === undefined) {
      addIssue(issues, updatePath, `unknown update ${updateName}`);
      continue;
    }

    const updateFieldNames = new Set(update.fields.map((field) => field.name));
    for (const [fieldName, fieldDesign] of Object.entries(updateDesign.fields)) {
      const fieldPath = `${updatePath}.fields.${fieldName}`;
      if (!updateFieldNames.has(fieldName)) {
        addIssue(issues, fieldPath, `unknown update field ${updateName}.${fieldName}`);
        continue;
      }

      validateUpdateIgnoredRoute(fieldDesign.ignored?.reason, `${fieldPath}.ignored`, issues);
      for (const event of fieldDesign.events ?? []) {
        validateUpdateEventRoute(
          updateName,
          fieldName,
          event,
          `${fieldPath}.events`,
          context,
          issues
        );
      }
      for (const effect of fieldDesign.effects ?? []) {
        validateUpdateEffectRoute(
          updateName,
          fieldName,
          effect,
          `${fieldPath}.effects`,
          context,
          issues
        );
      }
    }
    validateUpdateHandlerPlan(updateName, updateDesign.handlerPlan, updatePath, context, issues);
  }
}

function validateUpdateHandlerPlan(
  updateName: string,
  handlerPlan: StorageSchemaUpdateHandlerPlan | undefined,
  updatePath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (handlerPlan === undefined) {
    return;
  }

  const update = context.updatesByName.get(updateName);
  if (update === undefined) {
    return;
  }

  const planPath = `${updatePath}.handlerPlan`;
  if (!supportedUpdateHandlerPlanStatuses.has(handlerPlan.status)) {
    addIssue(issues, `${planPath}.status`, `unsupported handler plan status ${handlerPlan.status}`);
  }
  if (!supportedMaturities.has(handlerPlan.maturity)) {
    addIssue(
      issues,
      `${planPath}.maturity`,
      `unsupported handler plan maturity ${String(handlerPlan.maturity)}`
    );
  }
  if (handlerPlan.summary.trim().length === 0) {
    addIssue(issues, `${planPath}.summary`, 'handler plan must declare summary');
  }
  if (handlerPlan.steps.length === 0) {
    addIssue(issues, `${planPath}.steps`, 'handler plan must declare steps');
  }

  const coveredFieldNames = new Set<string>();
  const stepIds = new Set<string>();
  for (const [index, step] of handlerPlan.steps.entries()) {
    const stepPath = `${planPath}.steps.${String(index)}`;
    validateUpdateHandlerPlanStep(updateName, step, stepPath, context, issues, coveredFieldNames);
    if (step.id.trim().length === 0) {
      addIssue(issues, `${stepPath}.id`, 'handler plan step must declare id');
    } else if (stepIds.has(step.id)) {
      addIssue(issues, `${stepPath}.id`, `duplicate handler plan step id ${step.id}`);
    }
    stepIds.add(step.id);
  }

  for (const field of update.fields) {
    if (!coveredFieldNames.has(field.name)) {
      addIssue(
        issues,
        `${planPath}.steps`,
        `handler plan must cover update field Update.${updateName}.${field.name}`
      );
    }
  }
}

function validateUpdateHandlerPlanStep(
  updateName: string,
  step: StorageSchemaUpdateHandlerPlanStep,
  stepPath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[],
  coveredFieldNames: Set<string>
): void {
  if (!supportedUpdateHandlerPlanStepOps.has(step.op)) {
    addIssue(issues, `${stepPath}.op`, `unsupported handler plan op ${step.op}`);
  }
  if (step.description.trim().length === 0) {
    addIssue(issues, `${stepPath}.description`, 'handler plan step must declare description');
  }
  if (step.sourceFields.length === 0) {
    addIssue(issues, `${stepPath}.sourceFields`, 'handler plan step must declare sourceFields');
  }
  validateUniqueList(step.sourceFields, `${stepPath}.sourceFields`, 'source field', issues);
  for (const sourceField of step.sourceFields) {
    validateSourceField(sourceField, `${stepPath}.sourceFields`, context, issues);
    const fieldName = updateFieldNameFromSourceField(updateName, sourceField);
    if (fieldName === null) {
      addIssue(
        issues,
        `${stepPath}.sourceFields`,
        `handler plan source field ${sourceField} must belong to Update.${updateName}`
      );
    } else {
      coveredFieldNames.add(fieldName);
    }
  }
  if (step.table !== undefined && !context.tablesByName.has(step.table)) {
    addIssue(issues, `${stepPath}.table`, `unknown handler plan table ${step.table}`);
  }
  for (const column of step.columns ?? []) {
    if (!context.columnIds.has(column)) {
      addIssue(issues, `${stepPath}.columns`, `unknown handler plan column ${column}`);
    }
  }
  if (step.op === 'delegateType') {
    if (step.type === undefined || !context.typesByName.has(step.type)) {
      addIssue(issues, `${stepPath}.type`, `unknown handler plan delegate type ${step.type ?? ''}`);
    }
  }
  if (step.op === 'publishEvent' && step.event !== undefined && step.event.trim().length > 0) {
    return;
  }
  if (step.op === 'publishEvent') {
    addIssue(issues, `${stepPath}.event`, 'handler plan event step must name event');
  }
  if (step.op === 'runEffect') {
    if (step.effect === undefined || step.effect.trim().length === 0) {
      addIssue(issues, `${stepPath}.effect`, 'handler plan effect step must name effect');
    }
    if (step.effectKind === undefined || !supportedUpdateEffectKinds.has(step.effectKind)) {
      addIssue(
        issues,
        `${stepPath}.effectKind`,
        'handler plan effect step must declare effectKind'
      );
    }
  }
}

function updateFieldNameFromSourceField(updateName: string, sourceField: string): string | null {
  const prefix = `Update.${updateName}.`;
  if (!sourceField.startsWith(prefix)) {
    return null;
  }

  const path = sourceField.slice(prefix.length);
  const [fieldName] = path.split('.');
  return fieldName === undefined || fieldName.length === 0 ? null : fieldName;
}

function validateUpdateIgnoredRoute(
  reason: string | undefined,
  path: string,
  issues: SchemaDesignValidationIssue[]
): void {
  if (reason?.trim().length === 0) {
    addIssue(issues, `${path}.reason`, 'ignored update field must declare reason');
  }
}

function validateUpdateEventRoute(
  updateName: string,
  fieldName: string,
  event: StorageSchemaUpdateEventRoute,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (event.name.trim().length === 0) {
    addIssue(issues, `${path}.name`, 'update event route must name event');
  }
  validateUpdateRouteSourceFields(
    updateName,
    fieldName,
    event.sourceFields,
    `${path}.sourceFields`,
    context,
    issues
  );
}

function validateUpdateEffectRoute(
  updateName: string,
  fieldName: string,
  effect: StorageSchemaUpdateEffectRoute,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (!supportedUpdateEffectKinds.has(effect.kind)) {
    addIssue(issues, `${path}.kind`, `unsupported update effect kind ${effect.kind}`);
  }
  if (effect.name.trim().length === 0) {
    addIssue(issues, `${path}.name`, 'update effect route must name effect');
  }
  validateUpdateRouteSourceFields(
    updateName,
    fieldName,
    effect.sourceFields,
    `${path}.sourceFields`,
    context,
    issues
  );
}

function validateUpdateRouteSourceFields(
  updateName: string,
  fieldName: string,
  sourceFields: string[],
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (sourceFields.length === 0) {
    addIssue(issues, path, 'update route must declare sourceFields');
  }
  validateUniqueList(sourceFields, path, 'source field', issues);
  for (const sourceField of sourceFields) {
    validateSourceField(sourceField, path, context, issues);
    if (sourceField !== `Update.${updateName}.${fieldName}`) {
      addIssue(
        issues,
        path,
        `update route source field ${sourceField} must be Update.${updateName}.${fieldName}`
      );
    }
  }
}

function validateConstructorFields(
  storage: string,
  entryType: string,
  constructorName: string,
  constructorPath: string,
  fields: NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number]['fields'],
  tdlibConstructor: TdlibCallableSchemaEntity,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const tdlibFields = new Map(tdlibConstructor.fields.map((field) => [field.name, field]));
  const declaredFields = new Set(fields.map((field) => field.name));
  const seenFields = new Set<string>();

  for (const tdlibField of tdlibConstructor.fields) {
    if (!declaredFields.has(tdlibField.name)) {
      addIssue(issues, `${constructorPath}.fields`, `missing field ${tdlibField.name}`);
    }
  }

  for (const field of fields) {
    const fieldPath = `${constructorPath}.fields.${field.name}`;
    if (seenFields.has(field.name)) {
      addIssue(issues, fieldPath, `duplicate field ${field.name}`);
    }
    seenFields.add(field.name);
    const tdlibField = tdlibFields.get(field.name);
    if (tdlibField === undefined) {
      addIssue(issues, fieldPath, `unknown TDLib field ${field.name}`);
      continue;
    }
    if (tdlibField.type !== field.tdlibType) {
      addIssue(issues, `${fieldPath}.tdlibType`, `expected ${tdlibField.type}`);
    }
    if (storage === 'embedded' && field.target.kind !== 'embedded-payload') {
      addIssue(
        issues,
        `${fieldPath}.target`,
        'embedded storage fields must stay inside embedded payload'
      );
    }
    if (storage !== 'embedded' && field.target.kind === 'embedded-payload') {
      addIssue(
        issues,
        `${fieldPath}.target`,
        'embedded-payload target is only valid for embedded storage'
      );
    }
    if (storage === 'event' && field.target.kind !== 'event-payload') {
      addIssue(
        issues,
        `${fieldPath}.target`,
        'event storage fields must stay inside event payload'
      );
    }
    if (storage !== 'event' && field.target.kind === 'event-payload') {
      addIssue(
        issues,
        `${fieldPath}.target`,
        'event-payload target is only valid for event storage'
      );
    }
    validateFieldTarget(
      entryType,
      `${entryType}.${constructorName}.${field.name}`,
      tdlibField.type,
      fieldPath,
      field.target,
      context,
      issues
    );
  }
}

function validateFieldTarget(
  ownerType: string,
  sourceField: string,
  tdlibFieldType: string,
  fieldPath: string,
  target: NonNullable<
    StorageReviewEntry['schemaDesign']
  >['constructors'][number]['fields'][number]['target'],
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (target.kind === 'table-column' || target.kind === 'table-ref') {
    if (!context.columnIds.has(target.fieldId)) {
      addIssue(issues, `${fieldPath}.target.fieldId`, `unknown table column ${target.fieldId}`);
      return;
    }

    const column = context.columnById.get(target.fieldId);
    const table = context.tableByColumnId.get(target.fieldId);
    if (column !== undefined && !column.sourceFields.includes(sourceField)) {
      addIssue(
        issues,
        `${fieldPath}.target.fieldId`,
        `table column ${target.fieldId} must include source field ${sourceField}`
      );
    }
    if (table !== undefined && !table.sourceTypes.includes(ownerType)) {
      addIssue(
        issues,
        `${fieldPath}.target.fieldId`,
        `table ${table.name} must include ${ownerType} in sourceTypes`
      );
    }
    if (
      target.kind === 'table-column' &&
      column?.pgType === 'jsonb' &&
      tdlibTypeContainsFile(tdlibFieldType, context) &&
      !columnDocumentsCanonicalFileReferences(column)
    ) {
      addIssue(
        issues,
        `${fieldPath}.target.fieldId`,
        `jsonb column ${target.fieldId} stores file-bearing field ${sourceField} and must document canonical file_id/File.id references`
      );
    }
    if (target.kind === 'table-column' && column?.role === 'foreign-key') {
      addIssue(
        issues,
        `${fieldPath}.target.fieldId`,
        `foreign-key column ${target.fieldId} must use table-ref target`
      );
    }
    if (target.kind === 'table-ref') {
      if (target.referencedTable === undefined) {
        addIssue(
          issues,
          `${fieldPath}.target.referencedTable`,
          'table-ref target must declare referencedTable'
        );
        return;
      }
      if (column?.role !== 'foreign-key' && column?.role !== 'primary-key') {
        addIssue(
          issues,
          `${fieldPath}.target.fieldId`,
          `table-ref target ${target.fieldId} must point at a foreign-key or primary-key column`
        );
      }
      validateTableName(
        target.referencedTable,
        `${fieldPath}.target.referencedTable`,
        context,
        issues
      );
      const foreignKeys = context.foreignKeysByColumnId.get(target.fieldId) ?? [];
      const hasForeignKey = foreignKeys.some(
        (foreignKey) => foreignKey.referencedTable === target.referencedTable
      );
      if (!hasForeignKey) {
        addIssue(
          issues,
          `${fieldPath}.target.fieldId`,
          `table-ref ${target.fieldId} lacks foreign key to ${target.referencedTable}`
        );
      }
    }
    return;
  }

  if (target.kind === 'dynamic') {
    validateDynamicFieldTarget(ownerType, sourceField, fieldPath, target.ruleId, context, issues);
  }
  if (target.kind === 'embedded') {
    validateTableColumn(target.table, target.column, `${fieldPath}.target`, context, issues);
  }
  if (target.kind === 'event-payload' && target.event.trim().length === 0) {
    addIssue(issues, `${fieldPath}.target.event`, 'event payload target must name an event');
  }
}

function validateDynamicFieldTarget(
  ownerType: string,
  sourceField: string,
  fieldPath: string,
  ruleId: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (ruleId.trim().length === 0) {
    addIssue(issues, `${fieldPath}.target.ruleId`, 'dynamic target must declare ruleId');
    return;
  }

  const dynamicTableName = dynamicRuleTableName(ruleId);
  if (dynamicTableName === null) {
    addIssue(issues, `${fieldPath}.target.ruleId`, `invalid dynamic ruleId ${ruleId}`);
    return;
  }

  const dynamicTable = context.tablesByName.get(dynamicTableName);
  if (dynamicTable === undefined) {
    addIssue(
      issues,
      `${fieldPath}.target.ruleId`,
      `unknown dynamic target table ${dynamicTableName}`
    );
    return;
  }
  if (!dynamicTable.sourceTypes.includes(ownerType)) {
    addIssue(
      issues,
      `${fieldPath}.target.ruleId`,
      `dynamic target table ${dynamicTableName} must include ${ownerType} in sourceTypes`
    );
  }

  const usages = context.sourceFieldUsages.get(sourceField) ?? [];
  if (ruleId.startsWith('facet:')) {
    return;
  }
  if (usages.length === 0) {
    addIssue(
      issues,
      `${fieldPath}.target.ruleId`,
      `dynamic source field ${sourceField} must feed ${dynamicTableName} columns`
    );
  }
  for (const usage of usages) {
    if (usage.tableName !== dynamicTableName) {
      addIssue(
        issues,
        `${fieldPath}.target.ruleId`,
        `dynamic source field ${sourceField} feeds ${usage.columnId} outside ${dynamicTableName}`
      );
    }
  }
}

function validateEventConstructorTarget(
  entry: StorageReviewEntry,
  constructor: NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number],
  constructorPath: string,
  issues: SchemaDesignValidationIssue[]
): void {
  const target = constructor.target;
  if (target?.kind !== 'event') {
    addIssue(
      issues,
      `${constructorPath}.target`,
      'event storage constructor must declare event target'
    );
    return;
  }
  if (target.event.trim().length === 0) {
    addIssue(
      issues,
      `${constructorPath}.target.event`,
      'event constructor target must name an event'
    );
  }

  for (const field of constructor.fields) {
    if (field.target.kind !== 'event-payload') {
      continue;
    }
    if (field.target.event !== target.event) {
      addIssue(
        issues,
        `${constructorPath}.fields.${field.name}.target.event`,
        `${entry.type}.${constructor.name} event field must target ${target.event}`
      );
    }
  }
}

function validateExtendConstructorTarget(
  entry: StorageReviewEntry,
  constructor: NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number],
  constructorPath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const ownerType = entry.storageTarget.trim();
  const ownerTables = context.tablesBySourceType.get(ownerType) ?? [];
  if (ownerTables.length !== 1) {
    addIssue(
      issues,
      `${constructorPath}.target`,
      `extend storage must resolve one owner table for ${ownerType}`
    );
    return;
  }

  const ownerTable = ownerTables[0];
  if (ownerTable === undefined) {
    return;
  }
  const ownerTablePrefix = `${ownerTable.name}.`;
  for (const field of constructor.fields) {
    const fieldPath = `${constructorPath}.fields.${field.name}`;
    if (field.target.kind !== 'table-column' && field.target.kind !== 'table-ref') {
      addIssue(
        issues,
        `${fieldPath}.target`,
        `${entry.type} is extend, so fields must target owner table columns`
      );
      continue;
    }
    if (!field.target.fieldId.startsWith(ownerTablePrefix)) {
      addIssue(
        issues,
        `${fieldPath}.target.fieldId`,
        `${entry.type} extends ${ownerType}, so target must be in ${ownerTable.name}`
      );
    }
  }
}

function validateFacetConstructorTarget(
  entry: StorageReviewEntry,
  constructor: NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number],
  constructorPath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const facetTables = context.tablesBySourceType.get(entry.type) ?? [];
  if (facetTables.length !== 1) {
    addIssue(
      issues,
      `${constructorPath}.target`,
      `facet storage must resolve one facet table for ${entry.type}`
    );
    return;
  }

  const facetTable = facetTables[0];
  if (facetTable === undefined) {
    return;
  }
  const facetTablePrefix = `${facetTable.name}.`;
  for (const field of constructor.fields) {
    const fieldPath = `${constructorPath}.fields.${field.name}`;
    if (field.target.kind === 'table-column' || field.target.kind === 'table-ref') {
      if (!field.target.fieldId.startsWith(facetTablePrefix)) {
        addIssue(
          issues,
          `${fieldPath}.target.fieldId`,
          `${entry.type} is facet, so target must be in ${facetTable.name}`
        );
      }
      continue;
    }

    if (field.target.kind === 'dynamic') {
      const sourceField = `${entry.type}.${constructor.name}.${field.name}`;
      const hasFacetColumnSource = facetTable.columns.some((column) =>
        column.sourceFields.includes(sourceField)
      );
      if (!hasFacetColumnSource) {
        addIssue(
          issues,
          `${fieldPath}.target`,
          `${entry.type} dynamic facet field must feed ${facetTable.name} columns`
        );
      }
      continue;
    }

    addIssue(
      issues,
      `${fieldPath}.target`,
      `${entry.type} is facet, so fields must target facet table columns`
    );
  }
}

function validateKvConstructorTarget(
  entry: StorageReviewEntry,
  constructor: NonNullable<StorageReviewEntry['schemaDesign']>['constructors'][number],
  constructorPath: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const target = constructor.target;
  if (target?.kind !== 'kv') {
    addIssue(issues, `${constructorPath}.target`, 'kv storage constructor must declare kv target');
    return;
  }

  validateTableName(target.table, `${constructorPath}.target.table`, context, issues);
  validateTableColumn(
    target.table,
    target.valueColumn,
    `${constructorPath}.target`,
    context,
    issues
  );
  validateKvKey(target.key, `${constructorPath}.target.key`, context, issues);

  const targetTable = context.tablesByName.get(target.table);
  const valueColumn = targetTable?.columns.find((column) => column.name === target.valueColumn);
  if (targetTable !== undefined && !targetTable.sourceTypes.includes(entry.type)) {
    addIssue(
      issues,
      `${constructorPath}.target.table`,
      `kv target table ${target.table} must include ${entry.type} in sourceTypes`
    );
  }
  if (target.sourceFields === undefined || target.sourceFields.length === 0) {
    addIssue(
      issues,
      `${constructorPath}.target.sourceFields`,
      'kv value must declare sourceFields'
    );
  }
  for (const sourceField of target.keySourceFields ?? []) {
    validateSourceField(sourceField, `${constructorPath}.target.keySourceFields`, context, issues);
    if (targetTable !== undefined && !tablePrimaryKeySourceFields(targetTable).has(sourceField)) {
      addIssue(
        issues,
        `${constructorPath}.target.keySourceFields`,
        `kv key column in ${target.table} must include source field ${sourceField}`
      );
    }
  }
  for (const sourceField of target.sourceFields ?? []) {
    validateSourceField(sourceField, `${constructorPath}.target.sourceFields`, context, issues);
    if (valueColumn !== undefined && !valueColumn.sourceFields.includes(sourceField)) {
      addIssue(
        issues,
        `${constructorPath}.target.sourceFields`,
        `kv value column ${target.table}.${target.valueColumn} must include source field ${sourceField}`
      );
    }
  }

  for (const field of constructor.fields) {
    if (field.target.kind !== 'constructor-payload') {
      addIssue(
        issues,
        `${constructorPath}.fields.${field.name}.target`,
        `${entry.type} is kv, so fields must stay inside constructor payload`
      );
    }
  }
}

function tablePrimaryKeySourceFields(table: StorageSchemaTable): Set<string> {
  const primaryKeyColumnIds = new Set(table.primaryKey);
  return new Set(
    table.columns
      .filter((column) => primaryKeyColumnIds.has(column.id))
      .flatMap((column) => column.sourceFields)
  );
}

function validateKvKey(
  key: string,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const placeholders = [...key.matchAll(/<([^<>]+)>/g)].map((match) => match[1] ?? '');
  for (const placeholder of placeholders) {
    if (placeholder.endsWith('.constructor')) {
      const typeName = placeholder.slice(0, -'.constructor'.length);
      const type = context.typesByName.get(typeName);
      if (type === undefined) {
        addIssue(issues, path, `unknown constructor-token type ${typeName}`);
        continue;
      }
      for (const constructorName of type.constructorNames) {
        const constructor = context.constructorsByName.get(constructorName);
        if (constructor === undefined || constructor.fields.length > 0) {
          addIssue(issues, path, `${placeholder} can only be used for fieldless constructors`);
          break;
        }
      }
      continue;
    }

    const callableField = resolveCallableFieldPlaceholder(placeholder, context);
    if (callableField === null) {
      addIssue(issues, path, `unknown dynamic key placeholder ${placeholder}`);
      continue;
    }
    if (!context.scalarNames.has(callableField.fieldType)) {
      addIssue(
        issues,
        path,
        `dynamic key placeholder ${placeholder} must resolve to a scalar field`
      );
    }
  }
}

function validateSourceField(
  sourceField: string,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const [typeName, constructorName, fieldName, ...rest] = sourceField.split('.');
  if (typeName === undefined || constructorName === undefined || rest.length > 0) {
    addIssue(issues, path, `invalid source field ${sourceField}`);
    return;
  }

  const type = context.typesByName.get(typeName);
  if (typeName === 'Function') {
    const fn = context.functionsByName.get(constructorName);
    if (fn === undefined) {
      addIssue(issues, path, `unknown source function ${constructorName}`);
      return;
    }
    if (fieldName === undefined) {
      return;
    }
    if (!fn.fields.some((field) => field.name === fieldName)) {
      addIssue(issues, path, `unknown source field ${sourceField}`);
    }
    return;
  }

  if (type === undefined) {
    addIssue(issues, path, `unknown source type ${typeName}`);
    return;
  }

  const constructor =
    typeName === 'Update'
      ? context.updatesByName.get(constructorName)
      : context.constructorsByName.get(constructorName);
  if (constructor === undefined) {
    addIssue(issues, path, `unknown source constructor ${constructorName}`);
    return;
  }
  if (constructor.resultType !== typeName) {
    addIssue(issues, path, `${constructorName} does not produce ${typeName}`);
  }
  if (fieldName === undefined) {
    return;
  }
  if (!constructor.fields.some((field) => field.name === fieldName)) {
    addIssue(issues, path, `unknown source field ${sourceField}`);
  }
}

function resolveCallableFieldPlaceholder(
  placeholder: string,
  context: SchemaDesignValidationContext
): ResolvedCallableField | null {
  const [constructorName, fieldName, ...rest] = placeholder.split('.');
  if (constructorName === undefined || fieldName === undefined || rest.length > 0) {
    return null;
  }

  const callable =
    context.updatesByName.get(constructorName) ?? context.constructorsByName.get(constructorName);
  const field = callable?.fields.find((item) => item.name === fieldName);
  if (field === undefined) {
    return null;
  }

  return { fieldType: field.type };
}

function dynamicRuleTableName(ruleId: string): string | null {
  const separatorIndex = ruleId.indexOf(':');
  if (separatorIndex < 1 || separatorIndex === ruleId.length - 1) {
    return null;
  }

  const target = ruleId.slice(separatorIndex + 1);
  const [tableName] = target.split('.');
  if (tableName === undefined || tableName.length === 0) {
    return null;
  }

  return tableName;
}

function sourceFieldOwnerType(sourceField: string): string | null {
  const [ownerType] = sourceField.split('.');
  return ownerType ?? null;
}

function columnDocumentsCanonicalFileReferences(column: StorageSchemaTableColumn): boolean {
  return column.notes.some((note) => /file_id|File\.id|canonical File|telegram_files/.test(note));
}

function tdlibTypeContainsFile(
  typeName: string,
  context: SchemaDesignValidationContext,
  seenTypes = new Set<string>()
): boolean {
  const normalizedType = unwrapVectorType(typeName);
  if (normalizedType === 'file' || normalizedType === 'File') {
    return true;
  }
  if (context.scalarNames.has(normalizedType)) {
    return false;
  }
  if (seenTypes.has(normalizedType)) {
    return false;
  }
  seenTypes.add(normalizedType);

  const constructors: TdlibCallableSchemaEntity[] = [];
  const directType = context.typesByName.get(normalizedType);
  if (directType !== undefined) {
    for (const constructorName of directType.constructorNames) {
      const constructor = context.constructorsByName.get(constructorName);
      if (constructor !== undefined) {
        constructors.push(constructor);
      }
    }
  }

  const directConstructor = context.constructorsByName.get(normalizedType);
  if (directConstructor !== undefined) {
    constructors.push(directConstructor);
  }

  return constructors.some((constructor) =>
    constructor.fields.some((field) => tdlibTypeContainsFile(field.type, context, seenTypes))
  );
}

function unwrapVectorType(typeName: string): string {
  const match = /^vector<(.+)>$/.exec(typeName);
  return match?.[1] ?? typeName;
}

function validateTableName(
  tableName: string,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  if (!context.tablesByName.has(tableName)) {
    addIssue(issues, path, `unknown table ${tableName}`);
  }
}

function validateTableColumn(
  tableName: string,
  columnName: string,
  path: string,
  context: SchemaDesignValidationContext,
  issues: SchemaDesignValidationIssue[]
): void {
  const table = context.tablesByName.get(tableName);
  if (table === undefined) {
    addIssue(issues, `${path}.table`, `unknown table ${tableName}`);
    return;
  }
  if (!table.columns.some((column) => column.name === columnName)) {
    addIssue(issues, `${path}.column`, `unknown table column ${tableName}.${columnName}`);
  }
}

function addIssue(issues: SchemaDesignValidationIssue[], path: string, message: string): void {
  issues.push({ message, path });
}
