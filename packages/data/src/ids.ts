export function annotationId(input: {
  key: string;
  subjectId: string;
  subjectModel: string;
}): string {
  return joinSegments([input.subjectModel, input.subjectId, input.key]);
}

export function collectionItemId(input: {
  itemId: string;
  key: string;
  subjectId: string;
  subjectModel: string;
}): string {
  return joinSegments([input.subjectModel, input.subjectId, input.key, input.itemId]);
}

export function parseAnnotationId(value: string): {
  key: string;
  subjectId: string;
  subjectModel: string;
} {
  const parts = splitSegments(value, 3);
  return {
    key: segment(parts, 2, value),
    subjectId: segment(parts, 1, value),
    subjectModel: segment(parts, 0, value)
  };
}

export function parseCollectionItemId(value: string): {
  itemId: string;
  key: string;
  subjectId: string;
  subjectModel: string;
} {
  const parts = splitSegments(value, 4);
  return {
    itemId: segment(parts, 3, value),
    key: segment(parts, 2, value),
    subjectId: segment(parts, 1, value),
    subjectModel: segment(parts, 0, value)
  };
}

function joinSegments(values: readonly string[]): string {
  return values.map((value) => encodeURIComponent(value)).join(':');
}

function splitSegments(value: string, size: number): string[] {
  const parts = value.split(':');
  if (parts.length !== size) {
    throw new Error(`Data-owned model id is invalid: ${value}`);
  }
  return parts.map((part) => {
    const decoded = decodeSegment(part, value);
    if (decoded.length === 0) {
      throw new Error(`Data-owned model id is invalid: ${value}`);
    }
    return decoded;
  });
}

function segment(parts: readonly string[], index: number, source: string): string {
  const value = parts[index];
  if (value === undefined) {
    throw new Error(`Data-owned model id is invalid: ${source}`);
  }
  return value;
}

function decodeSegment(segment: string, source: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw new Error(`Data-owned model id is invalid: ${source}`);
  }
}
