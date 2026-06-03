import {
  absoluteBoundary,
  canonicalizeHistorySyncRange,
  expressionBoundary,
  historySyncRange
} from './ranges.js';
import type { HistorySyncBoundary, HistorySyncRange } from '../model/types.js';

export type HistorySyncTargetUpsertCommand = {
  chatId: string;
  range: HistorySyncRange;
  targetId?: string;
};

export function parseHistorySyncTargetUpsertCommand(
  value: unknown,
  source = 'history sync target upsert'
): HistorySyncTargetUpsertCommand {
  const input = asRecord(value);
  const chatId = requireString(input?.chatId, `${source} requires chatId`);
  const range = rangeFromInput(input, source);
  const targetId = asString(input?.targetId);

  return {
    chatId,
    range,
    ...(targetId === undefined ? {} : { targetId })
  };
}

export function rangeFromInput(
  input: Record<string, unknown> | undefined,
  source = 'history sync range'
): HistorySyncRange {
  const preset = asString(input?.preset);
  if (preset !== undefined) {
    return rangeFromPreset(preset);
  }

  const rangeInput = asRecord(input?.range);
  if (rangeInput !== undefined) {
    return parseHistorySyncRange(rangeInput);
  }

  const start = asString(input?.start);
  const end = asString(input?.end);
  if (start === undefined || end === undefined) {
    throw new Error(`${source} requires preset, range, or start/end`);
  }

  return historySyncRange(boundaryFromText(start), boundaryFromText(end));
}

export function parseHistorySyncRange(value: unknown): HistorySyncRange {
  const range = asRecord(value);
  if (range === undefined) {
    throw new Error('History Sync range must be an object');
  }

  return canonicalizeHistorySyncRange({
    end: parseHistorySyncBoundary(range.end),
    start: parseHistorySyncBoundary(range.start)
  });
}

export function parseHistorySyncBoundary(value: unknown): HistorySyncBoundary {
  const boundary = asRecord(value);
  if (boundary === undefined) {
    throw new Error('History Sync range boundary must be an object');
  }

  if (boundary.kind === 'absolute') {
    return absoluteBoundary(requireString(boundary.at, 'Absolute history boundary requires at'));
  }

  if (boundary.kind === 'expression') {
    return expressionBoundary(
      requireString(boundary.expression, 'Expression history boundary requires expression')
    );
  }

  throw new Error('History Sync range boundary kind must be absolute or expression');
}

export function rangeFromPreset(preset: string): HistorySyncRange {
  if (preset === 'last7d') {
    return historySyncRange(expressionBoundary('now-7d'), expressionBoundary('now'));
  }
  if (preset === 'last30d') {
    return historySyncRange(expressionBoundary('now-30d'), expressionBoundary('now'));
  }
  if (preset === 'full') {
    return historySyncRange(expressionBoundary('past'), expressionBoundary('now'));
  }

  throw new Error(`Unknown history range preset: ${preset}`);
}

export function boundaryFromText(value: string): HistorySyncBoundary {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('History Sync boundary cannot be empty');
  }

  if (
    trimmed === 'now' ||
    trimmed === 'past' ||
    /^(?:now|past)(?:\s*[+-]\s*\d+(?:y|mo|w|d|h|m|s)(?:\s*\d+(?:y|mo|w|d|h|m|s))*)+$/.test(trimmed)
  ) {
    return expressionBoundary(trimmed);
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? expressionBoundary(trimmed) : absoluteBoundary(date);
}

function requireString(value: unknown, message: string): string {
  const stringValue = asString(value);
  if (stringValue === undefined) {
    throw new Error(message);
  }
  return stringValue;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
