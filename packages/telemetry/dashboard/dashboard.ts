import type { ContentDefinition } from '@agentg/framework/dashboard';

const contents = [
  {
    contentId: 'telemetry.observability.links',
    load: () => import('./frontend/telemetry/observabilityLinks.vue'),
    tags: ['dashboard.header.actions']
  },
  {
    contentId: 'telemetry.page',
    load: () => import('./frontend/telemetry/telemetryPage.vue'),
    metadata: {
      page: {
        icon: 'solar:chart-square-bold',
        label: 'Telemetry',
        order: 20,
        routeSegment: 'telemetry'
      }
    },
    tags: ['dashboard.page']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const dashboard = {
  contents,
  title: 'Telemetry'
} as const;

export default dashboard;
