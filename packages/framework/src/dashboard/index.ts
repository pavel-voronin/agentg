export { provideDashboardHost, useDashboardHost } from './host.js';
export type { DashboardHost, DashboardHostEvent, ModelRefSelection } from './host.js';
export {
  contentProviderFromDashboardManifest,
  contentProvidersFromDashboardCatalogResponse,
  dashboardProviderManifestFromRegistration,
  loadDashboardProviderCatalogStyles,
  parseDashboardProviderCatalogResponse,
  parseDashboardProviderRegistration
} from './manifest.js';
export { slotRoute } from './slotRoute.js';
export type {
  DashboardContentManifest,
  DashboardContentRegistration,
  DashboardProviderCatalogResponse,
  DashboardProviderManifest,
  DashboardProviderRegistration
} from './manifest.js';
export {
  createContentCatalogIndex,
  createSlotRuntime,
  provideSlotRuntime,
  resolveSlotContents,
  SlotDebugLayer,
  SlotOutlet,
  SlotOutletItem,
  tagsCompatible,
  useSlotRuntime
} from './slots/index.js';
export type * from './slots/index.js';
export { default as UiButton } from './ui/uiButton.vue';
export { default as UiGrafanaDashboard } from './ui/uiGrafanaDashboard.vue';
export { default as UiMetricTile } from './ui/uiMetricTile.vue';
export { default as UiPage } from './ui/uiPage.vue';
export { default as UiStatusBadge } from './ui/uiStatusBadge.vue';
