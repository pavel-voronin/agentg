import { z } from 'zod';

import { toJsonValue } from '../json.js';
import {
  extensionError,
  extensionOk,
  type DomainError,
  type ProcedureEnvelope,
  type ProcedureExtensionEnvelope,
  type ProcedureExtensions
} from './envelope.js';

export const DEFAULT_EXTENSION_REGISTRATION_TTL_MS = 60_000;
export const DEFAULT_EXTENSION_CALL_TIMEOUT_MS = 5_000;

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

export const extensionRecordOutputSchema = z.object({
  expiresAt: z.string(),
  extension: z.string(),
  registeredAt: z.string(),
  slug: z.string(),
  target: z.string()
});

export const extensionListOutputSchema = z.object({
  extensions: z.array(extensionRecordOutputSchema)
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

export const extensionCallInputSchema = z.object({
  callId: nonEmptyStringSchema,
  input: z.unknown().optional(),
  output: z.unknown(),
  target: nonEmptyStringSchema
});

export const extensionCallOutputSchema = z.unknown();

export type ExtensionRegistrationInput = z.infer<typeof extensionRegistrationInputSchema>;
export type ExtensionRegistrationOutput = z.infer<typeof extensionRegistrationOutputSchema>;
export type ExtensionRecordOutput = z.output<typeof extensionRecordOutputSchema>;
export type ExtensionListOutput = z.output<typeof extensionListOutputSchema>;
export type ExtensionRegistryRecordOutput = z.output<typeof extensionRegistryRecordOutputSchema>;
export type ExtensionRegistryListInput = z.output<typeof extensionRegistryListInputSchema>;
export type ExtensionRegistryListOutput = z.output<typeof extensionRegistryListOutputSchema>;
export type ExtensionCallInput = z.infer<typeof extensionCallInputSchema>;

export type ExtensionRegistration = ExtensionRegistrationInput & {
  expiresAt: Date;
  registeredAt: Date;
  slug: string;
};

export type ExtensionRegistry = {
  cleanup(now?: Date): number;
  list(target: string, now?: Date): ExtensionRegistration[];
  listAll(now?: Date): ExtensionRegistration[];
  register(input: ExtensionRegistrationInput, now?: Date): ExtensionRegistrationOutput;
};

export type ExtensionCaller = (
  extension: string,
  input: ExtensionCallInput
) => Promise<ProcedureEnvelope<unknown> | ProcedureExtensionEnvelope<unknown>>;

export type ExtensionCallerResolver = (slug: string) => ExtensionCaller | undefined;

export type RegisteredExtensionCallOptions = {
  callId: string;
  input: unknown;
  output: unknown;
  registry?: ExtensionRegistry | undefined;
  resolveCaller?: ExtensionCallerResolver | undefined;
  target: string;
  timeoutMs?: number | undefined;
};

type StoredExtensionRegistration = ExtensionRegistration & {
  key: string;
};

export function createExtensionRegistry(options: { ttlMs?: number } = {}): ExtensionRegistry {
  const ttlMs = options.ttlMs ?? DEFAULT_EXTENSION_REGISTRATION_TTL_MS;
  const registrations = new Map<string, StoredExtensionRegistration>();

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
    list(target, now = new Date()): ExtensionRegistration[] {
      this.cleanup(now);
      return Array.from(registrations.values())
        .filter((registration) => registration.target === target)
        .sort((left, right) => left.extension.localeCompare(right.extension))
        .map(publicRegistration);
    },
    listAll(now = new Date()): ExtensionRegistration[] {
      this.cleanup(now);
      return Array.from(registrations.values())
        .sort((left, right) => {
          const targetOrder = left.target.localeCompare(right.target);
          return targetOrder === 0 ? left.extension.localeCompare(right.extension) : targetOrder;
        })
        .map(publicRegistration);
    },
    register(input, now = new Date()): ExtensionRegistrationOutput {
      this.cleanup(now);

      const parsed = extensionRegistrationInputSchema.parse(input);
      const slug = extensionSlug(parsed.extension);
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
        registeredAt: now,
        slug
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

export async function callRegisteredExtensions(
  options: RegisteredExtensionCallOptions
): Promise<ProcedureExtensions> {
  const registrations = options.registry?.list(options.target) ?? [];
  if (registrations.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    registrations.map(async (registration) => [
      registration.extension,
      await callRegisteredExtension(options, registration)
    ])
  );

  return Object.fromEntries(entries) as ProcedureExtensions;
}

export function extensionEnvelopeFromProcedureEnvelope(
  envelope: ProcedureEnvelope<unknown> | ProcedureExtensionEnvelope<unknown>
): ProcedureExtensionEnvelope {
  if (isFullProcedureEnvelope(envelope)) {
    if (envelope.ok) {
      return extensionOk(toJsonValue(envelope.result));
    }

    return extensionError(envelope.error);
  }

  if (envelope.ok) {
    return extensionOk(toJsonValue(envelope.result));
  }

  return extensionError(envelope.error);
}

export function serializeExtensionRegistration(
  registration: ExtensionRegistration
): ExtensionRecordOutput {
  return {
    expiresAt: registration.expiresAt.toISOString(),
    extension: registration.extension,
    registeredAt: registration.registeredAt.toISOString(),
    slug: registration.slug,
    target: registration.target
  };
}

function publicRegistration(registration: StoredExtensionRegistration): ExtensionRegistration {
  return {
    expiresAt: registration.expiresAt,
    extension: registration.extension,
    registeredAt: registration.registeredAt,
    slug: registration.slug,
    target: registration.target
  };
}

async function callRegisteredExtension(
  options: RegisteredExtensionCallOptions,
  registration: ExtensionRegistration
): Promise<ProcedureExtensionEnvelope> {
  const caller = options.resolveCaller?.(registration.slug);
  if (caller === undefined) {
    return extensionError({
      code: 'extension_service_unavailable',
      message: `Extension service is unavailable: ${registration.slug}`
    });
  }

  try {
    const envelope = await withTimeout(
      caller(registration.extension, {
        callId: options.callId,
        input: options.input,
        output: options.output,
        target: options.target
      }),
      options.timeoutMs ?? DEFAULT_EXTENSION_CALL_TIMEOUT_MS,
      registration.extension
    );

    return extensionEnvelopeFromProcedureEnvelope(envelope);
  } catch (error) {
    return extensionError(errorToExtensionDomainError(error, registration.extension));
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  extension: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new ExtensionTimeoutError(extension, timeoutMs));
    }, timeoutMs);
    timeout.unref();
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

class ExtensionTimeoutError extends Error {
  readonly extension: string;
  readonly timeoutMs: number;

  constructor(extension: string, timeoutMs: number) {
    super(`Extension timed out after ${String(timeoutMs)}ms: ${extension}`);
    this.name = 'ExtensionTimeoutError';
    this.extension = extension;
    this.timeoutMs = timeoutMs;
  }
}

function errorToExtensionDomainError(error: unknown, extension: string): DomainError {
  if (error instanceof ExtensionTimeoutError) {
    return {
      code: 'extension_timeout',
      details: {
        extension,
        timeoutMs: error.timeoutMs
      },
      message: error.message
    };
  }

  if (error instanceof Error) {
    return {
      code: 'extension_failed',
      details: {
        extension
      },
      message: error.message
    };
  }

  return {
    code: 'extension_failed',
    details: {
      extension
    },
    message: String(error)
  };
}

function extensionSlug(extension: string): string {
  const [slug] = extension.split('.');
  if (slug === undefined || slug.length === 0 || slug === extension) {
    throw new Error(`Extension must include a slug prefix: ${extension}`);
  }

  return slug;
}

function registrationKey(input: ExtensionRegistrationInput): string {
  return `${input.target}\u0000${input.extension}`;
}

function isFullProcedureEnvelope(
  envelope: ProcedureEnvelope<unknown> | ProcedureExtensionEnvelope<unknown>
): envelope is ProcedureEnvelope<unknown> {
  return 'extensions' in envelope;
}
