export const historyPageStyles = String.raw`* { box-sizing: border-box; }
body { font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, select { font: inherit; }
.timeline-segment {
  position: absolute;
  top: 0;
  bottom: 0;
  min-width: 2px;
}
.segment-target {
  background: repeating-linear-gradient(
    135deg,
    rgba(14, 116, 144, .72) 0,
    rgba(14, 116, 144, .72) 2px,
    transparent 2px,
    transparent 7px
  );
  background-attachment: fixed;
  pointer-events: none;
  z-index: 6;
}
.segment-target-highlight {
  pointer-events: none;
  z-index: 8;
}
.segment-target-highlight.history-linked-hover {
  background: repeating-linear-gradient(
    135deg,
    rgba(21, 94, 117, .9) 0,
    rgba(21, 94, 117, .9) 2px,
    transparent 2px,
    transparent 7px
  );
  background-attachment: fixed;
}
.segment-coverage { background: #10b981; z-index: 3; }
.segment-coverage.coverage-linked-hover {
  background: #059669;
  z-index: 5;
}
.timeline-segment.history-linked-hover:not(.segment-target):not(.segment-target-highlight):not(.segment-coverage) {
  box-shadow: inset 0 0 0 2px rgba(24, 24, 27, .32);
}
.history-table-row.history-linked-hover,
.coverage-table-row.coverage-linked-hover {
  background: #ecfdf5;
}
.segment-job-pending { background: rgba(124, 58, 237, .42); z-index: 2; }
.segment-job-running { background: #7c3aed; z-index: 2; }
.coverage-gap {
  bottom: 0;
  cursor: pointer;
  position: absolute;
  top: 0;
  z-index: 4;
}
.coverage-gap:hover,
.coverage-gap:focus-visible {
  background: repeating-linear-gradient(
    135deg,
    rgba(14, 116, 144, .30) 0,
    rgba(14, 116, 144, .30) 2px,
    transparent 2px,
    transparent 7px
  );
  outline: none;
  z-index: 6;
}
.timeline-selection {
  background: rgba(14, 165, 233, .16);
  border-left: 1px solid #0284c7;
  border-right: 1px solid #0284c7;
  bottom: 0;
  display: none;
  pointer-events: none;
  position: absolute;
  top: 0;
  z-index: 6;
}
.timeline-selection.is-active {
  display: block;
}
.history-hover-stack {
  display: grid;
  gap: 6px;
  left: 0;
  max-width: min(36rem, calc(100vw - 16px));
  pointer-events: none;
  position: fixed;
  top: 0;
  z-index: 50;
}
.history-hover-popover {
  background: #ffffff;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, .10), 0 4px 6px -4px rgba(0, 0, 0, .10);
  color: #18181b;
  font-size: 12px;
  max-width: 100%;
  padding: 8px 12px;
  white-space: nowrap;
}
[data-default-scale="true"]::after {
  background: #38bdf8;
  bottom: -6px;
  content: '';
  height: 1px;
  left: 0;
  position: absolute;
  right: 0;
}
`;
