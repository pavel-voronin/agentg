import type {
  EventCatalogProcedure,
  EventCatalogService,
  EventCatalogState
} from '../stores/controlPlaneTypes.js';

export const CONTROL_PLANE_EVENT_CATALOG_PATH = '/control-plane/event-catalog';

type ServiceDirectorySnapshotLike = {
  services: {
    events: string[];
    procedures: EventCatalogProcedure[];
    slug: string;
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

export function eventCatalogFromServiceDirectorySnapshot(
  snapshot: ServiceDirectorySnapshotLike
): EventCatalogState {
  return {
    services: snapshot.services.map((service) => ({
      events: [...service.events].sort(),
      procedures: service.procedures.map((procedure) => ({
        kind: procedure.kind,
        name: procedure.name
      })),
      slug: service.slug
    })),
    version: snapshot.version
  };
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
  if (
    !isRecord(value) ||
    typeof value.name !== 'string' ||
    (value.kind !== 'mutation' && value.kind !== 'query')
  ) {
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
