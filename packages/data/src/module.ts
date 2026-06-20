import { defineModule } from '@agentg/framework';

import { readConfig } from './config.js';
import { createDatabase } from './database/client.js';
import { createProviderRegistry } from './providers.js';
import { createRuntime } from './runtime.js';
import { createPostgresStore } from './store.js';

export const moduleDefinition = defineModule('data', {
  config: readConfig,
  setup({ config, resource }) {
    const database = resource('database', ({ startup }) => {
      const resource = createDatabase(config.databaseUrl);

      startup(() => resource.start());

      return resource.db;
    });
    const runtime = resource('runtime', () =>
      createRuntime({
        providers: createProviderRegistry({
          targets: config.providerTargets,
          timeoutMs: config.dispatchTimeoutMs
        }),
        store: createPostgresStore(database)
      })
    );

    return {
      'data.expand': (input: unknown) => runtime.actionExpand(input),
      'data.get': (input: unknown) => runtime.actionGet(input),
      'data.render': (input: unknown) => runtime.actionRender(input),
      'data.select': (input: unknown) => runtime.actionSelect(input),
      'data.writeAnnotation': (input: unknown) => runtime.actionWriteAnnotation(input),
      'data.writeCollectionItem': (input: unknown) => runtime.actionWriteCollectionItem(input),
      expand: (input: unknown) => runtime.expand(input),
      get: (input: unknown) => runtime.get(input),
      getAnnotation: (input: unknown) => runtime.getAnnotation(input),
      getCollectionItem: (input: unknown) => runtime.getCollectionItem(input),
      listAnnotations: (input: unknown) => runtime.listAnnotations(input),
      listCollection: (input: unknown) => runtime.listCollection(input),
      listModels: () => runtime.listModels(),
      render: (input: unknown) => runtime.render(input),
      select: (input: unknown) => runtime.select(input),
      writeAnnotation: (input: unknown) => runtime.writeAnnotation(input),
      writeCollectionItem: (input: unknown) => runtime.writeCollectionItem(input)
    };
  }
});
