import type { Database } from '../database/client.js';
import { telegramBasicGroups } from '../database/schema.js';
import { tdId, tdJsonObject, type UpdateByType } from '../tdlib/value.js';

type BasicGroup = UpdateByType<'updateBasicGroup'>['basic_group'];

export async function storeBasicGroup(database: Database, basicGroup: BasicGroup): Promise<void> {
  const row = telegramBasicGroupRow(basicGroup);
  await database.insert(telegramBasicGroups).values(row).onConflictDoUpdate({
    set: row,
    target: telegramBasicGroups.id
  });
}

function telegramBasicGroupRow(basicGroup: BasicGroup): typeof telegramBasicGroups.$inferInsert {
  return {
    id: String(basicGroup.id),
    isActive: basicGroup.is_active,
    memberCount: basicGroup.member_count,
    status: tdJsonObject(basicGroup.status),
    upgradedToSupergroupId: nullableZeroId(basicGroup.upgraded_to_supergroup_id)
  };
}

function nullableZeroId(value: number | string | null | undefined): string | null {
  const id = tdId(value);
  return id === undefined || id === '0' ? null : id;
}
