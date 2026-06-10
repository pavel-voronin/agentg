import { lookup } from 'node:dns/promises';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import {
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type RequestOptions
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { dirname } from 'node:path';
import { pipeline } from 'node:stream/promises';

import type { error$Input } from 'tdlib-types';
import { createLogger, logError } from '@agentg/framework';

import { priorities } from '../tdlib/priority.js';
import {
  positiveInteger,
  type FileGenerationStartUpdate,
  type FileSubsystemOptions
} from './runtime.js';
import {
  recordFileGenerationOutcome,
  timeFileGeneration,
  type FileGenerationFailureReason
} from './telemetry.js';

const MAX_GENERATION_REDIRECTS = 5;
const DEFAULT_GENERATION_DOWNLOAD_TIMEOUT_MS = 30_000;
const DEFAULT_GENERATION_MAX_BYTES = 100 * 1024 * 1024;

type SafeGeneratedFileTarget = {
  address: string;
  family: 4 | 6;
  hostname: string;
};

const blockedAddresses = new BlockList();
blockedAddresses.addSubnet('0.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('10.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('100.64.0.0', 10, 'ipv4');
blockedAddresses.addSubnet('127.0.0.0', 8, 'ipv4');
blockedAddresses.addSubnet('169.254.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('172.16.0.0', 12, 'ipv4');
blockedAddresses.addSubnet('192.168.0.0', 16, 'ipv4');
blockedAddresses.addSubnet('198.18.0.0', 15, 'ipv4');
blockedAddresses.addSubnet('224.0.0.0', 4, 'ipv4');
blockedAddresses.addSubnet('240.0.0.0', 4, 'ipv4');
blockedAddresses.addAddress('255.255.255.255', 'ipv4');
blockedAddresses.addAddress('::', 'ipv6');
blockedAddresses.addAddress('::1', 'ipv6');
blockedAddresses.addSubnet('fc00::', 7, 'ipv6');
blockedAddresses.addSubnet('fec0::', 10, 'ipv6');
blockedAddresses.addSubnet('fe80::', 10, 'ipv6');
blockedAddresses.addSubnet('ff00::', 8, 'ipv6');

const logger = createLogger('telegram');

export async function runFileGeneration(
  options: FileSubsystemOptions,
  update: FileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  await timeFileGeneration(() => runFileGenerationAttempt(options, update, signal));
}

async function runFileGenerationAttempt(
  options: FileSubsystemOptions,
  update: FileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  try {
    if (update.conversion !== '#url#') {
      throw fileGenerationError(
        'unsupported_conversion',
        `Unsupported Telegram file generation conversion: ${update.conversion}`
      );
    }

    await downloadGeneratedFileFromUrl(options, update, signal);
    if (signal.aborted) {
      await cleanupGeneratedFileDestination(update);
      recordFileGenerationOutcome('aborted');
      return;
    }
    await finishFileGeneration(options, update.generation_id, null);
    recordFileGenerationOutcome('completed');
  } catch (error) {
    if (signal.aborted) {
      await cleanupGeneratedFileDestination(update);
      recordFileGenerationOutcome('aborted');
      return;
    }
    const reason = fileGenerationFailureReason(error);
    recordFileGenerationOutcome('failed', reason);
    await cleanupGeneratedFileDestination(update);
    logger.warn(
      {
        conversion: update.conversion,
        event: 'telegram.file_generation_failed',
        generationId: update.generation_id,
        reason,
        ...logError(error)
      },
      'telegram file generation failed'
    );
    await finishFileGeneration(options, update.generation_id, {
      _: 'error',
      code: 500,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

async function cleanupGeneratedFileDestination(update: FileGenerationStartUpdate): Promise<void> {
  try {
    await rm(update.destination_path, { force: true });
  } catch (error) {
    logger.warn(
      {
        event: 'telegram.file_generation_cleanup_failed',
        generationId: update.generation_id,
        ...logError(error)
      },
      'telegram file generation cleanup failed'
    );
  }
}

async function downloadGeneratedFileFromUrl(
  options: FileSubsystemOptions,
  update: FileGenerationStartUpdate,
  signal: AbortSignal
): Promise<void> {
  const timeoutMs = positiveInteger(
    options.generationDownloadTimeoutMs,
    DEFAULT_GENERATION_DOWNLOAD_TIMEOUT_MS
  );
  const maxBytes = positiveInteger(options.generationMaxBytes, DEFAULT_GENERATION_MAX_BYTES);

  await withGenerationDownloadSignal(signal, timeoutMs, (downloadSignal) =>
    downloadGeneratedFileFromUrlAttempt(options, update, downloadSignal, maxBytes)
  );
}

async function downloadGeneratedFileFromUrlAttempt(
  options: FileSubsystemOptions,
  update: FileGenerationStartUpdate,
  signal: AbortSignal,
  maxBytes: number
): Promise<void> {
  let url = parseGeneratedFileUrl(update.original_path);
  let response: IncomingMessage | null = null;
  for (let redirectCount = 0; redirectCount <= MAX_GENERATION_REDIRECTS; redirectCount += 1) {
    try {
      response = await requestGeneratedFileUrl(url, signal);
    } catch (error) {
      if (isKnownFileGenerationError(error)) {
        throw error;
      }
      throw fileGenerationError('network_error', 'Telegram generated file download failed');
    }
    const status = response.statusCode ?? 0;
    if (!isRedirectStatus(status)) {
      break;
    }
    response.resume();
    const location = headerValue(response.headers, 'location');
    if (location === null) {
      throw fileGenerationError(
        'http_error',
        `Telegram generated file redirect returned HTTP ${String(status)} without location`
      );
    }
    url = parseGeneratedFileUrl(location, url);
  }

  const status = response?.statusCode ?? 0;
  if (response === null || isRedirectStatus(status)) {
    throw fileGenerationError(
      'http_error',
      'Telegram generated file download redirected too many times'
    );
  }
  if (status < 200 || status > 299) {
    throw fileGenerationError(
      'http_error',
      `Telegram generated file download failed with HTTP ${String(status)}`
    );
  }

  const expectedSize = parseContentLength(headerValue(response.headers, 'content-length'));
  if (expectedSize !== null && expectedSize > maxBytes) {
    throw fileGenerationError('size_limit', 'Telegram generated file exceeds maximum allowed size');
  }

  await setFileGenerationProgress(options, update.generation_id, {
    expectedSize: expectedSize ?? 0,
    localPrefixSize: 0
  });

  await mkdir(dirname(update.destination_path), { recursive: true });
  try {
    await pipeline(
      limitGeneratedFileBytes(response, maxBytes),
      createWriteStream(update.destination_path),
      {
        signal
      }
    );
  } catch (error) {
    if (isKnownFileGenerationError(error)) {
      throw error;
    }
    throw fileGenerationError('write_failed', 'Telegram generated file write failed');
  }

  let generatedSize: number;
  try {
    generatedSize = (await stat(update.destination_path)).size;
  } catch {
    throw fileGenerationError('write_failed', 'Telegram generated file write failed');
  }
  await setFileGenerationProgress(options, update.generation_id, {
    expectedSize: generatedSize,
    localPrefixSize: generatedSize
  });
}

async function setFileGenerationProgress(
  options: FileSubsystemOptions,
  generationId: number | string,
  input: {
    expectedSize: number;
    localPrefixSize: number;
  }
): Promise<void> {
  await options.tdlib.setFileGenerationProgress(
    {
      expectedSize: safeFileGenerationSize(input.expectedSize),
      generationId,
      localPrefixSize: safeFileGenerationSize(input.localPrefixSize)
    },
    {
      priority: priorities.normal
    }
  );
}

async function finishFileGeneration(
  options: FileSubsystemOptions,
  generationId: number | string,
  error: error$Input | null
): Promise<void> {
  await options.tdlib.finishFileGeneration(
    {
      error,
      generationId
    },
    {
      priority: priorities.normal
    }
  );
}

function safeFileGenerationSize(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

async function withGenerationDownloadSignal<T>(
  signal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);
  timeout.unref();

  try {
    return await operation(AbortSignal.any([signal, timeoutController.signal]));
  } catch (error) {
    if (timeoutController.signal.aborted && !signal.aborted) {
      throw fileGenerationError('timeout', 'Telegram generated file download timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function* limitGeneratedFileBytes(
  source: AsyncIterable<Buffer | string>,
  maxBytes: number
): AsyncGenerator<Buffer | string> {
  let totalBytes = 0;
  for await (const chunk of source) {
    totalBytes += Buffer.isBuffer(chunk) ? chunk.byteLength : Buffer.byteLength(chunk);
    if (totalBytes > maxBytes) {
      throw fileGenerationError(
        'size_limit',
        'Telegram generated file exceeds maximum allowed size'
      );
    }
    yield chunk;
  }
}

function parseGeneratedFileUrl(value: string, base?: URL): URL {
  let url: URL;
  try {
    url = base === undefined ? new URL(value) : new URL(value, base);
  } catch {
    throw fileGenerationError('invalid_url', 'Telegram generated file URL is invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw fileGenerationError(
      'invalid_url',
      `Unsupported Telegram generated file URL protocol: ${url.protocol}`
    );
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw fileGenerationError(
      'invalid_url',
      'Telegram generated file URL credentials are forbidden'
    );
  }
  return url;
}

export async function assertSafeGeneratedFileUrl(url: URL): Promise<void> {
  await resolveSafeGeneratedFileTarget(url);
}

async function requestGeneratedFileUrl(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const target = await resolveSafeGeneratedFileTarget(url);
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  const options: RequestOptions & { servername?: string } = {
    family: target.family,
    headers: {
      Host: url.host
    },
    hostname: target.address,
    method: 'GET',
    path: `${url.pathname}${url.search}`,
    port: url.port.length === 0 ? undefined : Number(url.port),
    signal
  };
  if (isIP(target.hostname) === 0) {
    options.servername = target.hostname;
  }

  return new Promise<IncomingMessage>((resolve, reject) => {
    const requestHandle = request(options, resolve);
    requestHandle.on('error', reject);
    requestHandle.end();
  });
}

async function resolveSafeGeneratedFileTarget(url: URL): Promise<SafeGeneratedFileTarget> {
  const hostname = normalizedUrlHostname(url);
  if (isLocalHostname(hostname)) {
    throw fileGenerationError('blocked_url', 'Blocked Telegram generated file URL target');
  }
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, {
      all: true,
      verbatim: true
    });
  } catch {
    throw fileGenerationError('network_error', 'Telegram generated file DNS lookup failed');
  }
  if (addresses.length === 0) {
    throw fileGenerationError('blocked_url', 'Blocked Telegram generated file URL target');
  }
  const safeTargets: SafeGeneratedFileTarget[] = [];
  for (const address of addresses) {
    const family = addressFamily(address.address);
    if (family === null || blockedGeneratedFileAddress(address.address)) {
      throw fileGenerationError('blocked_url', 'Blocked Telegram generated file URL target');
    }
    safeTargets.push({
      address: address.address,
      family,
      hostname
    });
  }
  const [target] = safeTargets;
  if (target !== undefined) {
    return target;
  }
  throw fileGenerationError('blocked_url', 'Blocked Telegram generated file URL target');
}

function headerValue(headers: IncomingHttpHeaders, key: string): string | null {
  const value = headers[key];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function parseContentLength(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function blockedGeneratedFileAddress(address: string): boolean {
  const family = addressFamily(address);
  if (family === 4 && blockedAddresses.check(address, 'ipv4')) {
    return true;
  }
  if (family === 6 && blockedAddresses.check(address, 'ipv6')) {
    return true;
  }
  return isIpv4MappedAddress(address);
}

function addressFamily(address: string): 4 | 6 | null {
  const family = isIP(address);
  return family === 4 || family === 6 ? family : null;
}

function isIpv4MappedAddress(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized.startsWith('::ffff:') || normalized.startsWith('0:0:0:0:0:ffff:');
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost' || normalized.endsWith('.localhost');
}

function normalizedUrlHostname(url: URL): string {
  return url.hostname.replace(/^\[(?<address>.*)\]$/u, '$<address>');
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function fileGenerationError(reason: FileGenerationFailureReason, message: string): Error {
  return Object.assign(new Error(message), { fileGenerationReason: reason });
}

function fileGenerationFailureReason(error: unknown): FileGenerationFailureReason {
  return typeof error === 'object' &&
    error !== null &&
    'fileGenerationReason' in error &&
    isFileGenerationFailureReason(error.fileGenerationReason)
    ? error.fileGenerationReason
    : 'network_error';
}

function isKnownFileGenerationError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'fileGenerationReason' in error &&
    isFileGenerationFailureReason(error.fileGenerationReason)
  );
}

function isFileGenerationFailureReason(value: unknown): value is FileGenerationFailureReason {
  return (
    value === 'blocked_url' ||
    value === 'http_error' ||
    value === 'invalid_url' ||
    value === 'network_error' ||
    value === 'size_limit' ||
    value === 'timeout' ||
    value === 'unsupported_conversion' ||
    value === 'write_failed'
  );
}
