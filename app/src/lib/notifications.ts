import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { api, type CourseStats, type TimetableSlot, type Activity, type LogStatus } from './api';

export const NOTIFICATION_CHANNEL_ID = 'kontrol-alerts';
export const LECTURE_CHANNEL_ID = 'kontrol-lectures';
export const LECTURE_ACTION_TYPE_ID = 'LECTURE_ATTENDANCE';

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

let listenersAttached = false;

/**
 * Attaches notification action listeners so tapping action buttons (Attend, Skip, Ghost)
 * in foreground/background logs attendance immediately and informs the app.
 */
export function setupNotificationListeners(): void {
  if (!isNative || listenersAttached) return;
  listenersAttached = true;

  try {
    void LocalNotifications.addListener('localNotificationActionPerformed', async (action) => {
      try {
        const actionId = action.actionId;
        const courseId = action.notification.extra?.courseId as string | undefined;

        if (courseId && (actionId === 'ATTENDED' || actionId === 'SKIPPED' || actionId === 'GHOST')) {
          await api.logAttendance(courseId, actionId as LogStatus);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('kontrol:attendance-updated', {
                detail: { courseId, status: actionId },
              })
            );
          }
        }
      } catch (err) {
        console.error('[Notifications] Error logging attendance from action:', err);
      }
    });
  } catch (err) {
    console.warn('[Notifications] Failed to add notification action listener:', err);
  }
}

/**
 * Initializes the high-importance notification channels and action types on Android.
 */
export async function initNotificationChannel(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      const requested = await LocalNotifications.requestPermissions();
      if (requested.display !== 'granted') return false;
    }

    // Register interactive action types: Attend, Skip, Ghost
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: LECTURE_ACTION_TYPE_ID,
          actions: [
            {
              id: 'ATTENDED',
              title: '✓ Attend',
            },
            {
              id: 'SKIPPED',
              title: '✗ Skip',
              destructive: true,
            },
            {
              id: 'GHOST',
              title: '👻 Ghost',
            },
          ],
        },
      ],
    });

    // Channel 1: Interactive Lecture Pop-ups (Maximum importance for heads-up alerts)
    await LocalNotifications.createChannel({
      id: LECTURE_CHANNEL_ID,
      name: 'Lectures & Attendance',
      description: 'Heads-up interactive lecture pop-ups with quick action buttons',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#6366F1',
    });

    // Channel 2: Vault & Deadline Alerts
    await LocalNotifications.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'Kontrol Alerts',
      description: 'High-priority notifications for deadlines and vault tasks',
      importance: 5,
      visibility: 1,
      sound: 'default',
      vibration: true,
      lights: true,
      lightColor: '#6366F1',
    });

    setupNotificationListeners();
    return true;
  } catch (err) {
    console.warn('[Notifications] Failed to init notification channels:', err);
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
 * Sends an immediate test heads-up interactive lecture pop-up notification.
 */
export async function sendTestLectureNotification(courseId?: string, courseCode?: string): Promise<boolean> {
  if (!isNative) {
    alert('Test notifications are supported on Android native devices.');
    return false;
  }
  const channelReady = await initNotificationChannel();
  if (!channelReady) return false;

  try {
    const id = Math.floor(Math.random() * 899999) + 100000;
    const code = courseCode ?? 'TEST-101';
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `📚 ${code} in 15m (Test Pop-Up)`,
          body: 'Interactive lecture alert. Tap Attend, Skip, or Ghost below to test logging.',
          channelId: LECTURE_CHANNEL_ID,
          actionTypeId: LECTURE_ACTION_TYPE_ID,
          extra: { courseId: courseId ?? 'test-course' },
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
 * Backwards compatibility alias.
 */
export const sendTestNotification = sendTestLectureNotification;

/**
 * Parses activity due date and optional time into a device local Date object.
 */
export function parseLocalActivityDate(dueDate: string, dueTime?: string | null): Date | null {
  try {
    const cleanDate = dueDate.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length < 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

    let hour = 9;
    let minute = 0;
    if (dueTime && /^\d{1,2}:\d{2}/.test(dueTime)) {
      const [hStr, mStr] = dueTime.split(':');
      hour = parseInt(hStr, 10);
      minute = parseInt(mStr, 10);
    }
    return new Date(year, month, day, hour, minute, 0, 0);
  } catch {
    return null;
  }
}

function hashStringToId(str: string, offset: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return 500000 + Math.abs(hash % 400000) + offset;
}

export async function checkExactAlarmSetting(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  if (!isNative) return 'unsupported';
  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    return (status.exact_alarm as 'granted' | 'prompt' | 'denied') ?? 'unsupported';
  } catch {
    return 'unsupported';
  }
}

export async function requestExactAlarmSetting(): Promise<void> {
  if (!isNative) return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    // ignore
  }
}

export async function getPendingNotificationsCount(): Promise<number> {
  if (!isNative) return 0;
  try {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.length;
  } catch {
    return 0;
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

    let allowWhileIdle = true;
    try {
      const exactStatus = await LocalNotifications.checkExactNotificationSetting();
      if (exactStatus.exact_alarm === 'denied' || exactStatus.exact_alarm === 'prompt') {
        allowWhileIdle = false;
      }
    } catch {
      // ignore
    }

    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      channelId: string;
      actionTypeId?: string;
      extra?: Record<string, any>;
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

    // 1. Weekly lecture notifications (15 minutes prior) with interactive action buttons
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
        channelId: LECTURE_CHANNEL_ID,
        actionTypeId: LECTURE_ACTION_TYPE_ID,
        extra: { courseId: course.id },
        schedule: {
          on: {
            weekday: capacitorWeekday,
            hour: schedHour,
            minute: schedMinute,
          },
          repeats: true,
          allowWhileIdle,
        },
        sound: 'default',
      });
    }

    // 2. Build Vault Activity Deadline Notifications (24h, 1h, and at start)
    const nowMs = Date.now();
    const minFutureMs = nowMs + 5000;
    for (const act of activities) {
      if (!act.dueDate || act.isDone) continue;

      const dueDateObj = parseLocalActivityDate(act.dueDate, act.dueTime);
      if (!dueDateObj) continue;
      const dueTimestamp = dueDateObj.getTime();
      const timeStr = act.dueTime || '09:00';

      // 24 hours before
      const tMinus24h = dueTimestamp - 24 * 60 * 60 * 1000;
      if (tMinus24h > minFutureMs) {
        notifications.push({
          id: hashStringToId(act.id, 1),
          title: `⏳ Build Vault: Due in 24 Hours`,
          body: `${act.title}${act.priority ? ` [${act.priority}]` : ''} is due tomorrow at ${timeStr}.`,
          channelId: LECTURE_CHANNEL_ID,
          schedule: {
            at: new Date(tMinus24h),
            allowWhileIdle,
          },
          sound: 'default',
        });
      }

      // 1 hour before
      const tMinus1h = dueTimestamp - 60 * 60 * 1000;
      if (tMinus1h > minFutureMs) {
        notifications.push({
          id: hashStringToId(act.id, 2),
          title: `🚨 Build Vault: Due in 1 Hour!`,
          body: `Final deadline for "${act.title}" at ${timeStr}.`,
          channelId: LECTURE_CHANNEL_ID,
          schedule: {
            at: new Date(tMinus1h),
            allowWhileIdle,
          },
          sound: 'default',
        });
      }

      // At event start time
      if (dueTimestamp > minFutureMs) {
        notifications.push({
          id: hashStringToId(act.id, 3),
          title: `🎯 Build Vault: Event Starting Now`,
          body: `"${act.title}" deadline / event is now at ${timeStr}.`,
          channelId: LECTURE_CHANNEL_ID,
          schedule: {
            at: dueDateObj,
            allowWhileIdle,
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
