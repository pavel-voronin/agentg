import type { JsonValue } from '@agentg/framework';
import type { background as TdlibBackground, file as TdlibFile } from 'tdlib-types';

import type {
  ChatBackgroundSavedChange,
  ChatThemeSavedChange,
  DefaultBackgroundSelectionSavedChange,
  DomainChange,
  EmojiChatThemesSavedChange
} from '../../domain/changes.js';
import type { Background } from '../../domain/models/background.js';
import type { FileState } from '../../domain/models/fileState.js';
import type { UpgradedGift } from '../../domain/models/gift.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';
import { fileStateFromTdlibFile } from './fileState.js';

export const TELEGRAM_EMOJI_CHAT_THEMES_KV_KEY = 'emoji_chat_themes';

type ChatBackgroundUpdate = UpdateByType<'updateChatBackground'>;
type ChatBackground = NonNullable<ChatBackgroundUpdate['background']>;
type ChatThemeUpdate = UpdateByType<'updateChatTheme'>;
type ChatTheme = NonNullable<ChatThemeUpdate['theme']>;
type ChatThemeGift = Extract<ChatTheme, { _: 'chatThemeGift' }>;
type DefaultBackgroundUpdate = UpdateByType<'updateDefaultBackground'>;
type EmojiChatTheme = UpdateByType<'updateEmojiChatThemes'>['chat_themes'][number];
type EmojiChatThemesUpdate = UpdateByType<'updateEmojiChatThemes'>;
type GiftChatTheme = ChatThemeGift['gift_theme'];
type ThemeSettings = GiftChatTheme['light_settings'];
type TdlibUpgradedGift = GiftChatTheme['gift'];
type Sticker = TdlibUpgradedGift['model']['sticker'];

export function chatBackgroundChanges(update: ChatBackgroundUpdate): DomainChange[] {
  const background = update.background ?? null;
  return [
    {
      kind: 'chatBackground.saved',
      input: {
        background:
          background === null ? null : backgroundRecordFromTdlibBackground(background.background),
        chat: {
          background: chatBackgroundReferenceValue(background),
          id: String(update.chat_id)
        },
        files:
          background === null ? [] : backgroundFileStatesFromTdlibBackground(background.background)
      }
    } satisfies ChatBackgroundSavedChange
  ];
}

export function defaultBackgroundSelectionChanges(update: DefaultBackgroundUpdate): DomainChange[] {
  const background = update.background ?? null;
  const key = defaultBackgroundKvKey(update.for_dark_theme);
  return [
    {
      kind: 'defaultBackgroundSelection.saved',
      input: {
        background: background === null ? null : backgroundRecordFromTdlibBackground(background),
        files: background === null ? [] : backgroundFileStatesFromTdlibBackground(background),
        key,
        value: background === null ? null : { background_id: background.id }
      }
    } satisfies DefaultBackgroundSelectionSavedChange
  ];
}

export function emojiChatThemesChanges(update: EmojiChatThemesUpdate): DomainChange[] {
  const backgrounds = uniqueBackgrounds([...themeBackgrounds(update.chat_themes)]);
  return [
    {
      kind: 'emojiChatThemes.saved',
      input: {
        backgrounds: backgrounds.map(backgroundRecordFromTdlibBackground),
        entry: {
          key: TELEGRAM_EMOJI_CHAT_THEMES_KV_KEY,
          value: requiredJsonValue(update.chat_themes)
        },
        files: uniqueFileStates(backgrounds.flatMap(backgroundFileStatesFromTdlibBackground))
      }
    } satisfies EmojiChatThemesSavedChange
  ];
}

export function chatThemeChanges(update: ChatThemeUpdate): DomainChange[] {
  const theme = update.theme ?? null;
  const giftTheme = theme?._ === 'chatThemeGift' ? theme.gift_theme : null;
  const backgrounds =
    giftTheme === null
      ? []
      : uniqueBackgrounds([
          ...themeSettingsBackgrounds(giftTheme.light_settings, giftTheme.dark_settings)
        ]);
  return [
    {
      kind: 'chatTheme.saved',
      input: {
        backgrounds: backgrounds.map(backgroundRecordFromTdlibBackground),
        chat: {
          id: String(update.chat_id),
          theme: chatThemeValue(theme)
        },
        files: giftTheme === null ? [] : upgradedGiftFileStates(giftTheme.gift),
        upgradedGifts: giftTheme === null ? [] : [upgradedGift(giftTheme.gift)]
      }
    } satisfies ChatThemeSavedChange
  ];
}

export function defaultBackgroundKvKey(forDarkTheme: boolean): string {
  return `default_background:${forDarkTheme ? 'dark' : 'light'}`;
}

function backgroundRecordFromTdlibBackground(background: TdlibBackground): Background {
  return {
    document: backgroundDocumentValue(background.document ?? null),
    id: background.id,
    isDark: background.is_dark,
    isDefault: background.is_default,
    name: background.name,
    type: tdJsonObject(background.type)
  };
}

function backgroundFileStatesFromTdlibBackground(background: TdlibBackground): FileState[] {
  return uniqueFileStates([...backgroundFiles(background)].map(fileStateFromTdlibFile));
}

function chatBackgroundReferenceValue(chatBackground: ChatBackground | null): JsonValue {
  if (chatBackground === null) {
    return null;
  }

  return {
    _: 'chatBackground',
    background_id: chatBackground.background.id,
    dark_theme_dimming: chatBackground.dark_theme_dimming
  };
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

function backgroundReferenceValue(background: TdlibBackground | null): JsonValue {
  if (background === null) {
    return null;
  }

  return {
    _: 'background',
    id: background.id
  };
}

function backgroundDocumentValue(
  document: NonNullable<TdlibBackground['document']> | null
): JsonValue | null {
  if (document === null) {
    return null;
  }

  const thumbnail = document.thumbnail ?? null;
  return {
    _: 'document',
    document_file_id: document.document.id,
    file_name: document.file_name,
    mime_type: document.mime_type,
    minithumbnail: tdJsonValue(document.minithumbnail ?? null) ?? null,
    thumbnail: thumbnail === null ? null : thumbnailValue(thumbnail)
  };
}

function thumbnailValue(
  thumbnail: NonNullable<NonNullable<TdlibBackground['document']>['thumbnail']>
): JsonValue {
  return {
    _: 'thumbnail',
    file_id: thumbnail.file.id,
    format: tdJsonObject(thumbnail.format),
    height: thumbnail.height,
    width: thumbnail.width
  };
}

function* backgroundFiles(background: TdlibBackground): Generator<TdlibFile> {
  const document = background.document ?? null;
  if (document === null) {
    return;
  }

  yield document.document;

  const thumbnail = document.thumbnail ?? null;
  if (thumbnail !== null) {
    yield thumbnail.file;
  }
}

function* themeBackgrounds(themes: readonly EmojiChatTheme[]): Generator<TdlibBackground> {
  for (const theme of themes) {
    yield* themeSettingsBackgrounds(theme.light_settings, theme.dark_settings);
  }
}

function* themeSettingsBackgrounds(
  ...settings: readonly ThemeSettings[]
): Generator<TdlibBackground> {
  for (const setting of settings) {
    const background = setting.background ?? null;
    if (background !== null) {
      yield background;
    }
  }
}

function upgradedGift(gift: TdlibUpgradedGift): UpgradedGift {
  return {
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
}

function upgradedGiftFileStates(gift: TdlibUpgradedGift): FileState[] {
  return uniqueFileStates([...upgradedGiftFiles(gift)].map(fileStateFromTdlibFile));
}

function* upgradedGiftFiles(gift: TdlibUpgradedGift): Generator<TdlibFile> {
  yield* stickerFiles(gift.model.sticker);
  yield* stickerFiles(gift.symbol.sticker);
}

function* stickerFiles(sticker: Sticker): Generator<TdlibFile> {
  yield sticker.sticker;

  const thumbnail = sticker.thumbnail ?? null;
  if (thumbnail !== null) {
    yield thumbnail.file;
  }
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}

function nullableZeroId(value: number | string): string | null {
  const id = String(value);
  return id === '0' ? null : id;
}

function nullableEmptyString(value: string): string | null {
  return value.length === 0 ? null : value;
}

function uniqueBackgrounds(backgrounds: readonly TdlibBackground[]): TdlibBackground[] {
  const backgroundsById = new Map<string, TdlibBackground>();
  for (const background of backgrounds) {
    backgroundsById.set(background.id, background);
  }
  return [...backgroundsById.values()];
}

function uniqueFileStates(files: readonly FileState[]): FileState[] {
  const filesById = new Map<number, FileState>();
  for (const file of files) {
    filesById.set(file.id, file);
  }
  return [...filesById.values()];
}
