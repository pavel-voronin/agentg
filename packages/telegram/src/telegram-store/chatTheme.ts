import type { JsonValue } from '@agentg/events/json';

import type { TelegramDatabase } from '../database.js';
import { telegramFiles, telegramUpgradedGifts } from '../schema.js';
import {
  telegramWireJsonObject,
  telegramWireJsonValue,
  type TelegramWireFile,
  type TelegramWireUpdateByType
} from '../telegramWire.js';
import { storeTelegramBackground } from './chatBackground.js';
import { upsertTelegramChatFragment } from './chat.js';

type TelegramWireChatThemeUpdate = TelegramWireUpdateByType<'updateChatTheme'>;
type TelegramWireChatTheme = NonNullable<TelegramWireChatThemeUpdate['theme']>;
type TelegramWireChatThemeGift = Extract<TelegramWireChatTheme, { _: 'chatThemeGift' }>;
type TelegramWireGiftChatTheme = TelegramWireChatThemeGift['gift_theme'];
type TelegramWireThemeSettings = TelegramWireGiftChatTheme['light_settings'];
type TelegramWireUpgradedGift = TelegramWireGiftChatTheme['gift'];
type TelegramWireBackground = NonNullable<TelegramWireThemeSettings['background']>;
type TelegramWireSticker = TelegramWireUpgradedGift['model']['sticker'];

export async function storeChatTheme(
  database: TelegramDatabase,
  chatId: string,
  theme: TelegramWireChatTheme | null
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
  database: TelegramDatabase,
  giftTheme: TelegramWireGiftChatTheme
): Promise<void> {
  await storeUpgradedGiftFiles(database, giftTheme.gift);
  await storeUpgradedGift(database, giftTheme.gift);
  await storeThemeSettingsBackground(database, giftTheme.light_settings);
  await storeThemeSettingsBackground(database, giftTheme.dark_settings);
}

async function storeThemeSettingsBackground(
  database: TelegramDatabase,
  settings: TelegramWireThemeSettings
): Promise<void> {
  const background = settings.background ?? null;
  if (background === null) {
    return;
  }

  await storeTelegramBackground(database, background);
}

async function storeUpgradedGift(
  database: TelegramDatabase,
  gift: TelegramWireUpgradedGift
): Promise<void> {
  const row: typeof telegramUpgradedGifts.$inferInsert = {
    backdrop: telegramWireJsonObject(gift.backdrop),
    canSendPurchaseOffer: gift.can_send_purchase_offer,
    colors: telegramWireJsonValue(gift.colors ?? null) ?? null,
    craftProbabilityPerMille: gift.craft_probability_per_mille,
    giftAddress: nullableEmptyString(gift.gift_address),
    hostId: telegramWireJsonValue(gift.host_id ?? null) ?? null,
    id: gift.id,
    isBurned: gift.is_burned,
    isCrafted: gift.is_crafted,
    isPremium: gift.is_premium,
    isThemeAvailable: gift.is_theme_available,
    maxUpgradedCount: gift.max_upgraded_count,
    model: telegramWireJsonObject(gift.model),
    name: gift.name,
    number: gift.number,
    originalDetails: telegramWireJsonValue(gift.original_details ?? null) ?? null,
    ownerAddress: nullableEmptyString(gift.owner_address),
    ownerId: telegramWireJsonValue(gift.owner_id ?? null) ?? null,
    ownerName: gift.owner_name,
    publisherChatId: nullableZeroId(gift.publisher_chat_id),
    regularGiftId: gift.regular_gift_id,
    resaleParameters: telegramWireJsonValue(gift.resale_parameters ?? null) ?? null,
    symbol: telegramWireJsonObject(gift.symbol),
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

async function storeUpgradedGiftFiles(
  database: TelegramDatabase,
  gift: TelegramWireUpgradedGift
): Promise<void> {
  const storedFileIds = new Set<number>();

  for (const file of upgradedGiftFiles(gift)) {
    if (storedFileIds.has(file.id)) {
      continue;
    }
    storedFileIds.add(file.id);
    await storeFile(database, file);
  }
}

async function storeFile(database: TelegramDatabase, file: TelegramWireFile): Promise<void> {
  const row: typeof telegramFiles.$inferInsert = {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: telegramWireJsonObject(file.local),
    remote: telegramWireJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };

  await database.insert(telegramFiles).values(row).onConflictDoUpdate({
    set: row,
    target: telegramFiles.id
  });
}

function chatThemeValue(theme: TelegramWireChatTheme | null): JsonValue {
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

function giftChatThemeValue(giftTheme: TelegramWireGiftChatTheme): JsonValue {
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

function themeSettingsValue(settings: TelegramWireThemeSettings): JsonValue {
  return {
    _: 'themeSettings',
    accent_color: settings.accent_color,
    animate_outgoing_message_fill: settings.animate_outgoing_message_fill,
    background: backgroundReferenceValue(settings.background ?? null),
    base_theme: telegramWireJsonObject(settings.base_theme),
    outgoing_message_accent_color: settings.outgoing_message_accent_color,
    outgoing_message_fill: telegramWireJsonValue(settings.outgoing_message_fill ?? null) ?? null
  };
}

function backgroundReferenceValue(background: TelegramWireBackground | null): JsonValue {
  if (background === null) {
    return null;
  }

  return {
    _: 'background',
    id: background.id
  };
}

function* upgradedGiftFiles(gift: TelegramWireUpgradedGift): Generator<TelegramWireFile> {
  yield* stickerFiles(gift.model.sticker);
  yield* stickerFiles(gift.symbol.sticker);
}

function* stickerFiles(sticker: TelegramWireSticker): Generator<TelegramWireFile> {
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
