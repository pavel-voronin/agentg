import { policies as telegramPolicies } from '../../../telegram/policies/policies.js';

export const policyCatalog = [...telegramPolicies] as const;
