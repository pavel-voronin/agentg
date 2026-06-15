import type {
  HistoryGapRestoreDecision as PolicyDecision,
  HistoryGapRestoreRuleSet as RuleSet
} from '../../policies/policies.js';
import type { GetMessagesInput } from '../procedures/get-messages/contract.js';

export type Chat = {
  chatId: string;
  type: string;
};

export type SkipReason =
  | 'emptyRange'
  | 'invalidChatType'
  | 'missingLiveBoundary'
  | 'noMatchingRule'
  | 'restoreDisabled';

export type Plan =
  | {
      kind: 'request';
      input: GetMessagesInput;
    }
  | {
      kind: 'skip';
      reason: SkipReason;
    };

type ChatType = 'private' | 'secret' | 'group' | 'channel';

const chatTypes = new Set<string>(['private', 'secret', 'group', 'channel']);

export function selectDecision(rules: RuleSet, chat: Chat): PolicyDecision | SkipReason {
  if (!isChatType(chat.type)) {
    return 'invalidChatType';
  }

  const byId = rules.chatIds[chat.chatId];
  if (byId !== undefined) {
    return byId;
  }

  const byType = rules.chatTypes[chat.type];
  if (byType !== undefined) {
    return byType;
  }

  return rules.all ?? 'noMatchingRule';
}

export function planRequest(input: {
  chat: Chat;
  decision: PolicyDecision | SkipReason;
  liveBoundary: Date | null;
}): Plan {
  if (typeof input.decision === 'string') {
    return {
      kind: 'skip',
      reason: input.decision
    };
  }

  if (input.decision.kind === 'disabled') {
    return {
      kind: 'skip',
      reason: 'restoreDisabled'
    };
  }

  if (input.liveBoundary === null) {
    return {
      kind: 'skip',
      reason: 'missingLiveBoundary'
    };
  }

  const endAt = input.liveBoundary;
  const startAt = new Date(endAt.getTime() - input.decision.windowSeconds * 1000);
  if (startAt >= endAt) {
    return {
      kind: 'skip',
      reason: 'emptyRange'
    };
  }

  return {
    input: {
      owner: {
        chatId: input.chat.chatId,
        kind: 'chat'
      },
      selector: {
        endAt: endAt.toISOString(),
        kind: 'range',
        startAt: startAt.toISOString()
      }
    },
    kind: 'request'
  };
}

function isChatType(type: string): type is ChatType {
  return chatTypes.has(type);
}
