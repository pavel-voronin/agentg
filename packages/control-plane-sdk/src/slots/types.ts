import type { Component } from 'vue';

export type SlotContext = Record<string, unknown>;

export type ContentModule = {
  default: Component;
};

export type ContentDefinition = {
  contentId: string;
  defaultSlotIds?: readonly string[];
  domainId?: string;
  load: () => Promise<ContentModule>;
  props?: Record<string, unknown>;
  tags: readonly string[];
};

export type ContentProvider = {
  contents: readonly Omit<ContentDefinition, 'domainId'>[];
  defaultPlacements?: readonly SlotLayoutPlacement[];
  domainId: string;
};

export type ContentCatalog = readonly ContentDefinition[];

export type SlotDefinition = {
  slotId: string;
  tags: readonly string[];
};

export type SlotLayoutEntry = {
  contentId: string;
};

export type SlotLayout = Record<string, SlotLayoutEntry>;

export type SlotLayoutPlacement = {
  contentId: string;
  slotId: string;
};

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
  target: object | null;
};

export type SlotDebugEntryInput = Omit<SlotDebugEntry, 'id' | 'order'>;

export type SlotDebugRegistration = {
  unregister: () => void;
  update: (entry: SlotDebugEntryInput) => void;
};
