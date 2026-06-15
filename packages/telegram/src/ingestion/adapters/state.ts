import type { JsonValue } from '@agentg/framework';

import type {
  ChatActiveStoriesSavedChange,
  ChatBoostSavedChange,
  ChatRevenueAmountSavedChange,
  ContactCloseBirthdaysReplacedChange,
  DomainChange,
  FileGenerationRequestSavedChange,
  TextCompositionStylesReplacedChange
} from '../../domain/changes.js';
import type {
  ChatActiveStories,
  ChatBoost,
  ChatRevenueAmount,
  ContactCloseBirthday,
  FileGenerationRequest,
  TextCompositionStyle
} from '../../domain/models/state.js';
import { tdJsonObject, tdJsonValue, type UpdateByType } from '../../tdlib/shape.js';

type ContactCloseBirthdaysUpdate = UpdateByType<'updateContactCloseBirthdays'>;
type CloseBirthdayUser = ContactCloseBirthdaysUpdate['close_birthday_users'][number];
type TextCompositionStylesUpdate = UpdateByType<'updateTextCompositionStyles'>;
type ChatRevenueAmountUpdate = UpdateByType<'updateChatRevenueAmount'>;
type FileGenerationStartUpdate = UpdateByType<'updateFileGenerationStart'>;
type ChatBoostUpdate = UpdateByType<'updateChatBoost'>;
type ChatActiveStoriesUpdate = UpdateByType<'updateChatActiveStories'>;
type TdlibChatActiveStories = ChatActiveStoriesUpdate['active_stories'];

type TextCompositionStyleRuntimeObject = Record<string, unknown> & {
  readonly creator_user_id?: unknown;
  readonly custom_emoji_id?: unknown;
  readonly english_example?: unknown;
  readonly install_count?: unknown;
  readonly is_creator?: unknown;
  readonly is_custom?: unknown;
  readonly name?: unknown;
  readonly prompt?: unknown;
  readonly title?: unknown;
};

export function contactCloseBirthdaysChanges(update: ContactCloseBirthdaysUpdate): DomainChange[] {
  return [
    {
      kind: 'contactCloseBirthdays.replaced',
      records: update.close_birthday_users.map(contactCloseBirthdayRecord)
    } satisfies ContactCloseBirthdaysReplacedChange
  ];
}

export function textCompositionStylesChanges(update: TextCompositionStylesUpdate): DomainChange[] {
  return [
    {
      kind: 'textCompositionStyles.replaced',
      records: update.styles.map(textCompositionStyleRecord)
    } satisfies TextCompositionStylesReplacedChange
  ];
}

export function chatRevenueAmountChanges(update: ChatRevenueAmountUpdate): DomainChange[] {
  return [
    {
      kind: 'chatRevenueAmount.saved',
      record: chatRevenueAmountRecord(update)
    } satisfies ChatRevenueAmountSavedChange
  ];
}

export function fileGenerationRequestChanges(update: FileGenerationStartUpdate): DomainChange[] {
  return [
    {
      kind: 'fileGenerationRequest.saved',
      record: fileGenerationRequestRecord(update)
    } satisfies FileGenerationRequestSavedChange
  ];
}

export function fileGenerationRequestRecord(
  update: FileGenerationStartUpdate
): FileGenerationRequest {
  return {
    conversion: update.conversion,
    destinationPath: update.destination_path,
    generationId: update.generation_id,
    originalPath: update.original_path
  };
}

export function chatBoostChanges(update: ChatBoostUpdate): DomainChange[] {
  return [
    {
      kind: 'chatBoost.saved',
      record: chatBoostRecord(update)
    } satisfies ChatBoostSavedChange
  ];
}

export function chatActiveStoriesChanges(update: ChatActiveStoriesUpdate): DomainChange[] {
  return [
    {
      kind: 'chatActiveStories.saved',
      record: chatActiveStoriesRecord(update.active_stories)
    } satisfies ChatActiveStoriesSavedChange
  ];
}

function contactCloseBirthdayRecord(user: CloseBirthdayUser): ContactCloseBirthday {
  return {
    birthdate: tdJsonObject(user.birthdate),
    userId: String(user.user_id)
  };
}

function textCompositionStyleRecord(style: unknown): TextCompositionStyle {
  const record = textCompositionStyleRuntimeRecord(style);
  return {
    creatorUserId: nullableIdField(record, 'creator_user_id'),
    customEmojiId: nullableIdField(record, 'custom_emoji_id'),
    englishExample: nullableJsonField(record, 'english_example'),
    installCount: nullableIntegerField(record, 'install_count'),
    isCreator: booleanFlagField(record, 'is_creator'),
    isCustom: booleanFlagField(record, 'is_custom'),
    name: requiredStringField(record, 'name'),
    prompt: nullableStringField(record, 'prompt'),
    title: requiredStringField(record, 'title')
  };
}

function chatRevenueAmountRecord(update: ChatRevenueAmountUpdate): ChatRevenueAmount {
  const amount = update.revenue_amount;
  return {
    availableAmount: amount.available_amount,
    balanceAmount: amount.balance_amount,
    chatId: String(update.chat_id),
    cryptocurrency: amount.cryptocurrency,
    totalAmount: amount.total_amount,
    withdrawalEnabled: amount.withdrawal_enabled
  };
}

function chatBoostRecord(update: ChatBoostUpdate): ChatBoost {
  const boost = update.boost;
  return {
    chatId: String(update.chat_id),
    count: boost.count,
    expirationDate: unixDate(boost.expiration_date),
    id: boost.id,
    source: tdJsonObject(boost.source),
    startDate: unixDate(boost.start_date)
  };
}

function chatActiveStoriesRecord(activeStories: TdlibChatActiveStories): ChatActiveStories {
  return {
    canBeArchived: activeStories.can_be_archived,
    chatId: String(activeStories.chat_id),
    list: nullableJsonValue(activeStories.list),
    maxReadStoryId: activeStories.max_read_story_id,
    order: String(activeStories.order),
    stories: requiredJsonValue(activeStories.stories)
  };
}

function textCompositionStyleRuntimeRecord(style: unknown): TextCompositionStyleRuntimeObject {
  if (typeof style !== 'object' || style === null || Array.isArray(style)) {
    throw new Error('Expected textCompositionStyle runtime object');
  }

  return style as TextCompositionStyleRuntimeObject;
}

function requiredStringField(record: TextCompositionStyleRuntimeObject, field: string): string {
  const value = record[field];
  if (typeof value !== 'string') {
    throw new Error(`Expected textCompositionStyle.${field} to be a string`);
  }
  return value;
}

function nullableStringField(
  record: TextCompositionStyleRuntimeObject,
  field: string
): string | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected textCompositionStyle.${field} to be a string or null`);
  }
  return value;
}

function booleanFlagField(record: TextCompositionStyleRuntimeObject, field: string): boolean {
  const value = record[field];
  if (value === undefined || value === null || value === false || value === 0 || value === '0') {
    return false;
  }
  if (value === true || value === 1 || value === '1') {
    return true;
  }
  throw new Error(`Expected textCompositionStyle.${field} to be a boolean flag`);
}

function nullableIntegerField(
  record: TextCompositionStyleRuntimeObject,
  field: string
): number | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Expected textCompositionStyle.${field} to be an integer or null`);
  }
  return value;
}

function nullableIdField(record: TextCompositionStyleRuntimeObject, field: string): string | null {
  const value = record[field];
  if (value === undefined || value === null || value === 0 || value === '0') {
    return null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`Expected textCompositionStyle.${field} to be an ID or null`);
  }
  return String(value);
}

function nullableJsonField(
  record: TextCompositionStyleRuntimeObject,
  field: string
): JsonValue | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  return tdJsonValue(value) ?? null;
}

function unixDate(value: number): Date {
  return new Date(value * 1000);
}

function nullableJsonValue(value: unknown): JsonValue {
  return tdJsonValue(value ?? null) ?? null;
}

function requiredJsonValue(value: unknown): JsonValue {
  const json = tdJsonValue(value);
  if (json === undefined) {
    throw new Error('Expected Telegram wire JSON value');
  }
  return json;
}
