import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { handledUpdateTypes } from '../src/ingestion/adapters/catalog.js';

type TdlibUpdate = {
  fields: { name: string }[];
  name: string;
};

type TdlibSchema = {
  updates: TdlibUpdate[];
};

type StorageReview = {
  updateDesigns?: Record<string, UpdateDesign>;
};

type UpdateDesign = {
  handlerPlan?: {
    steps?: { sourceFields?: string[] }[];
  };
};

const schema = readJson('../../tdlib-docs/src/data/tdlibSchema.json') as TdlibSchema;
const storageReview = readJson(
  '../../tdlib-docs/src/data/tdlibStorageReview.json'
) as StorageReview;

describe('TDLib update catalog coverage', () => {
  it('keeps handler catalog aligned with TDLib schema and storage review', () => {
    const schemaUpdateTypes = sorted(schema.updates.map((update) => update.name));
    const designUpdateTypes = sorted(Object.keys(storageReview.updateDesigns ?? {}));

    expect(sorted([...handledUpdateTypes])).toEqual(schemaUpdateTypes);
    expect(designUpdateTypes).toEqual(schemaUpdateTypes);
  });

  it('covers every TDLib update root field in handler plans', () => {
    const uncoveredFields: string[] = [];

    for (const update of schema.updates) {
      const design = storageReview.updateDesigns?.[update.name];
      const sourceFields = new Set(
        (design?.handlerPlan?.steps ?? []).flatMap((step) => step.sourceFields ?? [])
      );

      for (const field of update.fields) {
        const rootField = `Update.${update.name}.${field.name}`;
        const covered = [...sourceFields].some(
          (sourceField) =>
            sourceField === rootField ||
            sourceField.startsWith(`${rootField}.`) ||
            sourceField.startsWith(`${rootField}[`)
        );
        if (!covered) {
          uncoveredFields.push(rootField);
        }
      }
    }

    expect(uncoveredFields).toEqual([]);
  });
});

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as unknown;
}

function sorted(values: string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}
