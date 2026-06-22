import type { dataClient } from '../../src/index.js';
import { METHODS } from '../contracts.js';

type Client = ReturnType<typeof dataClient>;

type Resources = {
  client: Client;
};

export function createProcedures(
  resources: Resources
): Record<string, (input: unknown) => Promise<unknown>> {
  return {
    [METHODS.browseAnnotations]: (input) => resources.client.browseAnnotations(input),
    [METHODS.browseCollection]: (input) => resources.client.browseCollection(input),
    [METHODS.overview]: () => resources.client.overview(),
    [METHODS.selectPage]: (input) => resources.client.selectPage(input)
  };
}
