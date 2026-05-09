import type { SlotLayout } from '@agentg/control-plane-sdk/slots';

export const controlPlaneSlotLayout = {
  'control-plane.dashboard.tiles': {
    items: [
      {
        contentId: 'telegram.dashboard.chats'
      },
      {
        contentId: 'history.dashboard.current-job'
      }
    ]
  },
  'control-plane.events.preview': {
    items: [
      {
        contentId: 'events.stream.panel'
      }
    ]
  },
  'control-plane.header.status': {
    items: [
      {
        contentId: 'telegram.status.tdlib'
      }
    ]
  },
  'control-plane.workspace': {
    items: [
      {
        contentId: 'telegram.workspace'
      }
    ]
  },
  'telegram.workspace.primary': {
    items: [
      {
        contentId: 'history.workspace'
      }
    ]
  },
  'telegram.workspace.sidecar': {
    items: [
      {
        contentId: 'events.stream.panel'
      }
    ]
  }
} satisfies SlotLayout;
