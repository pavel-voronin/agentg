export {
  useControlPlaneAppView,
  type AppEventItem,
  type ChatSidebarView,
  type DashboardMetric,
  type EventFiltersPanelView,
  type SelectedWorkspaceView
} from './stores/controlPlaneStore.js';

export function addCustomTarget(start: string, end: string): void;
export function addPresetTarget(preset: string): void;
export function clearChatSearch(): void;
export function closeSelectedChat(): void;
export function mountControlPlaneAppRuntime(): void;
export function openArchiveChats(): void;
export function openFolderChats(folderId: number): void;
export function openMainChats(): void;
export function searchChats(value: string): void;
export function selectTimelineScale(value: number): void;
export function toggleChat(chatId: string): void;
