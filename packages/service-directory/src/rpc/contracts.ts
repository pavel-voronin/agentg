import { z } from 'zod';

export const DEFAULT_SERVICE_DIRECTORY_LEASE_TTL_MS = 60_000;
export const DEFAULT_SERVICE_DIRECTORY_RENEW_INTERVAL_MS = 30_000;
export const SERVICE_DIRECTORY_CHANGED_EVENT = 'service_directory.changed';

const nonEmptyStringSchema = z.string().trim().min(1);
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema).default([]);

export const serviceDirectoryProcedureKindSchema = z.enum(['mutation', 'query']);

export const serviceDirectoryProcedureInputSchema = z.object({
  kind: serviceDirectoryProcedureKindSchema,
  name: nonEmptyStringSchema
});

export const serviceDirectoryExtensionInputSchema = z.object({
  extension: nonEmptyStringSchema,
  target: nonEmptyStringSchema
});

export const serviceDirectoryManifestInputSchema = z.object({
  controlPlane: z.unknown().optional(),
  events: nonEmptyStringArraySchema,
  extensions: z.array(serviceDirectoryExtensionInputSchema).default([]),
  procedures: z.array(serviceDirectoryProcedureInputSchema).default([]),
  required: z.boolean(),
  rpcUrl: nonEmptyStringSchema,
  slug: nonEmptyStringSchema
});

export const serviceDirectoryLeaseRenewInputSchema = z.object({
  leaseToken: nonEmptyStringSchema,
  slug: nonEmptyStringSchema
});

export const serviceDirectoryLeaseSchema = z.object({
  expiresAt: z.iso.datetime(),
  leaseToken: nonEmptyStringSchema,
  slug: nonEmptyStringSchema
});

export const serviceDirectoryServiceRecordSchema = z.object({
  controlPlane: z.unknown().optional(),
  events: z.array(nonEmptyStringSchema),
  expiresAt: z.iso.datetime(),
  extensions: z.array(serviceDirectoryExtensionInputSchema),
  procedures: z.array(serviceDirectoryProcedureInputSchema),
  registeredAt: z.iso.datetime(),
  required: z.boolean(),
  rpcUrl: nonEmptyStringSchema,
  slug: nonEmptyStringSchema
});

export const serviceDirectoryExtensionRecordSchema = z.object({
  expiresAt: z.iso.datetime(),
  extension: nonEmptyStringSchema,
  registeredAt: z.iso.datetime(),
  rpcUrl: nonEmptyStringSchema,
  serviceSlug: nonEmptyStringSchema,
  target: nonEmptyStringSchema
});

export const serviceDirectorySnapshotSchema = z.object({
  extensions: z.array(serviceDirectoryExtensionRecordSchema),
  services: z.array(serviceDirectoryServiceRecordSchema),
  version: z.number().int().nonnegative()
});

export const serviceDirectoryJoinOutputSchema = z.object({
  lease: serviceDirectoryLeaseSchema,
  snapshot: serviceDirectorySnapshotSchema
});

export const serviceDirectoryRenewOutputSchema = serviceDirectoryJoinOutputSchema;

export type ServiceDirectoryExtensionInput = z.input<typeof serviceDirectoryExtensionInputSchema>;
export type ServiceDirectoryManifestInput = z.input<typeof serviceDirectoryManifestInputSchema>;
export type ServiceDirectoryProcedureKind = z.output<typeof serviceDirectoryProcedureKindSchema>;
export type ServiceDirectoryProcedureInput = z.input<typeof serviceDirectoryProcedureInputSchema>;
export type ServiceDirectoryProcedureRecord = z.output<typeof serviceDirectoryProcedureInputSchema>;
export type ServiceDirectoryLeaseRenewInput = z.input<typeof serviceDirectoryLeaseRenewInputSchema>;
export type ServiceDirectoryLease = z.output<typeof serviceDirectoryLeaseSchema>;
export type ServiceDirectoryServiceRecord = z.output<typeof serviceDirectoryServiceRecordSchema>;
export type ServiceDirectoryExtensionRecord = z.output<
  typeof serviceDirectoryExtensionRecordSchema
>;
export type ServiceDirectorySnapshot = z.output<typeof serviceDirectorySnapshotSchema>;
export type ServiceDirectoryJoinOutput = z.output<typeof serviceDirectoryJoinOutputSchema>;
export type ServiceDirectoryRenewOutput = z.output<typeof serviceDirectoryRenewOutputSchema>;
