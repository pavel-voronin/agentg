import { definePolicy, type PolicyInstance } from '@agentg/framework/policies';
import { z } from 'zod';

import { nodeSchema, triggerSchema } from '../src/schema.js';

const pipelineAutomationRuleSpec = z
  .object({
    enabled: z.boolean(),
    pipeline: z
      .object({
        nodes: z.record(z.string().trim().min(1), nodeSchema)
      })
      .strict(),
    trigger: triggerSchema
  })
  .strict();

type PipelineAutomationRuleSpec = z.infer<typeof pipelineAutomationRuleSpec>;

export type PipelineAutomationRule = Readonly<{
  enabled: boolean;
  name: string;
  pipeline: Readonly<{
    nodes: Readonly<PipelineAutomationRuleSpec['pipeline']['nodes']>;
  }>;
  trigger: PipelineAutomationRuleSpec['trigger'];
}>;

export type PipelineAutomationRuleSet = readonly PipelineAutomationRule[];

export const pipelineAutomationRulesPolicy = definePolicy<
  PipelineAutomationRuleSpec,
  PipelineAutomationRuleSet
>({
  id: 'pipelines.automation.rules',
  kind: 'PipelineAutomationRule',
  moduleId: 'pipelines',
  resolve: resolveAutomationRules,
  spec: pipelineAutomationRuleSpec,
  version: 1
});

export const policies = [pipelineAutomationRulesPolicy] as const;

function resolveAutomationRules(
  instances: readonly PolicyInstance<PipelineAutomationRuleSpec>[]
): PipelineAutomationRuleSet {
  return Object.freeze(
    instances.map(({ metadata, spec }) =>
      Object.freeze({
        enabled: spec.enabled,
        name: metadata.name,
        pipeline: Object.freeze({
          nodes: Object.freeze({ ...spec.pipeline.nodes })
        }),
        trigger: spec.trigger
      })
    )
  );
}
