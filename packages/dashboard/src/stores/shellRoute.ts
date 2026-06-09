export type ShellRoute = {
  pageSegment: string;
  segments: readonly string[];
};

export const DEFAULT_PAGE_SEGMENT = 'home';

export function routeFromPathname(
  pathname: string,
  defaultPageSegment = DEFAULT_PAGE_SEGMENT
): ShellRoute {
  const [pageSegment, ...routeSegments] = pathnameSegments(pathname);
  if (pageSegment === undefined) {
    return {
      pageSegment: defaultPageSegment,
      segments: []
    };
  }
  return {
    pageSegment,
    segments: routeSegments
  };
}

export function pathForRoute(route: ShellRoute, defaultPageSegment = DEFAULT_PAGE_SEGMENT): string {
  if (route.pageSegment === defaultPageSegment && route.segments.length === 0) {
    return '/';
  }
  return routePath(route.pageSegment, route.segments);
}

function pathnameSegments(pathname: string): string[] {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const segments: string[] = [];
  for (const segment of normalized.split('/')) {
    if (segment.length === 0) {
      continue;
    }
    const decoded = decodePathSegment(segment);
    if (decoded === null) {
      return [];
    }
    segments.push(decoded);
  }
  return segments;
}

function routePath(pageSegment: string, segments: readonly string[]): string {
  const suffix = segments.map((segment) => `/${encodeURIComponent(segment)}`).join('');
  return `/${encodeURIComponent(pageSegment)}${suffix}`;
}

function decodePathSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
