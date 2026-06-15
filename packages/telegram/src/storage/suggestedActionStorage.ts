import { inArray } from 'drizzle-orm';

import type { Database } from '../database/client.js';
import { telegramSuggestedActions } from '../database/schema.js';
import type { SuggestedAction } from '../domain/models/suggestedAction.js';

export async function applySuggestedActionDeltaRecords(
  database: Database,
  input: {
    addedActions: readonly SuggestedAction[];
    removedActionKeys: readonly string[];
  }
): Promise<void> {
  const removedActionKeys = [...new Set(input.removedActionKeys)];
  await database.transaction(async (transaction) => {
    if (removedActionKeys.length > 0) {
      await transaction
        .delete(telegramSuggestedActions)
        .where(inArray(telegramSuggestedActions.actionKey, removedActionKeys));
    }

    for (const action of input.addedActions) {
      await transaction.insert(telegramSuggestedActions).values(action).onConflictDoUpdate({
        set: action,
        target: telegramSuggestedActions.actionKey
      });
    }
  });
}
