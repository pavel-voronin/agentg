import { defineInternalRpcDomain } from '@agentg/framework';

import type {
  Dataset,
  DatasetRow,
  ExpandInput,
  GetInput,
  RenderInput,
  SelectInput
} from './schema.js';

type ProviderProcedures = {
  dataExpand(input: ExpandInput): Promise<Dataset>;
  dataGet(input: GetInput): Promise<DatasetRow | null>;
  dataRender(input: RenderInput): Promise<Dataset>;
  dataSelect(input: SelectInput): Promise<Dataset>;
};

export type ProviderRegistry = {
  expand: (provider: string, input: ExpandInput) => Promise<Dataset>;
  get: (provider: string, input: GetInput) => Promise<DatasetRow | null>;
  render: (provider: string, input: RenderInput) => Promise<Dataset>;
  select: (provider: string, input: SelectInput) => Promise<Dataset>;
};

export function createProviderRegistry(input: {
  readonly targets: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
}): ProviderRegistry {
  return {
    expand(provider, request) {
      return client(input, provider).dataExpand(request);
    },
    get(provider, request) {
      return client(input, provider).dataGet(request);
    },
    render(provider, request) {
      return client(input, provider).dataRender(request);
    },
    select(provider, request) {
      return client(input, provider).dataSelect(request);
    }
  };
}

function client(
  input: {
    readonly targets: Readonly<Record<string, string>>;
    readonly timeoutMs: number;
  },
  provider: string
) {
  const url = input.targets[provider];
  if (url === undefined) {
    throw new Error(`Data provider target is not configured: ${provider}`);
  }
  return defineInternalRpcDomain<ProviderProcedures>(provider)({
    timeoutMs: input.timeoutMs,
    url
  });
}
