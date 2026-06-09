import { describe, expect, it } from 'vitest';

import { slotRoute } from '../src/dashboard/slotRoute.js';

describe('slot route', () => {
  it('reads route segments from slot context', () => {
    const route = slotRoute({
      routeSegments: ['database', 'samples']
    });

    expect(route.segments).toEqual(['database', 'samples']);
    expect(route.segment(0)).toBe('database');
    expect(route.segment(1)).toBe('samples');
    expect(route.segment(2)).toBeNull();
    expect(route.rest(1)).toEqual(['samples']);
  });

  it('ignores invalid route segment context values', () => {
    const route = slotRoute({
      routeSegments: ['database', 7]
    });

    expect(route.segments).toEqual([]);
  });

  it('replaces the current route segments through the slot context setter', () => {
    const written: string[][] = [];
    const route = slotRoute({
      routeSegments: ['database'],
      setRouteSegments: (segments: readonly string[]) => written.push([...segments])
    });

    route.replace(['rpc', 'samples']);

    expect(written).toEqual([['rpc', 'samples']]);
  });

  it('passes child route segments while preserving the parent prefix on writes', () => {
    const written: string[][] = [];
    const route = slotRoute({
      selectedChatId: '-100123',
      routeSegments: ['chats', '-100123', 'history'],
      setRouteSegments: (segments: readonly string[]) => written.push([...segments])
    });

    const child = route.child(2);

    expect(child.segments).toEqual(['history']);
    expect(child.context.selectedChatId).toBe('-100123');

    child.replace(['media', 'photos']);

    expect(written).toEqual([['chats', '-100123', 'media', 'photos']]);
  });
});
