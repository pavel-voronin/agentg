import type { ModelRef } from '../contracts.js';

export type Selection =
  | Readonly<{ kind: 'annotation'; key: string }>
  | Readonly<{ kind: 'collection'; key: string }>
  | Readonly<{ kind: 'model'; model: string }>
  | Readonly<{ kind: 'relatedData'; model: string; subject: ModelRef }>;

export type TreeProviderGroup = Readonly<{
  models: readonly Readonly<{ model: string }>[];
  provider: string;
}>;

export type DataGridColumn = Readonly<{
  filter?:
    | Readonly<{
        key: string;
        label: string;
        operators: readonly Readonly<{ key: string; label: string }>[];
      }>
    | undefined;
  key: string;
  label: string;
  sortable?: boolean | undefined;
}>;

export type DataGridRow = Readonly<{
  cells: Readonly<Record<string, string>>;
  clientChatId?: string | undefined;
  filterValues?: Readonly<Record<string, string>> | undefined;
  id: string;
  inspectorView?: InspectorView | undefined;
  relatedDataRef?: ModelRef | undefined;
  sortValues?: Readonly<Record<string, number | string>> | undefined;
  subject?: ModelRef | undefined;
  subjectOpenable?: boolean | undefined;
}>;

export type InspectorAction = Readonly<
  | { href: string; label: string; ref?: undefined }
  | { href?: undefined; label: string; ref: ModelRef }
>;

export type InspectorView = Readonly<{
  actions?: readonly InspectorAction[] | undefined;
  fields: readonly Readonly<{ label: string; ref?: ModelRef | undefined; value: string }>[];
  title: string;
  value?: unknown;
}>;

export type SortDirection = 'asc' | 'desc';

export type SortState = Readonly<{
  direction: SortDirection;
  key: string;
}>;
