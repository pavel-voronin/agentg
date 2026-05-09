import { describe, expect, it } from 'vitest';

import { controlPlaneSlotLayout } from '../src/composition/slots/manifest.js';

describe('slot manifest', () => {
  it('declares Control Plane-owned content placements', () => {
    expect(controlPlaneSlotLayout).toEqual({
      'control-plane.dashboard.tiles': {
        items: [
          {
            contentId: 'telegram.dashboard.chats'
          },
          {
            contentId: 'history.dashboard.current-job'
          }
        ]
      },
      'control-plane.events.preview': {
        items: [
          {
            contentId: 'events.stream.panel'
          }
        ]
      },
      'control-plane.header.status': {
        items: [
          {
            contentId: 'telegram.status.tdlib'
          }
        ]
      },
      'control-plane.workspace': {
        items: [
          {
            contentId: 'telegram.workspace'
          }
        ]
      },
      'telegram.workspace.primary': {
        items: [
          {
            contentId: 'history.workspace'
          }
        ]
      },
      'telegram.workspace.sidecar': {
        items: [
          {
            contentId: 'events.stream.panel'
          }
        ]
      }
    });
  });
});
