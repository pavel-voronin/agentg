import {
  absoluteBoundary,
  canonicalizeHistoryRange,
  expressionBoundary,
  historyRange
} from './ranges.js';
import type { HistoryBoundary, HistoryRange } from './types.js';

export type HistoryTargetUpsertCommand = {
  chatId: string;
  range: HistoryRange;
  targetId?: string;
};

export function parseHistoryTargetUpsertCommand(
  value: unknown,
  source = 'history target upsert'
): HistoryTargetUpsertCommand {
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
  source = 'history range'
): HistoryRange {
  const preset = asString(input?.preset);
  if (preset !== undefined) {
    return rangeFromPreset(preset);
  }

  const rangeInput = asRecord(input?.range);
  if (rangeInput !== undefined) {
    return parseHistoryRange(rangeInput);
  }

  const start = asString(input?.start);
  const end = asString(input?.end);
  if (start === undefined || end === undefined) {
    throw new Error(`${source} requires preset, range, or start/end`);
  }

  return historyRange(boundaryFromText(start), boundaryFromText(end));
}

export function parseHistoryRange(value: unknown): HistoryRange {
  const range = asRecord(value);
  if (range === undefined) {
    throw new Error('History range must be an object');
  }

  return canonicalizeHistoryRange({
    end: parseHistoryBoundary(range.end),
    start: parseHistoryBoundary(range.start)
  });
}

export function parseHistoryBoundary(value: unknown): HistoryBoundary {
  const boundary = asRecord(value);
  if (boundary === undefined) {
    throw new Error('History range boundary must be an object');
  }

  if (boundary.kind === 'absolute') {
    return absoluteBoundary(requireString(boundary.at, 'Absolute history boundary requires at'));
  }

  if (boundary.kind === 'expression') {
    return expressionBoundary(
      requireString(boundary.expression, 'Expression history boundary requires expression')
    );
  }

  throw new Error('History range boundary kind must be absolute or expression');
}

export function rangeFromPreset(preset: string): HistoryRange {
  if (preset === 'last7d') {
    return historyRange(expressionBoundary('now-7d'), expressionBoundary('now'));
  }
  if (preset === 'last30d') {
    return historyRange(expressionBoundary('now-30d'), expressionBoundary('now'));
  }
  if (preset === 'full') {
    return historyRange(expressionBoundary('past'), expressionBoundary('now'));
  }

  throw new Error(`Unknown history range preset: ${preset}`);
}

export function boundaryFromText(value: string): HistoryBoundary {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error('History boundary cannot be empty');
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
