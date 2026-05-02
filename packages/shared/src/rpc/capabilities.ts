import { z } from 'zod';

export const DEFAULT_CAPABILITY_REGISTRATION_TTL_MS = 60_000;

const nonEmptyStringSchema = z.string().trim().min(1);

export const capabilityRpcTypeSchema = z.enum(['mutation', 'query']);

export const capabilityRegistrationInputSchema = z.object({
  description: nonEmptyStringSchema.optional(),
  moduleSlug: nonEmptyStringSchema,
  name: nonEmptyStringSchema,
  rpcMethod: nonEmptyStringSchema,
  rpcType: capabilityRpcTypeSchema.default('query'),
  serviceUrl: nonEmptyStringSchema
});

export const capabilityRegistrationOutputSchema = z.object({
  expiresAt: z.string(),
  moduleSlug: z.string(),
  name: z.string(),
  refreshed: z.boolean(),
  registered: z.boolean(),
  rpcMethod: z.string(),
  rpcType: capabilityRpcTypeSchema,
  serviceUrl: z.string()
});

export const capabilityRecordOutputSchema = z.object({
  description: z.string().optional(),
  expiresAt: z.string(),
  moduleSlug: z.string(),
  name: z.string(),
  registeredAt: z.string(),
  rpcMethod: z.string(),
  rpcType: capabilityRpcTypeSchema,
  serviceUrl: z.string()
});

export const capabilityListOutputSchema = z.object({
  capabilities: z.array(capabilityRecordOutputSchema)
});

export const capabilityCallInputSchema = z.object({
  input: z.unknown().optional(),
  name: nonEmptyStringSchema
});

export type CapabilityRpcType = z.infer<typeof capabilityRpcTypeSchema>;
export type CapabilityRegistrationInput = z.input<typeof capabilityRegistrationInputSchema>;
export type CapabilityRegistrationOutput = z.output<typeof capabilityRegistrationOutputSchema>;
export type CapabilityRecordOutput = z.output<typeof capabilityRecordOutputSchema>;
export type CapabilityListOutput = z.output<typeof capabilityListOutputSchema>;
export type CapabilityCallInput = z.infer<typeof capabilityCallInputSchema>;

export type CapabilityRegistration = {
  description?: string | undefined;
  expiresAt: Date;
  moduleSlug: string;
  name: string;
  registeredAt: Date;
  rpcMethod: string;
  rpcType: CapabilityRpcType;
  serviceUrl: string;
};

export type CapabilityRegistry = {
  cleanup(now?: Date): number;
  get(name: string, now?: Date): CapabilityRegistration | undefined;
  listAll(now?: Date): CapabilityRegistration[];
  register(input: CapabilityRegistrationInput, now?: Date): CapabilityRegistrationOutput;
};

type StoredCapabilityRegistration = CapabilityRegistration & {
  key: string;
};

export function createCapabilityRegistry(options: { ttlMs?: number } = {}): CapabilityRegistry {
  const ttlMs = options.ttlMs ?? DEFAULT_CAPABILITY_REGISTRATION_TTL_MS;
  const registrations = new Map<string, StoredCapabilityRegistration>();

  return {
    cleanup(now = new Date()): number {
      let removed = 0;
      for (const [key, registration] of registrations) {
        if (registration.expiresAt <= now) {
          registrations.delete(key);
          removed += 1;
        }
      }

      return removed;
    },
    get(name, now = new Date()): CapabilityRegistration | undefined {
      this.cleanup(now);
      const registration = registrations.get(name);
      return registration === undefined ? undefined : publicRegistration(registration);
    },
    listAll(now = new Date()): CapabilityRegistration[] {
      this.cleanup(now);
      return Array.from(registrations.values())
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(publicRegistration);
    },
    register(input, now = new Date()): CapabilityRegistrationOutput {
      this.cleanup(now);

      const parsed = capabilityRegistrationInputSchema.parse(input);
      assertNamespacedCapability(parsed.moduleSlug, parsed.name);

      const expiresAt = new Date(now.getTime() + ttlMs);
      const existing = registrations.get(parsed.name);

      if (existing !== undefined) {
        assertCompatibleRefresh(existing, parsed);
        existing.expiresAt = expiresAt;
        if (parsed.description !== undefined) {
          existing.description = parsed.description;
        }

        return {
          expiresAt: expiresAt.toISOString(),
          moduleSlug: existing.moduleSlug,
          name: existing.name,
          refreshed: true,
          registered: false,
          rpcMethod: existing.rpcMethod,
          rpcType: existing.rpcType,
          serviceUrl: existing.serviceUrl
        };
      }

      registrations.set(parsed.name, {
        ...(parsed.description === undefined ? {} : { description: parsed.description }),
        expiresAt,
        key: parsed.name,
        moduleSlug: parsed.moduleSlug,
        name: parsed.name,
        registeredAt: now,
        rpcMethod: parsed.rpcMethod,
        rpcType: parsed.rpcType,
        serviceUrl: parsed.serviceUrl
      });

      return {
        expiresAt: expiresAt.toISOString(),
        moduleSlug: parsed.moduleSlug,
        name: parsed.name,
        refreshed: false,
        registered: true,
        rpcMethod: parsed.rpcMethod,
        rpcType: parsed.rpcType,
        serviceUrl: parsed.serviceUrl
      };
    }
  };
}

export function serializeCapabilityRegistration(
  registration: CapabilityRegistration
): CapabilityRecordOutput {
  return {
    ...(registration.description === undefined ? {} : { description: registration.description }),
    expiresAt: registration.expiresAt.toISOString(),
    moduleSlug: registration.moduleSlug,
    name: registration.name,
    registeredAt: registration.registeredAt.toISOString(),
    rpcMethod: registration.rpcMethod,
    rpcType: registration.rpcType,
    serviceUrl: registration.serviceUrl
  };
}

function publicRegistration(registration: StoredCapabilityRegistration): CapabilityRegistration {
  return {
    ...(registration.description === undefined ? {} : { description: registration.description }),
    expiresAt: registration.expiresAt,
    moduleSlug: registration.moduleSlug,
    name: registration.name,
    registeredAt: registration.registeredAt,
    rpcMethod: registration.rpcMethod,
    rpcType: registration.rpcType,
    serviceUrl: registration.serviceUrl
  };
}

function assertNamespacedCapability(moduleSlug: string, name: string): void {
  if (!name.startsWith(`${moduleSlug}.`)) {
    throw new Error(`Capability name must use module slug prefix: ${moduleSlug}`);
  }
}

function assertCompatibleRefresh(
  existing: CapabilityRegistration,
  input: z.output<typeof capabilityRegistrationInputSchema>
): void {
  if (
    existing.moduleSlug !== input.moduleSlug ||
    existing.rpcMethod !== input.rpcMethod ||
    existing.rpcType !== input.rpcType ||
    existing.serviceUrl !== input.serviceUrl
  ) {
    throw new Error(`Capability name is already registered: ${input.name}`);
  }
}
