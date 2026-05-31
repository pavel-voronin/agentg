/* global console, process */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const packageDirs = [
  'packages/framework',
  'packages/registry',
  'packages/gateway',
  'packages/control-plane',
  'packages/telegram',
  'packages/history-sync'
];
const forbiddenPackages = ['@agentg/events', '@agentg/service-directory', '@agentg/database'];
const sourceExtensions = new Set(['.js', '.mjs', '.ts', '.vue']);
const failures = [];

for (const packageDir of packageDirs) {
  auditPackageDependencies(packageDir);
  auditSourceImports(packageDir);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exitCode = 1;
} else {
  console.log('module-boundary-audit: ok');
}

function auditPackageDependencies(packageDir) {
  const packageFile = join(root, packageDir, 'package.json');
  if (!existsSync(packageFile)) {
    failures.push(`module boundary package is missing package.json: ${packageDir}`);
    return;
  }

  const manifest = JSON.parse(readFileSync(packageFile, 'utf8'));
  const dependencySections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies'
  ];
  for (const section of dependencySections) {
    const dependencies = manifest[section];
    if (!isRecord(dependencies)) {
      continue;
    }
    for (const dependencyName of Object.keys(dependencies)) {
      if (forbiddenPackages.includes(dependencyName)) {
        failures.push(
          `module boundary package must not depend on deleted old-contour package: ${packageDir}/package.json ${section}.${dependencyName}`
        );
      }
    }
  }
}

function auditSourceImports(packageDir) {
  for (const file of listFiles(join(root, packageDir))) {
    if (!sourceExtensions.has(fileExtension(file))) {
      continue;
    }
    const source = readFileSync(file, 'utf8');
    for (const specifier of importSpecifiers(source)) {
      const forbiddenPackage = forbiddenPackages.find((candidate) =>
        isPackageSpecifier(specifier, candidate)
      );
      if (forbiddenPackage !== undefined) {
        failures.push(
          `module boundary source must not import deleted old-contour package: ${toRel(file)} -> ${forbiddenPackage}`
        );
      }
    }
  }
}

function importSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier !== undefined) {
        specifiers.push(specifier);
      }
    }
  }

  return specifiers;
}

function isPackageSpecifier(specifier, packageName) {
  return specifier === packageName || specifier.startsWith(`${packageName}/`);
}

function listFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        return [];
      }
      return listFiles(path);
    }
    return entry.isFile() ? [path] : [];
  });
}

function fileExtension(file) {
  const name = file.split('/').at(-1) ?? '';
  const extensionStart = name.lastIndexOf('.');
  return extensionStart === -1 ? '' : name.slice(extensionStart);
}

function toRel(file) {
  return relative(root, file).split('\\').join('/');
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
