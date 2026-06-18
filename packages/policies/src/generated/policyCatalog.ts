import { policies as telegramPolicies } from '../../../telegram/policies/policies.js';
import { policies as triggersPolicies } from '../../../triggers/policies/policies.js';

export const policyCatalog = [...telegramPolicies, ...triggersPolicies] as const;
