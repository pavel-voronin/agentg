import {
  extensionRegistrationInputSchema,
  extensionRegistryListInputSchema,
  type ExtensionRegistrationInput,
  type ExtensionRegistrationOutput,
  type ExtensionRegistryListInput,
  type ExtensionRegistryRecordOutput
} from '@agentg/shared/rpc/extensions';

export type ExtensionRegistryRegistration = ExtensionRegistrationInput & {
  expiresAt: Date;
  registeredAt: Date;
};

export type ExtensionRegistry = {
  cleanup(now?: Date): number;
  list(input?: ExtensionRegistryListInput, now?: Date): ExtensionRegistryRecordOutput[];
  register(input: ExtensionRegistrationInput, now?: Date): ExtensionRegistrationOutput;
};

type StoredExtensionRegistryRegistration = ExtensionRegistryRegistration & {
  key: string;
};

export function createExtensionRegistry(options: { ttlMs?: number } = {}): ExtensionRegistry {
  const ttlMs = options.ttlMs ?? 60_000;
  const registrations = new Map<string, StoredExtensionRegistryRegistration>();

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
    list(input = {}, now = new Date()): ExtensionRegistryRecordOutput[] {
      this.cleanup(now);
      const parsed = extensionRegistryListInputSchema.parse(input);

      return Array.from(registrations.values())
        .filter((registration) =>
          parsed.target === undefined ? true : registration.target === parsed.target
        )
        .sort(compareRegistrations)
        .map(serializeRegistration);
    },
    register(input, now = new Date()): ExtensionRegistrationOutput {
      this.cleanup(now);

      const parsed = extensionRegistrationInputSchema.parse(input);
      const key = registrationKey(parsed);
      const expiresAt = new Date(now.getTime() + ttlMs);
      const existing = registrations.get(key);

      if (existing !== undefined) {
        existing.expiresAt = expiresAt;
        return {
          expiresAt: expiresAt.toISOString(),
          extension: existing.extension,
          refreshed: true,
          registered: false,
          target: existing.target
        };
      }

      registrations.set(key, {
        ...parsed,
        expiresAt,
        key,
        registeredAt: now
      });

      return {
        expiresAt: expiresAt.toISOString(),
        extension: parsed.extension,
        refreshed: false,
        registered: true,
        target: parsed.target
      };
    }
  };
}

function compareRegistrations(
  left: StoredExtensionRegistryRegistration,
  right: StoredExtensionRegistryRegistration
): number {
  const targetOrder = left.target.localeCompare(right.target);
  return targetOrder === 0 ? left.extension.localeCompare(right.extension) : targetOrder;
}

function serializeRegistration(
  registration: StoredExtensionRegistryRegistration
): ExtensionRegistryRecordOutput {
  return {
    expiresAt: registration.expiresAt.toISOString(),
    extension: registration.extension,
    registeredAt: registration.registeredAt.toISOString(),
    target: registration.target
  };
}

function registrationKey(input: ExtensionRegistrationInput): string {
  return `${input.target}\u0000${input.extension}`;
}
