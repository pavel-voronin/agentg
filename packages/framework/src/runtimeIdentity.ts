export function configuredServiceName(fallback: string): string {
  const configured = process.env.OTEL_SERVICE_NAME?.trim();
  return configured === undefined || configured.length === 0 ? fallback : configured;
}
