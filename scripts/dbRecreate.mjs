#!/usr/bin/env node
/* global console, process */

import 'dotenv/config';

import { spawn } from 'node:child_process';

import { Client } from 'pg';

const DEFAULT_DATABASE_URL = 'postgres://agentg:agentg@localhost:5432/agentg';
const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
const targetUrl = new URL(databaseUrl);

if (targetUrl.protocol !== 'postgres:' && targetUrl.protocol !== 'postgresql:') {
  throw new Error(`Unsupported DATABASE_URL protocol: ${targetUrl.protocol}`);
}

const targetDatabase = decodeURIComponent(targetUrl.pathname.replace(/^\//, ''));
if (targetDatabase.length === 0) {
  throw new Error('DATABASE_URL must include a database name');
}
if (['postgres', 'template0', 'template1'].includes(targetDatabase)) {
  throw new Error(`Refusing to recreate reserved Postgres database: ${targetDatabase}`);
}

const maintenanceUrl = new URL(targetUrl.href);
maintenanceUrl.pathname = '/postgres';
maintenanceUrl.search = '';

const client = new Client({
  connectionString: maintenanceUrl.toString()
});

try {
  await client.connect();
  console.log(
    JSON.stringify({
      database: targetDatabase,
      event: 'database.recreate.drop_started'
    })
  );
  await client.query(`DROP DATABASE IF EXISTS ${quoteIdent(targetDatabase)} WITH (FORCE)`);
  await client.query(createDatabaseSql(targetDatabase, decodeURIComponent(targetUrl.username)));
  await createDatabaseExtensions(targetUrl);
  console.log(
    JSON.stringify({
      database: targetDatabase,
      event: 'database.recreate.created'
    })
  );
} finally {
  await client.end();
}

await runChecked('npm', ['run', 'db:migrate']);
console.log(
  JSON.stringify({
    database: targetDatabase,
    event: 'database.recreate.migrated'
  })
);

function createDatabaseSql(database, owner) {
  const ownerSql = owner.length === 0 ? '' : ` OWNER ${quoteIdent(owner)}`;
  return `CREATE DATABASE ${quoteIdent(database)}${ownerSql}`;
}

function quoteIdent(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

async function createDatabaseExtensions(url) {
  const targetClient = new Client({
    connectionString: url.toString()
  });

  try {
    await targetClient.connect();
    await targetClient.query('CREATE EXTENSION IF NOT EXISTS pg_stat_statements');
  } finally {
    await targetClient.end();
  }
}

function runChecked(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit'
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Command failed: ${[command, ...args].join(' ')}${signal === null ? '' : ` (${signal})`}`
        )
      );
    });
  });
}
