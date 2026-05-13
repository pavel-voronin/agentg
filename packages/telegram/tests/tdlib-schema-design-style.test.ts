import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const schemaDesignComponentDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  '../src/tdlib-docs/components/schema-design'
);

describe('TDLib schema design component styles', () => {
  it('keeps native controls reset through scoped Tailwind classes', () => {
    const violations: string[] = [];

    for (const fileName of vueFiles()) {
      const source = readFileSync(join(schemaDesignComponentDirectory, fileName), 'utf8');
      const styleBlock = source.match(/<style scoped>[\s\S]*?<\/style>/)?.[0] ?? '';

      for (const match of source.matchAll(/<(button|input|select|textarea)\b[\s\S]*?>/g)) {
        const tag = match[1];
        const control = match[0];
        const className = singleStaticClass(control);

        if (className === null) {
          violations.push(`${fileName}: <${tag}> must use exactly one semantic class`);
          continue;
        }

        const style = classStyle(styleBlock, className);
        if (style === null) {
          violations.push(`${fileName}: .${className} must be styled in scoped CSS`);
          continue;
        }

        for (const utility of ['appearance-none', 'outline-none', 'bg-', 'border']) {
          if (!style.includes(utility)) {
            violations.push(`${fileName}: .${className} must @apply ${utility}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('keeps schema-design component styles scoped', () => {
    const violations: string[] = [];

    for (const fileName of vueFiles()) {
      const source = readFileSync(join(schemaDesignComponentDirectory, fileName), 'utf8');
      for (const match of source.matchAll(/<style\b[^>]*>/g)) {
        if (match[0] !== '<style scoped>') {
          violations.push(`${fileName}: ${match[0]} must be <style scoped>`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});

function vueFiles(): string[] {
  return readdirSync(schemaDesignComponentDirectory)
    .filter((fileName) => fileName.endsWith('.vue'))
    .sort();
}

function singleStaticClass(control: string): string | null {
  const classValue = control.match(/\bclass="([^"]+)"/)?.[1] ?? null;
  if (classValue === null) {
    return null;
  }

  const classes = classValue.trim().split(/\s+/);
  return classes.length === 1 ? (classes[0] ?? null) : null;
}

function classStyle(styleBlock: string, className: string): string | null {
  const escapedClassName = className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return (
    styleBlock.match(new RegExp(`\\.${escapedClassName}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? null
  );
}
