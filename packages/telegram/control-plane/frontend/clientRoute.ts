const CHAT_ROUTE_SEGMENT = 'chats';
const CHAT_ROUTE_PREFIX_LENGTH = 2;

export function chatIdFromClientRouteSegments(segments: readonly string[]): string | null {
  const [kind, chatId] = segments;
  if (kind !== CHAT_ROUTE_SEGMENT || chatId === undefined) {
    return null;
  }
  return nonEmptySegment(chatId);
}

export function tabSegmentFromClientRouteSegments(segments: readonly string[]): string | null {
  if (chatIdFromClientRouteSegments(segments) === null) {
    return null;
  }
  return nonEmptySegment(segments[CHAT_ROUTE_PREFIX_LENGTH]);
}

export function clientRouteSegmentsForChat(
  chatId: string | null,
  tabSegment: string | null = null,
  childSegments: readonly string[] = []
): string[] {
  const normalizedChatId = nonEmptySegment(chatId);
  if (normalizedChatId === null) {
    return [];
  }
  const normalizedTabSegment = nonEmptySegment(tabSegment);
  if (normalizedTabSegment === null) {
    return [CHAT_ROUTE_SEGMENT, normalizedChatId, ...childSegments];
  }
  return [CHAT_ROUTE_SEGMENT, normalizedChatId, normalizedTabSegment, ...childSegments];
}

function nonEmptySegment(value: string | undefined | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}
