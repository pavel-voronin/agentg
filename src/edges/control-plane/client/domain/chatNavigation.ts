import type { ChatNavigation } from '../stores/controlPlaneTypes.js';

export function normalizeChatNavigation(navigation: ChatNavigation): Required<ChatNavigation> {
  return {
    archiveCount: navigation.archiveCount,
    folders: navigation.folders,
    mainCount: navigation.mainCount
  };
}
