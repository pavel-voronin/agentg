/* global console, process */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

const tsFiles = listFiles(root).filter((file) => file.endsWith('.ts') && !ignored(file));

auditRawTrpcBuilderImports(tsFiles);
auditCrossDomainSchemaImports(tsFiles);
auditTablePrefixes();
auditGatewayCapabilities();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log('source-audit: ok');
}

function auditRawTrpcBuilderImports(files) {
  for (const file of files) {
    const rel = toRel(file);
    const source = readFileSync(file, 'utf8');
    if (!source.includes("from '@trpc/server'") && !source.includes('from "@trpc/server"')) {
      continue;
    }

    if (!/packages\/[^/]+\/src\/rpc\/trpc\.ts$/.test(rel)) {
      failures.push(
        `raw tRPC builder import is only allowed in package-local src/rpc/trpc.ts: ${rel}`
      );
    }
  }
}

function auditCrossDomainSchemaImports(files) {
  const schemaImports = [
    '@agentg/history-sync/schema',
    '@agentg/summaries/schema',
    '@agentg/telegram/schema'
  ];

  for (const file of files) {
    const rel = toRel(file);
    const owner = packageOwner(rel);
    const source = readFileSync(file, 'utf8');

    for (const specifier of schemaImports) {
      if (!source.includes(specifier)) {
        continue;
      }

      const schemaOwner = specifier.split('/')[1];
      if (owner !== schemaOwner) {
        failures.push(`cross-domain storage schema import is not allowed: ${rel} -> ${specifier}`);
      }
    }
  }
}

function auditTablePrefixes() {
  const schemas = [
    {
      file: join(root, 'packages/history-sync/src/schema.ts'),
      prefix: 'history_'
    },
    {
      file: join(root, 'packages/summaries/src/schema.ts'),
      prefix: 'summaries_'
    },
    {
      file: join(root, 'packages/telegram/src/schema.ts'),
      prefix: 'telegram_'
    }
  ];

  for (const schema of schemas) {
    const source = readFileSync(schema.file, 'utf8');
    const tableNames = [...source.matchAll(/pgTable\(\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1]
    );

    if (tableNames.length === 0) {
      failures.push(`schema declares no pgTable tables: ${toRel(schema.file)}`);
      continue;
    }

    for (const tableName of tableNames) {
      if (!tableName.startsWith(schema.prefix)) {
        failures.push(
          `table ${tableName} in ${toRel(schema.file)} must use prefix ${schema.prefix}`
        );
      }
    }
  }
}

function auditGatewayCapabilities() {
  const agentGateway = readFileSync(join(root, 'packages/gateway/src/agent-gateway.ts'), 'utf8');
  const capabilities = readFileSync(join(root, 'packages/gateway/src/capabilities.ts'), 'utf8');
  const tests = readFileSync(join(root, 'packages/gateway/tests/capabilities.test.ts'), 'utf8');
  const requiredGatewayTokens = [
    'createCapabilityRegistry',
    "'capabilities.register'",
    "'capabilities.list'",
    "'capabilities.call'"
  ];
  const requiredCapabilityTokens = [
    'createTrpcGatewayCapabilityCaller',
    'unwrapCapabilityResponse',
    'withTimeout'
  ];
  const requiredTestTokens = [
    'registers, refreshes, lists, and removes stale capabilities',
    'proxies capability calls to the owning module tRPC method'
  ];

  for (const token of requiredGatewayTokens) {
    if (!agentGateway.includes(token)) {
      failures.push(`Gateway capability registry behavior is missing token: ${token}`);
    }
  }
  for (const token of requiredCapabilityTokens) {
    if (!capabilities.includes(token)) {
      failures.push(`Gateway capability proxy behavior is missing token: ${token}`);
    }
  }
  for (const token of requiredTestTokens) {
    if (!tests.includes(token)) {
      failures.push(`Gateway capability behavior lacks regression test token: ${token}`);
    }
  }
}

function listFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (ignoredDirectory(path)) {
        continue;
      }
      files.push(...listFiles(path));
      continue;
    }
    if (entry.isFile()) {
      files.push(path);
    }
  }

  return files;
}

function ignoredDirectory(directory) {
  const rel = toRel(directory);
  return (
    rel === 'node_modules' ||
    rel === 'dist' ||
    rel === 'dist-server' ||
    rel.endsWith('/node_modules') ||
    rel.endsWith('/dist') ||
    rel.endsWith('/dist-server') ||
    rel === '.git' ||
    rel.endsWith('/.git')
  );
}

function ignored(file) {
  const rel = toRel(file);
  return (
    rel.includes('/node_modules/') ||
    rel.includes('/dist/') ||
    rel.includes('/dist-server/') ||
    rel.startsWith('node_modules/') ||
    rel.startsWith('dist/') ||
    rel.startsWith('dist-server/')
  );
}

function packageOwner(rel) {
  const match = /^packages\/([^/]+)\//.exec(rel);
  return match?.[1];
}

function toRel(file) {
  return relative(root, file).replaceAll('\\', '/');
}
