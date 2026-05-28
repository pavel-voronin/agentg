import { and, eq, sql } from 'drizzle-orm';

import { telegramLanguagePackStrings } from '../../schema.js';
import type { TelegramUpdateHandlerContext } from '../update-runtime/context.js';
import { telegramWireJsonValue, type TelegramWireUpdateByType } from '../wire.js';

type TelegramWireLanguagePackStringsUpdate = TelegramWireUpdateByType<'updateLanguagePackStrings'>;

export async function handleUpdateLanguagePackStrings(
  { database }: TelegramUpdateHandlerContext,
  update: TelegramWireLanguagePackStringsUpdate
): Promise<void> {
  if (update.strings.length === 0) {
    await database
      .delete(telegramLanguagePackStrings)
      .where(
        and(
          eq(telegramLanguagePackStrings.localizationTarget, update.localization_target),
          eq(telegramLanguagePackStrings.languagePackId, update.language_pack_id)
        )
      );
    return;
  }

  const rows = update.strings.map((string): typeof telegramLanguagePackStrings.$inferInsert => ({
    key: string.key,
    languagePackId: update.language_pack_id,
    localizationTarget: update.localization_target,
    value: telegramWireJsonValue(string.value)
  }));

  await database
    .insert(telegramLanguagePackStrings)
    .values(rows)
    .onConflictDoUpdate({
      set: {
        value: sql`excluded.value`
      },
      target: [
        telegramLanguagePackStrings.localizationTarget,
        telegramLanguagePackStrings.languagePackId,
        telegramLanguagePackStrings.key
      ]
    });
}
