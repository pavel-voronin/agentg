import type { JsonValue } from '@agentg/framework';

import type { Database } from '../database/client.js';
import { telegramFiles, telegramUpgradedGifts } from '../database/schema.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../tdlib/value.js';
import type { file as File } from 'tdlib-types';
import { storeTelegramBackground } from './chatBackground.js';
import { upsertTelegramChatFragment } from './chat.js';

type ChatThemeUpdate = UpdateByType<'updateChatTheme'>;
type ChatTheme = NonNullable<ChatThemeUpdate['theme']>;
type ChatThemeGift = Extract<ChatTheme, { _: 'chatThemeGift' }>;
type GiftChatTheme = ChatThemeGift['gift_theme'];
type ThemeSettings = GiftChatTheme['light_settings'];
type UpgradedGift = GiftChatTheme['gift'];
type Background = NonNullable<ThemeSettings['background']>;
type Sticker = UpgradedGift['model']['sticker'];

export async function storeChatTheme(
  database: Database,
  chatId: string,
  theme: ChatTheme | null
): Promise<void> {
  await database.transaction(async (transaction) => {
    if (theme?._ === 'chatThemeGift') {
      await storeGiftChatThemeAssets(transaction, theme.gift_theme);
    }

    await upsertTelegramChatFragment(transaction, {
      id: chatId,
      theme: chatThemeValue(theme)
    });
  });
}

async function storeGiftChatThemeAssets(
  database: Database,
  giftTheme: GiftChatTheme
): Promise<void> {
  await storeUpgradedGiftFiles(database, giftTheme.gift);
  await storeUpgradedGift(database, giftTheme.gift);
  await storeThemeSettingsBackground(database, giftTheme.light_settings);
  await storeThemeSettingsBackground(database, giftTheme.dark_settings);
}

async function storeThemeSettingsBackground(
  database: Database,
  settings: ThemeSettings
): Promise<void> {
  const background = settings.background ?? null;
  if (background === null) {
    return;
  }

  await storeTelegramBackground(database, background);
}

async function storeUpgradedGift(database: Database, gift: UpgradedGift): Promise<void> {
  const row: typeof telegramUpgradedGifts.$inferInsert = {
    backdrop: tdJsonObject(gift.backdrop),
    canSendPurchaseOffer: gift.can_send_purchase_offer,
    colors: tdJsonValue(gift.colors ?? null) ?? null,
    craftProbabilityPerMille: gift.craft_probability_per_mille,
    giftAddress: nullableEmptyString(gift.gift_address),
    hostId: tdJsonValue(gift.host_id ?? null) ?? null,
    id: gift.id,
    isBurned: gift.is_burned,
    isCrafted: gift.is_crafted,
    isPremium: gift.is_premium,
    isThemeAvailable: gift.is_theme_available,
    maxUpgradedCount: gift.max_upgraded_count,
    model: tdJsonObject(gift.model),
    name: gift.name,
    number: gift.number,
    originalDetails: tdJsonValue(gift.original_details ?? null) ?? null,
    ownerAddress: nullableEmptyString(gift.owner_address),
    ownerId: tdJsonValue(gift.owner_id ?? null) ?? null,
    ownerName: gift.owner_name,
    publisherChatId: nullableZeroId(gift.publisher_chat_id),
    regularGiftId: gift.regular_gift_id,
    resaleParameters: tdJsonValue(gift.resale_parameters ?? null) ?? null,
    symbol: tdJsonObject(gift.symbol),
    title: gift.title,
    totalUpgradedCount: gift.total_upgraded_count,
    usedThemeChatId: nullableZeroId(gift.used_theme_chat_id),
    valueAmount: String(gift.value_amount),
    valueCurrency: gift.value_currency,
    valueUsdAmount: String(gift.value_usd_amount)
  };

  await database.insert(telegramUpgradedGifts).values(row).onConflictDoUpdate({
    set: row,
    target: telegramUpgradedGifts.id
  });
}

async function storeUpgradedGiftFiles(database: Database, gift: UpgradedGift): Promise<void> {
  const storedFileIds = new Set<number>();

  for (const file of upgradedGiftFiles(gift)) {
    if (storedFileIds.has(file.id)) {
      continue;
    }
    storedFileIds.add(file.id);
    await storeFile(database, file);
  }
}

async function storeFile(database: Database, file: File): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: tdJsonObject(file.local),
    remote: tdJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function chatThemeValue(theme: ChatTheme | null): JsonValue {
  if (theme === null) {
    return null;
  }

  if (theme._ === 'chatThemeEmoji') {
    return {
      _: 'chatThemeEmoji',
      name: theme.name
    };
  }

  return {
    _: 'chatThemeGift',
    gift_theme: giftChatThemeValue(theme.gift_theme)
  };
}

function giftChatThemeValue(giftTheme: GiftChatTheme): JsonValue {
  return {
    _: 'giftChatTheme',
    dark_settings: themeSettingsValue(giftTheme.dark_settings),
    gift: {
      _: 'upgradedGift',
      id: giftTheme.gift.id
    },
    light_settings: themeSettingsValue(giftTheme.light_settings)
  };
}

function themeSettingsValue(settings: ThemeSettings): JsonValue {
  return {
    _: 'themeSettings',
    accent_color: settings.accent_color,
    animate_outgoing_message_fill: settings.animate_outgoing_message_fill,
    background: backgroundReferenceValue(settings.background ?? null),
    base_theme: tdJsonObject(settings.base_theme),
    outgoing_message_accent_color: settings.outgoing_message_accent_color,
    outgoing_message_fill: tdJsonValue(settings.outgoing_message_fill ?? null) ?? null
  };
}

function backgroundReferenceValue(background: Background | null): JsonValue {
  if (background === null) {
    return null;
  }

  return {
    _: 'background',
    id: background.id
  };
}

function* upgradedGiftFiles(gift: UpgradedGift): Generator<File> {
  yield* stickerFiles(gift.model.sticker);
  yield* stickerFiles(gift.symbol.sticker);
}

function* stickerFiles(sticker: Sticker): Generator<File> {
  yield sticker.sticker;

  const thumbnail = sticker.thumbnail ?? null;
  if (thumbnail !== null) {
    yield thumbnail.file;
  }
}

function nullableZeroId(value: number | string): string | null {
  const id = String(value);
  return id === '0' ? null : id;
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}

function nullableEmptyString(value: string): string | null {
  return value.length === 0 ? null : value;
}
