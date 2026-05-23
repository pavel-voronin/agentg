/* global console */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

import { format, resolveConfig } from 'prettier';

import { TD_LIB_SCHEMA_COMMIT, TD_LIB_SCHEMA_URL } from './tdlib/schemaSource.mjs';

const ROOT = new URL('../', import.meta.url);
const OUT_FILE = new URL('packages/telegram/src/tdlib-docs/data/tdlibSchema.json', ROOT);
const PRETTIER_OPTIONS = (await resolveConfig(new URL('package.json', ROOT))) ?? {};
const SCALAR_TYPES = [
  'int32',
  'int53',
  'int64',
  'double',
  'string',
  'bytes',
  'Bool',
  'True',
  'vector'
];

const schemaText = await (await fetch(TD_LIB_SCHEMA_URL)).text();
const schema = buildExplorerSchema(schemaText);

await mkdir(new URL('.', OUT_FILE), { recursive: true });
await writeFile(
  OUT_FILE,
  await format(JSON.stringify(schema), { ...PRETTIER_OPTIONS, parser: 'json' })
);

console.log(
  JSON.stringify({
    constructors: schema.counts.constructors,
    event: 'telegram.tdlib_explorer_schema_generated',
    functions: schema.counts.functions,
    types: schema.counts.types,
    updates: schema.counts.updates
  })
);

function buildExplorerSchema(text) {
  const parsed = parseTdSchema(text);
  const typeDescriptions = new Map(parsed.typeDescriptions);

  for (const scalar of SCALAR_TYPES) {
    if (!typeDescriptions.has(scalar)) {
      typeDescriptions.set(scalar, `${scalar} scalar value.`);
    }
  }

  const types = [...parsed.constructorsByType.entries()]
    .map(([name, constructors]) => ({
      constructorNames: constructors.map((constructor) => constructor.name),
      description: typeDescriptions.get(name) ?? '',
      kind: 'type',
      name
    }))
    .sort(byName);

  const scalars = SCALAR_TYPES.map((name) => ({
    description: typeDescriptions.get(name) ?? '',
    kind: 'scalar',
    name
  }));

  const constructors = parsed.constructors
    .filter((constructor) => constructor.resultType !== 'Update')
    .map((constructor) => ({
      description: constructor.description,
      fields: constructor.fields,
      kind: 'constructor',
      name: constructor.name,
      resultType: constructor.resultType
    }))
    .sort(byName);

  const updates = parsed.constructors
    .filter((constructor) => constructor.resultType === 'Update')
    .map((constructor) => ({
      description: constructor.description,
      fields: constructor.fields,
      kind: 'update',
      name: constructor.name,
      resultType: constructor.resultType
    }))
    .sort(byName);

  const functions = parsed.functions
    .map((func) => ({
      description: func.description,
      fields: func.fields,
      kind: 'function',
      name: func.name,
      resultType: func.resultType
    }))
    .sort(byName);

  return {
    counts: {
      constructors: constructors.length,
      fields:
        constructors.reduce((sum, constructor) => sum + constructor.fields.length, 0) +
        updates.reduce((sum, update) => sum + update.fields.length, 0) +
        functions.reduce((sum, func) => sum + func.fields.length, 0),
      functions: functions.length,
      scalars: scalars.length,
      types: types.length,
      updates: updates.length
    },
    generatedAt: new Date().toISOString(),
    schema: {
      commit: TD_LIB_SCHEMA_COMMIT,
      sha256: createHash('sha256').update(text).digest('hex'),
      url: TD_LIB_SCHEMA_URL
    },
    version: 1,
    constructors,
    functions,
    scalars,
    types,
    updates
  };
}

function parseTdSchema(text) {
  const constructors = [];
  const constructorsByType = new Map();
  const functions = [];
  const typeDescriptions = new Map();
  const pending = createPendingDocs();
  let section = 'constructors';

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (line === '---functions---') {
      section = 'functions';
      clearDocs(pending);
      continue;
    }

    if (line.startsWith('//@')) {
      readDocLine(pending, line.slice(2));
      if (pending.tags.class !== undefined) {
        typeDescriptions.set(pending.tags.class, pending.tags.description ?? '');
        clearDocs(pending);
      }
      continue;
    }

    if (line.startsWith('//-')) {
      appendDocContinuation(pending, line.slice(3).trim());
      continue;
    }

    if (line.length === 0 || line.startsWith('//')) {
      continue;
    }

    const definition = parseDefinition(line);
    if (definition === null) {
      clearDocs(pending);
      continue;
    }

    const docs = consumeDocs(pending);
    const fields = definition.fields.map((field) => ({
      description: docs.fields.get(field.name) ?? '',
      name: field.name,
      type: field.type
    }));
    const item = {
      description: docs.description,
      fields,
      name: definition.name,
      resultType: definition.resultType
    };

    if (section === 'functions') {
      functions.push(item);
      continue;
    }

    constructors.push(item);
    constructorsByType.set(item.resultType, [
      ...(constructorsByType.get(item.resultType) ?? []),
      item
    ]);
  }

  return { constructors, constructorsByType, functions, typeDescriptions };
}

function parseDefinition(line) {
  const match = line.match(/^([A-Za-z][A-Za-z0-9_]*)\b(.*?)=\s*(.+?)\s*;/);
  if (match === null) {
    return null;
  }
  if (match[2].includes('{') || match[3].includes(' ')) {
    return null;
  }

  return {
    fields: parseTlFields(match[2]),
    name: match[1],
    resultType: match[3]
  };
}

function parseTlFields(fieldsText) {
  return fieldsText
    .trim()
    .split(/\s+/)
    .filter((token) => /^[a-z][A-Za-z0-9_]*:/.test(token))
    .map((token) => {
      const separatorIndex = token.indexOf(':');
      return {
        name: token.slice(0, separatorIndex),
        type: token.slice(separatorIndex + 1)
      };
    });
}

function createPendingDocs() {
  return { fieldOrder: [], lastTag: null, tags: {} };
}

function readDocLine(pending, content) {
  const segments = tagSegments(content);

  for (const segment of segments) {
    pending.tags[segment.tag] =
      pending.tags[segment.tag] === undefined
        ? segment.value
        : `${pending.tags[segment.tag]} ${segment.value}`.trim();
    pending.lastTag = segment.tag;
    if (
      !['class', 'description'].includes(segment.tag) &&
      !pending.fieldOrder.includes(segment.tag)
    ) {
      pending.fieldOrder.push(segment.tag);
    }
  }
}

function appendDocContinuation(pending, content) {
  if (pending.lastTag === null) {
    return;
  }

  pending.tags[pending.lastTag] = `${pending.tags[pending.lastTag] ?? ''} ${content}`.trim();
}

function tagSegments(content) {
  const matches = [...content.matchAll(/(?:^|\s)@([A-Za-z_][A-Za-z0-9_]*)\s/g)];
  if (matches.length === 0) {
    return [];
  }

  return matches.map((match, index) => {
    const next = matches[index + 1];
    const start = match.index + match[0].length;
    const end = next === undefined ? content.length : next.index;
    return {
      tag: match[1],
      value: content.slice(start, end).trim()
    };
  });
}

function consumeDocs(pending) {
  const fields = new Map();

  for (const field of pending.fieldOrder) {
    if (pending.tags[field] !== undefined) {
      fields.set(field, pending.tags[field]);
    }
  }

  const result = {
    description: pending.tags.description ?? '',
    fields
  };
  clearDocs(pending);
  return result;
}

function clearDocs(pending) {
  pending.fieldOrder.length = 0;
  pending.lastTag = null;
  pending.tags = {};
}

function byName(left, right) {
  return left.name.localeCompare(right.name);
}
