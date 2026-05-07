import type { SlotLayout } from '@agentg/control-plane-extension/slots';

export const defaultControlPlaneLayout = {
  'control-plane.dashboard': {
    contentId: 'control-plane.dashboard.metrics'
  },
  'control-plane.dashboard.preview': {
    contentId: 'control-plane.dashboard.metrics'
  },
  'control-plane.events.preview': {
    contentId: 'events.stream.panel'
  },
  'control-plane.workspace': {
    contentId: 'telegram.workspace'
  },
  'telegram.workspace.primary': {
    contentId: 'history.workspace'
  },
  'telegram.workspace.sidecar': {
    contentId: 'events.stream.panel'
  }
} satisfies SlotLayout;

const controlPlaneLayoutStorageKey = 'agentg.controlPlane.layout';

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
  return layout;
}
