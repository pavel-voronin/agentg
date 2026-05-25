#!/usr/bin/env node
/* global console */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reviewPath = resolve(repoRoot, 'packages/tdlib-docs/src/data/tdlibStorageReview.json');
const schemaPath = resolve(repoRoot, 'packages/telegram/src/tdlibDbSchema.ts');
const drizzleDir = resolve(repoRoot, 'packages/telegram/drizzle');
const drizzleMetaDir = resolve(drizzleDir, 'meta');
const migrationTag = '0000_telegram_tdlib_schema';
const migrationPath = resolve(drizzleDir, `${migrationTag}.sql`);
const prettierOptions = (await resolveConfig(schemaPath)) ?? {};
const PG_TYPES = new Set([
  'bigint',
  'boolean',
  'bytea',
  'double precision',
  'integer',
  'jsonb',
  'text',
  'timestamp with time zone'
]);

const reviewState = JSON.parse(await readFile(reviewPath, 'utf8'));
const tables = sortTablesByDependencies(parseReviewTables(reviewState));

await mkdir(drizzleMetaDir, { recursive: true });
await writeFile(
  schemaPath,
  await format(renderDrizzleSchema(tables), { ...prettierOptions, parser: 'typescript' })
);
await writeFile(migrationPath, renderSqlMigration(tables));

console.log(
  JSON.stringify({
    event: 'telegram.db_schema.generated',
    foreignKeys: tables.reduce((total, table) => total + table.foreignKeys.length, 0),
    migration: `packages/telegram/drizzle/${migrationTag}.sql`,
    schema: 'packages/telegram/src/tdlibDbSchema.ts',
    source: 'packages/tdlib-docs/src/data/tdlibStorageReview.json',
    tables: tables.length
  })
);

function parseReviewTables(input) {
  if (input?.version !== 2 || !Array.isArray(input.tables)) {
    throw new Error('TDLib storage review must be version 2 and contain tables');
  }

  const tables = input.tables.map(parseReviewTable);
  validateTables(tables);
  return tables;
}

function parseReviewTable(table) {
  const name = requiredString(table.name, 'table.name');
  const columns = requiredArray(table.columns, `${name}.columns`)
    .map((column) => parseReviewColumn(name, column))
    .sort((left, right) => left.name.localeCompare(right.name));
  const foreignKeys = requiredArray(table.foreignKeys, `${name}.foreignKeys`).map((foreignKey) =>
    parseReviewForeignKey(name, foreignKey)
  );
  const primaryKey = requiredArray(table.primaryKey, `${name}.primaryKey`).map((columnId) =>
    requiredString(columnId, `${name}.primaryKey[]`)
  );

  return {
    columns,
    foreignKeys,
    name,
    primaryKey
  };
}

function parseReviewColumn(tableName, column) {
  const name = requiredString(column.name, `${tableName}.columns.name`);
  const id = requiredString(column.id, `${tableName}.${name}.id`);
  const pgType = requiredString(column.pgType, `${tableName}.${name}.pgType`);

  if (!PG_TYPES.has(pgType)) {
    throw new Error(`Unsupported schema-design pgType: ${tableName}.${name}=${pgType}`);
  }

  return {
    id,
    name,
    nullable: column.nullable === true,
    pgType
  };
}

function parseReviewForeignKey(tableName, foreignKey) {
  return {
    columns: requiredArray(foreignKey.columns, `${tableName}.foreignKeys.columns`).map((columnId) =>
      requiredString(columnId, `${tableName}.foreignKeys.columns[]`)
    ),
    id: requiredString(foreignKey.id, `${tableName}.foreignKeys.id`),
    referencedColumns: requiredArray(
      foreignKey.referencedColumns,
      `${tableName}.foreignKeys.referencedColumns`
    ).map((columnId) => requiredString(columnId, `${tableName}.foreignKeys.referencedColumns[]`)),
    referencedTable: requiredString(
      foreignKey.referencedTable,
      `${tableName}.foreignKeys.referencedTable`
    )
  };
}

function validateTables(tables) {
  const tablesByName = new Map();

  for (const table of tables) {
    if (tablesByName.has(table.name)) {
      throw new Error(`Duplicate schema-design table: ${table.name}`);
    }
    tablesByName.set(table.name, table);
    validateTableColumns(table);
  }

  for (const table of tables) {
    const columnIds = new Set(table.columns.map((column) => column.id));
    for (const primaryKeyColumn of table.primaryKey) {
      if (!columnIds.has(primaryKeyColumn)) {
        throw new Error(`Primary key references unknown column: ${table.name}.${primaryKeyColumn}`);
      }
    }

    for (const foreignKey of table.foreignKeys) {
      validateForeignKey(table, foreignKey, tablesByName);
    }
  }
}

function validateTableColumns(table) {
  const columnNames = new Set();
  const columnIds = new Set();

  for (const column of table.columns) {
    if (column.id !== `${table.name}.${column.name}`) {
      throw new Error(`Column id must be ${table.name}.${column.name}: ${column.id}`);
    }
    if (columnNames.has(column.name)) {
      throw new Error(`Duplicate column name: ${table.name}.${column.name}`);
    }
    if (columnIds.has(column.id)) {
      throw new Error(`Duplicate column id: ${column.id}`);
    }
    columnNames.add(column.name);
    columnIds.add(column.id);
  }
}

function validateForeignKey(table, foreignKey, tablesByName) {
  if (foreignKey.columns.length === 0) {
    throw new Error(`Foreign key has no local columns: ${foreignKey.id}`);
  }
  if (foreignKey.columns.length !== foreignKey.referencedColumns.length) {
    throw new Error(`Foreign key column count mismatch: ${foreignKey.id}`);
  }

  const localColumnIds = new Set(table.columns.map((column) => column.id));
  for (const columnId of foreignKey.columns) {
    if (!localColumnIds.has(columnId)) {
      throw new Error(`Foreign key references unknown local column: ${foreignKey.id}.${columnId}`);
    }
  }

  const referencedTable = tablesByName.get(foreignKey.referencedTable);
  if (referencedTable === undefined) {
    throw new Error(`Foreign key references unknown table: ${foreignKey.id}`);
  }

  const referencedColumnIds = new Set(referencedTable.columns.map((column) => column.id));
  for (const columnId of foreignKey.referencedColumns) {
    if (!referencedColumnIds.has(columnId)) {
      throw new Error(`Foreign key references unknown target column: ${foreignKey.id}.${columnId}`);
    }
  }
}

function sortTablesByDependencies(tables) {
  const tablesByName = new Map(tables.map((table) => [table.name, table]));
  const visited = new Set();
  const visiting = [];
  const result = [];

  for (const table of tables) {
    visitTable(table);
  }

  return result;

  function visitTable(table) {
    if (visited.has(table.name)) {
      return;
    }
    if (visiting.includes(table.name)) {
      throw new Error(`Foreign key dependency cycle: ${[...visiting, table.name].join(' -> ')}`);
    }

    visiting.push(table.name);
    for (const referencedTableName of referencedTableNames(table)) {
      const referencedTable = tablesByName.get(referencedTableName);
      if (referencedTable === undefined) {
        throw new Error(`Unknown referenced table: ${referencedTableName}`);
      }
      visitTable(referencedTable);
    }
    visiting.pop();
    visited.add(table.name);
    result.push(table);
  }
}

function referencedTableNames(table) {
  return [
    ...new Set(
      table.foreignKeys
        .map((foreignKey) => foreignKey.referencedTable)
        .filter((referencedTable) => referencedTable !== table.name)
    )
  ];
}

function renderDrizzleSchema(inputTables) {
  const chunks = [
    `import { boolean, customType, doublePrecision, foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';`,
    '',
    `import type { JsonValue } from '@agentg/events/json';`,
    '',
    `const bigintText = customType<{ data: string; driverData: string }>({`,
    `  dataType() {`,
    `    return 'bigint';`,
    `  }`,
    `});`,
    '',
    `const byteaText = customType<{ data: string; driverData: string }>({`,
    `  dataType() {`,
    `    return 'bytea';`,
    `  }`,
    `});`,
    ''
  ];

  const context = createRenderContext(inputTables);
  for (const table of inputTables) {
    chunks.push(renderTableExport(table, context), '');
  }

  return `${chunks.join('\n')}\n`;
}

function createRenderContext(tables) {
  return {
    tablesByName: new Map(tables.map((table) => [table.name, table])),
    tableVariableByName: new Map(tables.map((table) => [table.name, camelCase(table.name)]))
  };
}

function renderTableExport(table, context) {
  const exportName = tableVariableName(table, context);
  const pkColumnIds = new Set(table.primaryKey);
  const singleInlinePrimaryKey =
    table.foreignKeys.length === 0 && table.primaryKey.length === 1 ? table.primaryKey[0] : null;
  const columnLines = table.columns.map(
    (column) =>
      `    ${camelCase(column.name)}: ${renderColumn(column, pkColumnIds, singleInlinePrimaryKey)}`
  );
  const configLines = renderTableConfig(table, context);

  if (configLines.length === 0) {
    return `export const ${exportName} = pgTable('${table.name}', {\n${columnLines.join(',\n')}\n});`;
  }

  return [
    `export const ${exportName} = pgTable(`,
    `  '${table.name}',`,
    `  {`,
    columnLines.join(',\n'),
    `  },`,
    `  (table) => [`,
    configLines.join(',\n'),
    `  ]`,
    `);`
  ].join('\n');
}

function renderTableConfig(table, context) {
  const lines = [];

  if (
    table.primaryKey.length > 0 &&
    (table.primaryKey.length > 1 || table.foreignKeys.length > 0)
  ) {
    lines.push(renderPrimaryKeyConfig(table));
  }
  for (const foreignKeyConfig of table.foreignKeys.map((foreignKey) =>
    renderForeignKeyConfig(table, foreignKey, context)
  )) {
    lines.push(foreignKeyConfig);
  }

  return lines;
}

function renderPrimaryKeyConfig(table) {
  return [
    `    primaryKey({`,
    `      columns: [${table.primaryKey.map((columnId) => `table.${columnPropertyName(table, columnId)}`).join(', ')}],`,
    `      name: '${table.name}_pk'`,
    `    })`
  ].join('\n');
}

function renderForeignKeyConfig(table, foreignKey, context) {
  const referencedTable = context.tablesByName.get(foreignKey.referencedTable);
  if (referencedTable === undefined) {
    throw new Error(`Unknown referenced table for render: ${foreignKey.referencedTable}`);
  }

  const referencedTableVariable = tableVariableName(referencedTable, context);

  return [
    `    foreignKey({`,
    `      columns: [${foreignKey.columns.map((columnId) => `table.${columnPropertyName(table, columnId)}`).join(', ')}],`,
    `      foreignColumns: [${foreignKey.referencedColumns
      .map(
        (columnId) => `${referencedTableVariable}.${columnPropertyName(referencedTable, columnId)}`
      )
      .join(', ')}],`,
    `      name: '${constraintName(foreignKey.id)}'`,
    `    })`
  ].join('\n');
}

function renderColumn(column, primaryKeyColumnIds, singleInlinePrimaryKey) {
  const parts = [columnBuilder(column)];
  if (column.id === singleInlinePrimaryKey) {
    parts.push('primaryKey()');
  } else if (!column.nullable || primaryKeyColumnIds.has(column.id)) {
    parts.push('notNull()');
  }

  return parts.join('.');
}

function columnBuilder(column) {
  if (column.pgType === 'bigint') {
    return `bigintText('${column.name}')`;
  }
  if (column.pgType === 'boolean') {
    return `boolean('${column.name}')`;
  }
  if (column.pgType === 'bytea') {
    return `byteaText('${column.name}')`;
  }
  if (column.pgType === 'double precision') {
    return `doublePrecision('${column.name}')`;
  }
  if (column.pgType === 'integer') {
    return `integer('${column.name}')`;
  }
  if (column.pgType === 'jsonb') {
    return `jsonb('${column.name}').$type<JsonValue>()`;
  }
  if (column.pgType === 'text') {
    return `text('${column.name}')`;
  }
  if (column.pgType === 'timestamp with time zone') {
    return `timestamp('${column.name}', { withTimezone: true })`;
  }

  throw new Error(`Unsupported pgType for ${column.id}: ${column.pgType}`);
}

function renderSqlMigration(inputTables) {
  return `${inputTables.map(renderCreateTableSql).join('\n\n--> statement-breakpoint\n\n')}\n`;
}

function renderCreateTableSql(table) {
  const primaryKeyColumnIds = new Set(table.primaryKey);
  const columnLines = table.columns.map(
    (column) =>
      `  ${quoteIdent(column.name)} ${column.pgType}${sqlNotNull(column, primaryKeyColumnIds)}`
  );
  const constraintLines = [
    ...renderPrimaryKeySql(table),
    ...table.foreignKeys.map((foreignKey) => renderForeignKeySql(table, foreignKey))
  ];

  return [
    `CREATE TABLE ${quoteIdent(table.name)} (`,
    [...columnLines, ...constraintLines].join(',\n'),
    `);`
  ].join('\n');
}

function renderPrimaryKeySql(table) {
  if (table.primaryKey.length === 0) {
    return [];
  }
  return [
    `  CONSTRAINT ${quoteIdent(`${table.name}_pk`)} PRIMARY KEY (${table.primaryKey.map((columnId) => quoteIdent(columnNameFromId(table, columnId))).join(', ')})`
  ];
}

function renderForeignKeySql(table, foreignKey) {
  const localColumns = foreignKey.columns.map((columnId) =>
    quoteIdent(columnNameFromId(table, columnId))
  );
  const referencedColumns = foreignKey.referencedColumns.map((columnId) =>
    quoteIdent(columnNameFromReferencedId(foreignKey.referencedTable, columnId))
  );

  return [
    `  CONSTRAINT ${quoteIdent(constraintName(foreignKey.id))}`,
    `FOREIGN KEY (${localColumns.join(', ')})`,
    `REFERENCES ${quoteIdent(foreignKey.referencedTable)}`,
    `(${referencedColumns.join(', ')})`
  ].join(' ');
}

function sqlNotNull(column, primaryKeyColumnIds) {
  return !column.nullable || primaryKeyColumnIds.has(column.id) ? ' NOT NULL' : '';
}

function columnPropertyName(table, columnId) {
  return camelCase(columnNameFromId(table, columnId));
}

function columnNameFromId(table, columnId) {
  const prefix = `${table.name}.`;
  if (!columnId.startsWith(prefix)) {
    throw new Error(`Column ${columnId} does not belong to ${table.name}`);
  }
  return columnId.slice(prefix.length);
}

function columnNameFromReferencedId(referencedTable, columnId) {
  const prefix = `${referencedTable}.`;
  if (!columnId.startsWith(prefix)) {
    throw new Error(`Column ${columnId} does not belong to ${referencedTable}`);
  }
  return columnId.slice(prefix.length);
}

function tableVariableName(table, context) {
  const variableName = context.tableVariableByName.get(table.name);
  if (variableName === undefined) {
    throw new Error(`No table variable name for ${table.name}`);
  }
  return variableName;
}

function constraintName(id) {
  return id.replaceAll('.', '_');
}

function requiredArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`TDLib storage review field must be an array: ${label}`);
  }
  return value;
}

function requiredString(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`TDLib storage review field must be a non-empty string: ${label}`);
  }
  return value;
}

function quoteIdent(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function camelCase(value) {
  const words = value.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      return index === 0 ? lower : `${lower[0]?.toUpperCase() ?? ''}${lower.slice(1)}`;
    })
    .join('');
}
