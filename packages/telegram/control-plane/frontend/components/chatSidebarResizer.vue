<script setup lang="ts">
const props = defineProps<{
  maxWidth: number;
  minWidth: number;
  width: number;
}>();

const emit = defineEmits<{
  keyboardResize: [event: KeyboardEvent];
  resizeStart: [event: PointerEvent];
}>();

function resizeWithKeyboard(event: KeyboardEvent): void {
  emit('keyboardResize', event);
}

function startResize(event: PointerEvent): void {
  emit('resizeStart', event);
}
</script>

<template>
  <div
    class="chat-sidebar-resizer"
    role="separator"
    aria-label="Resize chat list"
    aria-orientation="vertical"
    :aria-valuemax="props.maxWidth"
    :aria-valuemin="props.minWidth"
    :aria-valuenow="props.width"
    tabindex="0"
    @keydown="resizeWithKeyboard"
    @pointerdown="startResize"
  >
    <span class="chat-sidebar-resizer__line"></span>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.chat-sidebar-resizer {
  @apply absolute bottom-0 top-0 left-[calc(var(--telegram-chat-sidebar-width)-2px)] z-10 flex w-[5px] cursor-col-resize justify-center bg-transparent focus:outline-none;
}

.chat-sidebar-resizer__line {
  @apply block h-full w-px bg-zinc-200;
}
</style>
