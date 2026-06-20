import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createDatabase } from './database/client.js';
import { createPostgresStore } from './store.js';

const databaseUrl = process.env.DATA_STORE_DATABASE_URL;
const testWithDatabase = databaseUrl === undefined ? it.skip : it;

describe('postgres data store', () => {
  testWithDatabase('merges concurrent annotation writes without dropping fields', async () => {
    const database = createDatabase(databaseUrl ?? '');
    const stop = await database.start();
    try {
      const store = createPostgresStore(database.db);
      const subject = {
        _model: 'test.subject',
        id: `subject_${randomUUID()}`
      };

      await store.writeAnnotation(
        {
          key: 'summary',
          mode: 'replace',
          subject,
          value: { base: true }
        },
        new Date('2026-01-01T00:00:00.000Z')
      );
      await Promise.all([
        store.writeAnnotation(
          {
            key: 'summary',
            mode: 'merge',
            subject,
            value: { first: true }
          },
          new Date('2026-01-01T00:00:01.000Z')
        ),
        store.writeAnnotation(
          {
            key: 'summary',
            mode: 'merge',
            subject,
            value: { second: true }
          },
          new Date('2026-01-01T00:00:02.000Z')
        )
      ]);

      await expect(store.getAnnotation({ key: 'summary', subject })).resolves.toMatchObject({
        value: {
          base: true,
          first: true,
          second: true
        }
      });
    } finally {
      await stop();
    }
  });
});
