import type { JsonValue } from '@agentg/framework';
import { definePolicy, type PolicyInstance } from '@agentg/framework/policies';
import { z } from 'zod';

const moduleNameSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
const procedureNameSchema = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
);

const triggerConditionSpec = z
  .object({
    everySeconds: z.number().int().positive(),
    kind: z.literal('periodic'),
    startAt: z.iso.datetime().optional()
  })
  .strict();

const triggerActionSpec = z
  .object({
    input: jsonValueSchema,
    module: moduleNameSchema,
    procedure: procedureNameSchema
  })
  .strict();

export const triggerRuleSpec = z
  .object({
    action: triggerActionSpec,
    condition: triggerConditionSpec
  })
  .strict();

export type TriggerCondition = z.infer<typeof triggerConditionSpec>;
export type TriggerAction = z.infer<typeof triggerActionSpec>;
export type TriggerRuleSpec = z.infer<typeof triggerRuleSpec>;

export type TriggerRule = Readonly<{
  labels?: Readonly<Record<string, string>>;
  name: string;
  spec: TriggerRuleSpec;
}>;

export const triggerRulePolicy = definePolicy<TriggerRuleSpec, readonly TriggerRule[]>({
  id: 'triggers.rule',
  kind: 'TriggerRule',
  moduleId: 'triggers',
  resolve: resolveTriggerRules,
  spec: triggerRuleSpec,
  version: 1
});

export const policies = [triggerRulePolicy] as const;

function resolveTriggerRules(
  instances: readonly PolicyInstance<TriggerRuleSpec>[]
): readonly TriggerRule[] {
  return Object.freeze(
    instances.map(({ metadata, spec }) =>
      Object.freeze({
        ...(metadata.labels === undefined ? {} : { labels: Object.freeze({ ...metadata.labels }) }),
        name: metadata.name,
        spec
      })
    )
  );
}
