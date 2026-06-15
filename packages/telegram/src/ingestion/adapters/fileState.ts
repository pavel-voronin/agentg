import type { file as TdlibFile } from 'tdlib-types';

import type { FileState } from '../../domain/models/fileState.js';
import { tdJsonObject } from '../../tdlib/shape.js';

export function fileStateFromTdlibFile(file: TdlibFile): FileState {
  return {
    expectedSize: String(file.expected_size),
    id: file.id,
    local: tdJsonObject(file.local),
    remote: tdJsonObject(file.remote),
    size: nullablePositiveId(file.size)
  };
}

function nullablePositiveId(value: number): string | null {
  return value > 0 ? String(value) : null;
}
