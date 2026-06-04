import { describe, expect, it } from 'vitest';

import { pathForRoute, routeFromPathname } from '../src/stores/shellRoute.js';

describe('shell route', () => {
  it('parses top-level page routes', () => {
    expect(routeFromPathname('/')).toEqual({
      pageSegment: 'home',
      segments: []
    });
    expect(routeFromPathname('/client')).toEqual({
      pageSegment: 'client',
      segments: []
    });
    expect(routeFromPathname('/reports')).toEqual({
      pageSegment: 'reports',
      segments: []
    });
  });

  it('keeps page-owned route segments', () => {
    expect(routeFromPathname('/client/chats/-100123')).toEqual({
      pageSegment: 'client',
      segments: ['chats', '-100123']
    });
    expect(routeFromPathname('/reports/latency')).toEqual({
      pageSegment: 'reports',
      segments: ['latency']
    });
    expect(routeFromPathname('/reports/storage')).toEqual({
      pageSegment: 'reports',
      segments: ['storage']
    });
  });

  it('serializes canonical route paths', () => {
    expect(pathForRoute({ pageSegment: 'home', segments: [] })).toBe('/');
    expect(pathForRoute({ pageSegment: 'client', segments: ['chats', 'chat/alpha'] })).toBe(
      '/client/chats/chat%2Falpha'
    );
    expect(pathForRoute({ pageSegment: 'reports', segments: [] })).toBe('/reports');
    expect(pathForRoute({ pageSegment: 'reports', segments: ['slowest'] })).toBe(
      '/reports/slowest'
    );
    expect(pathForRoute({ pageSegment: 'reports', segments: ['storage'] })).toBe(
      '/reports/storage'
    );
  });

  it('uses the configured default page for root paths', () => {
    expect(routeFromPathname('/', 'dashboard')).toEqual({
      pageSegment: 'dashboard',
      segments: []
    });
    expect(pathForRoute({ pageSegment: 'dashboard', segments: [] }, 'dashboard')).toBe('/');
  });

  it('treats unknown page segments as contributed page routes', () => {
    expect(routeFromPathname('/unknown')).toEqual({
      pageSegment: 'unknown',
      segments: []
    });
  });
});
