/* global console, process */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

const sourceFiles = listFiles(root).filter((file) => !ignored(file));
const tsFiles = sourceFiles.filter((file) => file.endsWith('.ts'));
const vueFiles = sourceFiles.filter((file) => file.endsWith('.vue'));

auditRawTrpcBuilderImports(tsFiles);
auditCrossDomainSchemaImports(tsFiles);
auditTablePrefixes();
auditGatewayExternalSurface();
auditServiceDirectorySurface();
auditServiceDirectoryBootstrap();
auditExtensionBoundaries(tsFiles);
auditNoSharedWorkspacePackage();
auditDockerfileWorkspacePackageCopies();
auditControlPlaneCompositionBoundaries(tsFiles);
auditScopedVueComponentStyles(vueFiles, sourceFiles);

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
    '@agentg/history/schema',
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
      file: join(root, 'packages/history/src/schema.ts'),
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

function auditGatewayExternalSurface() {
  const agentGateway = readFileSync(join(root, 'packages/gateway/src/agent-gateway.ts'), 'utf8');
  const telegramReads = readFileSync(join(root, 'packages/gateway/src/telegram-reads.ts'), 'utf8');
  const tests = readFileSync(join(root, 'packages/gateway/tests/agent-gateway.test.ts'), 'utf8');
  const requiredTestTokens = [
    'exposes only telegram.getChat through WebSocket RPC',
    'forwards only telegram.login.completed as an external event'
  ];
  const forbiddenSourceTokens = [
    "'capabilities.",
    '"capabilities.',
    "'extensions.compose'",
    '"extensions.compose"',
    "'history.",
    '"history.',
    "'telegram.getMessage'",
    '"telegram.getMessage"',
    "'telegram.listRecentMessages'",
    '"telegram.listRecentMessages"',
    "'telegram.searchMessages'",
    '"telegram.searchMessages"'
  ];

  if (!agentGateway.includes("'telegram.getChat'")) {
    failures.push("Gateway external RPC surface must include only 'telegram.getChat'");
  }
  if (!agentGateway.includes("'telegram.login.completed'")) {
    failures.push("Gateway external event surface must include only 'telegram.login.completed'");
  }
  if (!telegramReads.includes("'telegram.getChat'")) {
    failures.push("Gateway Telegram adapter must call only 'telegram.getChat'");
  }
  for (const token of forbiddenSourceTokens) {
    if (agentGateway.includes(token) || telegramReads.includes(token)) {
      failures.push(`Gateway source exposes forbidden external surface token: ${token}`);
    }
  }
  for (const token of requiredTestTokens) {
    if (!tests.includes(token)) {
      failures.push(`Gateway external surface lacks regression test token: ${token}`);
    }
  }
}

function auditExtensionBoundaries(files) {
  auditNoDomainEnrichedRuntime(files);
  auditNoDomainExtensionEndpoints(files);
  auditRegistryDoesNotCallRpc(files);
  auditControlPlaneSdkHasNoDomainKnowledge(files);
}

function auditNoDomainEnrichedRuntime(files) {
  const auditedPrefixes = [
    'packages/events/src/',
    'packages/rpc/src/',
    'packages/infra/src/',
    'packages/history/src/',
    'packages/telegram/src/',
    'packages/summaries/src/',
    'packages/gateway/src/'
  ];
  const forbiddenTokens = [
    'callRegisteredExtensions',
    'createTrpcExtensionCallerResolver',
    'ExtensionCallerResolver',
    'extensionCallInputSchema',
    '@agentg/rpc/envelope',
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
  const domainRpcPrefixes = ['packages/history/src/rpc/', 'packages/telegram/src/rpc/'];
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

function auditServiceDirectorySurface() {
  const packageJson = JSON.parse(
    readFileSync(join(root, 'packages/service-directory/package.json'), 'utf8')
  );
  const exports = packageJson.exports ?? {};
  if (JSON.stringify(exports) !== JSON.stringify({ './rpc': './src/rpc/index.ts' })) {
    failures.push('Service Directory package must export only ./rpc');
  }

  const rpcIndex = readFileSync(join(root, 'packages/service-directory/src/rpc/index.ts'), 'utf8');
  const expectedRpcIndex =
    "export {\n  createServiceDirectoryClient,\n  type ServiceDirectoryClient,\n  type ServiceDirectoryProcedureCall\n} from './service-directory-client.js';";
  if (rpcIndex.trim() !== expectedRpcIndex) {
    failures.push(
      'Service Directory public RPC surface must expose only the client and procedure-call types'
    );
  }

  for (const file of listFiles(join(root, 'packages/service-directory/src'))) {
    if (!file.endsWith('.ts')) {
      continue;
    }

    const rel = toRel(file);
    const source = readFileSync(file, 'utf8');
    for (const token of ['registerExtension', 'listExtensions']) {
      if (source.includes(token)) {
        failures.push(`Service Directory must not expose old extension RPC method: ${rel}`);
      }
    }
  }
}

function auditServiceDirectoryBootstrap() {
  const requiredDependencies = [
    'packages/telegram/package.json',
    'packages/history/package.json',
    'packages/gateway/package.json',
    'packages/control-plane/package.json'
  ];

  for (const file of requiredDependencies) {
    const packageJson = JSON.parse(readFileSync(join(root, file), 'utf8'));
    if (packageJson.dependencies?.['@agentg/service-directory'] === undefined) {
      failures.push(`${file} must depend on @agentg/service-directory`);
    }
  }

  const telegramIngestion = readFileSync(join(root, 'packages/telegram/src/ingestion.ts'), 'utf8');
  if (!telegramIngestion.includes('createServiceDirectoryClient')) {
    failures.push('Telegram must join Service Directory');
  }
  auditRequiredManifest('packages/telegram/src/registrations.ts', true);

  const historyService = readFileSync(join(root, 'packages/history/src/service.ts'), 'utf8');
  if (!historyService.includes('createServiceDirectoryClient')) {
    failures.push('History must join Service Directory');
  }
  auditRequiredManifest('packages/history/src/registrations.ts', true);

  const gatewaySource = readFileSync(join(root, 'packages/gateway/src/agent-gateway.ts'), 'utf8');
  if (!gatewaySource.includes('createGatewayServiceManifest')) {
    failures.push('Gateway must join Service Directory');
  }
  auditRequiredManifest('packages/gateway/src/registrations.ts', true);

  const controlPlaneSource = readFileSync(
    join(root, 'packages/control-plane/src/server/control-plane-server.ts'),
    'utf8'
  );
  if (!controlPlaneSource.includes('createControlPlaneServiceManifest')) {
    failures.push('Control Plane must join Service Directory');
  }
  auditRequiredManifest('packages/control-plane/src/server/registrations.ts', true);

  auditRequiredManifest('packages/summaries/src/registrations.ts', false);

  const historyConfig = readFileSync(join(root, 'packages/history/src/config.ts'), 'utf8');
  if (historyConfig.includes('TELEGRAM_RPC_URL')) {
    failures.push('History config must resolve Telegram through Service Directory');
  }

  const gatewayConfig = readFileSync(join(root, 'packages/gateway/src/config.ts'), 'utf8');
  if (gatewayConfig.includes('TELEGRAM_RPC_URL')) {
    failures.push('Gateway config must resolve Telegram through Service Directory');
  }

  const controlPlaneConfig = readFileSync(
    join(root, 'packages/control-plane/src/server/config.ts'),
    'utf8'
  );
  for (const token of ['HISTORY_RPC_URL', 'TELEGRAM_RPC_URL']) {
    if (controlPlaneConfig.includes(token)) {
      failures.push(`Control Plane config must resolve ${token} through Service Directory`);
    }
  }
}

function auditRequiredManifest(file, required) {
  const source = readFileSync(join(root, file), 'utf8');
  const token = `required: ${String(required)}`;
  if (!source.includes(token)) {
    failures.push(`${file} must declare ${token}`);
  }
}

function auditRegistryDoesNotCallRpc(files) {
  for (const file of files) {
    const rel = toRel(file);
    if (
      !rel.startsWith('packages/service-directory/src/') ||
      rel === 'packages/service-directory/src/rpc/service-directory-client.ts'
    ) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    const forbiddenTokens = ['@trpc/client', 'createTRPCClient', 'createTRPCUntypedClient'];
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`Service Directory server must not call RPC methods: ${rel} -> ${token}`);
      }
    }
  }
}

function auditNoSharedWorkspacePackage() {
  const removedSharedWorkspace = `packages/${'shared'}`;
  const removedSharedPackage = `@agentg/${'shared'}`;
  const workspacePackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const workspaces = workspacePackage.workspaces ?? [];
  if (workspaces.includes(removedSharedWorkspace)) {
    failures.push(`root workspaces must not include ${removedSharedWorkspace}`);
  }
  if (existsSync(join(root, removedSharedWorkspace))) {
    failures.push(`removed workspace directory must not exist: ${removedSharedWorkspace}`);
  }

  for (const file of listFiles(root)) {
    const rel = toRel(file);
    if (ignored(file) || rel === 'package-lock.json') {
      continue;
    }
    if (!/\.(json|md|mjs|ts|vue)$/.test(rel) && rel !== 'Dockerfile') {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (source.includes(removedSharedPackage) || source.includes(removedSharedWorkspace)) {
      failures.push(`shared package reference is not allowed: ${rel}`);
    }
  }
}

function auditDockerfileWorkspacePackageCopies() {
  const dockerfile = readFileSync(join(root, 'Dockerfile'), 'utf8');
  const workspacePackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const workspaces = new Set(workspacePackage.workspaces ?? []);
  const copiedPackages = [
    ...dockerfile.matchAll(/COPY packages\/([^/]+)\/package\.json packages\/\1\/package\.json/g)
  ].map((match) => `packages/${match[1]}`);

  for (const workspace of workspaces) {
    if (!copiedPackages.includes(workspace)) {
      failures.push(`Dockerfile must copy workspace package manifest: ${workspace}`);
    }
  }

  for (const copiedPackage of copiedPackages) {
    if (!workspaces.has(copiedPackage)) {
      failures.push(`Dockerfile copies non-workspace package manifest: ${copiedPackage}`);
    }
    if (!existsSync(join(root, copiedPackage, 'package.json'))) {
      failures.push(`Dockerfile copies missing package manifest: ${copiedPackage}`);
    }
  }
}

function auditControlPlaneCompositionBoundaries(files) {
  const packageJson = JSON.parse(
    readFileSync(join(root, 'packages/control-plane/package.json'), 'utf8')
  );
  if (packageJson.dependencies?.['@trpc/client'] !== undefined) {
    failures.push('Control Plane must use @agentg/rpc/trpc-proxy instead of owning @trpc/client');
  }

  const forbiddenControlPlaneFiles = [
    'packages/control-plane/src/control-plane/controlPlaneApi.ts',
    'packages/control-plane/src/domain/chatNavigation.ts',
    'packages/control-plane/src/server/control-plane-read-model.ts',
    'packages/control-plane/src/stores/chat.ts',
    'packages/control-plane/src/stores/overview.ts',
    'packages/control-plane/src/stores/selectedHistory.ts',
    'packages/control-plane/src/stores/selectedHistoryEvents.ts',
    'packages/control-plane/src/view-models/chatSidebarView.ts',
    'packages/control-plane/src/view-models/dashboardView.ts',
    'packages/control-plane/src/view-models/selectedWorkspaceView.ts'
  ];
  const relFiles = new Set(files.map(toRel));
  for (const file of forbiddenControlPlaneFiles) {
    if (relFiles.has(file)) {
      failures.push(`Control Plane must not own domain view state: ${file}`);
    }
  }

  const layoutSource = readFileSync(
    join(root, 'packages/control-plane/src/composition/slots/layout.ts'),
    'utf8'
  );
  for (const token of ['telegram.', 'history.', 'summaries.']) {
    if (layoutSource.includes(token)) {
      failures.push(`Control Plane default layout must be derived from providers: ${token}`);
    }
  }

  const forbiddenTokens = [
    'Telegram',
    'telegram',
    'History',
    'history',
    '@agentg/telegram',
    '@agentg/history'
  ];
  for (const file of listFiles(join(root, 'packages/control-plane'))) {
    const rel = toRel(file);
    if (ignored(file) || !/\.(css|json|ts|vue)$/.test(rel)) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`Control Plane package must not contain domain token: ${rel} -> ${token}`);
      }
    }
  }

  for (const file of listFiles(join(root, 'packages/control-plane/src/server'))) {
    const rel = toRel(file);
    if (ignored(file) || !file.endsWith('.ts')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const token of [
      '@trpc/client',
      'createTRPCClient',
      'createTRPCUntypedClient',
      'httpBatchLink'
    ]) {
      if (source.includes(token)) {
        failures.push(`Control Plane server must not own tRPC proxy code: ${rel} -> ${token}`);
      }
    }
  }
}

function auditControlPlaneSdkHasNoDomainKnowledge(files) {
  const forbiddenTokens = [
    'telegram.',
    'history.',
    'summaries.',
    'controlPlane.',
    '@agentg/telegram',
    '@agentg/history',
    '@agentg/summaries',
    '@agentg/control-plane'
  ];

  for (const file of files) {
    const rel = toRel(file);
    if (!rel.startsWith('packages/control-plane-sdk/src/')) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`Control Plane SDK must stay mechanical: ${rel} -> ${token}`);
      }
    }
  }
}

function auditScopedVueComponentStyles(vueFiles, sourceFiles) {
  const auditedPrefixes = [
    'packages/control-plane/src/',
    'packages/control-plane-sdk/src/',
    'packages/history/src/control-plane/',
    'packages/telegram/src/control-plane/'
  ];

  for (const file of sourceFiles) {
    const rel = toRel(file);
    if (!auditedPrefixes.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }
    if (!/\.(css|ts|vue)$/.test(rel)) {
      continue;
    }
    if (rel === 'packages/control-plane/src/main.ts') {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    if (/import\s+['"][^'"]+\.css['"]/.test(source)) {
      failures.push(`control-plane composition must not import global CSS: ${rel}`);
    }
  }

  for (const file of vueFiles) {
    const rel = toRel(file);
    if (!auditedPrefixes.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/g)) {
      const attrs = match[1];
      if (!/\bscoped\b/.test(attrs)) {
        failures.push(`Vue component styles must be scoped: ${rel}`);
      }
      if (match[2].includes('@apply') && !match[2].includes('@reference "tailwindcss";')) {
        failures.push(`Vue component @apply blocks must reference Tailwind: ${rel}`);
      }
      auditStyleBlockContainsOnlyApply(rel, source, match);
    }

    if (/\B(?::class|v-bind:class)\s*=/.test(source)) {
      failures.push(`Vue component templates must not use dynamic class bindings: ${rel}`);
    }

    for (const match of source.matchAll(/\bclass\s*=\s*(["'])(.*?)\1/g)) {
      const className = match[2].trim();
      if (className.length === 0) {
        failures.push(`Vue component class must be a single semantic name: ${rel}`);
        continue;
      }
      if (/\s/.test(className)) {
        failures.push(`Vue component class must contain one semantic name: ${rel} -> ${className}`);
      }
    }
  }
}

function auditStyleBlockContainsOnlyApply(rel, source, match) {
  const startLine = source.slice(0, match.index).split('\n').length;
  const lines = match[2].split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (
      trimmed.length === 0 ||
      trimmed.startsWith('@apply ') ||
      trimmed.startsWith('@reference ') ||
      trimmed.startsWith('.') ||
      trimmed.startsWith('}') ||
      trimmed.endsWith('{') ||
      trimmed.startsWith('/*') ||
      trimmed.startsWith('*')
    ) {
      return;
    }
    failures.push(
      `Vue component style blocks may contain selectors and @apply only: ${rel}:${String(startLine + index + 1)}`
    );
  });
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
