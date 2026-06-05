import { describe, expect, it } from 'vitest';

import {
  chatIdFromClientRouteSegments,
  clientRouteSegmentsForChat,
  tabSegmentFromClientRouteSegments
} from './clientRoute.js';

describe('Telegram client route', () => {
  it('maps route segments to the selected chat id', () => {
    expect(chatIdFromClientRouteSegments(['chats', '-100123'])).toBe('-100123');
    expect(chatIdFromClientRouteSegments(['chats', '-100123', 'history'])).toBe('-100123');
    expect(chatIdFromClientRouteSegments(['chats', '  '])).toBeNull();
    expect(chatIdFromClientRouteSegments(['folders', '7'])).toBeNull();
  });

  it('maps route segments to the selected client tab segment', () => {
    expect(tabSegmentFromClientRouteSegments(['chats', '-100123', 'history'])).toBe('history');
    expect(tabSegmentFromClientRouteSegments(['chats', '-100123', '  '])).toBeNull();
    expect(tabSegmentFromClientRouteSegments(['folders', '7', 'history'])).toBeNull();
  });

  it('maps selected chat ids to route segments', () => {
    expect(clientRouteSegmentsForChat('-100123')).toEqual(['chats', '-100123']);
    expect(clientRouteSegmentsForChat('-100123', null, ['thread', '42'])).toEqual([
      'chats',
      '-100123',
      'thread',
      '42'
    ]);
    expect(clientRouteSegmentsForChat('-100123', 'history')).toEqual([
      'chats',
      '-100123',
      'history'
    ]);
    expect(clientRouteSegmentsForChat('-100123', 'history', ['messages', '42'])).toEqual([
      'chats',
      '-100123',
      'history',
      'messages',
      '42'
    ]);
    expect(clientRouteSegmentsForChat('')).toEqual([]);
    expect(clientRouteSegmentsForChat(null)).toEqual([]);
  });
});
