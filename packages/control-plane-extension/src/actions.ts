import { inject, provide, type InjectionKey } from 'vue';

export type ControlPlaneActions = {
  addCustomTarget: (start: string, end: string) => void;
  addPresetTarget: (preset: string) => void;
  clearTimelineScale: () => void;
  clearChatSearch: () => void;
  closeSelectedChat: () => void;
  deleteTarget: (targetId: string) => void;
  openArchiveChats: () => void;
  openChat: (chatId: string) => void;
  openFolderChats: (folderId: number) => void;
  openMainChats: () => void;
  searchChats: (value: string) => void;
  selectTimelineScale: (value: number) => void;
  toggleChat: (chatId: string) => void;
};

const controlPlaneActionsKey: InjectionKey<ControlPlaneActions> = Symbol('controlPlaneActions');

export function provideControlPlaneActions(actions: ControlPlaneActions): void {
  provide(controlPlaneActionsKey, actions);
}

export function useControlPlaneActions(): ControlPlaneActions {
  const actions = inject(controlPlaneActionsKey);
  if (actions === undefined) {
    throw new Error('Control Plane actions are not available');
  }
  return actions;
}
