import { createNatsEventBus } from '@agentg/shared/events/bus';

import { loadServiceDirectoryServiceConfig } from './config.js';
import { runServiceDirectoryService } from './service.js';

const config = loadServiceDirectoryServiceConfig();

try {
  const eventBus = await createNatsEventBus(config.nats);
  await runServiceDirectoryService({
    config,
    eventBus
  });
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'service_directory.failed'
    })
  );
  process.exitCode = 1;
}
