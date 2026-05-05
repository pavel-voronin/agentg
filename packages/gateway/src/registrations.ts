export function createGatewayServiceManifest(config: { serviceUrl: string }) {
  return {
    events: [],
    extensions: [],
    procedures: [],
    required: true,
    rpcUrl: config.serviceUrl,
    slug: 'gateway'
  };
}
