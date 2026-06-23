import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('pipeline spec document', () => {
  it('documents the action ids and context keys agents need', async () => {
    const text = await readFile(
      fileURLToPath(new URL('../../../docs/03-domains/pipelineSpec.md', import.meta.url)),
      'utf8'
    );

    expect(text).toContain('PipelineAutomationRule');
    expect(text).toContain('policies_set_instance');
    expect(text).toContain('pipelines_describe_spec');
    for (const value of [
      'data.select',
      'data.get',
      'data.expand',
      'data.render',
      'llm.run',
      'data.writeAnnotation',
      'data.writeCollectionItem',
      'run.startedAt',
      'trigger.scheduledAt',
      'window.startAt',
      'window.endAt',
      'date.utc'
    ]) {
      expect(text).toContain(value);
    }
  });
});
