import type { ContentDefinition } from '@agentg/framework/cp';

const contents = [
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
    tags: ['control-plane.page']
  }
] as const satisfies readonly Omit<ContentDefinition, 'domainId'>[];

export const controlPlane = {
  contents,
  title: 'Telemetry'
} as const;

export default controlPlane;
