import type { JsonValue } from '@agentg/framework';

import type { MessageTextEntity } from '../domain/models/message.js';

export function extractFormattedTextLinkEntities(value: unknown): MessageTextEntity[] {
  const formattedText = recordValue(value);
  const text = typeof formattedText?.text === 'string' ? formattedText.text : '';
  const sourceEntities = Array.isArray(formattedText?.entities) ? formattedText.entities : [];
  const entities = sourceEntities
    .map((entity) => textLinkEntity(entity, text))
    .filter((entity): entity is MessageTextEntity => entity !== undefined)
    .sort(compareTextEntities);

  const result: MessageTextEntity[] = [];
  let consumedUntil = 0;
  for (const entity of entities) {
    if (entity.offset < consumedUntil) {
      continue;
    }
    result.push(entity);
    consumedUntil = entity.offset + entity.length;
  }
  return result;
}

export function messageTextEntitiesFromJson(
  text: string | null,
  entities: JsonValue | null | undefined
): MessageTextEntity[] {
  if (text === null) {
    return [];
  }
  return extractFormattedTextLinkEntities({
    entities: Array.isArray(entities) ? entities : [],
    text
  });
}

function textLinkEntity(value: unknown, text: string): MessageTextEntity | undefined {
  const entity = recordValue(value);
  const type = recordValue(entity?.type);
  const offset = safeInteger(entity?.offset);
  const length = safeInteger(entity?.length);
  if (
    offset === undefined ||
    length === undefined ||
    length <= 0 ||
    offset < 0 ||
    offset + length > text.length
  ) {
    return undefined;
  }

  if (type?._ === 'textEntityTypeUrl') {
    const url = normalizeHttpUrl(text.slice(offset, offset + length), true);
    return url === null ? undefined : { kind: 'url', length, offset, url };
  }

  if (type?._ === 'textEntityTypeTextUrl') {
    const url = normalizeHttpUrl(type.url, false);
    return url === null ? undefined : { kind: 'textUrl', length, offset, url };
  }

  return undefined;
}

function normalizeHttpUrl(value: unknown, allowMissingProtocol: boolean): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const directUrl = parseHttpUrl(trimmed);
  if (directUrl !== null || !allowMissingProtocol) {
    return directUrl;
  }
  return parseHttpUrl(`https://${trimmed}`);
}

function parseHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compareTextEntities(left: MessageTextEntity, right: MessageTextEntity): number {
  if (left.offset !== right.offset) {
    return left.offset - right.offset;
  }
  return right.length - left.length;
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
