import {
  telegramAutomaticDownloadPolicyRules,
  telegramExplicitDownloadPolicyRules,
  type TelegramMediaDownloadPolicyCause,
  type TelegramMediaDownloadPolicyRule
} from './telegramFilePolicyRules.js';
import type { ExtractedTelegramFileSlot } from './telegramFileTypes.js';

export type TelegramFilePolicyInput = {
  cause: TelegramMediaDownloadPolicyCause;
  current: {
    sourceFingerprint: string;
    status: string;
  } | null;
  slot: Pick<ExtractedTelegramFileSlot, 'byteSize' | 'mediaKind'>;
  sourceFingerprint: string;
};

export type TelegramFilePolicyDecision =
  | {
      action: 'deny';
      reason: string;
    }
  | {
      action: 'enqueue';
      reason: string;
    }
  | {
      action: 'record';
      reason: string;
    };

export type { TelegramMediaDownloadPolicyCause } from './telegramFilePolicyRules.js';

export function decideTelegramFilePolicy(
  input: TelegramFilePolicyInput
): TelegramFilePolicyDecision {
  if (
    input.current?.sourceFingerprint === input.sourceFingerprint &&
    input.current.status === 'ready'
  ) {
    return {
      action: 'record',
      reason: 'already ready'
    };
  }
  if (
    input.cause !== 'explicit_request' &&
    input.current?.sourceFingerprint === input.sourceFingerprint &&
    input.current.status === 'failed'
  ) {
    return {
      action: 'record',
      reason: 'already failed'
    };
  }

  const rules =
    input.cause === 'explicit_request'
      ? telegramExplicitDownloadPolicyRules
      : telegramAutomaticDownloadPolicyRules;
  const rule = rules.find((candidate) => ruleMatches(candidate, input));

  if (rule === undefined) {
    return {
      action: 'record',
      reason: `${input.slot.mediaKind} is not covered by ${input.cause} download policy`
    };
  }

  if (!byteSizeAllowed(input.slot.byteSize, rule.maxBytes)) {
    return input.cause === 'explicit_request'
      ? {
          action: 'deny',
          reason: `${rule.name} requires a known size at or below ${String(rule.maxBytes)} bytes`
        }
      : {
          action: 'record',
          reason: `${rule.name} size limit did not match`
        };
  }

  return {
    action: 'enqueue',
    reason: rule.name
  };
}

function ruleMatches(
  rule: TelegramMediaDownloadPolicyRule,
  input: TelegramFilePolicyInput
): boolean {
  return rule.mediaKind === input.slot.mediaKind && rule.causes.includes(input.cause);
}

function byteSizeAllowed(byteSize: number | null, maxBytes: number | null): boolean {
  if (maxBytes === null) {
    return true;
  }
  return byteSize !== null && byteSize <= maxBytes;
}
