import { asc, eq, sql } from 'drizzle-orm';

import type { HistorySyncDatabase as AppDatabase } from './database.js';
import { historySyncTargets, historySyncTemplates } from './schema.js';
import { canonicalizeHistorySyncRange } from './ranges.js';
import type { HistorySyncRange, HistorySyncTarget, HistorySyncTemplate } from './types.js';

export async function listHistorySyncTemplates(
  database: AppDatabase
): Promise<HistorySyncTemplate[]> {
  const rows = await database
    .select({
      id: historySyncTemplates.id,
      match: historySyncTemplates.match,
      range: historySyncTemplates.range
    })
    .from(historySyncTemplates)
    .orderBy(asc(historySyncTemplates.id));

  return rows.map((row) => ({
    id: row.id,
    match: row.match,
    range: canonicalizeHistorySyncRange(row.range as HistorySyncRange)
  }));
}

export async function upsertHistorySyncTemplate(
  database: AppDatabase,
  template: HistorySyncTemplate
): Promise<void> {
  const range = canonicalizeHistorySyncRange(template.range);
  await database
    .insert(historySyncTemplates)
    .values({
      id: template.id,
      match: template.match,
      range
    })
    .onConflictDoUpdate({
      set: {
        match: template.match,
        range,
        updatedAt: sql`now()`
      },
      target: historySyncTemplates.id
    });
}

export async function listHistorySyncTargets(database: AppDatabase): Promise<HistorySyncTarget[]> {
  const rows = await database
    .select({
      id: historySyncTargets.id,
      range: historySyncTargets.range,
      telegramChatId: historySyncTargets.telegramChatId,
      templateId: historySyncTargets.templateId
    })
    .from(historySyncTargets)
    .orderBy(asc(historySyncTargets.telegramChatId), asc(historySyncTargets.id));

  return rows.map((row) => ({
    chatId: row.telegramChatId,
    id: row.id,
    range: canonicalizeHistorySyncRange(row.range as HistorySyncRange),
    ...(row.templateId === null ? {} : { templateId: row.templateId })
  }));
}

export async function upsertHistorySyncTarget(
  database: AppDatabase,
  target: HistorySyncTarget
): Promise<void> {
  const range = canonicalizeHistorySyncRange(target.range);
  await database
    .insert(historySyncTargets)
    .values({
      id: target.id,
      range,
      telegramChatId: target.chatId,
      templateId: target.templateId
    })
    .onConflictDoUpdate({
      set: {
        range,
        telegramChatId: target.chatId,
        templateId: target.templateId,
        updatedAt: sql`now()`
      },
      target: historySyncTargets.id
    });
}

export async function deleteHistorySyncTarget(
  database: AppDatabase,
  targetId: string
): Promise<HistorySyncTarget | undefined> {
  const [deleted] = await database
    .delete(historySyncTargets)
    .where(eq(historySyncTargets.id, targetId))
    .returning({
      id: historySyncTargets.id,
      range: historySyncTargets.range,
      telegramChatId: historySyncTargets.telegramChatId,
      templateId: historySyncTargets.templateId
    });

  if (deleted === undefined) {
    return undefined;
  }

  return {
    chatId: deleted.telegramChatId,
    id: deleted.id,
    range: canonicalizeHistorySyncRange(deleted.range as HistorySyncRange),
    ...(deleted.templateId === null ? {} : { templateId: deleted.templateId })
  };
}

export async function upsertHistorySyncTargets(
  database: AppDatabase,
  targets: HistorySyncTarget[]
): Promise<void> {
  for (const target of targets) {
    await upsertHistorySyncTarget(database, target);
  }
}
