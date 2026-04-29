import { historyAppTemplate } from './history-app.js';
import { historyClientScript } from './history-client.js';

export const historyBrowserScript = `const HISTORY_APP_TEMPLATE = ${JSON.stringify(
  historyAppTemplate
)};
${historyClientScript}`;
