export type ClientMode = 'client' | 'live';

const LIVE_ROUTE_SEGMENT = 'live';
const CHAT_ROUTE_SEGMENT = 'chats';
export const CLIENT_CHAT_ROUTE_PREFIX_LENGTH = 2;

export function clientModeFromRouteSegments(segments: readonly string[]): ClientMode | null {
  const [mode] = segments;
  if (mode === LIVE_ROUTE_SEGMENT) {
    return 'live';
  }
  if (mode === undefined || mode === CHAT_ROUTE_SEGMENT) {
    return 'client';
  }
  return null;
}

export function clientRouteSegmentsForMode(mode: ClientMode): string[] {
  return mode === 'live' ? [LIVE_ROUTE_SEGMENT] : [];
}

export function clientRouteSegmentsForLive(): string[] {
  return clientRouteSegmentsForMode('live');
}

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
  return nonEmptySegment(segments[CLIENT_CHAT_ROUTE_PREFIX_LENGTH]);
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

export function clientPathForChat(chatId: string): string {
  return `/client/${clientRouteSegmentsForChat(chatId).map(encodeURIComponent).join('/')}`;
}

function nonEmptySegment(value: string | undefined | null): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length > 0 ? normalized : null;
}
