import type messages from "./messages/en.json";

declare global {
  type IntlMessages = typeof messages;

  // The gtag init script in `app/layout.tsx` defines this global on the client
  // when a GA measurement id is configured. Optional because it is absent during
  // SSR, when no GA id is set, or when GA is blocked.
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
