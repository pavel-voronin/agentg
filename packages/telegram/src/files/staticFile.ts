import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const STATIC_PREFIX = '/telegram-files/';

type StaticFileContent = {
  bodyBase64: string;
  contentType: string;
};

export async function readStaticFileContent(
  filesDirectory: string,
  staticPath: string
): Promise<StaticFileContent | null> {
  const filePath = resolveStaticFilePath(filesDirectory, staticPath);
  if (filePath === null) {
    return null;
  }

  try {
    const body = await readFile(filePath);
    return {
      bodyBase64: body.toString('base64'),
      contentType: contentType(filePath)
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

function resolveStaticFilePath(filesDirectory: string, staticPath: string): string | null {
  if (!staticPath.startsWith(STATIC_PREFIX)) {
    return null;
  }
  const root = resolve(filesDirectory);
  const relativePath = staticPath.slice(STATIC_PREFIX.length);
  const candidate = resolve(root, relativePath);
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate.startsWith(rootWithSeparator) ? candidate : null;
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.mp4':
      return 'video/mp4';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
