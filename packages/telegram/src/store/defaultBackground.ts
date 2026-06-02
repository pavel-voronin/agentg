import { eq } from 'drizzle-orm';

import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramKv } from '../database/schema.js';
import { type UpdateByType } from '../tdlib/value.js';
import { storeTelegramBackground } from './chatBackground.js';
import { deleteTelegramKv, upsertTelegramKv } from './kv.js';

type DefaultBackgroundUpdate = UpdateByType<'updateDefaultBackground'>;
type Background = NonNullable<DefaultBackgroundUpdate['background']>;

export type TelegramDefaultBackgroundScope = 'dark' | 'light';

export type TelegramDefaultBackgroundSelection = {
  backgroundId: string | null;
  forDarkTheme: boolean;
  key: string;
  scope: TelegramDefaultBackgroundScope;
};

export function defaultBackgroundKvKey(forDarkTheme: boolean): string {
  return `default_background:${forDarkTheme ? 'dark' : 'light'}`;
}

export function defaultBackgroundScopeFromKey(
  key: string
): { forDarkTheme: boolean; scope: TelegramDefaultBackgroundScope } | null {
  if (key === 'default_background:dark') {
    return {
      forDarkTheme: true,
      scope: 'dark'
    };
  }
  if (key === 'default_background:light') {
    return {
      forDarkTheme: false,
      scope: 'light'
    };
  }
  return null;
}

export async function storeDefaultBackgroundSelection(
  database: Database,
  forDarkTheme: boolean,
  background: Background | null
): Promise<TelegramDefaultBackgroundSelection> {
  const key = defaultBackgroundKvKey(forDarkTheme);
  const scope: TelegramDefaultBackgroundScope = forDarkTheme ? 'dark' : 'light';

  await database.transaction(async (transaction) => {
    if (background === null) {
      await deleteTelegramKv(transaction, key);
      return;
    }

    await storeTelegramBackground(transaction, background);
    await upsertTelegramKv(transaction, key, {
      background_id: background.id
    });
  });

  return {
    backgroundId: background === null ? null : background.id,
    forDarkTheme,
    scope,
    key
  };
}

export async function readDefaultBackgroundSelection(
  database: Database,
  key: string
): Promise<TelegramDefaultBackgroundSelection | null> {
  const scope = defaultBackgroundScopeFromKey(key);
  if (scope === null) {
    return null;
  }

  const [row] = await database
    .select({ value: telegramKv.value })
    .from(telegramKv)
    .where(eq(telegramKv.key, key))
    .limit(1);

  return {
    ...scope,
    backgroundId: backgroundIdFromKvValue(row?.value),
    key
  };
}

function backgroundIdFromKvValue(value: JsonValue | undefined): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const backgroundId = value.background_id;
  return typeof backgroundId === 'number' || typeof backgroundId === 'string'
    ? String(backgroundId)
    : null;
}
