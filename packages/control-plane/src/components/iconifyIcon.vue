<script setup lang="ts">
import solarIcons from '@iconify-json/solar/icons.json' with { type: 'json' };
import type { IconifyJSON } from '@iconify-json/solar';
import { getIconData, iconToSVG, stringToIcon } from '@iconify/utils';
import { computed } from 'vue';

type SvgView = {
  attributes: Record<string, string>;
  body: string;
};

const DEFAULT_ICON_NAME = 'solar:widget-2-bold';
const iconSets: Record<string, IconifyJSON> = {
  solar: solarIcons
};

const props = defineProps<{
  icon: string;
}>();

const svg = computed(() => iconSvg(props.icon) ?? iconSvg(DEFAULT_ICON_NAME));

function iconSvg(iconName: string): SvgView | null {
  const parsed = stringToIcon(iconName, true);
  if (parsed === null || parsed.provider.length > 0) {
    return null;
  }

  const iconSet = iconSets[parsed.prefix];
  if (iconSet === undefined) {
    return null;
  }

  const icon = getIconData(iconSet, parsed.name);
  if (icon === null) {
    return null;
  }

  const rendered = iconToSVG(icon, {
    height: '1em',
    width: '1em'
  });
  return {
    attributes: rendered.attributes,
    body: rendered.body
  };
}
</script>

<template>
  <svg
    v-if="svg !== null"
    aria-hidden="true"
    class="iconify-icon"
    focusable="false"
    v-bind="svg.attributes"
    v-html="svg.body"
  />
</template>

<style scoped>
@reference "tailwindcss";
.iconify-icon {
  @apply h-3.5 w-3.5 shrink-0;
}
</style>
