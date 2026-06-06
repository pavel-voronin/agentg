import { ref, type Ref } from 'vue';

import { NATS_REPORT_PROCEDURE } from '../contracts.js';
import { parseNatsReport, type NatsReport } from './natsView.js';

type ReportHost = {
  rpc(procedure: string, input?: unknown): Promise<unknown>;
};

type SourceMarkers = {
  markSourceAccepted(
    sourceId: string,
    details?: { generatedAt?: string | undefined; generatedInMs?: number | undefined }
  ): void;
  markSourceError(
    sourceId: string,
    error: string,
    details?: { generatedAt?: string | undefined; generatedInMs?: number | undefined }
  ): void;
};

export function useNatsTelemetryReport(
  host: ReportHost,
  sources: SourceMarkers
): {
  acceptNatsReport: (value: unknown) => void;
  ensureNatsReport: () => Promise<void>;
  loadNatsReport: () => Promise<void>;
  natsError: Ref<string | null>;
  natsLoading: Ref<boolean>;
  natsReport: Ref<NatsReport | null>;
} {
  const natsReport = ref<NatsReport | null>(null);
  const natsError = ref<string | null>(null);
  const natsLoading = ref(false);

  async function ensureNatsReport(): Promise<void> {
    if (natsReport.value !== null || natsLoading.value) {
      return;
    }
    await loadNatsReport();
  }

  async function loadNatsReport(): Promise<void> {
    natsLoading.value = true;
    try {
      acceptNatsReport(await host.rpc(NATS_REPORT_PROCEDURE));
    } catch (loadError) {
      const message = errorMessage(loadError);
      natsError.value = message;
      sources.markSourceError('telemetry.nats', message);
    } finally {
      natsLoading.value = false;
    }
  }

  function acceptNatsReport(value: unknown): void {
    const parsed = parseNatsReport(value);
    natsReport.value = parsed;
    natsError.value = null;
    if (parsed.ok) {
      sources.markSourceAccepted('telemetry.nats', {
        generatedAt: parsed.generatedAt,
        generatedInMs: parsed.generatedInMs
      });
      return;
    }
    sources.markSourceError('telemetry.nats', parsed.error ?? 'NATS monitoring error', {
      generatedAt: parsed.generatedAt,
      generatedInMs: parsed.generatedInMs
    });
  }

  return {
    acceptNatsReport,
    ensureNatsReport,
    loadNatsReport,
    natsError,
    natsLoading,
    natsReport
  };
}

function errorMessage(errorValue: unknown): string {
  return errorValue instanceof Error ? errorValue.message : String(errorValue);
}
