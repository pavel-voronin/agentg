import {
  defineModule,
  TELEMETRY_NATS_REPORT_EVENT_TYPE,
  TELEMETRY_RECORDS_EVENT_TYPE,
  TELEMETRY_REPORT_EVENT_TYPE
} from '@agentg/framework';

import { readConfig } from './config.js';
import { createNatsMonitor, type NatsMonitor } from './natsMonitor.js';
import { createStorage, type Storage } from './storage.js';

export const collectorModule = defineModule('telemetry', {
  config: readConfig,
  setup({ config, events, startup }) {
    let monitor: NatsMonitor | undefined;
    let storage: Storage | undefined;

    startup('storage', () => {
      const activeStorage = createStorage({
        path: config.storagePath
      });
      const activeMonitor = createNatsMonitor({
        monitoringUrl: config.natsMonitoringUrl,
        requestTimeoutMs: config.natsMonitoringTimeoutMs
      });
      monitor = activeMonitor;
      storage = activeStorage;
      const subscription = events.subscribe(TELEMETRY_RECORDS_EVENT_TYPE, (event) => {
        activeStorage.writeBatch(event.data);
      });
      const stopReports = startReportPublisher(activeStorage);
      const stopNatsReports = startNatsReportPublisher(activeMonitor);
      return () => {
        stopNatsReports();
        stopReports();
        subscription.unsubscribe();
        activeStorage.close();
        monitor = undefined;
        storage = undefined;
      };
    });

    function nats() {
      return requireMonitor(monitor).readReport();
    }

    function report(input: unknown) {
      return requireStorage(storage).readReport(reportOptions(input));
    }

    function reset() {
      const activeStorage = requireStorage(storage);
      activeStorage.reset();
      return activeStorage.readReport();
    }

    function startReportPublisher(activeStorage: Storage): () => void {
      const publish = (): void => {
        events.publish(TELEMETRY_REPORT_EVENT_TYPE, activeStorage.readReport());
      };
      publish();
      const interval = setInterval(publish, config.reportIntervalMs);
      interval.unref();
      return () => {
        clearInterval(interval);
      };
    }

    function startNatsReportPublisher(activeMonitor: NatsMonitor): () => void {
      let active = true;
      let publishing = false;
      const publish = (): void => {
        if (publishing) {
          return;
        }
        publishing = true;
        void activeMonitor
          .readReport()
          .then((current) => {
            if (active) {
              events.publish(TELEMETRY_NATS_REPORT_EVENT_TYPE, current);
            }
          })
          .catch(() => undefined)
          .finally(() => {
            publishing = false;
          });
      };
      publish();
      const interval = setInterval(publish, config.reportIntervalMs);
      interval.unref();
      return () => {
        active = false;
        clearInterval(interval);
      };
    }

    return {
      procedures: {
        nats,
        report,
        reset
      },
      required: true
    };
  }
});

function reportOptions(input: unknown): { recordLimit?: number | undefined } {
  if (input === undefined || input === null) {
    return {};
  }
  if (!isRecord(input)) {
    throw new Error('Telemetry report input must contain recordLimit');
  }
  if (!('recordLimit' in input)) {
    return {};
  }
  if (
    typeof input.recordLimit === 'number' &&
    Number.isFinite(input.recordLimit) &&
    input.recordLimit > 0
  ) {
    return { recordLimit: input.recordLimit };
  }
  throw new Error('Telemetry report recordLimit must be a positive number');
}

function requireMonitor(monitor: NatsMonitor | undefined): NatsMonitor {
  if (monitor === undefined) {
    throw new Error('NATS telemetry monitor is not started');
  }
  return monitor;
}

function requireStorage(storage: Storage | undefined): Storage {
  if (storage === undefined) {
    throw new Error('Telemetry storage is not started');
  }
  return storage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
