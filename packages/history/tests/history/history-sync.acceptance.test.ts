import { describe, expect, it } from 'vitest';

import { TELEGRAM_HISTORY_PAST_BOUNDARY } from '../../src/constants.js';
import {
  editHistoryTargetDirectly,
  materializeTemplatesForChat,
  updateLinkedTargetsForTemplate
} from '../../src/materialization.js';
import { projectSyncIntervalsForChat } from '../../src/reconciler.js';
import { expressionBoundary, historyRange } from '../../src/ranges.js';
import type { HistoryTarget, HistoryTemplate } from '../../src/types.js';

describe('history sync acceptance', () => {
  it('materializes a target for a newly discovered matching chat and projects it for Telegram', () => {
    const targets = materializeTemplatesForChat([privateRecentTemplate], privateChat);

    expect(project(targets)).toEqual([interval('2026-03-29', '2026-04-28')]);
  });

  it('updates a linked target after a template change and projects the new desired interval', () => {
    const targets = materializeTemplatesForChat([privateRecentTemplate], privateChat);
    const updatedTargets = updateLinkedTargetsForTemplate(privateFullTemplate, targets);

    expect(project(updatedTargets)).toEqual([interval('2013-08-14', '2026-04-28')]);
  });

  it('keeps a standalone target unchanged after a template change', () => {
    const [linkedTarget] = materializeTemplatesForChat([privateRecentTemplate], privateChat);
    if (linkedTarget === undefined) {
      throw new Error('Expected template to materialize a target');
    }

    const standaloneTarget = editHistoryTargetDirectly(linkedTarget, {
      range: privateRecentTemplate.range
    });

    expect(updateLinkedTargetsForTemplate(privateFullTemplate, [standaloneTarget])).toEqual([
      standaloneTarget
    ]);
  });
});

const now = date('2026-04-28');
const chatId = 'chat-a';
const privateChat = {
  id: chatId,
  title: 'Alice',
  type: 'private'
};

const privateRecentTemplate: HistoryTemplate = {
  id: 'private-recent',
  match: { chatType: 'private' },
  range: historyRange(expressionBoundary('now-30d'), expressionBoundary('now'))
};

const privateFullTemplate: HistoryTemplate = {
  ...privateRecentTemplate,
  range: historyRange(expressionBoundary('past'), expressionBoundary('now'))
};

function project(targets: HistoryTarget[]) {
  return projectSyncIntervalsForChat({
    chatId,
    literals: {
      past: TELEGRAM_HISTORY_PAST_BOUNDARY
    },
    now,
    targets
  });
}

function interval(startAt: string, endAt: string) {
  return {
    endAt: date(endAt),
    startAt: date(startAt)
  };
}

function date(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
