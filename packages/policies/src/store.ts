import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, extname, join, resolve } from 'node:path';

import {
  identityOf,
  requirePolicyDocument,
  type PolicyDocument,
  type PolicyIdentity,
  type PolicyStore
} from '@agentg/framework/policies';
import { parseDocument, stringify } from 'yaml';

type FileStoreInput = {
  directory: string;
};

export function createFileStore(input: FileStoreInput): PolicyStore {
  const root = resolve(input.directory);

  return {
    async delete(identity) {
      await rm(canonicalPath(root, identity), { force: true });
    },
    async loadAll() {
      await mkdir(root, { recursive: true });
      await removeTempFiles(root);
      const documents: PolicyDocument[] = [];
      for (const path of await documentPaths(root)) {
        const document = await readDocument(path);
        const canonical = canonicalPath(root, identityOf(document));
        if (resolve(path) !== canonical) {
          throw new Error(`Policy path identity mismatch: ${path} must be ${canonical}`);
        }
        documents.push(document);
      }
      return documents;
    },
    async set(document) {
      const path = canonicalPath(root, identityOf(document));
      await mkdir(dirname(path), { recursive: true });
      const tempPath = `${path}.agentg-${String(process.pid)}-${String(Date.now())}.tmp`;
      await writeFile(tempPath, stringify(document), 'utf8');
      await rename(tempPath, path);
    }
  };
}

async function readDocument(path: string): Promise<PolicyDocument> {
  const yaml = parseDocument(await readFile(path, 'utf8'));
  if (yaml.errors.length > 0) {
    throw new Error(
      `Policy YAML is invalid in ${path}: ${yaml.errors[0]?.message ?? 'parse failed'}`
    );
  }
  if (yaml.warnings.length > 0) {
    throw new Error(
      `Policy YAML is invalid in ${path}: ${yaml.warnings[0]?.message ?? 'parse warning'}`
    );
  }
  return requirePolicyDocument(yaml.toJSON());
}

async function documentPaths(root: string): Promise<string[]> {
  const output: string[] = [];
  for (const kindEntry of await readdir(root, { withFileTypes: true })) {
    if (!kindEntry.isDirectory()) {
      continue;
    }
    const kindDirectory = join(root, kindEntry.name);
    for (const documentEntry of await readdir(kindDirectory, { withFileTypes: true })) {
      if (documentEntry.isFile() && ['.yaml', '.yml'].includes(extname(documentEntry.name))) {
        output.push(join(kindDirectory, documentEntry.name));
      }
    }
  }
  return output.sort();
}

async function removeTempFiles(root: string): Promise<void> {
  for (const kindEntry of await readdir(root, { withFileTypes: true })) {
    if (!kindEntry.isDirectory()) {
      continue;
    }
    const kindDirectory = join(root, kindEntry.name);
    for (const documentEntry of await readdir(kindDirectory, { withFileTypes: true })) {
      if (documentEntry.isFile() && isPolicyTempFile(documentEntry.name)) {
        await rm(join(kindDirectory, documentEntry.name), { force: true });
      }
    }
  }
}

function isPolicyTempFile(fileName: string): boolean {
  return /^[a-z][A-Za-z0-9]*\.yaml\.agentg-\d+-\d+\.tmp$/.test(fileName);
}

function canonicalPath(root: string, identity: PolicyIdentity): string {
  return join(root, kindDirectoryName(identity.kind), `${identity.name}.yaml`);
}

function kindDirectoryName(kind: string): string {
  return kind
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
