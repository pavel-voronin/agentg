import { definePolicy } from '@agentg/framework/policies';
import { z } from 'zod';

const historyGapRestoreChatTypes = ['private', 'secret', 'group', 'channel'] as const;
const mediaDownloadPolicyCauses = [
  'explicit_request',
  'history_fetch',
  'initialization',
  'live_update',
  'operator_page'
] as const;

const fileMediaKinds = ['avatar', 'document', 'photo', 'thumbnail', 'video', 'voice'] as const;

const chatIdSchema = z
  .string()
  .regex(/^-?(0|[1-9][0-9]*)$/)
  .refine((value) => value !== '-0')
  .refine((value) => Number.isSafeInteger(Number(value)));

const gapRestoreRuleSpec = z
  .object({
    chatIds: z.array(chatIdSchema).nonempty().optional(),
    chatTypes: z.array(z.enum(historyGapRestoreChatTypes)).nonempty().optional(),
    restore: z.boolean(),
    windowSeconds: z.number().int().positive().optional()
  })
  .superRefine((spec, context) => {
    if (spec.chatIds !== undefined && spec.chatTypes !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'chatIds and chatTypes cannot be used together',
        path: ['chatIds']
      });
    }
    if (spec.restore && spec.windowSeconds === undefined) {
      context.addIssue({
        code: 'custom',
        message: 'restore true requires windowSeconds',
        path: ['windowSeconds']
      });
    }
    if (!spec.restore && spec.windowSeconds !== undefined) {
      context.addIssue({
        code: 'custom',
        message: 'restore false cannot set windowSeconds',
        path: ['windowSeconds']
      });
    }
    addUniqueArrayIssue(spec.chatIds, 'chatIds', context);
    addUniqueArrayIssue(spec.chatTypes, 'chatTypes', context);
  });
const downloadRuleSpec = z.object({
  causes: z.array(z.enum(mediaDownloadPolicyCauses)).nonempty(),
  maxBytes: z.number().int().positive().nullable(),
  mediaKind: z.enum(fileMediaKinds)
});

type GapRestoreRuleSpec = z.infer<typeof gapRestoreRuleSpec>;
type HistoryGapRestoreChatType = (typeof historyGapRestoreChatTypes)[number];
export type HistoryGapRestoreDecision =
  | {
      kind: 'disabled';
    }
  | {
      kind: 'enabled';
      windowSeconds: number;
    };
export type HistoryGapRestoreRuleSet = Readonly<{
  all?: HistoryGapRestoreDecision;
  chatIds: Readonly<Record<string, HistoryGapRestoreDecision>>;
  chatTypes: Readonly<Partial<Record<HistoryGapRestoreChatType, HistoryGapRestoreDecision>>>;
}>;
type DownloadRuleSpec = z.infer<typeof downloadRuleSpec>;

export const historyGapRestoreRulesPolicy = definePolicy<
  GapRestoreRuleSpec,
  HistoryGapRestoreRuleSet
>({
  id: 'telegram.history.gapRestoreRules',
  kind: 'TelegramHistoryGapRestoreRule',
  moduleId: 'telegram',
  resolve: resolveGapRestoreRules,
  spec: gapRestoreRuleSpec,
  version: 1
});

export const fileDownloadRulesPolicy = definePolicy({
  id: 'telegram.files.downloadRules',
  kind: 'TelegramFileDownloadRule',
  moduleId: 'telegram',
  resolve(specs: readonly DownloadRuleSpec[]) {
    const seen = new Set<string>();
    for (const spec of specs) {
      for (const cause of spec.causes) {
        const key = `${spec.mediaKind}:${cause}`;
        if (seen.has(key)) {
          throw new Error(`Duplicate Telegram file download rule for ${key}`);
        }
        seen.add(key);
      }
    }
    return Object.freeze([...specs]);
  },
  spec: downloadRuleSpec,
  version: 1
});

export const policies = [fileDownloadRulesPolicy, historyGapRestoreRulesPolicy] as const;

function resolveGapRestoreRules(specs: readonly GapRestoreRuleSpec[]): HistoryGapRestoreRuleSet {
  const rules: {
    all?: HistoryGapRestoreDecision;
    chatIds: Record<string, HistoryGapRestoreDecision>;
    chatTypes: Partial<Record<HistoryGapRestoreChatType, HistoryGapRestoreDecision>>;
  } = {
    chatIds: {},
    chatTypes: {}
  };

  for (const spec of specs) {
    const decision = gapRestoreDecision(spec);
    if (spec.chatIds !== undefined) {
      for (const chatId of spec.chatIds) {
        setDecision(`chatId:${chatId}`, decision, rules.chatIds, chatId);
      }
      continue;
    }
    if (spec.chatTypes !== undefined) {
      for (const chatType of spec.chatTypes) {
        setDecision(`chatType:${chatType}`, decision, rules.chatTypes, chatType);
      }
      continue;
    }

    rules.all = mergeDecision('all', rules.all, decision);
  }

  return Object.freeze({
    ...(rules.all === undefined ? {} : { all: rules.all }),
    chatIds: Object.freeze({ ...rules.chatIds }),
    chatTypes: Object.freeze({ ...rules.chatTypes })
  });
}

function gapRestoreDecision(spec: GapRestoreRuleSpec): HistoryGapRestoreDecision {
  if (!spec.restore) {
    return Object.freeze({
      kind: 'disabled'
    });
  }
  if (spec.windowSeconds === undefined) {
    throw new Error('restore true requires windowSeconds');
  }
  return Object.freeze({
    kind: 'enabled',
    windowSeconds: spec.windowSeconds
  });
}

function setDecision<TKey extends string>(
  label: string,
  decision: HistoryGapRestoreDecision,
  rules: Partial<Record<TKey, HistoryGapRestoreDecision>>,
  key: TKey
): void {
  rules[key] = mergeDecision(label, rules[key], decision);
}

function mergeDecision(
  label: string,
  current: HistoryGapRestoreDecision | undefined,
  next: HistoryGapRestoreDecision
): HistoryGapRestoreDecision {
  if (current === undefined || equalDecision(current, next)) {
    return next;
  }
  throw new Error(`Conflicting Telegram history gap restore rule for ${label}`);
}

function equalDecision(
  first: HistoryGapRestoreDecision,
  second: HistoryGapRestoreDecision
): boolean {
  if (first.kind !== second.kind) {
    return false;
  }
  if (first.kind === 'disabled' || second.kind === 'disabled') {
    return true;
  }
  return first.windowSeconds === second.windowSeconds;
}

function addUniqueArrayIssue(
  values: readonly string[] | undefined,
  path: string,
  context: z.RefinementCtx
): void {
  if (values === undefined) {
    return;
  }
  if (new Set(values).size !== values.length) {
    context.addIssue({
      code: 'custom',
      message: `${path} must contain unique values`,
      path: [path]
    });
  }
}
