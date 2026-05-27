import {
  telegramWireDate,
  telegramWireIdNumber,
  type TelegramWireMessage
} from '../telegramWire.js';

export function parseTelegramChatId(value: string): number {
  const text = requireString(value, 'telegram.history.fetch_page requires chatId');
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Telegram chat id must be numeric: ${text}`);
  }
  return parsed;
}

export function parseOptionalMessageId(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function optionalTelegramMessageId(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error(`Telegram message id must be numeric: ${String(value)}`);
  }
  return value;
}

export function requireDate(value: unknown, message: string): Date {
  const text = requireString(value, message);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new Error(message);
  }
  return date;
}

export function parseLimit(value: unknown, fallback: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    return fallback;
  }

  return Math.min(value, max);
}

export function tdMessageId(message: TelegramWireMessage | undefined): number | undefined {
  return telegramWireIdNumber(message?.id);
}

export function tdMessageDate(message: TelegramWireMessage | undefined): Date | undefined {
  return telegramWireDate(message?.date);
}

export function isBeforeInterval(message: TelegramWireMessage, startAt: Date): boolean {
  const messageDate = tdMessageDate(message);
  return messageDate !== undefined && messageDate < startAt;
}

export function oldestMessageDate(messages: TelegramWireMessage[]): Date | undefined {
  const dates = messages.map(tdMessageDate).filter((date): date is Date => date !== undefined);
  const [first, ...rest] = dates;
  return first === undefined
    ? undefined
    : rest.reduce((oldest, date) => (date < oldest ? date : oldest), first);
}

export function oldestMessageIdOlderThan(
  messages: TelegramWireMessage[],
  cursorMessageId: number
): number | undefined {
  const ids = messages
    .map(tdMessageId)
    .filter((id): id is number => id !== undefined && id < cursorMessageId);

  return ids.length === 0 ? undefined : Math.min(...ids);
}

function requireString(value: unknown, message: string): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  throw new Error(message);
}
