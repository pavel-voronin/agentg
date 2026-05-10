import { asc, eq, sql } from 'drizzle-orm';

import type { HistoryDatabase as AppDatabase } from './database.js';
import { historyTargets, historyTemplates } from './schema.js';
import { canonicalizeHistoryRange } from './ranges.js';
import type { HistoryRange, HistoryTarget, HistoryTemplate } from './types.js';

export async function listHistoryTemplates(database: AppDatabase): Promise<HistoryTemplate[]> {
  const rows = await database
    .select({
      id: historyTemplates.id,
      match: historyTemplates.match,
      range: historyTemplates.range
    })
    .from(historyTemplates)
    .orderBy(asc(historyTemplates.id));

  return rows.map((row) => ({
    id: row.id,
    match: row.match,
    range: canonicalizeHistoryRange(row.range as HistoryRange)
  }));
}

export async function upsertHistoryTemplate(
  database: AppDatabase,
  template: HistoryTemplate
): Promise<void> {
  const range = canonicalizeHistoryRange(template.range);
  await database
    .insert(historyTemplates)
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
      target: historyTemplates.id
    });
}

export async function listHistoryTargets(database: AppDatabase): Promise<HistoryTarget[]> {
  const rows = await database
    .select({
      id: historyTargets.id,
      range: historyTargets.range,
      telegramChatId: historyTargets.telegramChatId,
      templateId: historyTargets.templateId
    })
    .from(historyTargets)
    .orderBy(asc(historyTargets.telegramChatId), asc(historyTargets.id));

  return rows.map((row) => ({
    chatId: row.telegramChatId,
    id: row.id,
    range: canonicalizeHistoryRange(row.range as HistoryRange),
    ...(row.templateId === null ? {} : { templateId: row.templateId })
  }));
}

export async function upsertHistoryTarget(
  database: AppDatabase,
  target: HistoryTarget
): Promise<void> {
  const range = canonicalizeHistoryRange(target.range);
  await database
    .insert(historyTargets)
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
      target: historyTargets.id
    });
}

export async function deleteHistoryTarget(
  database: AppDatabase,
  targetId: string
): Promise<HistoryTarget | undefined> {
  const [deleted] = await database
    .delete(historyTargets)
    .where(eq(historyTargets.id, targetId))
    .returning({
      id: historyTargets.id,
      range: historyTargets.range,
      telegramChatId: historyTargets.telegramChatId,
      templateId: historyTargets.templateId
    });

  if (deleted === undefined) {
    return undefined;
  }

  return {
    chatId: deleted.telegramChatId,
    id: deleted.id,
    range: canonicalizeHistoryRange(deleted.range as HistoryRange),
    ...(deleted.templateId === null ? {} : { templateId: deleted.templateId })
  };
}

export async function upsertHistoryTargets(
  database: AppDatabase,
  targets: HistoryTarget[]
): Promise<void> {
  for (const target of targets) {
    await upsertHistoryTarget(database, target);
  }
}
