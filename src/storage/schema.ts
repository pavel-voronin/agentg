export const AGENTG_MIGRATIONS_TABLE = 'agentg_migrations';

export const TABLE_PREFIXES = {
  history: 'history_',
  summaries: 'summaries_',
  telegram: 'telegram_'
} as const;

export type StorageTableOwner = keyof typeof TABLE_PREFIXES | `plugin:${string}`;

export function prefixedTableName(owner: StorageTableOwner, tableName: string): string {
  assertIdentifier(tableName, 'tableName');

  if (owner === 'history' || owner === 'summaries' || owner === 'telegram') {
    return `${TABLE_PREFIXES[owner]}${tableName}`;
  }

  const pluginName = owner.slice('plugin:'.length);
  assertIdentifier(pluginName, 'pluginName');
  return `${pluginName}_${tableName}`;
}

export function assertDomainTableName(tableName: string): void {
  if (tableName === AGENTG_MIGRATIONS_TABLE) {
    return;
  }

  const prefixes = Object.values(TABLE_PREFIXES);
  if (prefixes.some((prefix) => tableName.startsWith(prefix))) {
    return;
  }

  throw new Error(`SQLite domain table must use an owner prefix: ${tableName}`);
}

function assertIdentifier(value: string, name: string): void {
  if (!/^[a-z][a-z0-9_]*$/u.test(value)) {
    throw new Error(`${name} must be a lowercase SQL identifier`);
  }
}
