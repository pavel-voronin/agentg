const MEDIA_URL_PREFIX = '/telegram-files/agentg-media/';

export function providerFileUrl(url: string | null): string | null {
  if (!url?.startsWith(MEDIA_URL_PREFIX)) {
    return null;
  }
  if (url.includes('?') || url.includes('#')) {
    return null;
  }
  return safeMediaUrl(url) ? url : null;
}

function safeMediaUrl(url: string): boolean {
  const relativePath = url.slice(MEDIA_URL_PREFIX.length);
  if (relativePath.length === 0) {
    return false;
  }
  return relativePath.split('/').every(safeMediaSegment);
}

function safeMediaSegment(segment: string): boolean {
  if (segment.length === 0 || segment.includes('\\')) {
    return false;
  }
  try {
    const decoded = decodeURIComponent(segment);
    return (
      decoded.length > 0 &&
      decoded !== '.' &&
      decoded !== '..' &&
      !decoded.includes('/') &&
      !decoded.includes('\\')
    );
  } catch {
    return false;
  }
}
