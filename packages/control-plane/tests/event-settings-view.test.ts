import { renderToString } from '@vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { describe, expect, it } from 'vitest';

import EventSettings from '../src/components/EventSettings.vue';

describe('event settings view', () => {
  it('renders positive event stream settings and close action', async () => {
    const html = await renderToString(
      createSSRApp({
        render() {
          return h(EventSettings, {
            eventLimit: 2501,
            eventYamlListLimit: 12,
            id: 'eventSettings'
          });
        }
      })
    );

    expect(html).toContain('Event limit');
    expect(html).toContain('YAML list limit');
    expect(html).toContain('value="2501"');
    expect(html).toContain('value="12"');
    expect(html).toContain('min="1"');
    expect(html).not.toContain('max=');
    expect(html).toContain('Close Settings');
  });
});
