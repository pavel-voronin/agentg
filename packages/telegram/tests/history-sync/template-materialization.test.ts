import { describe, expect, it } from 'vitest';

import {
  editHistoryTargetDirectly,
  materializeTemplatesForChat,
  updateLinkedTargetsForTemplate
} from '../../src/history-sync/materialization.js';
import { expressionBoundary, historyRange } from '../../src/history-sync/ranges.js';
import type { HistoryRange, HistoryTarget, HistoryTemplate } from '../../src/history-sync/types.js';

describe('history template materialization', () => {
  it('creates a linked target when a discovered chat matches a template', () => {
    expect(materializeTemplatesForChat([privateRecentTemplate], privateChat())).toEqual([
      {
        chatId: 'chat-1',
        id: 'private-recent:chat-1',
        range: recentRange,
        templateId: 'private-recent'
      }
    ]);
  });

  it('does not create a target when a discovered chat does not match any template', () => {
    expect(materializeTemplatesForChat([privateRecentTemplate], channelChat())).toEqual([]);
  });

  it('materializes the template range into the target range', () => {
    const [target] = materializeTemplatesForChat([privateRecentTemplate], privateChat());
    expect(target?.range).toEqual(recentRange);
  });

  it('updates linked targets when the source template range changes', () => {
    expect(updateLinkedTargetsForTemplate(privateFullTemplate, [linkedTarget()])).toEqual([
      {
        ...linkedTarget(),
        range: fullRange
      }
    ]);
  });

  it('does not update standalone targets when the source template range changes', () => {
    const standaloneTarget = editHistoryTargetDirectly(linkedTarget(), { range: recentRange });
    expect(updateLinkedTargetsForTemplate(privateFullTemplate, [standaloneTarget])).toEqual([
      standaloneTarget
    ]);
  });

  it('removes the template link when a linked target is edited directly', () => {
    expect(editHistoryTargetDirectly(linkedTarget(), { range: fullRange })).toEqual({
      chatId: 'chat-1',
      id: 'target-1',
      range: fullRange
    });
  });

  it('does not create duplicate targets for the same chat and range', () => {
    const existing: HistoryTarget = {
      chatId: 'chat-1',
      id: 'manual-target',
      range: recentRange
    };

    expect(materializeTemplatesForChat([privateRecentTemplate], privateChat(), [existing])).toEqual(
      [existing]
    );
  });

  it('allows multiple targets for the same chat when their ranges differ', () => {
    const existing: HistoryTarget = {
      chatId: 'chat-1',
      id: 'manual-target',
      range: fullRange
    };

    expect(materializeTemplatesForChat([privateRecentTemplate], privateChat(), [existing])).toEqual(
      [
        existing,
        {
          chatId: 'chat-1',
          id: 'private-recent:chat-1',
          range: recentRange,
          templateId: 'private-recent'
        }
      ]
    );
  });
});

const recentRange = historyRange(expressionBoundary('now-30d'), expressionBoundary('now'));
const fullRange = historyRange(expressionBoundary('past'), expressionBoundary('now'));

const privateRecentTemplate: HistoryTemplate = {
  id: 'private-recent',
  match: { chatType: 'private' },
  range: recentRange
};

const privateFullTemplate: HistoryTemplate = {
  ...privateRecentTemplate,
  range: fullRange
};

function linkedTarget(range: HistoryRange = recentRange): HistoryTarget {
  return {
    chatId: 'chat-1',
    id: 'target-1',
    range,
    templateId: 'private-recent'
  };
}

function privateChat() {
  return {
    id: 'chat-1',
    title: 'Alice',
    type: 'private'
  };
}

function channelChat() {
  return {
    id: 'chat-2',
    title: 'News',
    type: 'channel'
  };
}
