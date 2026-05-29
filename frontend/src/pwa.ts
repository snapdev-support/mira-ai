import { registerSW } from "virtual:pwa-register";

// Minimal, no-UI registration.
// The browser will prompt for install when criteria are met.
registerSW({
  immediate: true,
});
