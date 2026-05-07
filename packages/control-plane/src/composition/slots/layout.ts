import type { ContentProvider, SlotLayout } from '@agentg/control-plane-sdk/slots';

const controlPlaneLayoutStorageKey = 'agentg.controlPlane.layout';

export function defaultLayoutFromProviders(providers: readonly ContentProvider[]): SlotLayout {
  const layout: SlotLayout = {};
  for (const provider of providers) {
    for (const content of provider.contents) {
      for (const slotId of content.defaultSlotIds ?? []) {
        addDefaultPlacement(layout, {
          contentId: content.contentId,
          slotId
        });
      }
    }
    for (const placement of provider.defaultPlacements ?? []) {
      addDefaultPlacement(layout, placement);
    }
  }
  return layout;
}

export function readControlPlaneLayout(fallback: SlotLayout): SlotLayout {
  try {
    const stored = localStorage.getItem(controlPlaneLayoutStorageKey);
    if (stored === null) {
      return fallback;
    }
    return normalizeSlotLayout(JSON.parse(stored), fallback);
  } catch {
    return fallback;
  }
}

export function writeControlPlaneLayout(layout: SlotLayout): void {
  try {
    localStorage.setItem(controlPlaneLayoutStorageKey, JSON.stringify(layout));
  } catch {
    return;
  }
}

function normalizeSlotLayout(value: unknown, fallback: SlotLayout): SlotLayout {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fallback;
  }

  const layout: SlotLayout = {};
  for (const [slotId, entry] of Object.entries(value)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      continue;
    }
    const contentId = (entry as Record<string, unknown>).contentId;
    if (typeof contentId === 'string' && contentId.trim().length > 0) {
      layout[slotId] = {
        contentId
      };
    }
  }
  return {
    ...fallback,
    ...layout
  };
}

function addDefaultPlacement(
  layout: SlotLayout,
  placement: { contentId: string; slotId: string }
): void {
  if (layout[placement.slotId] !== undefined) {
    throw new Error(`Duplicate default content for slot: ${placement.slotId}`);
  }
  layout[placement.slotId] = {
    contentId: placement.contentId
  };
}
