import type { ContentDefinition } from '@agentg/framework/cp';

export type ShellPageContributionView = {
  contentId: string;
  icon: string;
  isDefault: boolean;
  label: string;
  order: number;
  routeSegment: string;
};

const DEFAULT_PAGE_ICON = 'solar:widget-2-bold';
const ICONIFY_NAME =
  /^(?:@[a-z0-9]+(?:-[a-z0-9]+)*:)?[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function shellPageContributions(
  contents: readonly ContentDefinition[]
): ShellPageContributionView[] {
  return contents
    .map(shellPageContribution)
    .filter((page): page is ShellPageContributionView => page !== null)
    .sort(compareShellPageContributions);
}

function shellPageContribution(content: ContentDefinition): ShellPageContributionView | null {
  if (!content.tags.includes('control-plane.page')) {
    return null;
  }

  const metadata = isRecord(content.metadata) ? content.metadata : {};
  const page = isRecord(metadata.page) ? metadata.page : {};
  const routeSegment =
    routeSegmentString(page.routeSegment) ?? deriveRouteSegment(content.contentId);

  if (routeSegment === null) {
    return null;
  }

  return {
    contentId: content.contentId,
    icon: pageIcon(page.icon),
    isDefault: page.default === true,
    label: nonEmptyString(page.label) ?? labelFromRouteSegment(routeSegment),
    order: finiteNumber(page.order) ?? 100,
    routeSegment
  };
}

function compareShellPageContributions(
  left: ShellPageContributionView,
  right: ShellPageContributionView
): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return (
    left.label.localeCompare(right.label) ||
    left.routeSegment.localeCompare(right.routeSegment) ||
    left.contentId.localeCompare(right.contentId)
  );
}

function routeSegmentString(value: unknown): string | null {
  const segment = nonEmptyString(value);
  if (segment === null || segment.includes('/')) {
    return null;
  }
  return segment;
}

function pageIcon(value: unknown): string {
  const icon = nonEmptyString(value);
  if (icon !== null && ICONIFY_NAME.test(icon)) {
    return icon;
  }
  return DEFAULT_PAGE_ICON;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function deriveRouteSegment(contentId: string): string | null {
  const parts = contentId
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);
  const lastPart = parts.at(-1);
  const candidate = lastPart === 'page' ? parts.at(-2) : lastPart;
  return routeSegmentSlug(candidate ?? contentId);
}

function routeSegmentSlug(value: string): string | null {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : null;
}

function labelFromRouteSegment(routeSegment: string): string {
  return routeSegment
    .split(/[-_.]+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ');
}

function capitalize(value: string): string {
  return value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
