import { loadExtensionRegistryServiceConfig } from './config.js';
import { runExtensionRegistryService } from './service.js';

const config = loadExtensionRegistryServiceConfig();

try {
  await runExtensionRegistryService(config);
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
      event: 'extension_registry.failed'
    })
  );
  process.exitCode = 1;
}
