import { defineInternalRpcDomain, type JsonValue } from '@agentg/framework';

import type { Document } from './schema.js';

type TriggerProcedures = {
  replaceRegistrations(input: {
    owner: { key: string; module: string };
    registrations: readonly {
      action: { input: JsonValue; module: string; procedure: string };
      condition: { everySeconds: number; kind: 'periodic'; startAt?: string | undefined };
      name: string;
    }[];
  }): Promise<{ registrations: readonly { key: string; name: string }[] }>;
};

export type RegistrationClient = {
  replace: (document: Document | null, name: string) => Promise<readonly TriggerBinding[]>;
};

export type TriggerBinding = {
  key: string;
  registrationKey: string;
  triggerName: string;
};

export function createRegistrationClient(input: {
  readonly timeoutMs: number;
  readonly url: string;
}): RegistrationClient {
  const client = defineInternalRpcDomain<TriggerProcedures>('triggers')({
    timeoutMs: input.timeoutMs,
    url: input.url
  });
  return {
    async replace(document, name) {
      const registrations =
        document === null
          ? []
          : Object.entries(document.spec.triggers ?? {}).map(([triggerName, trigger]) => ({
              action: {
                input: {
                  pipelineName: document.metadata.name,
                  triggerName
                },
                module: 'pipelines',
                procedure: 'runTriggered'
              },
              condition: trigger,
              name: triggerName
            }));
      const result = await client.replaceRegistrations({
        owner: {
          key: name,
          module: 'pipelines'
        },
        registrations
      });
      return result.registrations.map((registration) => ({
        key: `${name}:${registration.name}`,
        registrationKey: registration.key,
        triggerName: registration.name
      }));
    }
  };
}
