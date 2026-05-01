import { createNatsEventBus } from '@agentg/shared/events/bus';

import { loadControlPlaneConfig } from './config.js';
import { runControlPlaneServer } from './control-plane-server.js';

const config = loadControlPlaneConfig();

try {
  const eventBus = await createNatsEventBus(config.nats);
  await runControlPlaneServer({
    config: config.controlPlane,
    eventBus,
    services: config.services
  });
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'control_plane.failed'
    })
  );
  process.exitCode = 1;
}
