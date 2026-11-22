import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

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
 * ImpactStyle.Light — for tab switches, sheet toggles, carousel snap changes
 */
export async function hapticTap(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  } catch {
    // Ignore devices that do not support haptics
  }
}

/**
 * ImpactStyle.Medium — for logging Attend, Skip, Ghost actions
 */
export async function hapticAction(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(20);
    }
  } catch {
    // Ignore
  }
}

/**
 * NotificationType.Success — for AppLock unlock, PIN verification, completed activities
 */
export async function hapticSuccess(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([15, 40, 15]);
    }
  } catch {
    // Ignore
  }
}

/**
 * NotificationType.Warning — for logging skip when remainingSkips <= 1, or failed PIN/TOTP
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
