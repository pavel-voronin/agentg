export const MODEL_REF_SELECTED_EVENT = 'agentg:model-ref-selected';

export type ModelRefSelection = {
  id: string;
  model: string;
};

type ModelRefSelectedEvent = {
  detail?: unknown;
};

type ModelRefSelectedEventListener = (event: Event) => void;

type ModelRefEventTarget = {
  addEventListener: (type: string, listener: ModelRefSelectedEventListener) => void;
  dispatchEvent: (event: Event) => boolean;
  removeEventListener: (type: string, listener: ModelRefSelectedEventListener) => void;
};

type ModelRefCustomEventConstructor = new (
  type: string,
  init: { detail: ModelRefSelection }
) => Event;

type ModelRefGlobal = Partial<ModelRefEventTarget> & {
  CustomEvent?: ModelRefCustomEventConstructor;
};

export function dispatchModelRefSelected(selection: ModelRefSelection): void {
  const target = modelRefGlobal();
  if (typeof target.dispatchEvent !== 'function' || typeof target.CustomEvent !== 'function') {
    return;
  }
  target.dispatchEvent(
    new target.CustomEvent(MODEL_REF_SELECTED_EVENT, {
      detail: selection
    })
  );
}

export function onModelRefSelected(listener: (selection: ModelRefSelection) => void): () => void {
  const target = modelRefGlobal();
  if (
    typeof target.addEventListener !== 'function' ||
    typeof target.removeEventListener !== 'function'
  ) {
    return () => undefined;
  }

  const eventListener = (event: Event): void => {
    const detail = (event as ModelRefSelectedEvent).detail;
    if (isModelRefSelection(detail)) {
      listener(detail);
    }
  };
  target.addEventListener(MODEL_REF_SELECTED_EVENT, eventListener);
  return () => {
    target.removeEventListener?.(MODEL_REF_SELECTED_EVENT, eventListener);
  };
}

function isModelRefSelection(value: unknown): value is ModelRefSelection {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const selection = value as Record<string, unknown>;
  return typeof selection.model === 'string' && typeof selection.id === 'string';
}

function modelRefGlobal(): ModelRefGlobal {
  return globalThis;
}
