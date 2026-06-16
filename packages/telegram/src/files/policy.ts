import type { MediaDownloadPolicyCause, MediaDownloadPolicyRule } from './policyRules.js';
import type { ExtractedFileSlot } from './types.js';

type FilePolicyInput = {
  cause: MediaDownloadPolicyCause;
  current: {
    failureReason: string | null;
    sourceFingerprint: string;
    status: string;
  } | null;
  rules: readonly MediaDownloadPolicyRule[];
  slot: Pick<ExtractedFileSlot, 'byteSize' | 'mediaKind'>;
  sourceFingerprint: string;
};

export type FilePolicyDecision =
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

export type { MediaDownloadPolicyCause } from './policyRules.js';

export function decideFilePolicy(input: FilePolicyInput): FilePolicyDecision {
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
    input.current.status === 'failed' &&
    !isAutomaticRetryableFailure(input.current.failureReason)
  ) {
    return {
      action: 'record',
      reason: 'already failed'
    };
  }

  const rule = input.rules.find((candidate) => ruleMatches(candidate, input));

  if (rule === undefined) {
    return {
      action: 'record',
      reason: `${input.slot.mediaKind} is not covered by ${input.cause} download policy`
    };
  }

  if (!byteSizeAllowed(input.slot.byteSize, rule.maxBytes)) {
    const ruleReason = downloadRuleReason(rule, input.cause);
    return input.cause === 'explicit_request'
      ? {
          action: 'deny',
          reason: `${ruleReason} requires a known size at or below ${String(rule.maxBytes)} bytes`
        }
      : {
          action: 'record',
          reason: `${ruleReason} size limit did not match`
        };
  }

  return {
    action: 'enqueue',
    reason: downloadRuleReason(rule, input.cause)
  };
}

function isAutomaticRetryableFailure(failureReason: string | null): boolean {
  return failureReason?.startsWith('Telegram file download stale retry limit reached') === true;
}

function ruleMatches(rule: MediaDownloadPolicyRule, input: FilePolicyInput): boolean {
  return rule.mediaKind === input.slot.mediaKind && rule.causes.includes(input.cause);
}

function byteSizeAllowed(byteSize: number | null, maxBytes: number | null): boolean {
  if (maxBytes === null) {
    return true;
  }
  return byteSize !== null && byteSize <= maxBytes;
}

function downloadRuleReason(
  rule: MediaDownloadPolicyRule,
  cause: MediaDownloadPolicyCause
): string {
  return `${rule.mediaKind} ${cause} download policy`;
}
