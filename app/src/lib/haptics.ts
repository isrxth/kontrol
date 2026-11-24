import { Capacitor } from '@capacitor/core';
import { Haptics, NotificationType } from '@capacitor/haptics';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

export function isHapticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('kontrol_haptics') !== 'false';
}

export function setHapticsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('kontrol_haptics', enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('kontrol:haptics-changed', { detail: { enabled } }));
}

/**
 * Crisp micro-pulse (8ms) — for tab switches, sheet toggles, carousel snap changes.
 * Replaces heavy ImpactStyle.Light (50ms+) on Android.
 */
export async function hapticTap(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.vibrate({ duration: 8 });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
  } catch {
    // Ignore devices that do not support haptics
  }
}

/**
 * Crisp micro-pulse (14ms) — for logging Attend, Skip, Ghost actions.
 * Replaces heavy ImpactStyle.Medium (50ms+) on Android.
 */
export async function hapticAction(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.vibrate({ duration: 14 });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(14);
    }
  } catch {
    // Ignore
  }
}

/**
 * Crisp single 16ms pulse — for AppLock unlock, PIN verification, completed activities.
 * Replaced heavy double-buzz NotificationType.Success.
 */
export async function hapticSuccess(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.vibrate({ duration: 16 });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(16);
    }
  } catch {
    // Ignore
  }
}

/**
 * NotificationType.Warning — for logging skip when remainingSkips <= 1, or failed PIN/TOTP.
 */
export async function hapticWarning(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([30, 50, 30]);
    }
  } catch {
    // Ignore
  }
}
