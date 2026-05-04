import { mkdir, copyFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

export type TelegramFileStore = {
  copyIntoStore(input: TelegramFileCopyInput): Promise<TelegramStoredFile>;
  resolvePath(fileId: string, fileName?: string): string;
  rootDirectory: string;
};

export type TelegramFileCopyInput = {
  fileId: string;
  sourcePath: string;
  fileName?: string;
};

export type TelegramStoredFile = {
  fileId: string;
  path: string;
};

export function createTelegramFileStore(rootDirectory: string): TelegramFileStore {
  return {
    async copyIntoStore(input): Promise<TelegramStoredFile> {
      await mkdir(rootDirectory, { recursive: true });
      const path = resolveStoredPath(
        rootDirectory,
        input.fileId,
        input.fileName ?? input.sourcePath
      );
      await copyFile(input.sourcePath, path);

      return {
        fileId: input.fileId,
        path
      };
    },
    resolvePath(fileId, fileName): string {
      return resolveStoredPath(rootDirectory, fileId, fileName);
    },
    rootDirectory
  };
}

function resolveStoredPath(rootDirectory: string, fileId: string, fileName?: string): string {
  const safeFileId = fileId.replaceAll(/[^a-zA-Z0-9_-]/gu, '_');
  const extensionSource = fileName === undefined ? '' : basename(fileName);
  const extension = extensionSource.includes('.')
    ? `.${extensionSource.split('.').at(-1) ?? 'bin'}`
    : '';

  return join(rootDirectory, `${safeFileId}${extension}`);
}
