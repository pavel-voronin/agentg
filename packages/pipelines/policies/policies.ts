import type { JsonValue } from '@agentg/framework';
import { definePolicy, type PolicyInstance } from '@agentg/framework/policies';
import { z } from 'zod';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const nodeSchema = z
  .object({
    from: z.string().trim().min(1).optional(),
    needs: z.array(z.string().trim().min(1)).readonly().optional(),
    use: z.string().trim().min(1),
    with: jsonValueSchema.optional()
  })
  .strict();

const triggerSchema = z
  .object({
    everySeconds: z.number().int().positive(),
    kind: z.literal('periodic'),
    startAt: z.iso.datetime().optional()
  })
  .strict();

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
