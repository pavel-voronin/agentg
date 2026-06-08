type GrafanaDashboardVariableScalar = boolean | number | string;

export type GrafanaDashboardVariableValue =
  | GrafanaDashboardVariableScalar
  | readonly GrafanaDashboardVariableScalar[]
  | null
  | undefined;

export type GrafanaDashboardVariables = Record<string, GrafanaDashboardVariableValue>;

export type GrafanaDashboardSourceInput = {
  baseUrl?: string | undefined;
  dashboardSlug?: string | undefined;
  dashboardUid?: string | undefined;
  from?: string | undefined;
  kiosk?: boolean | 'tv' | undefined;
  orgId?: number | string | undefined;
  refresh?: string | undefined;
  theme?: 'dark' | 'light' | undefined;
  to?: string | undefined;
  url?: string | undefined;
  variables?: GrafanaDashboardVariables | undefined;
};

export function grafanaDashboardSource(input: GrafanaDashboardSourceInput): string | null {
  const url = baseDashboardUrl(input);
  if (url === null) {
    return null;
  }

  applyDefaultParameter(url, 'orgId', input.orgId);
  applyDefaultParameter(url, 'from', input.from);
  applyDefaultParameter(url, 'to', input.to);
  applyDefaultParameter(url, 'refresh', input.refresh);
  applyDefaultParameter(url, 'theme', input.theme);
  applyKioskParameter(url, input.kiosk);
  applyVariables(url, input.variables);

  return url.href;
}

function baseDashboardUrl(input: GrafanaDashboardSourceInput): URL | null {
  const source = nonEmptyString(input.url);
  if (source !== null) {
    return parseUrl(source, input.baseUrl);
  }

  const uid = nonEmptyString(input.dashboardUid);
  const base = nonEmptyString(input.baseUrl);
  if (uid === null || base === null) {
    return null;
  }

  const dashboardBase = normalizedBaseUrl(base);
  if (dashboardBase === null) {
    return null;
  }

  const slug = nonEmptyString(input.dashboardSlug) ?? uid;
  return new URL(`d/${encodePathSegment(uid)}/${encodePathSegment(slug)}`, dashboardBase);
}

function parseUrl(value: string, baseUrl: string | undefined): URL | null {
  try {
    return new URL(value);
  } catch {
    const base = nonEmptyString(baseUrl);
    if (base === null) {
      return null;
    }
    const dashboardBase = normalizedBaseUrl(base);
    if (dashboardBase === null) {
      return null;
    }
    try {
      return new URL(value, dashboardBase);
    } catch {
      return null;
    }
  }
}

function normalizedBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    return url;
  } catch {
    return null;
  }
}

function applyDefaultParameter(
  url: URL,
  name: string,
  value: boolean | number | string | null | undefined
): void {
  const parameter = parameterString(value);
  if (parameter !== null && !url.searchParams.has(name)) {
    url.searchParams.set(name, parameter);
  }
}

function applyKioskParameter(url: URL, value: boolean | 'tv' | undefined): void {
  if (value === false || value === undefined || url.searchParams.has('kiosk')) {
    return;
  }

  url.searchParams.set('kiosk', value === true ? '1' : value);
}

function applyVariables(url: URL, variables: GrafanaDashboardVariables | undefined): void {
  if (variables === undefined) {
    return;
  }

  for (const [name, value] of Object.entries(variables)) {
    const variable = nonEmptyString(name);
    if (variable === null) {
      continue;
    }
    const key = `var-${variable}`;
    url.searchParams.delete(key);
    for (const parameter of variableParameters(value)) {
      url.searchParams.append(key, parameter);
    }
  }
}

function variableParameters(value: GrafanaDashboardVariableValue): string[] {
  if (isVariableList(value)) {
    return value
      .map(parameterString)
      .filter((parameter): parameter is string => parameter !== null);
  }
  const parameter = parameterString(value);
  return parameter === null ? [] : [parameter];
}

function isVariableList(
  value: GrafanaDashboardVariableValue
): value is readonly GrafanaDashboardVariableScalar[] {
  return Array.isArray(value);
}

function parameterString(value: GrafanaDashboardVariableScalar | null | undefined): string | null {
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : null;
  }
  return nonEmptyString(value);
}

function nonEmptyString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}
