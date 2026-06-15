export type { TelemetryAttributes, TelemetryAttributeValue } from './contracts.js';
export {
  incrementTelemetryCounter,
  recordTelemetryHistogram,
  runWithRootTelemetryContext,
  setTelemetryGauge,
  startTelemetryRuntime,
  startTelemetrySpan,
  telemetryEnabled,
  timeTelemetrySpan
} from './recorder.js';
