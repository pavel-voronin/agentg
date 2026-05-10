import { describe, expect, it } from 'vitest';
import { h, createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';

import TimelineDetailsTable from '../src/control-plane/components/timeline/TimelineDetailsTable.vue';
import { buildTimelineViewModel } from '../src/control-plane/timeline/timelineModel.js';

describe('timeline view model', () => {
  it('shows live coverage rows with original interval dates when the segment is clipped', async () => {
    const view = buildTimelineViewModel({
      coverageTableOpen: true,
      data: {
        chat: {
          historyBeginningReached: false,
          historyStartAt: null,
          id: 'chat-a',
          isBot: false,
          messageCount: 10,
          title: 'Saved Messages',
          type: 'private',
          updatedAt: '2026-05-01T17:04:41.000Z'
        },
        coverage: [
          {
            endAt: '2026-05-01T17:04:41.000Z',
            messageCount: 10,
            startAt: '2026-05-01T15:31:33.000Z'
          }
        ],
        desired: [],
        missing: [],
        targets: []
      },
      viewport: {
        endAt: Date.parse('2026-05-01T17:04:28.000Z'),
        startAt: Date.parse('2026-04-24T17:04:28.000Z')
      }
    });

    const coverage = view.detailSections.find((section) => section.type === 'coverage');

    expect(coverage?.items[0]).toMatchObject({
      duration: '1h 33m',
      endValue: '2026-05-01 17:04:41',
      startValue: '2026-05-01 15:31:33'
    });

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(TimelineDetailsTable, {
            highlightedKeys: [],
            sections: view.detailSections
          });
        }
      })
    );

    expect(html).toContain('2026-05-01 17:04:41');
    expect(html).not.toContain('2026-05-01 17:04:28');
  });

  it('does not render missing coverage message counts as zero', async () => {
    const view = buildTimelineViewModel({
      coverageTableOpen: true,
      data: {
        chat: {
          historyBeginningReached: false,
          historyStartAt: null,
          id: 'chat-a',
          isBot: false,
          messageCount: 0,
          title: 'Saved Messages',
          type: 'private',
          updatedAt: '2026-05-01T17:04:41.000Z'
        },
        coverage: [
          {
            endAt: '2026-05-01T17:04:41.000Z',
            startAt: '2026-05-01T15:31:33.000Z'
          }
        ],
        desired: [],
        missing: [],
        targets: []
      },
      viewport: {
        endAt: Date.parse('2026-05-01T18:04:28.000Z'),
        startAt: Date.parse('2026-05-01T14:04:28.000Z')
      }
    });

    const coverage = view.detailSections.find((section) => section.type === 'coverage');
    const coverageSegment = view.segments.find((segment) => segment.kind === 'coverage');

    expect(coverage?.items[0]?.count).toBe('unknown');
    expect(coverageSegment).toMatchObject({
      ariaLabel: '2026-05-01 15:31:33 -> 2026-05-01 17:04:41, unknown messages'
    });

    const html = await renderToString(
      createSSRApp({
        render() {
          return h(TimelineDetailsTable, {
            highlightedKeys: [],
            sections: view.detailSections
          });
        }
      })
    );

    expect(html).toContain('unknown');
    expect(html).not.toContain('>0</td>');
  });
});
