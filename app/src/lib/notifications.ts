import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { CourseStats, TimetableSlot, Activity } from './api';

export const NOTIFICATION_CHANNEL_ID = 'kontrol-alerts';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

/**
 * Initializes the high-importance notification channel on Android.
 */
export async function initNotificationChannel(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') return false;
    }

    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'Kontrol Alerts',
      description: 'High-priority notifications for lectures and deadlines',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#6366F1',
    });
    return true;
  } catch (err) {
    console.warn('[Notifications] Failed to init notification channel:', err);
    return false;
  }
}

/**
 * Returns whether notifications are enabled in settings.
 */
export function areNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('kontrol_notifications_enabled') !== 'false';
}

/**
 * Sets notification enabled state and re-syncs or clears schedule.
 */
export async function setNotificationsEnabled(
  enabled: boolean,
  data?: { courses?: CourseStats[]; slots?: TimetableSlot[]; activities?: Activity[] }
): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem('kontrol_notifications_enabled', enabled ? 'true' : 'false');
  if (!enabled) {
    await clearAllNotifications();
  } else if (data) {
    await syncAllNotifications(data.courses ?? [], data.slots ?? [], data.activities ?? []);
  }
}

/**
 * Cancels all currently pending notifications.
 */
export async function clearAllNotifications(): Promise<void> {
  if (!isNative) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (err) {
    console.warn('[Notifications] Failed to cancel notifications:', err);
  }
}

/**
 * Sends an immediate test heads-up pop-up notification.
 */
export async function sendTestNotification(): Promise<boolean> {
  if (!isNative) {
    alert('Test notifications are supported on Android native devices.');
    return false;
  }
  const channelReady = await initNotificationChannel();
  if (!channelReady) return false;

  try {
    const id = Math.floor(Math.random() * 899999) + 100000;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: '🔔 Kontrol Alert Active',
          body: 'Heads-up lecture and deadline pop-ups are fully operational.',
          channelId: NOTIFICATION_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true },
          sound: 'default',
        },
      ],
    });
    return true;
  } catch (err) {
    console.error('[Notifications] Failed to send test notification:', err);
    return false;
  }
}

/**
 * Synchronizes weekly timetable reminders and vault activity deadlines.
 */
export async function syncAllNotifications(
  courses: CourseStats[],
  slots: TimetableSlot[],
  activities: Activity[]
): Promise<void> {
  if (!isNative || !areNotificationsEnabled()) return;

  const channelReady = await initNotificationChannel();
  if (!channelReady) return;

  try {
    // Clear previously scheduled notifications to prevent duplicates
    await clearAllNotifications();

    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId: string;
      schedule: {
        at?: Date;
        on?: { weekday?: number; hour?: number; minute?: number };
        repeats?: boolean;
        allowWhileIdle?: boolean;
      };
      sound?: string;
    }> = [];

    const coursesMap = new Map<string, CourseStats>();
    for (const c of courses) {
      coursesMap.set(c.id, c);
    }

    // 1. Weekly lecture notifications (15 minutes prior)
    let notifIdCounter = 1000;
    for (const slot of slots) {
      if (slot.isCancelled) continue;
      const course = coursesMap.get(slot.courseId);
      if (!course) continue;

      const [h, m] = slot.startTime.split(':').map(Number);
      if (Number.isNaN(h) || Number.isNaN(m)) continue;

      let totalMinutes = h * 60 + m - 15;
      let weekdayOffset = 0;
      if (totalMinutes < 0) {
        totalMinutes += 24 * 60;
        weekdayOffset = -1;
      }

      const schedHour = Math.floor(totalMinutes / 60);
      const schedMinute = totalMinutes % 60;

      // Map Kontrol dayOfWeek (1=Mon..7=Sun) to Capacitor weekday (1=Sun, 2=Mon..7=Sat)
      let targetDow = slot.dayOfWeek + weekdayOffset;
      if (targetDow < 1) targetDow = 7;
      if (targetDow > 7) targetDow = 1;
      const capacitorWeekday = (targetDow % 7) + 1;

      const skips = Math.max(0, course.remainingSkips);
      const skipWarning =
        skips === 0
          ? '⚠️ 0 safe skips left (Attendance at Risk!)'
          : `${skips} safe ${skips === 1 ? 'skip' : 'skips'} remaining`;

      notifications.push({
        id: notifIdCounter++,
        title: `📚 ${course.code} in 15m`,
        body: `${course.name} at ${slot.startTime}${slot.venue ? ` • ${slot.venue}` : ''} (${skipWarning})`,
        channelId: NOTIFICATION_CHANNEL_ID,
        schedule: {
          on: {
            weekday: capacitorWeekday,
            hour: schedHour,
            minute: schedMinute,
          },
          repeats: true,
          allowWhileIdle: true,
        },
        sound: 'default',
      });
    }

    // 2. Build Vault Activity Deadline Notifications (24h and 1h before)
    const nowMs = Date.now();
    for (const act of activities) {
      if (!act.dueDate) continue;

      // Parse activity due datetime
      const timeStr = act.dueTime && /^\d{2}:\d{2}$/.test(act.dueTime) ? act.dueTime : '23:59';
      const dueTimestamp = new Date(`${act.dueDate}T${timeStr}:00`).getTime();
      if (Number.isNaN(dueTimestamp) || dueTimestamp <= nowMs) continue;

      // 24 hours before
      const tMinus24h = dueTimestamp - 24 * 60 * 60 * 1000;
      if (tMinus24h > nowMs) {
        notifications.push({
          id: notifIdCounter++,
          title: `⏳ Build Vault: Due in 24 Hours`,
          body: `${act.title}${act.priority ? ` [${act.priority}]` : ''} is due tomorrow at ${timeStr}.`,
          channelId: NOTIFICATION_CHANNEL_ID,
          schedule: {
            at: new Date(tMinus24h),
            allowWhileIdle: true,
          },
          sound: 'default',
        });
      }

      // 1 hour before
      const tMinus1h = dueTimestamp - 60 * 60 * 1000;
      if (tMinus1h > nowMs) {
        notifications.push({
          id: notifIdCounter++,
          title: `🚨 Build Vault: Due in 1 Hour!`,
          body: `Final deadline for "${act.title}" at ${timeStr}.`,
          channelId: NOTIFICATION_CHANNEL_ID,
          schedule: {
            at: new Date(tMinus1h),
            allowWhileIdle: true,
          },
          sound: 'default',
        });
      }
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (err) {
    console.warn('[Notifications] Failed to schedule notifications:', err);
  }
}
