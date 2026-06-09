import type { SlotItemResolution, SlotItemRenderState } from '@agentg/framework/dashboard';

export type ClientTab = {
  item: SlotItemResolution & { kind: 'content' };
  label: string;
  order: number;
  routeSegment: string;
};

export function compareClientTabs(left: ClientTab, right: ClientTab): number {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return (
    left.label.localeCompare(right.label) || left.item.contentId.localeCompare(right.item.contentId)
  );
}

export function initialItemState(item: SlotItemResolution): SlotItemRenderState {
  switch (item.kind) {
    case 'content':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'component-loading'
      };
    case 'incompatible':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'incompatible-content'
      };
    case 'missing-content':
      return {
        contentId: item.contentId,
        index: item.index,
        kind: 'missing-content'
      };
  }
}

export function slotItemKey(item: SlotItemResolution): string {
  return `${String(item.index)}:${item.contentId}`;
}

export function clientTabFromItem(item: SlotItemResolution): ClientTab | undefined {
  if (item.kind !== 'content') {
    return undefined;
  }
  const metadata = isPlainRecord(item.content.metadata) ? item.content.metadata : {};
  const tab = isPlainRecord(metadata.tab) ? metadata.tab : undefined;
  const label = typeof tab?.label === 'string' && tab.label.trim().length > 0 ? tab.label : '';
  const order = typeof tab?.order === 'number' && Number.isFinite(tab.order) ? tab.order : null;
  const routeSegment = tab === undefined ? null : clientTabRouteSegment(tab, item.contentId);
  if (tab === undefined || label.length === 0 || order === null || routeSegment === null) {
    return undefined;
  }
  return {
    item,
    label,
    order,
    routeSegment
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clientTabRouteSegment(tab: Record<string, unknown>, contentId: string): string | null {
  const explicitSegment = nonEmptyString(tab.routeSegment);
  if (explicitSegment !== null) {
    return explicitSegment;
  }
  const fallbackSegment = contentId.split('.').at(-1);
  return nonEmptyString(fallbackSegment);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
