import { LINKS_METHOD, type LinkSet } from '../contracts.js';

type Resources = {
  grafanaUrl: string;
  jaegerUiUrl: string;
  victoriaMetricsUrl: string;
};

export function procedures(
  resources: Resources
): Record<string, (input: unknown) => Promise<unknown>> {
  const linkSet = buildLinks(
    resources.victoriaMetricsUrl,
    resources.jaegerUiUrl,
    resources.grafanaUrl
  );

  function readLinks(): Promise<LinkSet> {
    return Promise.resolve(copyLinks(linkSet));
  }

  return {
    [LINKS_METHOD]: readLinks
  };
}

function buildLinks(metricsUrl: string, jaegerUiUrl: string, grafanaUrl: string): LinkSet {
  return {
    grafanaUi: new URL('/', grafanaUrl).href,
    jaegerUi: new URL('/', jaegerUiUrl).href,
    metricsUi: new URL('/vmui', metricsUrl).href
  };
}

function copyLinks(links: LinkSet): LinkSet {
  return { ...links };
}
