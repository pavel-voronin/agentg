import { createAppDatabase } from '@agentg/database/client';
import { createDatabasePool } from '@agentg/database/database';
import { createNatsEventBus } from '@agentg/shared/events/bus';

import { runAgentGateway } from './agent-gateway.js';
import { loadGatewayConfig } from './config.js';

const config = loadGatewayConfig();
const pool = createDatabasePool(config.databaseUrl);
const database = createAppDatabase(pool);

try {
  const eventBus = await createNatsEventBus(config.nats);
  await runAgentGateway({
    config: config.gateway,
    database,
    eventBus
  });
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'agent_gateway.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
