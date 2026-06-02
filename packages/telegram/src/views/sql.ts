import { and, sql, type SQL } from 'drizzle-orm';

export function andSql(...conditions: (SQL | undefined)[]): SQL | undefined {
  const defined = conditions.filter((condition): condition is SQL => condition !== undefined);
  return defined.length === 0 ? undefined : and(...defined);
}

export function orSql(first: SQL, second: SQL): SQL {
  return sql`(${first} or ${second})`;
}
