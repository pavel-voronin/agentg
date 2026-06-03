import { describe, expect, it } from 'vitest';

import type {
  HistorySyncRange,
  HistorySyncTarget,
  HistorySyncTemplate
} from '../src/model/types.js';
import { expressionBoundary, historySyncRange } from '../src/range/ranges.js';
import {
  editHistorySyncTargetDirectly,
  materializeTemplatesForChat,
  updateLinkedTargetsForTemplate
} from '../src/target/materialization.js';

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
    const standaloneTarget = editHistorySyncTargetDirectly(linkedTarget(), { range: recentRange });
    expect(updateLinkedTargetsForTemplate(privateFullTemplate, [standaloneTarget])).toEqual([
      standaloneTarget
    ]);
  });

  it('removes the template link when a linked target is edited directly', () => {
    expect(editHistorySyncTargetDirectly(linkedTarget(), { range: fullRange })).toEqual({
      chatId: 'chat-1',
      id: 'target-1',
      range: fullRange
    });
  });

  it('does not create duplicate targets for the same chat and range', () => {
    const existing: HistorySyncTarget = {
      chatId: 'chat-1',
      id: 'manual-target',
      range: recentRange
    };

    expect(materializeTemplatesForChat([privateRecentTemplate], privateChat(), [existing])).toEqual(
      [existing]
    );
  });

  it('allows multiple targets for the same chat when their ranges differ', () => {
    const existing: HistorySyncTarget = {
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

const recentRange = historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'));
const fullRange = historySyncRange(expressionBoundary('past'), expressionBoundary('now'));

const privateRecentTemplate: HistorySyncTemplate = {
  id: 'private-recent',
  match: { chatType: 'private' },
  range: recentRange
};

const privateFullTemplate: HistorySyncTemplate = {
  ...privateRecentTemplate,
  range: fullRange
};

function linkedTarget(range: HistorySyncRange = recentRange): HistorySyncTarget {
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
