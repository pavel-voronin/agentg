import { access, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const packagesDirectory = new URL('../packages/', import.meta.url);
const outputPath = new URL('../packages/policies/src/generated/policyCatalog.ts', import.meta.url);

const packageEntries = (await readdir(packagesDirectory, { withFileTypes: true })).sort(
  (left, right) => left.name.localeCompare(right.name)
);
const imports = [];
const spreads = [];

for (const entry of packageEntries) {
  if (!entry.isDirectory() || entry.name === 'policies') {
    continue;
  }

  const policiesPath = join(packagesDirectory.pathname, entry.name, 'policies', 'policies.ts');
  const hasPolicies = await fileExists(policiesPath);
  if (!hasPolicies) {
    continue;
  }

  const importName = `${camelCase(entry.name)}Policies`;
  imports.push(
    `import { policies as ${importName} } from '../../../${entry.name}/policies/policies.js';`
  );
  spreads.push(`...${importName}`);
}

const contents = `${imports.join('\n')}

export const policyCatalog = [${spreads.join(', ')}] as const;
`;

await writeFile(outputPath, contents, 'utf8');

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function camelCase(value) {
  return value.replace(/-([a-z0-9])/g, (_match, char) => char.toUpperCase());
}
