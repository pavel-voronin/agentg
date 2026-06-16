import { describe, expect, it } from 'vitest';

import {
  readHistoryCoverageState,
  timelineScaleButtons,
  type HistoryCoverageState
} from './historyCoverageState.js';
import { buildTimelineViewModel } from './timeline/timelineModel.js';

describe('Telegram history coverage state', () => {
  it('accepts coverage only for the selected chat id', () => {
    const matching = readHistoryCoverageState(
      {
        chatId: '123',
        coverage: [
          {
            coveredAt: '2026-05-01T02:00:00.000Z',
            endAt: '2026-05-01T02:00:00.000Z',
            messageCount: 17,
            startAt: '2026-05-01T01:00:00.000Z'
          }
        ]
      },
      '123'
    );
    const mismatched = readHistoryCoverageState(
      {
        chatId: '456',
        coverage: [
          {
            coveredAt: '2026-05-01T02:00:00.000Z',
            endAt: '2026-05-01T02:00:00.000Z',
            messageCount: 17,
            startAt: '2026-05-01T01:00:00.000Z'
          }
        ]
      },
      '123'
    );

    expect(matching).toEqual({
      chat: {
        historyStartAt: null,
        id: '123'
      },
      coverage: [
        {
          coveredAt: '2026-05-01T02:00:00.000Z',
          endAt: '2026-05-01T02:00:00.000Z',
          messageCount: 17,
          startAt: '2026-05-01T01:00:00.000Z'
        }
      ]
    });
    expect(mismatched).toBeNull();
  });

  it('builds old timeline coverage and gap segments without target segments', () => {
    const state: HistoryCoverageState = {
      chat: {
        historyStartAt: '2026-05-01T00:00:00.000Z',
        id: '123'
      },
      coverage: [
        {
          coveredAt: '2026-05-01T02:00:00.000Z',
          endAt: '2026-05-01T02:00:00.000Z',
          messageCount: 3,
          startAt: '2026-05-01T01:00:00.000Z'
        },
        {
          coveredAt: '2026-05-01T04:00:00.000Z',
          endAt: '2026-05-01T04:00:00.000Z',
          messageCount: 9,
          startAt: '2026-05-01T03:00:00.000Z'
        }
      ]
    };

    const view = buildTimelineViewModel({
      coverageTableOpen: true,
      data: state,
      viewport: {
        endAt: new Date('2026-05-01T05:00:00.000Z').getTime(),
        startAt: new Date('2026-05-01T00:00:00.000Z').getTime()
      }
    });

    expect(view.segments.map((segment) => segment.kind)).toEqual(['coverage', 'coverage', 'gap']);
    expect(view.detailSections).toHaveLength(1);
    expect(view.detailSections[0]).toMatchObject({
      title: 'Coverage',
      type: 'coverage'
    });
    expect(view.detailSections[0]?.items).toHaveLength(2);
    expect(view.detailSections[0]?.items.map((item) => item.count)).toEqual(['3', '9']);
  });

  it('marks scale presets the same way as the restored timeline UI', () => {
    expect(
      timelineScaleButtons({
        defaultViewportDays: 30,
        viewportDays: 7
      }).map((button) => ({
        active: button.active,
        isDefault: button.isDefault,
        label: button.label
      }))
    ).toEqual([
      { active: true, isDefault: false, label: '7d' },
      { active: false, isDefault: true, label: '30d' },
      { active: false, isDefault: false, label: '90d' },
      { active: false, isDefault: false, label: '1y' },
      { active: false, isDefault: false, label: 'All' }
    ]);
  });
});
