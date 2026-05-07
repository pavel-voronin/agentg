export const CONTROL_PLANE_STORAGE_KEYS = {
  dashboardCollapsed: 'agentg.controlPlane.dashboardCollapsed',
  eventFilters: 'agentg.controlPlane.eventFilters',
  eventLimit: 'agentg.controlPlane.eventLimit',
  eventsPanelCollapsed: 'agentg.controlPlane.eventsPanelCollapsed',
  slotDebugEnabled: 'agentg.controlPlane.slotDebugEnabled'
} as const;

export function readStoredBoolean(key: string, fallback: boolean): boolean {
  const value = readStorage(key);
  if (value === null) {
    return fallback;
  }
  if (value === '1' || value === 'true') {
    return true;
  }
  if (value === '0' || value === 'false') {
    return false;
  }
  return fallback;
}

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    if (value.length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    return;
  }
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
