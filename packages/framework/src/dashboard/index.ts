export { provideDashboardHost, useDashboardHost } from './host.js';
export type { DashboardHost, DashboardHostEvent, ModelRefSelection } from './host.js';
export { slotRoute } from './slotRoute.js';
export {
  createSlotRuntime,
  provideSlotRuntime,
  SlotDebugLayer,
  SlotOutlet,
  SlotOutletItem,
  useSlotRuntime
} from './slots/index.js';
export type {
  ContentCatalog,
  ContentDefinition,
  ContentProvider,
  SlotContext,
  SlotDebugRegistration,
  SlotItemRenderState,
  SlotItemResolution,
  SlotLayout,
  SlotRenderState,
  SlotResolution
} from './slots/index.js';
export { default as UiButton } from './ui/uiButton.vue';
export { default as UiGrafanaDashboard } from './ui/uiGrafanaDashboard.vue';
/** @public Reserved dashboard UI kit component. */
export { default as UiMetricTile } from './ui/uiMetricTile.vue';
export { default as UiPage } from './ui/uiPage.vue';
export { default as UiStatusBadge } from './ui/uiStatusBadge.vue';
