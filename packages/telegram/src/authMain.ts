import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';

import type { LoginDetails } from 'tdl';

import { loadTelegramIngestionConfig } from './config.js';
import { configureTdlib, createTelegramClient, hasTelegramCredentials } from './tdlib.js';

const config = loadTelegramIngestionConfig();

try {
  if (!hasTelegramCredentials(config.telegram)) {
    throw new Error('TELEGRAM_API_ID and TELEGRAM_API_HASH are required for TDLib authorization');
  }

  const tdlibStatus = configureTdlib();
  console.log(
    JSON.stringify({
      event: 'telegram.tdlib_auth.started',
      tdlib: {
        tdjsonPath: tdlibStatus.tdjsonPath
      }
    })
  );

  const client = await createTelegramClient(config.telegram);
  client.on('update', (update: unknown) => {
    if (!isAuthorizationUpdate(update)) {
      return;
    }

    console.log(
      JSON.stringify({
        event: 'telegram.authorization_state',
        state: update.authorization_state._
      })
    );
  });

  try {
    await client.login(createLoginDetails());
    console.log(JSON.stringify({ event: 'telegram.tdlib_auth.completed' }));
  } finally {
    await client.close();
  }
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'telegram.tdlib_auth.failed',
      error: error instanceof Error ? error.message : String(error)
    })
  );
  process.exitCode = 1;
}

function createLoginDetails(): LoginDetails {
  return {
    confirmOnAnotherDevice(link) {
      console.log(`Confirm login in Telegram: ${link}`);
    },
    async getAuthCode(retry) {
      return promptHidden(retry ? 'Telegram code again: ' : 'Telegram code: ');
    },
    async getEmailAddress() {
      return promptVisible('Email address: ');
    },
    async getEmailCode() {
      return promptHidden('Email code: ');
    },
    async getName() {
      const firstName = await promptVisible('First name: ');
      const lastName = await promptVisible('Last name (optional): ');

      return lastName.length === 0 ? { firstName } : { firstName, lastName };
    },
    async getPassword(passwordHint, retry) {
      const hint = passwordHint.length === 0 ? '' : ` (${passwordHint})`;
      return promptHidden(retry ? `2FA password again${hint}: ` : `2FA password${hint}: `);
    },
    async getPhoneNumber(retry) {
      return promptVisible(retry ? 'Phone number again: ' : 'Phone number: ');
    },
    type: 'user'
  };
}

async function promptVisible(prompt: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  try {
    return (await readline.question(prompt)).trim();
  } finally {
    readline.close();
  }
}

async function promptHidden(prompt: string): Promise<string> {
  process.stdout.write(prompt);

  const mutedOutput = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    }
  });
  const readline = createInterface({
    input: process.stdin,
    output: mutedOutput,
    terminal: true
  });

  try {
    return (await readline.question('')).trim();
  } finally {
    readline.close();
    process.stdout.write('\n');
  }
}

function isAuthorizationUpdate(update: unknown): update is {
  _: 'updateAuthorizationState';
  authorization_state: { _: string };
} {
  if (typeof update !== 'object' || update === null || Array.isArray(update)) {
    return false;
  }

  const record = update as Record<string, unknown>;
  const authorizationState = record.authorization_state;
  if (
    record._ !== 'updateAuthorizationState' ||
    typeof authorizationState !== 'object' ||
    authorizationState === null ||
    Array.isArray(authorizationState)
  ) {
    return false;
  }

  return typeof (authorizationState as Record<string, unknown>)._ === 'string';
}
