import { describe, expect, it } from 'vitest';

import { pipelineAutomationRulesPolicy } from './policies.js';

describe('pipeline automation policy', () => {
  it('uses policy instance names as pipeline names', () => {
    const value = pipelineAutomationRulesPolicy.resolve([
      {
        metadata: { name: 'dailySummary' },
        spec: {
          enabled: true,
          pipeline: {
            nodes: {
              chats: { use: 'data.select', with: { model: 'telegram.chat' } }
            }
          },
          trigger: { everySeconds: 86400, kind: 'periodic' }
        }
      }
    ]);

    expect(value).toEqual([
      {
        enabled: true,
        name: 'dailySummary',
        pipeline: {
          nodes: {
            chats: { use: 'data.select', with: { model: 'telegram.chat' } }
          }
        },
        trigger: { everySeconds: 86400, kind: 'periodic' }
      }
    ]);
  });
});
