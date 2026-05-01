import { createNatsEventBus } from '@agentg/shared/events/bus';

import { runAgentGateway } from './agent-gateway.js';
import { loadGatewayConfig } from './config.js';

const config = loadGatewayConfig();

try {
  const eventBus = await createNatsEventBus(config.nats);
  await runAgentGateway({
    config: config.gateway,
    eventBus,
    services: config.services
  });
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'agent_gateway.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
}
