import type { EventBus } from '@agentg/shared/events/bus';
import { createIntegrationEvent } from '@agentg/shared/events/envelope';

import { type ServiceDirectory } from '../registry.js';
import {
  SERVICE_DIRECTORY_CHANGED_EVENT,
  serviceDirectoryJoinOutputSchema,
  serviceDirectoryLeaseRenewInputSchema,
  serviceDirectoryManifestInputSchema,
  serviceDirectoryRenewOutputSchema,
  serviceDirectorySnapshotSchema
} from './contracts.js';
import { rpc, serviceDirectoryRpcRouter } from './trpc.js';

export function createServiceDirectoryRouter(directory: ServiceDirectory, eventBus?: EventBus) {
  return serviceDirectoryRpcRouter({
    getSnapshot: rpc.output(serviceDirectorySnapshotSchema).query(() => {
      const result = directory.getSnapshot();
      publishServiceDirectoryChanged(eventBus, result.changed, result.output.version);
      return result.output;
    }),
    join: rpc
      .input(serviceDirectoryManifestInputSchema)
      .output(serviceDirectoryJoinOutputSchema)
      .mutation(({ input }) => {
        const result = directory.join(input);
        publishServiceDirectoryChanged(eventBus, result.changed, result.output.snapshot.version);
        return result.output;
      }),
    renew: rpc
      .input(serviceDirectoryLeaseRenewInputSchema)
      .output(serviceDirectoryRenewOutputSchema)
      .mutation(({ input }) => {
        const result = directory.renew(input);
        publishServiceDirectoryChanged(eventBus, result.changed, result.output.snapshot.version);
        return result.output;
      })
  });
}

export type ServiceDirectoryRouter = ReturnType<typeof createServiceDirectoryRouter>;

export function publishServiceDirectoryChanged(
  eventBus: EventBus | undefined,
  changed: boolean,
  version: number
): void {
  if (!changed) {
    return;
  }

  eventBus?.publish(
    createIntegrationEvent({
      data: {
        version
      },
      source: 'service-directory',
      type: SERVICE_DIRECTORY_CHANGED_EVENT
    })
  );
}
