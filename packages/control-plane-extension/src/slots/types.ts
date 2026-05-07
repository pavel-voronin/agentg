import type {
  ControlPlaneContentDefinition,
  ControlPlaneContentProvider
} from '@agentg/shared/control-plane/slot-content';
import type { Component } from 'vue';

export type SlotContext = Record<string, unknown>;

export type ContentModule = {
  default: Component;
};

export type ContentDefinition = ControlPlaneContentDefinition & {
  domainId?: string;
};

export type ContentProvider = ControlPlaneContentProvider;

export type ContentCatalog = readonly ContentDefinition[];

export type SlotDefinition = {
  slotId: string;
  tags: readonly string[];
};

export type SlotLayoutEntry = {
  contentId: string;
};

export type SlotLayout = Record<string, SlotLayoutEntry>;

export type SlotResolution =
  | {
      kind: 'content';
      content: ContentDefinition;
    }
  | {
      kind: 'empty';
    }
  | {
      contentId: string;
      kind: 'missing-content';
    }
  | {
      content: ContentDefinition;
      kind: 'incompatible';
      slotTags: readonly string[];
    };

export type SlotDebugEntry = {
  id: number;
  order: number;
  resolution: SlotResolution;
  slotId: string;
  tags: readonly string[];
  target: unknown | null;
};

export type SlotDebugEntryInput = Omit<SlotDebugEntry, 'id' | 'order'>;

export type SlotDebugRegistration = {
  unregister: () => void;
  update: (entry: SlotDebugEntryInput) => void;
};
