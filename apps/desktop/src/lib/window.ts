import { isTauri } from './ipc';

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

/** Native window controls. No-ops outside Tauri so the UI still runs in a browser. */
export const appWindow = {
  minimize: async () => {
    if (isTauri()) (await currentWindow()).minimize();
  },
  toggleMaximize: async () => {
    if (isTauri()) (await currentWindow()).toggleMaximize();
  },
  close: async () => {
    if (isTauri()) (await currentWindow()).close();
  },
};
