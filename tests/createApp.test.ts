import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app/createApp.js';
import type { AppEvent } from '../src/bus/events.js';

describe('createApp', () => {
  it('wires config, storage handle, lifecycle, and event bus', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'agentg-app-'));
    const app = createApp({
      cwd,
      env: {
        AGENTG_PLUGINS: 'summaries,claude',
        AGENTG_SQLITE_PATH: './test.sqlite',
        CONTROL_PLANE_ENABLED: 'true',
        CONTROL_PLANE_PORT: '9901',
        GATEWAY_PORT: '9902'
      }
    });
    const received: AppEvent[] = [];

    app.eventBus.subscribe('app.started', (event) => {
      received.push(event);
    });

    await app.start();

    expect(app.config.plugins.enabled).toEqual(['summaries', 'claude']);
    expect(app.config.controlPlane).toMatchObject({
      enabled: true,
      port: 9901
    });
    expect(app.config.gateway.port).toBe(9902);
    expect(app.storage.sqlite.path).toBe(join(cwd, 'test.sqlite'));
    expect(app.lifecycle.getState()).toBe('started');
    expect(received).toHaveLength(1);

    await app.stop();

    expect(app.lifecycle.getState()).toBe('stopped');
  });
});
