import { context, trace } from '@opentelemetry/api';
import { SeverityNumber, type LogAttributes, type LogBody } from '@opentelemetry/api-logs';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import pino, { type LogFn, type Logger } from 'pino';

import { configuredServiceName } from './runtimeIdentity.js';
import { recordTelemetryLog } from './telemetry/recorder.js';

const LOG_CONTEXT = Symbol.for('agentg:log:context');
const DEFAULT_LOG_LEVEL = 'info';
const REDACT_PATHS = [
  'apiHash',
  'api_hash',
  'authorization',
  'emailAddressAuthenticationCode',
  'email_address_authentication_code',
  'password',
  'phoneNumberAuthenticationCode',
  'phone_number_authentication_code',
  'token',
  '*.apiHash',
  '*.api_hash',
  '*.authorization',
  '*.emailAddressAuthenticationCode',
  '*.email_address_authentication_code',
  '*.password',
  '*.phoneNumberAuthenticationCode',
  '*.phone_number_authentication_code',
  '*.token'
];

type LogContextCarrier = {
  [LOG_CONTEXT]?: LogAttributes;
};

export function createLogger(serviceName: string): Logger {
  return pino({
    base: {
      'service.name': configuredServiceName(serviceName)
    },
    formatters: {
      level(label) {
        return { level: label };
      }
    },
    hooks: {
      logMethod(args, method, level) {
        recordTelemetryLog(logRecord(level, args));
        method.apply(this, args);
      }
    },
    level: configuredLogLevel(),
    messageKey: 'message',
    mixin() {
      const active = trace.getSpan(context.active())?.spanContext();
      if (active === undefined) {
        return {};
      }
      return {
        span_id: active.spanId,
        trace_flags: active.traceFlags,
        trace_id: active.traceId
      };
    },
    redact: {
      censor: '[redacted]',
      paths: REDACT_PATHS
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: serializeError
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

export function logContext(attributes: LogAttributes): LogContextCarrier {
  return {
    [LOG_CONTEXT]: attributes
  };
}

export function logError(error: unknown): Record<string, unknown> {
  return {
    [ATTR_ERROR_TYPE]: errorType(error),
    error
  };
}

function logRecord(level: number, args: Parameters<LogFn>) {
  return {
    attributes: logAttributes(args),
    body: logBody(args),
    severityNumber: severityNumber(level),
    severityText: severityText(level)
  };
}

function logBody(args: Parameters<LogFn>): LogBody {
  for (const value of args) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  const first = args[0];
  if (first instanceof Error) {
    return first.message;
  }
  if (isRecord(first) && typeof first.message === 'string') {
    return first.message;
  }
  if (
    typeof first === 'string' ||
    typeof first === 'number' ||
    typeof first === 'boolean' ||
    typeof first === 'bigint'
  ) {
    return String(first);
  }
  return '';
}

function logAttributes(args: Parameters<LogFn>): LogAttributes {
  const first = args[0];
  if (!isRecord(first)) {
    return traceAttributes();
  }
  return {
    ...traceAttributes(),
    ...explicitLogContext(first),
    ...(typeof first.event === 'string' ? { event: first.event } : {}),
    ...(typeof first[ATTR_ERROR_TYPE] === 'string'
      ? { [ATTR_ERROR_TYPE]: first[ATTR_ERROR_TYPE] }
      : {}),
    ...errorAttributes(first.error)
  };
}

function explicitLogContext(value: object): LogAttributes {
  const attributes = (value as LogContextCarrier)[LOG_CONTEXT];
  return isRecord(attributes) ? attributes : {};
}

function errorAttributes(error: unknown): LogAttributes {
  if (error === undefined) {
    return {};
  }
  return {
    'error.message': errorMessage(error)
  };
}

function traceAttributes(): LogAttributes {
  const active = trace.getSpan(context.active())?.spanContext();
  if (active === undefined) {
    return {};
  }
  return {
    span_id: active.spanId,
    trace_flags: active.traceFlags,
    trace_id: active.traceId
  };
}

function severityNumber(level: number): SeverityNumber {
  if (level >= 60) {
    return SeverityNumber.FATAL;
  }
  if (level >= 50) {
    return SeverityNumber.ERROR;
  }
  if (level >= 40) {
    return SeverityNumber.WARN;
  }
  if (level >= 30) {
    return SeverityNumber.INFO;
  }
  if (level >= 20) {
    return SeverityNumber.DEBUG;
  }
  return SeverityNumber.TRACE;
}

function severityText(level: number): string {
  if (level >= 60) {
    return 'fatal';
  }
  if (level >= 50) {
    return 'error';
  }
  if (level >= 40) {
    return 'warn';
  }
  if (level >= 30) {
    return 'info';
  }
  if (level >= 20) {
    return 'debug';
  }
  return 'trace';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function configuredLogLevel(): string {
  const configured = process.env.AGENTG_LOG_LEVEL?.trim();
  return configured === undefined || configured.length === 0 ? DEFAULT_LOG_LEVEL : configured;
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      ...(error.cause === undefined ? {} : { cause: serializeError(error.cause) }),
      message: error.message,
      name: error.name,
      ...(error.stack === undefined ? {} : { stack: error.stack })
    };
  }
  return {
    message: errorMessage(error),
    name: errorType(error)
  };
}

function errorType(error: unknown): string {
  if (error instanceof Error && error.name.length > 0) {
    return error.name;
  }
  return typeof error;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'string' ||
    typeof error === 'number' ||
    typeof error === 'boolean' ||
    typeof error === 'bigint'
  ) {
    return String(error);
  }
  if (typeof error === 'symbol') {
    return error.description ?? 'unknown error';
  }
  return 'unknown error';
}
