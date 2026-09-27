import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// On iOS the WKWebView's localStorage can be purged under storage pressure,
// so on native we mirror saves into Capacitor Preferences (UserDefaults /
// SharedPreferences), which is durable.
const native = Capacitor.isNativePlatform();

export async function loadString(key: string): Promise<string | null> {
  if (native) {
    try {
      const { value } = await Preferences.get({ key });
      if (value) return value;
    } catch { /* fall through */ }
  }
  try { return localStorage.getItem(key); } catch { return null; }
}

export function saveString(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota / private mode */ }
  if (native) Preferences.set({ key, value }).catch(() => {});
}

export function removeKey(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
  if (native) Preferences.remove({ key }).catch(() => {});
}
