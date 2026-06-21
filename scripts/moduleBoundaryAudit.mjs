/* global console, process */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const packageDirs = [
  'packages/framework',
  'packages/gateway',
  'packages/telemetry',
  'packages/dashboard',
  'packages/data',
  'packages/pipelines',
  'packages/llm-runner',
  'packages/triggers',
  'packages/telegram'
];
const failures = [];

for (const packageDir of packageDirs) {
  auditPackage(packageDir);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log('module-boundary-audit: ok');
}

function auditPackage(packageDir) {
  const packageFile = join(root, packageDir, 'package.json');
  if (!existsSync(packageFile)) {
    failures.push(`module boundary package is missing package.json: ${packageDir}`);
  }
}
