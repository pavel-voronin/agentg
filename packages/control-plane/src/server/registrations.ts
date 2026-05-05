export function createControlPlaneServiceManifest(config: { serviceUrl: string }) {
  return {
    events: [],
    extensions: [],
    procedures: [],
    required: true,
    rpcUrl: config.serviceUrl,
    slug: 'control-plane'
  };
}
