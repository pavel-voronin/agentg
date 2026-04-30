import type { ChatNavigation } from '../stores/controlPlaneTypes.js';

export function normalizeChatNavigation(navigation: ChatNavigation): Required<ChatNavigation> {
  return {
    archiveCount: navigation.archiveCount ?? 0,
    folders: navigation.folders ?? [],
    mainCount: navigation.mainCount ?? 0
  };
}
