import { z } from 'zod';

const nonEmptyStringSchema = z.string().trim().min(1);

export const modelMarkerSchema = z.object({
  _model: nonEmptyStringSchema,
  id: nonEmptyStringSchema
});

export type ModelRef = z.output<typeof modelMarkerSchema>;

export function collectModelRefs(value: unknown): ModelRef[] {
  const refs: ModelRef[] = [];
  const seenObjects = new WeakSet<object>();
  const seenRefs = new Set<string>();

  visit(value, refs, seenObjects, seenRefs);

  return refs;
}

function visit(
  value: unknown,
  refs: ModelRef[],
  seenObjects: WeakSet<object>,
  seenRefs: Set<string>
): void {
  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (seenObjects.has(value)) {
    return;
  }
  seenObjects.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      visit(item, refs, seenObjects, seenRefs);
    }
    return;
  }

  const parsed = modelMarkerSchema.safeParse(value);
  if (parsed.success) {
    const key = modelRefKey(parsed.data);
    if (!seenRefs.has(key)) {
      seenRefs.add(key);
      refs.push(parsed.data);
    }
  }

  for (const item of Object.values(value)) {
    visit(item, refs, seenObjects, seenRefs);
  }
}

function modelRefKey(ref: ModelRef): string {
  return `${ref._model}\u0000${ref.id}`;
}
