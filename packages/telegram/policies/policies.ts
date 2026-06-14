import { definePolicy } from '@agentg/framework/policies';
import { z } from 'zod';

const mediaDownloadPolicyCauses = [
  'explicit_request',
  'history_fetch',
  'initialization',
  'live_update',
  'operator_page'
] as const;

const fileMediaKinds = ['avatar', 'document', 'photo', 'thumbnail', 'video', 'voice'] as const;

const downloadRuleSpec = z.object({
  causes: z.array(z.enum(mediaDownloadPolicyCauses)).nonempty(),
  maxBytes: z.number().int().positive().nullable(),
  mediaKind: z.enum(fileMediaKinds),
  name: z.string().min(1)
});

type DownloadRuleSpec = z.infer<typeof downloadRuleSpec>;

export const fileDownloadRulesPolicy = definePolicy({
  id: 'telegram.files.downloadRules',
  kind: 'TelegramFileDownloadRule',
  moduleId: 'telegram',
  resolve(specs: readonly DownloadRuleSpec[]) {
    const seen = new Map<string, string>();
    for (const spec of specs) {
      for (const cause of spec.causes) {
        const key = `${spec.mediaKind}:${cause}`;
        const previous = seen.get(key);
        if (previous !== undefined) {
          throw new Error(
            `Duplicate Telegram file download rule for ${key}: ${previous}, ${spec.name}`
          );
        }
        seen.set(key, spec.name);
      }
    }
    return Object.freeze([...specs]);
  },
  spec: downloadRuleSpec,
  version: 1
});

export const policies = [fileDownloadRulesPolicy] as const;
