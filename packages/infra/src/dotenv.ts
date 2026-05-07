import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

export function loadNearestDotenv(startDirectory = process.cwd()): string | undefined {
  let directory = resolve(startDirectory);

  for (;;) {
    const candidate = resolve(directory, '.env');
    if (existsSync(candidate)) {
      loadDotenv({ path: candidate, quiet: true });
      return directory;
    }

    const parent = dirname(directory);
    if (parent === directory) {
      loadDotenv({ quiet: true });
      return undefined;
    }

    directory = parent;
  }
}
