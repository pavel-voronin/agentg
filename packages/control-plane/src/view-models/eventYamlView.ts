import type {
  AppEventBodyView,
  AppEventYamlContentLine,
  AppEventYamlLine,
  AppEventYamlRevealLine,
  AppEventYamlToken
} from '../stores/controlPlaneTypes.js';
import { normalizeEventYamlListLimit } from '../domain/events.js';
import { DEFAULT_EVENT_YAML_LIST_LIMIT } from '../stores/controlPlaneTypes.js';

const ROOT_YAML_PATH = '$';

export type EventYamlViewOptions = {
  listItemLimit?: number;
};

export function eventBodyView(
  value: unknown,
  options: EventYamlViewOptions = {}
): AppEventBodyView {
  const listItemLimit = normalizeEventYamlListLimit(
    options.listItemLimit ?? DEFAULT_EVENT_YAML_LIST_LIMIT
  );
  return {
    raw: JSON.stringify(value),
    yamlLines: yamlValueLines(value, 0, ROOT_YAML_PATH, listItemLimit)
  };
}

export function expandEventYamlRevealLine(line: AppEventYamlRevealLine): AppEventYamlLine[] {
  return line.values
    .slice(line.startIndex)
    .flatMap((value, index) =>
      yamlArrayItemLines(
        value,
        line.depth,
        yamlArrayItemPath(line.path, line.startIndex + index),
        line.listItemLimit
      )
    );
}

function yamlValueLines(
  value: unknown,
  depth: number,
  path: string,
  listItemLimit: number
): AppEventYamlLine[] {
  if (isPlainObject(value)) {
    const modelRef = modelRefParts(value);
    if (modelRef !== null) {
      return [
        yamlContentLine(depth, [modelRef.token]),
        ...modelRef.entries.flatMap(([key, item]) =>
          yamlObjectEntryLines(key, item, depth, path, listItemLimit)
        )
      ];
    }
    const entries = Object.entries(value);
    return entries.length === 0
      ? [yamlContentLine(depth, [{ kind: 'text', text: '{}' }])]
      : entries.flatMap(([key, item]) =>
          yamlObjectEntryLines(key, item, depth, path, listItemLimit)
        );
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? [yamlContentLine(depth, [{ kind: 'text', text: '[]' }])]
      : yamlArrayLines(value, depth, path, listItemLimit);
  }
  return [yamlContentLine(depth, [{ kind: 'text', text: yamlScalar(value) }])];
}

function yamlObjectEntryLines(
  key: string,
  value: unknown,
  depth: number,
  parentPath: string,
  listItemLimit: number
): AppEventYamlLine[] {
  const valuePath = yamlObjectPath(parentPath, key);
  if (isPlainObject(value)) {
    const modelRef = modelRefParts(value);
    if (modelRef !== null) {
      return [
        yamlContentLine(depth, [{ kind: 'text', text: `${key}: ` }, modelRef.token]),
        ...modelRef.entries.flatMap(([childKey, childValue]) =>
          yamlObjectEntryLines(childKey, childValue, depth + 1, valuePath, listItemLimit)
        )
      ];
    }
    const entries = Object.entries(value);
    return entries.length === 0
      ? [yamlContentLine(depth, [{ kind: 'text', text: `${key}: {}` }])]
      : [
          yamlContentLine(depth, [{ kind: 'text', text: `${key}:` }]),
          ...entries.flatMap(([childKey, childValue]) =>
            yamlObjectEntryLines(childKey, childValue, depth + 1, valuePath, listItemLimit)
          )
        ];
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? [yamlContentLine(depth, [{ kind: 'text', text: `${key}: []` }])]
      : [
          yamlContentLine(depth, [{ kind: 'text', text: `${key}:` }]),
          ...yamlArrayLines(value, depth + 1, valuePath, listItemLimit)
        ];
  }
  return [yamlContentLine(depth, [{ kind: 'text', text: `${key}: ${yamlScalar(value)}` }])];
}

function yamlArrayLines(
  values: unknown[],
  depth: number,
  path: string,
  listItemLimit: number
): AppEventYamlLine[] {
  const visibleValues = values.slice(0, listItemLimit);
  const lines = visibleValues.flatMap((value, index) =>
    yamlArrayItemLines(value, depth, yamlArrayItemPath(path, index), listItemLimit)
  );
  if (values.length <= listItemLimit) {
    return lines;
  }
  return [
    ...lines,
    {
      depth,
      hiddenCount: values.length - listItemLimit,
      id: yamlArrayRevealId(path),
      indent: depth,
      kind: 'reveal',
      listItemLimit,
      path,
      startIndex: listItemLimit,
      values
    }
  ];
}

function yamlArrayItemLines(
  value: unknown,
  depth: number,
  path: string,
  listItemLimit: number
): AppEventYamlLine[] {
  if (isPlainObject(value)) {
    const modelRef = modelRefParts(value);
    if (modelRef !== null) {
      return [
        yamlContentLine(depth, [{ kind: 'text', text: '- ' }, modelRef.token]),
        ...modelRef.entries.flatMap(([key, item]) =>
          yamlObjectEntryLines(key, item, depth + 1, path, listItemLimit)
        )
      ];
    }
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return [yamlContentLine(depth, [{ kind: 'text', text: '- {}' }])];
    }
    const firstEntry = entries[0];
    if (firstEntry === undefined) {
      return [yamlContentLine(depth, [{ kind: 'text', text: '- {}' }])];
    }
    const restEntries = entries.slice(1);
    const [firstKey, firstValue] = firstEntry;
    const [firstLine, ...firstNestedLines] = yamlObjectEntryLines(
      firstKey,
      firstValue,
      0,
      path,
      listItemLimit
    );
    if (firstLine === undefined || firstLine.kind !== 'content') {
      return [yamlContentLine(depth, [{ kind: 'text', text: '- {}' }])];
    }
    return [
      yamlContentLine(depth, [{ kind: 'text', text: '- ' }, ...firstLine.tokens]),
      ...firstNestedLines.map((line) => shiftYamlLineDepth(line, depth + 1)),
      ...restEntries.flatMap(([key, item]) =>
        yamlObjectEntryLines(key, item, depth + 1, path, listItemLimit)
      )
    ];
  }
  if (Array.isArray(value)) {
    return value.length === 0
      ? [yamlContentLine(depth, [{ kind: 'text', text: '- []' }])]
      : [
          yamlContentLine(depth, [{ kind: 'text', text: '-' }]),
          ...yamlArrayLines(value, depth + 1, path, listItemLimit)
        ];
  }
  return [yamlContentLine(depth, [{ kind: 'text', text: `- ${yamlScalar(value)}` }])];
}

function yamlContentLine(indent: number, tokens: AppEventYamlToken[]): AppEventYamlContentLine {
  return {
    indent,
    kind: 'content',
    tokens
  };
}

function shiftYamlLineDepth(line: AppEventYamlLine, offset: number): AppEventYamlLine {
  if (line.kind === 'content') {
    return {
      ...line,
      indent: line.indent + offset
    };
  }
  return {
    ...line,
    depth: line.depth + offset,
    indent: line.indent + offset
  };
}

function yamlScalar(value: unknown): string {
  if (typeof value === 'string') {
    return yamlStringScalar(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : JSON.stringify(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'null';
  }
  return JSON.stringify(value);
}

function yamlStringScalar(value: string): string {
  if (value.length === 0) {
    return '""';
  }
  return /^[A-Za-z0-9._/@:-]+$/.test(value) ? value : JSON.stringify(value);
}

function modelRefParts(
  value: Record<string, unknown>
): { entries: [string, unknown][]; token: AppEventYamlToken } | null {
  const model = value._model;
  const id = value.id;
  if (typeof model !== 'string' || model.trim().length === 0) {
    return null;
  }
  if (typeof id !== 'string' || id.trim().length === 0) {
    return null;
  }
  return {
    entries: Object.entries(value).filter(([key]) => key !== '_model' && key !== 'id'),
    token: {
      color: modelColor(model),
      id,
      kind: 'modelRef',
      model
    }
  };
}

function modelColor(model: string): string {
  const palette = [
    '#2563eb',
    '#059669',
    '#7c3aed',
    '#dc2626',
    '#0891b2',
    '#c2410c',
    '#4f46e5',
    '#be123c'
  ] as const;
  let hash = 0;
  for (const char of model) {
    hash += char.charCodeAt(0);
  }
  return palette[hash % palette.length] ?? '#2563eb';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function yamlObjectPath(parentPath: string, key: string): string {
  return `${parentPath}.k:${encodeURIComponent(key)}`;
}

function yamlArrayItemPath(parentPath: string, index: number): string {
  return `${parentPath}.i:${String(index)}`;
}

function yamlArrayRevealId(path: string): string {
  return `${path}.more`;
}
