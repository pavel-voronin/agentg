import type { SlotItemResolution, SlotItemRenderState } from '@agentg/framework/cp';

export type WorkspaceTab = {
  item: SlotItemResolution & { kind: 'content' };
  label: string;
  order: number;
};

export function compareWorkspaceTabs(left: WorkspaceTab, right: WorkspaceTab): number {
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

export function workspaceTabFromItem(item: SlotItemResolution): WorkspaceTab | undefined {
  if (item.kind !== 'content') {
    return undefined;
  }
  const metadata = isPlainRecord(item.content.metadata) ? item.content.metadata : {};
  const tab = isPlainRecord(metadata.tab) ? metadata.tab : undefined;
  const label = typeof tab?.label === 'string' && tab.label.trim().length > 0 ? tab.label : '';
  const order = typeof tab?.order === 'number' && Number.isFinite(tab.order) ? tab.order : null;
  if (tab === undefined || label.length === 0 || order === null) {
    return undefined;
  }
  return {
    item,
    label,
    order
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
