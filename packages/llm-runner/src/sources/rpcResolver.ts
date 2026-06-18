import { defineInternalRpcDomain } from '@agentg/framework';
import { z } from 'zod';

import type { SourceResolverConfig } from '../config.js';
import {
  contentRefSchema,
  jsonValueSchema,
  sourceRefSchema,
  sourceSelectorSchema
} from '../schema.js';
import type { SourceResolver } from './types.js';

type GenericProcedures = Record<string, (input: unknown) => unknown>;

const resolutionSchema = z.discriminatedUnion('status', [
  z
    .object({
      snapshot: z
        .object({
          contentRefs: z.array(contentRefSchema),
          payload: jsonValueSchema,
          sourceRefs: z.array(sourceRefSchema)
        })
        .strict(),
      status: z.literal('ready')
    })
    .strict(),
  z
    .object({
      contentRefs: z.array(contentRefSchema).optional(),
      requestId: z.string().trim().min(1),
      sourceRefs: z.array(sourceRefSchema).optional(),
      status: z.literal('pending')
    })
    .strict(),
  z
    .object({
      error: z
        .object({
          code: z.string().trim().min(1),
          message: z.string()
        })
        .strict(),
      status: z.literal('rejected')
    })
    .strict()
]);

export function createRpcSourceResolver(input: {
  resolvers: Readonly<Record<string, SourceResolverConfig>>;
}): SourceResolver {
  return {
    async resolve(rawInput) {
      const sourceSelector = sourceSelectorSchema.parse(rawInput.sourceSelector);
      const resolver = input.resolvers[sourceSelector.domain];
      if (resolver === undefined) {
        return {
          error: {
            code: 'unknown_source_domain',
            message: `No source resolver configured for ${sourceSelector.domain}`
          },
          status: 'rejected'
        };
      }
      const client = defineInternalRpcDomain<GenericProcedures>(sourceSelector.domain)({
        timeoutMs: resolver.timeoutMs,
        url: resolver.url
      });
      const procedure = client[resolver.procedure];
      if (procedure === undefined) {
        return {
          error: {
            code: 'unknown_source_procedure',
            message: `Source resolver procedure is not available: ${resolver.procedure}`
          },
          status: 'rejected'
        };
      }
      return resolutionSchema.parse(
        await procedure({
          sourceSelector
        })
      );
    }
  };
}
