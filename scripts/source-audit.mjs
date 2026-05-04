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
auditExtensionBoundaries(tsFiles);

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

    if (
      !/packages\/[^/]+\/src\/rpc\/trpc\.ts$/.test(rel) &&
      !/packages\/[^/]+\/tests\/trpc-test\.ts$/.test(rel)
    ) {
      failures.push(
        `raw tRPC builder import is only allowed in package-local src/rpc/trpc.ts or tests/trpc-test.ts: ${rel}`
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
  const requiredCapabilityTokens = ['createTrpcGatewayCapabilityCaller', 'withTimeout'];
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

function auditExtensionBoundaries(files) {
  auditNoDomainEnrichedRuntime(files);
  auditNoDomainExtensionEndpoints(files);
  auditRegistryDoesNotCallRpc(files);
  auditGatewayExtensionComposition();
}

function auditNoDomainEnrichedRuntime(files) {
  const auditedPrefixes = [
    'packages/shared/src/',
    'packages/history-sync/src/',
    'packages/telegram/src/',
    'packages/summaries/src/',
    'packages/gateway/src/'
  ];
  const forbiddenTokens = [
    'callRegisteredExtensions',
    'createTrpcExtensionCallerResolver',
    'ExtensionCallerResolver',
    'extensionCallInputSchema',
    '@agentg/shared/rpc/envelope',
    'ProcedureErrorEnvelope',
    'ProcedureDomainError',
    'ProcedureExtensionEnvelope',
    'ProcedureExtensions',
    'isProcedureErrorEnvelope',
    'isProcedureSuccessEnvelope'
  ];

  for (const file of files) {
    const rel = toRel(file);
    if (!auditedPrefixes.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    if (/\benriched\b/.test(source)) {
      failures.push(`domain runtime must not reintroduce enriched RPC behavior: ${rel}`);
    }

    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(
          `old extension envelope helper is not allowed in runtime: ${rel} -> ${token}`
        );
      }
    }
  }
}

function auditNoDomainExtensionEndpoints(files) {
  const domainRpcPrefixes = ['packages/history-sync/src/rpc/', 'packages/telegram/src/rpc/'];
  const forbiddenTokens = ['registerExtension', 'listExtensions'];

  for (const file of files) {
    const rel = toRel(file);
    if (!domainRpcPrefixes.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`domain RPC must not expose a local extension registry: ${rel} -> ${token}`);
      }
    }
  }
}

function auditRegistryDoesNotCallRpc(files) {
  for (const file of files) {
    const rel = toRel(file);
    if (!rel.startsWith('packages/extension-registry/src/')) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    const forbiddenTokens = ['@trpc/client', 'createTRPCClient', 'createTRPCUntypedClient'];
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`extension registry must not call RPC methods: ${rel} -> ${token}`);
      }
    }
  }
}

function auditGatewayExtensionComposition() {
  const agentGateway = readFileSync(join(root, 'packages/gateway/src/agent-gateway.ts'), 'utf8');
  const extensions = readFileSync(join(root, 'packages/gateway/src/extensions.ts'), 'utf8');
  const tests = readFileSync(join(root, 'packages/gateway/tests/capabilities.test.ts'), 'utf8');
  const requiredGatewayTokens = ["'extensions.compose'", 'composeGatewayExtensions'];
  const requiredExtensionTokens = [
    'collectModelMarkers',
    'createTrpcGatewayExtensionRegistryClient',
    'createTrpcGatewayExtensionGetterCaller'
  ];
  const requiredTestTokens = ['composes model extensions from the standalone extension registry'];

  for (const token of requiredGatewayTokens) {
    if (!agentGateway.includes(token)) {
      failures.push(`Gateway extension composition behavior is missing token: ${token}`);
    }
  }
  for (const token of requiredExtensionTokens) {
    if (!extensions.includes(token)) {
      failures.push(`Gateway extension composer is missing token: ${token}`);
    }
  }
  for (const token of requiredTestTokens) {
    if (!tests.includes(token)) {
      failures.push(`Gateway extension composition lacks regression test token: ${token}`);
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
