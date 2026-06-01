import type {
  EventCatalogProcedure,
  EventCatalogService,
  EventCatalogState
} from '../stores/controlPlaneTypes.js';

export const CONTROL_PLANE_EVENT_CATALOG_PATH = '/control-plane/event-catalog';

type RegistrySnapshotLike = {
  modules: readonly {
    module: string;
    procedures: readonly string[];
  }[];
  version: number;
};

export async function loadControlPlaneEventCatalog(): Promise<EventCatalogState> {
  const response = await fetch(CONTROL_PLANE_EVENT_CATALOG_PATH, {
    cache: 'no-store'
  });
  if (!response.ok) {
    throw new Error(`Control Plane event catalog request failed: ${String(response.status)}`);
  }

  return parseEventCatalogState(await response.json());
}

export function eventCatalogFromRegistrySnapshot(
  snapshot: RegistrySnapshotLike
): EventCatalogState {
  return {
    services: snapshot.modules.map((moduleRecord) => ({
      events: [],
      procedures: moduleRecord.procedures.map((procedure) => ({
        kind: 'procedure',
        name: eventCatalogProcedureName(moduleRecord.module, procedure)
      })),
      slug: moduleRecord.module
    })),
    version: snapshot.version
  };
}

function eventCatalogProcedureName(moduleName: string, procedureName: string): string {
  return procedureName.startsWith(`${moduleName}.`)
    ? procedureName
    : `${moduleName}.${procedureName}`;
}

function parseEventCatalogState(value: unknown): EventCatalogState {
  if (!isRecord(value)) {
    throw new Error('Control Plane event catalog response must be an object');
  }
  if (typeof value.version !== 'number' || !Number.isInteger(value.version) || value.version < 0) {
    throw new Error('Control Plane event catalog version must be a nonnegative integer');
  }
  if (!Array.isArray(value.services)) {
    throw new Error('Control Plane event catalog services must be an array');
  }
  return {
    services: value.services.map(parseEventCatalogService),
    version: value.version
  };
}

function parseEventCatalogService(value: unknown): EventCatalogService {
  if (!isRecord(value) || typeof value.slug !== 'string') {
    throw new Error('Control Plane event catalog service must include slug');
  }
  if (!Array.isArray(value.events)) {
    throw new Error(`Control Plane event catalog service events must be an array: ${value.slug}`);
  }
  if (!Array.isArray(value.procedures)) {
    throw new Error(
      `Control Plane event catalog service procedures must be an array: ${value.slug}`
    );
  }

  return {
    events: value.events.map(parseEventCatalogEvent),
    procedures: value.procedures.map(parseEventCatalogProcedure),
    slug: value.slug
  };
}

function parseEventCatalogProcedure(value: unknown): EventCatalogProcedure {
  if (!isRecord(value) || typeof value.name !== 'string' || value.kind !== 'procedure') {
    throw new Error('Control Plane event catalog procedure must include name and kind');
  }

  return {
    kind: value.kind,
    name: value.name
  };
}

function parseEventCatalogEvent(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Control Plane event catalog event type must be a nonempty string');
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
