import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

export type SchemaDesignScrollIndicatorStyle = {
  '--schema-design-scroll-thumb-height': string;
  '--schema-design-scroll-thumb-offset': string;
  '--schema-design-scroll-track-height': string;
  '--schema-design-scroll-track-top': string;
};

const minimumThumbHeight = 32;

export function useSchemaDesignScrollIndicator(
  shellElement: Ref<HTMLElement | null>,
  contentSelector: string,
  headerSelector: string
) {
  const scrollIndicatorScrollable = ref(false);
  const scrollIndicatorStyle = ref<SchemaDesignScrollIndicatorStyle>({
    '--schema-design-scroll-thumb-height': `${String(minimumThumbHeight)}px`,
    '--schema-design-scroll-thumb-offset': '0px',
    '--schema-design-scroll-track-height': '0px',
    '--schema-design-scroll-track-top': '0px'
  });
  let observer: ResizeObserver | null = null;

  onMounted(async () => {
    await nextTick();
    updateScrollIndicator();
    const shell = shellElement.value;
    if (shell === null || typeof ResizeObserver === 'undefined') {
      return;
    }

    observer = new ResizeObserver(() => {
      updateScrollIndicator();
    });
    observer.observe(shell);

    const content = shell.querySelector<HTMLElement>(contentSelector);
    if (content !== null) {
      observer.observe(content);
    }

    const header = shell.querySelector<HTMLElement>(headerSelector);
    if (header !== null) {
      observer.observe(header);
    }
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  function updateScrollIndicator(element = shellElement.value): void {
    if (element === null || element.clientHeight <= 0 || element.scrollHeight <= 0) {
      scrollIndicatorScrollable.value = false;
      return;
    }

    const headerHeight = element.querySelector<HTMLElement>(headerSelector)?.offsetHeight ?? 0;
    const trackHeight = Math.max(0, element.clientHeight - headerHeight);
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    if (maxScrollTop <= 0) {
      scrollIndicatorScrollable.value = false;
      scrollIndicatorStyle.value = {
        '--schema-design-scroll-thumb-height': `${String(trackHeight)}px`,
        '--schema-design-scroll-thumb-offset': '0px',
        '--schema-design-scroll-track-height': `${String(trackHeight)}px`,
        '--schema-design-scroll-track-top': `${String(headerHeight)}px`
      };
      return;
    }

    const thumbHeight = Math.max(
      minimumThumbHeight,
      Math.round((element.clientHeight / element.scrollHeight) * trackHeight)
    );
    const maxThumbOffset = trackHeight - thumbHeight;
    const thumbOffset = Math.round((element.scrollTop / maxScrollTop) * maxThumbOffset);

    scrollIndicatorScrollable.value = true;
    scrollIndicatorStyle.value = {
      '--schema-design-scroll-thumb-height': `${String(thumbHeight)}px`,
      '--schema-design-scroll-thumb-offset': `${String(thumbOffset)}px`,
      '--schema-design-scroll-track-height': `${String(trackHeight)}px`,
      '--schema-design-scroll-track-top': `${String(headerHeight)}px`
    };
  }

  return {
    scrollIndicatorScrollable,
    scrollIndicatorStyle,
    updateScrollIndicator
  };
}
