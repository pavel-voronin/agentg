import { acceptHMRUpdate, defineStore } from 'pinia';

import type { HistoryOverview } from './controlPlaneTypes.js';

export const useOverviewStore = defineStore('controlPlane.overview', {
  actions: {
    setOverview(overview: HistoryOverview | null) {
      this.overview = overview;
    }
  },
  state: () => ({
    overview: null as HistoryOverview | null
  })
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOverviewStore, import.meta.hot));
}
