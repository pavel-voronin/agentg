import type { Component } from 'vue';

export type SlotContext = Record<string, unknown>;

export type ContentModule = {
  default: Component;
};

export type ContentDefinition = {
  contentId: string;
  domainId?: string;
  load: () => Promise<ContentModule>;
  props?: Record<string, unknown>;
  revision?: string;
  tags: readonly string[];
};

export type ContentProvider = {
  contents: readonly Omit<ContentDefinition, 'domainId'>[];
  domainId: string;
};

export type ContentCatalog = readonly ContentDefinition[];

export type SlotDefinition = {
  slotId: string;
  tags: readonly string[];
};

export type SlotLayoutItem = {
  contentId: string;
};

export type SlotLayoutEntry = {
  items: readonly SlotLayoutItem[];
};

export type SlotLayout = Record<string, SlotLayoutEntry>;

export type SlotItemResolution =
  | {
      kind: 'content';
      content: ContentDefinition;
      contentId: string;
      index: number;
    }
  | {
      contentId: string;
      index: number;
      kind: 'missing-content';
    }
  | {
      content: ContentDefinition;
      contentId: string;
      index: number;
      kind: 'incompatible';
      slotTags: readonly string[];
    };

export type SlotResolution =
  | {
      kind: 'empty';
    }
  | {
      items: readonly SlotItemResolution[];
      kind: 'contents';
      overflowCount: number;
    };

export type SlotItemRenderState =
  | {
      contentId: string;
      index: number;
      kind: 'component-loading';
    }
  | {
      contentId: string;
      index: number;
      kind: 'component-ready';
    }
  | {
      contentId: string;
      index: number;
      kind: 'missing-content';
    }
  | {
      contentId: string;
      index: number;
      kind: 'incompatible-content';
    }
  | {
      contentId: string;
      error: string;
      index: number;
      kind: 'component-load-error';
    }
  | {
      contentId: string;
      error: string;
      index: number;
      kind: 'component-render-error';
    };

export type SlotRenderState =
  | {
      kind: 'empty';
    }
  | {
      items: readonly SlotItemRenderState[];
      kind: 'contents';
      overflowCount: number;
    };

export type SlotDebugEntry = {
  id: number;
  order: number;
  resolution: SlotResolution;
  slotId: string;
  state: SlotRenderState;
  tags: readonly string[];
  target: object | null;
};

export type SlotDebugEntryInput = Omit<SlotDebugEntry, 'id' | 'order'>;

export type SlotDebugRegistration = {
  unregister: () => void;
  update: (entry: SlotDebugEntryInput) => void;
};
