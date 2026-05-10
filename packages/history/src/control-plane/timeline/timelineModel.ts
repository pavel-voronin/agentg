import type { SelectedHistoryState } from '../views.js';
import { timelineDateLabel } from './timelineBounds.js';
import { detailSection, groupHistoryDetailItems, historyDetailItems } from './timelineDetails.js';
import {
  timelineCoverage,
  timelineTargets,
  visibleCoverageIntervals,
  visibleTargetDetails
} from './timelineIntervals.js';
import {
  coverageGapSegment,
  coverageTimelineSegment,
  targetHighlightTimelineSegments,
  targetUnionTimelineSegments,
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
export { historyItemsAtTime, timelineDetailHoverItem } from './timelineDetails.js';
export type * from './timelineTypes.js';

export function buildTimelineViewModel(options: {
  coverageTableOpen: boolean;
  data: SelectedHistoryState;
  viewport: TimelineViewport;
}): TimelineViewModel {
  const min = new Date(options.viewport.startAt);
  const max = new Date(options.viewport.endAt);
  const targetDetails = visibleTargetDetails(timelineTargets(options.data), min, max);
  const segments: TimelineSegment[] = [
    ...targetUnionTimelineSegments(targetDetails, min, max),
    ...targetHighlightTimelineSegments(targetDetails, min, max),
    ...visibleCoverageIntervals(timelineCoverage(options.data), min, max).map((interval) =>
      coverageTimelineSegment(interval, min, max)
    ),
    ...timelineEmptyGaps(options.data, targetDetails, min, max).map((gap) =>
      coverageGapSegment(gap, min, max)
    )
  ];
  const detailSections = options.coverageTableOpen
    ? groupHistoryDetailItems(historyDetailItems(options.data, min, max)).map(detailSection)
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
