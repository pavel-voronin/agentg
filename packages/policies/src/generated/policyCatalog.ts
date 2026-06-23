import { policies as pipelinesPolicies } from '../../../pipelines/policies/policies.js';
import { policies as telegramPolicies } from '../../../telegram/policies/policies.js';

export const policyCatalog = [...pipelinesPolicies, ...telegramPolicies] as const;
