import type { SlotContext } from './slots/types.js';

type SegmentSetter = (segments: readonly string[]) => void;

type RouteSegmentState = {
  child: (offset?: number) => RouteSegmentState;
  context: SlotContext;
  replace: (segments: readonly string[]) => void;
  rest: (start?: number) => readonly string[];
  segment: (index: number) => string | null;
  segments: readonly string[];
};

const ROUTE_SEGMENTS_KEY = 'routeSegments';
const SET_ROUTE_SEGMENTS_KEY = 'setRouteSegments';

export function slotRoute(context: SlotContext | undefined): RouteSegmentState {
  return createRoute(context, routeSegmentsFromContext(context), routeSetterFromContext(context));
}

function createRoute(
  sourceContext: SlotContext | undefined,
  segments: readonly string[],
  setter: SegmentSetter | null
): RouteSegmentState {
  function replace(nextSegments: readonly string[]): void {
    setter?.([...nextSegments]);
  }

  function child(offset = 1): RouteSegmentState {
    const index = normalizedIndex(offset);
    const prefix = segments.slice(0, index);
    const nextSegments = segments.slice(index);
    const nextSetter = (childSegments: readonly string[]) => {
      replace([...prefix, ...childSegments]);
    };
    return createRoute(
      childContext(sourceContext, nextSegments, nextSetter),
      nextSegments,
      nextSetter
    );
  }

  return {
    child,
    context: childContext(sourceContext, segments, replace),
    replace,
    rest(start = 1) {
      return segments.slice(normalizedIndex(start));
    },
    segment(index) {
      return segments[normalizedIndex(index)] ?? null;
    },
    segments
  };
}

function childContext(
  sourceContext: SlotContext | undefined,
  segments: readonly string[],
  setter: SegmentSetter
): SlotContext {
  return {
    ...(sourceContext ?? {}),
    [ROUTE_SEGMENTS_KEY]: [...segments],
    [SET_ROUTE_SEGMENTS_KEY]: setter
  };
}

function routeSegmentsFromContext(context: SlotContext | undefined): readonly string[] {
  const value = context?.[ROUTE_SEGMENTS_KEY];
  return Array.isArray(value) && value.every((segment) => typeof segment === 'string')
    ? [...value]
    : [];
}

function routeSetterFromContext(context: SlotContext | undefined): SegmentSetter | null {
  const value = context?.[SET_ROUTE_SEGMENTS_KEY];
  return typeof value === 'function'
    ? (segments) => {
        (value as SegmentSetter)(segments);
      }
    : null;
}

function normalizedIndex(value: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}
