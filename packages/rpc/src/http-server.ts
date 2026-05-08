import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

import { createHTTPHandler, type CreateHTTPHandlerOptions } from '@trpc/server/adapters/standalone';
import type { AnyRouter } from '@trpc/server/unstable-core-do-not-import';

export type InternalTrpcStaticAssetConfig = {
  rootDir: string;
  urlPrefix: string;
};

export type InternalTrpcHttpServerOptions<TRouter extends AnyRouter> =
  CreateHTTPHandlerOptions<TRouter> & {
    staticAssets?: InternalTrpcStaticAssetConfig;
  };

export function createInternalTrpcHttpServer<TRouter extends AnyRouter>(
  options: InternalTrpcHttpServerOptions<TRouter>
): Server {
  const trpcHandler = createHTTPHandler({
    ...options,
    allowMethodOverride: true
  });
  const staticAssets =
    options.staticAssets === undefined
      ? undefined
      : {
          rootDir: resolve(options.staticAssets.rootDir),
          urlPrefix: normalizeUrlPrefix(options.staticAssets.urlPrefix)
        };

  return createServer((request, response) => {
    if (staticAssets !== undefined && requestPath(request).startsWith(staticAssets.urlPrefix)) {
      void handleStaticAssetRequest(staticAssets, request, response);
      return;
    }
    trpcHandler(request, response);
  });
}

async function handleStaticAssetRequest(
  staticAssets: { rootDir: string; urlPrefix: string },
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendHttp(response, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    return;
  }

  const filePath = resolveStaticPath(staticAssets, requestPath(request));
  if (filePath === null) {
    sendHttp(response, 403, 'text/plain; charset=utf-8', 'Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      'access-control-allow-origin': '*',
      'content-length': body.byteLength,
      'content-type': contentType(filePath)
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.end(body);
  } catch (error) {
    if (isNotFoundError(error)) {
      sendHttp(response, 404, 'text/plain; charset=utf-8', 'Not Found');
      return;
    }
    throw error;
  }
}

function resolveStaticPath(
  staticAssets: { rootDir: string; urlPrefix: string },
  path: string
): string | null {
  const relativePath = decodeURIComponent(path.slice(staticAssets.urlPrefix.length));
  const candidate = resolve(staticAssets.rootDir, relativePath);
  const rootWithSeparator = staticAssets.rootDir.endsWith(sep)
    ? staticAssets.rootDir
    : `${staticAssets.rootDir}${sep}`;
  if (candidate !== staticAssets.rootDir && !candidate.startsWith(rootWithSeparator)) {
    return null;
  }

  return candidate;
}

function normalizeUrlPrefix(value: string): string {
  if (!value.startsWith('/')) {
    throw new Error(`Static asset URL prefix must start with /: ${value}`);
  }
  return value.endsWith('/') ? value : `${value}/`;
}

function requestPath(request: IncomingMessage): string {
  return new URL(request.url ?? '/', 'http://localhost').pathname;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  );
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function sendHttp(
  response: ServerResponse,
  statusCode: number,
  contentTypeHeader: string,
  body: string
): void {
  response.writeHead(statusCode, {
    'content-length': Buffer.byteLength(body),
    'content-type': contentTypeHeader
  });
  response.end(body);
}
