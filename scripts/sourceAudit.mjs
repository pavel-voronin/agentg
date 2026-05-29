/* global console, process */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const failures = [];

const sourceFiles = listFiles(root).filter((file) => !ignored(file));
const tsFiles = sourceFiles.filter((file) => file.endsWith('.ts'));
const vueFiles = sourceFiles.filter((file) => file.endsWith('.vue'));

auditNamingConventions(sourceFiles);
auditRawTrpcBuilderImports(tsFiles);
auditCrossDomainSchemaImports(tsFiles);
auditNoPublicProcedureDtoExports(tsFiles);
auditNoDomainRpcClientFacades(tsFiles);
auditDomainRpcFolders(tsFiles);
auditNoContextProcedureApi(tsFiles);
auditTelegramDomainResources(tsFiles);
auditTablePrefixes();
auditGatewayExternalSurface();
auditServiceDirectorySurface();
auditServiceDirectoryBootstrap();
auditExtensionBoundaries(tsFiles);
auditNoSharedWorkspacePackage();
auditDockerfileWorkspacePackageCopies();
auditControlPlaneCompositionBoundaries(tsFiles);
auditDateContract(sourceFiles);
auditTdlibContractGeneration(sourceFiles);
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
      rel !== 'packages/framework/src/trpc.ts' &&
      !/packages\/[^/]+\/tests\/trpcTest\.ts$/.test(rel)
    ) {
      failures.push(
        `raw tRPC builder import is only allowed in package-local src/rpc/trpc.ts or tests/trpcTest.ts: ${rel}`
      );
    }
  }
}

function auditNamingConventions(files) {
  const directories = new Set();

  for (const file of files) {
    const rel = toRel(file);
    const parts = rel.split('/');
    for (let index = 0; index < parts.length - 1; index += 1) {
      directories.add(parts.slice(0, index + 1).join('/'));
    }

    if (isExternalNamingContractFile(rel)) {
      continue;
    }

    const fileName = parts.at(-1) ?? '';
    const stem = projectFileStem(fileName);
    if (!/^(?:[a-z][A-Za-z0-9]*|[0-9]+[A-Za-z0-9]*)$/.test(stem)) {
      failures.push(`project file names must use camelCase: ${rel}`);
    }
  }

  for (const directory of directories) {
    for (const segment of directory.split('/')) {
      if (segment.startsWith('.')) {
        continue;
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(segment)) {
        failures.push(`project directory names must use kebab-case: ${directory}`);
        break;
      }
    }
  }
}

function projectFileStem(fileName) {
  let stem = fileName;
  for (;;) {
    const extension = [
      '.vue',
      '.ts',
      '.mjs',
      '.js',
      '.json',
      '.md',
      '.yml',
      '.yaml',
      '.html',
      '.css',
      '.sql'
    ].find((candidate) => stem.endsWith(candidate));
    if (extension === undefined) {
      break;
    }
    stem = stem.slice(0, -extension.length);
  }

  for (;;) {
    const suffix = ['.test', '.config', '.d'].find((candidate) => stem.endsWith(candidate));
    if (suffix === undefined) {
      break;
    }
    stem = stem.slice(0, -suffix.length);
  }

  return stem;
}

function isExternalNamingContractFile(rel) {
  const fileName = rel.split('/').at(-1) ?? '';
  const externalFileNames = new Set([
    'AGENTS.md',
    'Dockerfile',
    'docker-compose.yml',
    'drizzle.config.ts',
    'eslint.config.js',
    'package-lock.json',
    'package.json',
    'tsconfig.json',
    'vite.config.ts'
  ]);

  if (fileName.startsWith('.') || externalFileNames.has(fileName)) {
    return true;
  }
  if (rel === 'packages/claude-plugin/bun.lock') {
    return true;
  }
  if (/\/drizzle\/(?:meta\/)?(?:_journal|\d{4}[_-]).*\.(?:json|sql)$/.test(`/${rel}`)) {
    return true;
  }

  return false;
}

function auditCrossDomainSchemaImports(files) {
  const schemaImports = ['@agentg/history-sync/schema', '@agentg/telegram/schema'];

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

function auditNoPublicProcedureDtoExports(files) {
  for (const file of files) {
    const rel = toRel(file);
    if (!/packages\/[^/]+\/src\/framework\/index\.ts$/.test(rel)) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    const procedureDtoExport =
      /export\s+type\s+\{[^}]*\b[A-Za-z0-9]+(?:Input|Output)\b[^}]*\}\s+from\s+['"]\.\/procedures\//s;
    if (procedureDtoExport.test(source)) {
      failures.push(`public RPC surface must not export procedure Input/Output DTO types: ${rel}`);
    }
  }
}

function auditNoDomainRpcClientFacades(files) {
  const forbiddenFiles = new Set([
    'packages/history-sync/src/rpc/historySyncClient.ts',
    'packages/telegram/src/rpc/client.ts'
  ]);

  for (const file of files) {
    const rel = toRel(file);
    if (forbiddenFiles.has(rel)) {
      failures.push(`domain RPC clients must be generated by defineDomain: ${rel}`);
    }
  }
}

function auditDomainRpcFolders(files) {
  for (const file of files) {
    const rel = toRel(file);
    if (
      /^packages\/(?:history-sync|telegram)\/src\/rpc\/(?:index|setup)\.ts$/.test(rel) ||
      /^packages\/(?:history-sync|telegram)\/src\/rpc\/procedures\//.test(rel)
    ) {
      failures.push(`domain RPC folder must contain direct procedure files only: ${rel}`);
    }
  }

  for (const packagePath of [
    'packages/history-sync/package.json',
    'packages/telegram/package.json'
  ]) {
    const packageJson = JSON.parse(readFileSync(join(root, packagePath), 'utf8'));
    if (packageJson.exports?.['./domain'] !== undefined) {
      failures.push(`${packagePath} must not expose domain runner entrypoint`);
    }
    if (packageJson.exports?.['./rpc'] !== undefined) {
      failures.push(`${packagePath} must not expose generic ./rpc entrypoint`);
    }
    if (packageJson.exports?.['./rpc-client'] !== undefined) {
      failures.push(`${packagePath} must not expose RPC client through a subpath`);
    }
    if (
      packagePath === 'packages/telegram/package.json' &&
      packageJson.exports?.['.'] !== './src/main.ts'
    ) {
      failures.push('packages/telegram/package.json must expose Telegram public surface at "."');
    }
  }

  const forbiddenRunnerExports = [
    ['packages/history-sync/src/main.ts', 'export const historySync ='],
    ['packages/telegram/src/main.ts', 'export const telegram =']
  ];

  for (const [file, token] of forbiddenRunnerExports) {
    const source = readFileSync(join(root, file), 'utf8');
    if (source.includes(token)) {
      failures.push(`${file} must not export domain runner object`);
    }
  }

  for (const file of ['packages/history-sync/src/main.ts', 'packages/telegram/src/main.ts']) {
    const source = readFileSync(join(root, file), 'utf8');
    if (/class\s+\w*Subsystem\b/.test(source)) {
      failures.push(`${file} must not declare subsystem classes in domain entrypoint`);
    }
    if (source.includes('createRouter')) {
      failures.push(`${file} must not create procedure routers in domain entrypoint`);
    }
    if (/defineControlPlane\(\s*(?:\(|\{)/.test(source)) {
      failures.push(`${file} must define Control Plane through a framework subsystem`);
    }
  }

  const telegramMain = readFileSync(join(root, 'packages/telegram/src/main.ts'), 'utf8');
  if (!telegramMain.includes('const { procedures } = defineControlPlane')) {
    failures.push('Telegram main must receive Control Plane procedures from defineControlPlane');
  }
  if (telegramMain.includes('defineRuntime')) {
    failures.push('Telegram main must receive procedure context from domain subsystems');
  }
  if (telegramMain.includes('TELEGRAM_TDLIB_METHODS')) {
    failures.push('Telegram TDLib operation event catalog must live in TDLib subsystem');
  }
  if (telegramMain.includes('defineTelegramTdlibSubsystem')) {
    failures.push('Telegram TDLib subsystem must be exposed through a useTdlib composable');
  }
  if (telegramMain.includes("defineSubsystem('tdlib'")) {
    failures.push('Telegram main must use useTdlib instead of declaring TDLib inline');
  }
  if (!telegramMain.includes('const tdlib = useTdlib();')) {
    failures.push('Telegram main must use TDLib through useTdlib');
  }
  if (!telegramMain.includes('registerSubsystem(tdlib);')) {
    failures.push('Telegram main must register the used TDLib subsystem intentionally');
  }

  const telegramTdlibSubsystem = readFileSync(
    join(root, 'packages/telegram/src/tdlib/subsystem.ts'),
    'utf8'
  );
  if (!telegramTdlibSubsystem.includes('export const useTdlib = defineSubsystem(')) {
    failures.push('Telegram TDLib subsystem must be exposed as useTdlib defineSubsystem');
  }
  if (/export\s+(?:const|function|class|type)\s+(?!useTdlib\b)/.test(telegramTdlibSubsystem)) {
    failures.push('Telegram TDLib subsystem must export only useTdlib');
  }

  const historySyncMain = readFileSync(join(root, 'packages/history-sync/src/main.ts'), 'utf8');
  if (historySyncMain.includes('defineRuntime')) {
    failures.push('History Sync main must receive procedure context from domain subsystems');
  }
}

function auditNoContextProcedureApi(files) {
  const forbiddenTokens = [
    'context' + 'Query',
    'context' + 'Mutation',
    'context' + 'ForInternalRpcCall'
  ];

  for (const file of files) {
    const rel = toRel(file);
    if (rel === 'scripts/sourceAudit.mjs') {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`domain procedures must use injected resources, not context API: ${rel}`);
      }
    }
  }
}

function auditTelegramDomainResources(files) {
  if (existsSync(join(root, 'packages/telegram/src/tdlib/update-runtime/context.ts'))) {
    failures.push('TDLib update handlers must not keep a shared context module');
  }

  for (const file of files) {
    const rel = toRel(file);
    const source = readFileSync(file, 'utf8');
    if (source.includes('TelegramDomainContext')) {
      failures.push(
        `Telegram procedures must use subsystem composables, not domain context: ${rel}`
      );
    }

    if (
      /packages\/telegram\/src\/(?:rpc|history|control-plane\/backend)\//.test(rel) &&
      /context\.(?:client|database|eventBus|files)\b/.test(source)
    ) {
      failures.push(`Telegram procedure resources must be read through use* subsystems: ${rel}`);
    }

    if (
      /packages\/telegram\/src\/tdlib\/update-handlers\//.test(rel) &&
      (source.includes('TelegramUpdateHandlerContext') || /\bcontext\s*[.:]/.test(source))
    ) {
      failures.push(`Telegram update handlers must read resources through use* subsystems: ${rel}`);
    }

    if (
      /packages\/telegram\/src\/(?:rpc|control-plane\/backend\/procedures)\//.test(rel) &&
      /\b(?:query|mutation)\(\(\s*_?context\s*,/.test(source)
    ) {
      failures.push(
        `Telegram procedures without context must use query((procedure) => ...): ${rel}`
      );
    }
  }
}

function auditTablePrefixes() {
  const schemas = [
    {
      file: join(root, 'packages/history-sync/src/schema.ts'),
      prefix: 'history_sync_'
    },
    {
      file: join(root, 'packages/telegram/src/database/schema.ts'),
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
  const agentGateway = readFileSync(join(root, 'packages/gateway/src/agentGateway.ts'), 'utf8');
  const telegramReads = readFileSync(join(root, 'packages/gateway/src/telegramReads.ts'), 'utf8');
  const tests = readFileSync(join(root, 'packages/gateway/tests/agentGateway.test.ts'), 'utf8');
  const requiredTestTokens = [
    'exposes only telegram.getChat through WebSocket RPC',
    'forwards only telegram.login.completed as an external event'
  ];
  const forbiddenSourceTokens = [
    "'capabilities.",
    '"capabilities.',
    "'extensions.compose'",
    '"extensions.compose"',
    "'history-sync.",
    '"history-sync.',
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
  auditNoDomainEnrichedRpc(files);
  auditNoDomainExtensionEndpoints(files);
  auditRegistryDoesNotCallRpc(files);
  auditControlPlaneSdkHasNoDomainKnowledge(files);
}

function auditNoDomainEnrichedRpc(files) {
  const auditedPrefixes = [
    'packages/events/src/',
    'packages/framework/src/',
    'packages/infra/src/',
    'packages/history-sync/src/',
    'packages/telegram/src/',
    'packages/gateway/src/'
  ];
  const forbiddenTokens = [
    'callRegisteredExtensions',
    'createTrpcExtensionCallerResolver',
    'ExtensionCallerResolver',
    'extensionCallInputSchema',
    '@agentg/framework/envelope',
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
      failures.push(`domain code must not reintroduce enriched RPC behavior: ${rel}`);
    }

    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`old extension envelope helper is not allowed: ${rel} -> ${token}`);
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
    "export {\n  createServiceDirectoryClient,\n  type ServiceDirectoryClient,\n  type ServiceDirectoryProcedureCall\n} from './serviceDirectoryClient.js';";
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
    'packages/history-sync/package.json',
    'packages/gateway/package.json',
    'packages/control-plane/package.json'
  ];

  for (const file of requiredDependencies) {
    const packageJson = JSON.parse(readFileSync(join(root, file), 'utf8'));
    if (packageJson.dependencies?.['@agentg/service-directory'] === undefined) {
      failures.push(`${file} must depend on @agentg/service-directory`);
    }
  }

  const telegramIngestion = readFileSync(
    join(root, 'packages/telegram/src/tdlib/ingestion.ts'),
    'utf8'
  );
  if (!telegramIngestion.includes('createServiceDirectoryClient')) {
    failures.push('Telegram must join Service Directory');
  }
  auditRequiredManifest('packages/telegram/src/main.ts', true);

  const historySyncService = readFileSync(
    join(root, 'packages/history-sync/src/service/runService.ts'),
    'utf8'
  );
  if (!historySyncService.includes('createServiceDirectoryClient')) {
    failures.push('History Sync must join Service Directory');
  }
  auditRequiredManifest('packages/history-sync/src/main.ts', true);

  const gatewaySource = readFileSync(join(root, 'packages/gateway/src/agentGateway.ts'), 'utf8');
  if (!gatewaySource.includes('createGatewayServiceManifest')) {
    failures.push('Gateway must join Service Directory');
  }
  auditRequiredManifest('packages/gateway/src/registrations.ts', true);

  const controlPlaneSource = readFileSync(
    join(root, 'packages/control-plane/src/server/controlPlaneServer.ts'),
    'utf8'
  );
  if (!controlPlaneSource.includes('createControlPlaneServiceManifest')) {
    failures.push('Control Plane must join Service Directory');
  }
  auditRequiredManifest('packages/control-plane/src/server/registrations.ts', true);

  const historySyncConfig = readFileSync(join(root, 'packages/history-sync/src/config.ts'), 'utf8');
  if (historySyncConfig.includes('TELEGRAM_RPC_URL')) {
    failures.push('History Sync config must resolve Telegram through Service Directory');
  }

  const gatewayConfig = readFileSync(join(root, 'packages/gateway/src/config.ts'), 'utf8');
  if (gatewayConfig.includes('TELEGRAM_RPC_URL')) {
    failures.push('Gateway config must resolve Telegram through Service Directory');
  }

  const controlPlaneConfig = readFileSync(
    join(root, 'packages/control-plane/src/server/config.ts'),
    'utf8'
  );
  for (const token of ['HISTORY_SYNC_RPC_URL', 'TELEGRAM_RPC_URL']) {
    if (controlPlaneConfig.includes(token)) {
      failures.push(`Control Plane config must resolve ${token} through Service Directory`);
    }
  }
}

function auditRequiredManifest(file, required) {
  const source = readFileSync(join(root, file), 'utf8');
  const token = `required: ${String(required)}`;
  const compositionToken = `setRequired(${String(required)})`;
  if (!source.includes(token) && !source.includes(compositionToken)) {
    failures.push(`${file} must declare ${token}`);
  }
}

function auditRegistryDoesNotCallRpc(files) {
  for (const file of files) {
    const rel = toRel(file);
    if (
      !rel.startsWith('packages/service-directory/src/') ||
      rel === 'packages/service-directory/src/rpc/serviceDirectoryClient.ts'
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
    failures.push(
      'Control Plane must use @agentg/framework/trpc-proxy instead of owning @trpc/client'
    );
  }

  const forbiddenControlPlaneFiles = [
    'packages/control-plane/src/control-plane/controlPlaneApi.ts',
    'packages/control-plane/src/domain/chatNavigation.ts',
    'packages/control-plane/src/server/control-plane-read-model.ts',
    'packages/control-plane/src/stores/chat.ts',
    'packages/control-plane/src/stores/overview.ts',
    'packages/control-plane/src/stores/selectedHistorySync.ts',
    'packages/control-plane/src/stores/selectedHistorySyncEvents.ts',
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
    join(root, 'packages/control-plane/src/composition/slots/manifest.ts'),
    'utf8'
  );
  for (const token of ['telegram.', 'history-sync.']) {
    if (layoutSource.includes(token)) {
      failures.push(`Control Plane default layout must be derived from providers: ${token}`);
    }
  }

  const forbiddenTokens = [
    'Telegram',
    'telegram',
    'History Sync',
    'history-sync',
    'history-sync',
    '@agentg/telegram',
    '@agentg/history-sync'
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
    'history-sync.',
    'controlPlane.',
    '@agentg/telegram',
    '@agentg/history-sync',
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

function auditDateContract(files) {
  auditTelegramDateStorageContract();
  auditControlPlaneEventDateContract(files);
}

function auditTelegramDateStorageContract() {
  const telegramGeneratedSchema = readFileSync(
    join(root, 'packages/telegram/src/tdlib/databaseSchema.ts'),
    'utf8'
  );
  const telegramGeneratedMigration = readFileSync(
    join(root, 'packages/telegram/drizzle/0000_telegram_tdlib_schema.sql'),
    'utf8'
  );
  if (
    !/\bdate:\s*timestamp\('date',\s*\{\s*withTimezone:\s*true\s*\}\)/.test(telegramGeneratedSchema)
  ) {
    failures.push('Telegram generated schema must store TDLib message date as timestamptz');
  }
  if (!/"date"\s+timestamp with time zone/.test(telegramGeneratedMigration)) {
    failures.push('Telegram generated migration must store TDLib message date as timestamptz');
  }

  for (const rel of [
    'packages/telegram/src/store/message.ts',
    'packages/telegram/src/history/messageCounts.ts'
  ]) {
    const source = readFileSync(join(root, rel), 'utf8');
    if (/getTime\(\)\s*\/\s*1000/.test(source)) {
      failures.push(`Telegram message storage must keep Date values as timestamptz: ${rel}`);
    }
  }
}

function auditControlPlaneEventDateContract(files) {
  for (const file of files) {
    const rel = toRel(file);
    if (
      !rel.startsWith('packages/control-plane/src/') &&
      !rel.startsWith('packages/control-plane-sdk/src/') &&
      !rel.startsWith('packages/history-sync/src/control-plane/') &&
      !rel.startsWith('packages/telegram/src/control-plane/')
    ) {
      continue;
    }
    if (!/\.(ts|vue)$/.test(rel)) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    if (/occurredAt\??:\s*Date\s*\|\s*string/.test(source)) {
      failures.push(`Control Plane browser event state must use ISO strings: ${rel}`);
    }
  }
}

function auditTdlibContractGeneration(files) {
  const storageReviewPath = join(root, 'packages/tdlib-docs/src/data/tdlibStorageReview.json');
  const oldCoveragePath = join(root, 'docs/04-data/telegram-tdlib-schema/coverage.json');
  const dbSchemaGenerator = readFileSync(
    join(root, 'scripts/telegramDbSchemaGenerate.mjs'),
    'utf8'
  );

  if (!existsSync(storageReviewPath)) {
    failures.push(
      'TDLib storage review must exist: packages/tdlib-docs/src/data/tdlibStorageReview.json'
    );
  } else {
    const storageReview = JSON.parse(readFileSync(storageReviewPath, 'utf8'));
    if (storageReview.version !== 2) {
      failures.push('TDLib storage review must use version 2');
    }
    if (!Array.isArray(storageReview.tables) || storageReview.tables.length === 0) {
      failures.push('TDLib storage review must contain schema-design table definitions');
    }
    if (
      !storageReview.tables?.every(
        (table) => typeof table.name === 'string' && Array.isArray(table.columns)
      )
    ) {
      failures.push('TDLib storage review tables must include column definitions');
    }
    auditTdlibStorageReviewPolicy(storageReview);
    auditTdlibStorageReviewParserContract(storageReviewPath);
    auditTelegramChatLastMessageStorage(storageReview);
  }

  if (existsSync(oldCoveragePath)) {
    failures.push(
      'TDLib coverage.json is obsolete; use tdlibStorageReview.json for DB schema design'
    );
  }
  auditNoTdlibMarkdownArtifacts(files);
  auditTelegramWireBoundary(files);
  if (dbSchemaGenerator.includes('tables.md')) {
    failures.push('Telegram DB schema generator must read tdlibStorageReview.json, not tables.md');
  }
  if (dbSchemaGenerator.includes('contract.json')) {
    failures.push('Telegram DB schema generator must not read the old TDLib contract');
  }
  if (!dbSchemaGenerator.includes('tdlibStorageReview.json')) {
    failures.push('Telegram DB schema generator must read tdlibStorageReview.json');
  }

  const forbiddenTokens = [
    `tdlib-${'data-model'}-audit.mjs`,
    `tdlib-${'field-routing'}-generate.mjs`,
    `tdlib-${'field-routing'}.catalog.json`,
    `tdlib-${'field-routing'}.generated.md`,
    `tdlib:${'field-routing'}:generate`,
    `telegram-${'tdlib-schema'}-artifacts-generate.mjs`,
    `scripts/tdlib/${'overrides'}.json`,
    `tdlib:${'contract'}:generate`
  ];

  for (const file of files) {
    const rel = toRel(file);
    if (ignored(file) || rel === 'package-lock.json') {
      continue;
    }
    if (!/\.(json|md|mjs|ts)$/.test(rel)) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    for (const token of forbiddenTokens) {
      if (source.includes(token)) {
        failures.push(`old TDLib routing artifact reference is not allowed: ${rel} -> ${token}`);
      }
    }
  }
}

function auditTelegramWireBoundary(files) {
  const boundaryPrefixes = [
    'packages/telegram/src/tdlib/ingestion.ts',
    'packages/telegram/src/rpc/',
    'packages/telegram/src/tdlib/update-handlers/',
    'packages/telegram/src/files/extractor.ts',
    'packages/telegram/src/files/subsystem.ts',
    'packages/telegram/src/history/fetch.ts',
    'packages/telegram/src/store/'
  ];

  for (const file of files) {
    const rel = toRel(file);
    if (!boundaryPrefixes.some((prefix) => rel === prefix || rel.startsWith(prefix))) {
      continue;
    }

    const source = readFileSync(file, 'utf8');
    if (source.includes('/tdlib-schema/')) {
      failures.push(
        `Telegram live storage path must use generated wire types, not local schemas: ${rel}`
      );
    }
  }
}

function auditNoTdlibMarkdownArtifacts(files) {
  const schemaRoot = 'docs/04-data/telegram-tdlib-schema/';

  for (const file of files) {
    const rel = toRel(file);
    if (rel.startsWith(schemaRoot)) {
      failures.push(`old TDLib contract artifact is obsolete: ${rel}`);
    }
  }
}

function auditTelegramChatLastMessageStorage(storageReview) {
  const chatsTable = storageReview.tables.find((table) => table.name === 'telegram_chats');
  const columns = chatsTable?.columns ?? [];
  const lastMessage = columns.find((column) => column.name === 'last_message');
  const lastMessageId = columns.find((column) => column.name === 'last_message_id');

  if (lastMessage !== undefined) {
    failures.push('telegram_chats must not store last_message JSON; store last_message_id instead');
  }
  if (lastMessageId === undefined) {
    failures.push('telegram_chats must store last_message_id');
    return;
  }
  if (lastMessageId.pgType !== 'bigint') {
    failures.push('telegram_chats.last_message_id must be bigint');
  }
}

function auditTdlibStorageReviewPolicy(storageReview) {
  const allowedColumnTypes = new Set([
    'bigint',
    'boolean',
    'bytea',
    'double precision',
    'integer',
    'jsonb',
    'text',
    'timestamp with time zone'
  ]);
  const allowedColumnRoles = new Set(['primary-key', 'foreign-key', 'data']);

  for (const table of storageReview.tables ?? []) {
    const primaryKeyColumns = [];
    for (const column of table.columns ?? []) {
      const columnName = String(column.name ?? '');
      if (columnName === 'raw' || columnName.startsWith('raw_') || columnName.endsWith('_raw')) {
        failures.push(
          `TDLib storage review must not expose raw storage columns: ${table.name}.${columnName}`
        );
      }
      if (!allowedColumnTypes.has(String(column.pgType ?? ''))) {
        failures.push(
          `TDLib storage review column has unsupported pgType: ${table.name}.${columnName}`
        );
      }
      const role = String(column.role ?? '');
      if (!allowedColumnRoles.has(role)) {
        failures.push(
          `TDLib storage review column has unsupported role: ${table.name}.${columnName}`
        );
      }
      if (role === 'primary-key') {
        primaryKeyColumns.push(columnName);
      }
      if (!Array.isArray(column.sourceFields)) {
        failures.push(
          `TDLib storage review column must declare sourceFields: ${table.name}.${columnName}`
        );
      }
    }
    if (primaryKeyColumns.length === 0) {
      failures.push(`TDLib storage review table must declare a primary key: ${table.name}`);
    }
  }
}

function auditTdlibStorageReviewParserContract(storageReviewPath) {
  const tsxBinary = join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx'
  );
  if (!existsSync(tsxBinary)) {
    failures.push('source-audit requires node_modules/.bin/tsx for TDLib storage parser checks');
    return;
  }

  const code = [
    '(async () => {',
    "  const { readStorageReviewState } = await import('./packages/tdlib-docs/src/server/storageReview.ts');",
    `  await readStorageReviewState(${JSON.stringify(storageReviewPath)});`,
    '})().catch((error) => {',
    '  console.error(error instanceof Error ? error.stack : error);',
    '  process.exit(1);',
    '});'
  ].join('\n');

  try {
    execFileSync(tsxBinary, ['-e', code], {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe'
    });
  } catch (error) {
    failures.push(`TDLib storage review must pass the dev-server parser: ${execErrorText(error)}`);
  }
}

function execErrorText(error) {
  const parts = [];
  if (typeof error === 'object' && error !== null) {
    const stderr = 'stderr' in error ? error.stderr : undefined;
    const stdout = 'stdout' in error ? error.stdout : undefined;
    if (typeof stderr === 'string' && stderr.trim().length > 0) {
      parts.push(stderr.trim());
    }
    if (typeof stdout === 'string' && stdout.trim().length > 0) {
      parts.push(stdout.trim());
    }
  }
  if (error instanceof Error) {
    parts.push(error.message);
  }

  return parts.join('\n');
}

function auditScopedVueComponentStyles(vueFiles, sourceFiles) {
  const auditedPrefixes = [
    'packages/control-plane/src/',
    'packages/control-plane-sdk/src/',
    'packages/history-sync/src/control-plane/',
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
    rel === '.claude' ||
    rel === 'dist' ||
    rel === 'dist-control-plane' ||
    rel === 'dist-server' ||
    rel === 'output' ||
    rel === 'td-data' ||
    rel.endsWith('/node_modules') ||
    rel.endsWith('/.claude') ||
    rel.endsWith('/dist') ||
    rel.endsWith('/dist-control-plane') ||
    rel.endsWith('/dist-server') ||
    rel.endsWith('/output') ||
    rel.endsWith('/td-data') ||
    rel === '.git' ||
    rel.endsWith('/.git')
  );
}

function ignored(file) {
  const rel = toRel(file);
  return (
    rel.includes('/node_modules/') ||
    rel.includes('/.claude/') ||
    rel.includes('/dist/') ||
    rel.includes('/dist-control-plane/') ||
    rel.includes('/dist-server/') ||
    rel.includes('/output/') ||
    rel.includes('/td-data/') ||
    rel.startsWith('node_modules/') ||
    rel.startsWith('.claude/') ||
    rel.startsWith('dist/') ||
    rel.startsWith('dist-control-plane/') ||
    rel.startsWith('dist-server/') ||
    rel.startsWith('output/') ||
    rel.startsWith('td-data/')
  );
}

function packageOwner(rel) {
  const match = /^packages\/([^/]+)\//.exec(rel);
  return match?.[1];
}

function toRel(file) {
  return relative(root, file).replaceAll('\\', '/');
}
