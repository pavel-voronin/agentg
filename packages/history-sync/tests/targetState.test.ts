import { describe, expect, it } from 'vitest';

import { createTargetState } from '../src/target/targetState.js';

describe('target state', () => {
  it('keeps the runtime target snapshot and relative presence in sync', () => {
    const state = createTargetState();

    state.replace([
      {
        chatId: 'chat-1',
        id: 'target-absolute',
        range: {
          end: {
            at: '2026-01-02T00:00:00.000Z',
            kind: 'absolute'
          },
          start: {
            at: '2026-01-01T00:00:00.000Z',
            kind: 'absolute'
          }
        }
      }
    ]);
    expect(state.hasRelativeTargets()).toBe(false);
    expect(state.targets().map((target) => target.id)).toEqual(['target-absolute']);

    state.upsert({
      chatId: 'chat-1',
      id: 'target-relative',
      range: {
        end: {
          expression: 'now',
          kind: 'expression'
        },
        start: {
          expression: 'now-15m',
          kind: 'expression'
        }
      }
    });
    expect(state.hasRelativeTargets()).toBe(true);
    expect(state.targets().map((target) => target.id)).toEqual([
      'target-absolute',
      'target-relative'
    ]);

    state.delete('target-relative');
    expect(state.hasRelativeTargets()).toBe(false);
    expect(state.targets().map((target) => target.id)).toEqual(['target-absolute']);
  });
});
