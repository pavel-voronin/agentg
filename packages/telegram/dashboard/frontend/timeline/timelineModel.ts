import type { HistoryCoverageState } from '../historyCoverageState.js';
import { timelineDateLabel } from './timelineBounds.js';
import { coverageDetailItems, detailSection, groupCoverageDetailItems } from './timelineDetails.js';
import { timelineCoverage, visibleCoverageIntervals } from './timelineIntervals.js';
import {
  coverageGapSegment,
  coverageTimelineSegment,
  timelineEmptyGaps
} from './timelineSegments.js';
import type { TimelineSegment, TimelineViewModel, TimelineViewport } from './timelineTypes.js';

export * from './timelineConstants.js';
export {
  clamp,
  clampTimelineViewport,
  timelinePhysicalBounds,
  timelineViewportFromPreset
} from './timelineBounds.js';
export { coverageItemsAtTime, timelineDetailHoverItem } from './timelineDetails.js';
export type * from './timelineTypes.js';

export function buildTimelineViewModel(options: {
  coverageTableOpen: boolean;
  data: HistoryCoverageState;
  viewport: TimelineViewport;
}): TimelineViewModel {
  const min = new Date(options.viewport.startAt);
  const max = new Date(options.viewport.endAt);
  const segments: TimelineSegment[] = [
    ...visibleCoverageIntervals(timelineCoverage(options.data), min, max).map((interval) =>
      coverageTimelineSegment(interval, min, max)
    ),
    ...timelineEmptyGaps(options.data, min, max).map((gap) => coverageGapSegment(gap, min, max))
  ];
  const detailSections = options.coverageTableOpen
    ? groupCoverageDetailItems(coverageDetailItems(options.data, min, max)).map(detailSection)
    : [];

  return {
    dateLabels: [
      timelineDateLabel(min, min.getTime() - max.getTime(), 'left'),
      timelineDateLabel(max, max.getTime() - min.getTime(), 'right')
    ],
    detailSections,
    detailsEmpty: options.coverageTableOpen && detailSections.length === 0,
    max,
    min,
    segments
  };
}
