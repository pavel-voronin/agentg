import { z } from 'zod';

export const DEFAULT_EXTENSION_REGISTRATION_TTL_MS = 60_000;

const nonEmptyStringSchema = z.string().trim().min(1);

export const extensionRegistrationInputSchema = z.object({
  extension: nonEmptyStringSchema,
  target: nonEmptyStringSchema
});

export const extensionRegistrationOutputSchema = z.object({
  expiresAt: z.string(),
  extension: z.string(),
  refreshed: z.boolean(),
  registered: z.boolean(),
  target: z.string()
});

export const extensionRegistryRecordOutputSchema = z.object({
  expiresAt: z.string(),
  extension: z.string(),
  registeredAt: z.string(),
  target: z.string()
});

export const extensionRegistryListInputSchema = z
  .object({
    target: nonEmptyStringSchema.optional()
  })
  .default({});

export const extensionRegistryListOutputSchema = z.object({
  extensions: z.array(extensionRegistryRecordOutputSchema)
});

export type ExtensionRegistrationInput = z.infer<typeof extensionRegistrationInputSchema>;
export type ExtensionRegistrationOutput = z.infer<typeof extensionRegistrationOutputSchema>;
export type ExtensionRegistryRecordOutput = z.output<typeof extensionRegistryRecordOutputSchema>;
export type ExtensionRegistryListInput = z.output<typeof extensionRegistryListInputSchema>;
export type ExtensionRegistryListOutput = z.output<typeof extensionRegistryListOutputSchema>;
