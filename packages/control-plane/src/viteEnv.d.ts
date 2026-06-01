/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue" />

declare module 'virtual:control-plane/providers' {
  import type { ContentProvider } from '@agentg/framework/cp';

  export const providers: readonly ContentProvider[];
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}
