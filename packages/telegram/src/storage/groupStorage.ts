import { eq } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramBasicGroups, telegramSupergroups } from '../database/schema.js';
import type {
  BasicGroup,
  BasicGroupPatch,
  Supergroup,
  SupergroupPatch
} from '../domain/models/group.js';

export type BasicGroupStorageRow = typeof telegramBasicGroups.$inferInsert;
export type SupergroupStorageRow = typeof telegramSupergroups.$inferInsert;

export async function upsertBasicGroupPatch(
  database: Database,
  group: BasicGroupPatch
): Promise<void> {
  const row = basicGroupStorageRow(group);
  await database.insert(telegramBasicGroups).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBasicGroups.id
  });
}

export async function upsertSupergroup(database: Database, group: Supergroup): Promise<void> {
  const row = supergroupStorageRow(group);
  await database.insert(telegramSupergroups).values(row).onConflictDoUpdate({
    set: row,
    target: telegramSupergroups.id
  });
}

export async function updateExistingSupergroupPatch(
  database: Database,
  group: SupergroupPatch
): Promise<boolean> {
  const updated = await database
    .update(telegramSupergroups)
    .set(supergroupStorageRowFragment(group))
    .where(eq(telegramSupergroups.id, group.id))
    .returning({
      id: telegramSupergroups.id
    });

  return updated.length > 0;
}

function basicGroupStorageRow(group: BasicGroup | BasicGroupPatch): BasicGroupStorageRow {
  return group;
}

function supergroupStorageRow(group: Supergroup): SupergroupStorageRow {
  return group;
}

function supergroupStorageRowFragment(
  group: SupergroupPatch
): Partial<SupergroupStorageRow> & Pick<SupergroupStorageRow, 'id'> {
  return group;
}
