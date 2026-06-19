import { describe, expect, it } from 'vitest';

import {
  telemetryRouteSegments,
  telemetryTabFromSegment
} from '../dashboard/frontend/telemetry/route.js';

describe('telemetry route', () => {
  it('uses overview for the empty telemetry route', () => {
    expect(telemetryTabFromSegment(null)).toBe('overview');
    expect(telemetryRouteSegments('overview')).toEqual([]);
  });

  it('maps known tab segments to tab ids', () => {
    expect(telemetryTabFromSegment('overview')).toBe('overview');
    expect(telemetryTabFromSegment('policies')).toBe('policies');
    expect(telemetryTabFromSegment('triggers')).toBe('triggers');
    expect(telemetryTabFromSegment('llm-runner')).toBe('llm-runner');
    expect(telemetryTabFromSegment('telegram')).toBe('telegram');
    expect(telemetryTabFromSegment('get-messages')).toBe('get-messages');
    expect(telemetryTabFromSegment('history-reconciler')).toBe('history-reconciler');
    expect(telemetryTabFromSegment('files')).toBe('files');
    expect(telemetryTabFromSegment('updates')).toBe('updates');
    expect(telemetryTabFromSegment('postgres')).toBe('postgres');
    expect(telemetryTabFromSegment('nats')).toBe('nats');
  });

  it('rejects unknown tab segments', () => {
    expect(telemetryTabFromSegment('unknown')).toBeNull();
    expect(telemetryTabFromSegment('grafana')).toBeNull();
    expect(telemetryTabFromSegment('operations')).toBeNull();
    expect(telemetryTabFromSegment('traces')).toBeNull();
  });

  it('uses the tab id as the non-root route segment', () => {
    expect(telemetryRouteSegments('telegram')).toEqual(['telegram']);
    expect(telemetryRouteSegments('policies')).toEqual(['policies']);
    expect(telemetryRouteSegments('triggers')).toEqual(['triggers']);
    expect(telemetryRouteSegments('llm-runner')).toEqual(['llm-runner']);
    expect(telemetryRouteSegments('get-messages')).toEqual(['get-messages']);
    expect(telemetryRouteSegments('history-reconciler')).toEqual(['history-reconciler']);
    expect(telemetryRouteSegments('files')).toEqual(['files']);
    expect(telemetryRouteSegments('updates')).toEqual(['updates']);
    expect(telemetryRouteSegments('postgres')).toEqual(['postgres']);
    expect(telemetryRouteSegments('nats')).toEqual(['nats']);
  });
});
