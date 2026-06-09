import { describe, expect, it } from 'vitest';

import {
  telemetryRouteSegments,
  telemetryTabFromSegment
} from '../control-plane/frontend/telemetry/route.js';

describe('telemetry route', () => {
  it('uses operations for the empty telemetry route', () => {
    expect(telemetryTabFromSegment(null)).toBe('operations');
    expect(telemetryRouteSegments('operations')).toEqual([]);
  });

  it('maps known tab segments to tab ids', () => {
    expect(telemetryTabFromSegment('operations')).toBe('operations');
    expect(telemetryTabFromSegment('telegram')).toBe('telegram');
    expect(telemetryTabFromSegment('files')).toBe('files');
    expect(telemetryTabFromSegment('history-sync')).toBe('history-sync');
    expect(telemetryTabFromSegment('updates')).toBe('updates');
    expect(telemetryTabFromSegment('postgres')).toBe('postgres');
    expect(telemetryTabFromSegment('nats')).toBe('nats');
  });

  it('rejects unknown tab segments', () => {
    expect(telemetryTabFromSegment('unknown')).toBeNull();
    expect(telemetryTabFromSegment('grafana')).toBeNull();
    expect(telemetryTabFromSegment('overview')).toBeNull();
    expect(telemetryTabFromSegment('traces')).toBeNull();
  });

  it('uses the tab id as the non-root route segment', () => {
    expect(telemetryRouteSegments('telegram')).toEqual(['telegram']);
    expect(telemetryRouteSegments('files')).toEqual(['files']);
    expect(telemetryRouteSegments('history-sync')).toEqual(['history-sync']);
    expect(telemetryRouteSegments('updates')).toEqual(['updates']);
    expect(telemetryRouteSegments('postgres')).toEqual(['postgres']);
    expect(telemetryRouteSegments('nats')).toEqual(['nats']);
  });
});
