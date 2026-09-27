import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let enabled = true;
const native = Capacitor.isNativePlatform();

export function setHaptics(on: boolean) { enabled = on; }

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success') {
  if (!enabled) return;
  if (native) {
    if (kind === 'success') Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy }).catch(() => {});
    return;
  }
  const ms = { light: 8, medium: 16, heavy: 30, success: 24 }[kind];
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}
