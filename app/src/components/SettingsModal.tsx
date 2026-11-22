'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Copy,
  Fingerprint,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Clock,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthGate';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassButton } from '@/components/glassyui/glass-button';
import { GlassInput } from '@/components/glassyui/glass-input';
import {
  areNotificationsEnabled,
  sendTestLectureNotification,
  setNotificationsEnabled,
  checkExactAlarmSetting,
  requestExactAlarmSetting,
  getPendingNotificationsCount,
} from '@/lib/notifications';
import { isHapticsEnabled, setHapticsEnabled, hapticTap } from '@/lib/haptics';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { lock } = useAuth();
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const [mode, setMode] = useState<'main' | 'reset-totp' | 'change-pin'>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Biometric state
  const [biometricEnabled, setBiometricEnabled] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('kontrol_biometric_enabled') === 'true'
  );

  // Haptics state
  const [hapticsEnabled, setLocalHapticsEnabled] = useState(() => isHapticsEnabled());

  // Notification state
  const [notifsEnabled, setNotifsEnabled] = useState(() => areNotificationsEnabled());
  const [testSending, setTestSending] = useState(false);
  const [exactAlarmStatus, setExactAlarmStatus] = useState<'granted' | 'prompt' | 'denied' | 'unsupported'>('unsupported');
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    if (!open || !isNative) return;
    void checkExactAlarmSetting().then(setExactAlarmStatus);
    void getPendingNotificationsCount().then(setPendingCount);
  }, [open, isNative]);

  // Reset TOTP state
  const [setupData, setSetupData] = useState<{
    setupToken: string;
    secret: string;
    otpauth: string;
    qrDataUrl: string;
  } | null>(null);
  const [resetCode, setResetCode] = useState('');

  // Change PIN state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  if (!open) return null;

  const handleLock = async () => {
    try {
      await api.authLogout();
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kontrol_token');
      window.dispatchEvent(new Event('kontrol:lock'));
    }
    await lock();
    onClose();
  };

  const handleToggleBiometric = async () => {
    if (!isNative) return;
    const next = !biometricEnabled;
    setBiometricEnabled(next);
    setError(null);
    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      if (next) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('kontrol_token') : null;
        if (token) {
          await NativeBiometric.setCredentials({
            username: 'owner',
            password: token,
            server: 'com.kontrol.app',
          });
          localStorage.setItem('kontrol_biometric_enabled', 'true');
          setSuccess('Biometric unlock enabled');
        } else {
          setError('No active session found to save for biometrics.');
          setBiometricEnabled(false);
        }
      } else {
        await NativeBiometric.deleteCredentials({ server: 'com.kontrol.app' });
        localStorage.removeItem('kontrol_biometric_enabled');
        setSuccess('Biometric unlock disabled');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update biometric settings');
      setBiometricEnabled(!next);
    }
  };

  const handleToggleNotifications = async () => {
    const next = !notifsEnabled;
    setNotifsEnabled(next);
    await setNotificationsEnabled(next);
    setSuccess(next ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleSendTestPopUp = async () => {
    setTestSending(true);
    setError(null);
    try {
      const sent = await sendTestLectureNotification();
      if (sent) {
        setSuccess('Test interactive pop-up sent! Check your notification shade.');
      } else {
        setError('Notification permission not granted or device not supported.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test pop-up');
    } finally {
      setTestSending(false);
    }
  };

  const handleResetInit = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await api.resetTotpInit();
      setSetupData(data);
      setMode('reset-totp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResetConfirm = async () => {
    if (!setupData) return;
    if (!/^\d{6}$/.test(resetCode)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetTotp({ setupToken: setupData.setupToken, code: resetCode });
      setSetupData(null);
      setResetCode('');
      setMode('main');
      setSuccess('Authenticator reset successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (!/^\d{6}$/.test(currentPin)) {
      setError('Enter your current 6-digit PIN.');
      return;
    }
    if (!/^\d{6}$/.test(newPin) || newPin !== confirmNewPin) {
      setError('Set and confirm a valid matching 6-digit new PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.changePin({ currentPin, newPin });
      setCurrentPin('');
      setNewPin('');
      setConfirmNewPin('');
      setMode('main');
      setSuccess('Backup PIN changed successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN change failed');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#070707]/80 backdrop-blur-md transition-[padding] duration-200"
      style={{ paddingBottom: 'var(--kb, 0px)' }}
    >
      <GlassPanel className="w-full max-w-md mx-auto p-6 rounded-3xl border-white/10 bg-[#161b2e]/95 shadow-2xl relative max-h-[calc(100dvh-var(--kb,0px)-32px)] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white">
              {mode === 'main' ? 'Security & Settings' : mode === 'reset-totp' ? 'Reset Authenticator' : 'Change Backup PIN'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* 1. Main Menu */}
        {mode === 'main' && (
          <div className="space-y-4 pt-4">
            {/* Section 1: Lock Now */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Session</p>
              <button
                onClick={handleLock}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 active:scale-[0.99] transition-all"
              >
                <span className="flex items-center gap-2.5">
                  <Lock size={16} className="text-rose-400" />
                  <span>Lock App Now</span>
                </span>
                <span className="text-xs text-slate-500">Sign out</span>
              </button>
            </div>

            {/* Section 2: Biometric & Haptic Feedback */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Device &amp; Haptics</p>
              {isNative && (
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-2.5">
                    <Fingerprint size={18} className="text-indigo-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Fingerprint Unlock</p>
                      <p className="text-[11px] text-slate-400">Unlock on launch and app resume</p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleBiometric}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      biometricEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        biometricEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-2.5">
                  <Smartphone size={18} className="text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Haptic Feedback</p>
                    <p className="text-[11px] text-slate-400">Tactile vibrations on taps, actions, and unlock</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = !hapticsEnabled;
                    setLocalHapticsEnabled(next);
                    setHapticsEnabled(next);
                    if (next) void hapticTap();
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    hapticsEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      hapticsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Section 3: Pop-up Notifications */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Notifications</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-2.5">
                    <Bell size={18} className="text-amber-400" />
                    <div>
                      <p className="text-sm font-medium text-white">Lecture &amp; Deadline Alerts</p>
                      <p className="text-[11px] text-slate-400">Reminders 15m before class and at deadlines</p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleNotifications}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      notifsEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notifsEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Pending scheduled notifications diagnostics pill */}
                {isNative && notifsEnabled && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] text-xs">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={13} className="text-indigo-400" />
                      <span>Pending Scheduled Alarms</span>
                    </span>
                    <span className="font-mono font-medium text-indigo-300">
                      {pendingCount} queued
                    </span>
                  </div>
                )}

                {/* Exact Alarm Setting button on Android 13+ if denied or prompt */}
                {isNative && (exactAlarmStatus === 'denied' || exactAlarmStatus === 'prompt') && (
                  <GlassButton
                    onClick={async () => {
                      await requestExactAlarmSetting();
                      const updated = await checkExactAlarmSetting();
                      setExactAlarmStatus(updated);
                    }}
                    size="sm"
                    className="w-full justify-center text-xs py-2 border-amber-500/30 bg-amber-500/10 text-amber-300"
                  >
                    <AlertTriangle size={13} className="mr-1.5" />
                    Enable Exact Alarms in System Settings
                  </GlassButton>
                )}

                {isNative && notifsEnabled && (
                  <GlassButton
                    onClick={handleSendTestPopUp}
                    disabled={testSending}
                    size="sm"
                    className="w-full justify-center text-xs py-2 border-white/10"
                  >
                    <Send size={13} className="mr-1.5 text-indigo-400" />
                    {testSending ? 'Sending…' : 'Test Interactive Lecture Pop-Up'}
                  </GlassButton>
                )}

                {isNative && (
                  <div className="p-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 text-left space-y-1">
                    <p className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles size={12} className="shrink-0" />
                      <span>HyperOS / MIUI Pop-Up Setup</span>
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      For heads-up lecture alerts to pop over other apps and on lock screen, ensure{' '}
                      <span className="text-white font-medium">Display pop-up windows</span> and{' '}
                      <span className="text-white font-medium">Autostart</span> are enabled in{' '}
                      <span className="text-white font-mono text-[10px]">Settings → Apps → Kontrol</span>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Credentials Management */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Credentials</p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setError(null);
                    setSuccess(null);
                    setMode('change-pin');
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 transition-all"
                >
                  <span className="flex items-center gap-2.5">
                    <Copy size={16} className="text-indigo-400" />
                    <span>Change Backup PIN</span>
                  </span>
                  <span className="text-xs text-slate-500">6 digits</span>
                </button>

                <button
                  onClick={handleResetInit}
                  disabled={loading}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  <span className="flex items-center gap-2.5">
                    <RefreshCw size={16} className="text-amber-400" />
                    <span>Reset Google Authenticator</span>
                  </span>
                  <AlertTriangle size={14} className="text-amber-400" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Reset TOTP Screen */}
        {mode === 'reset-totp' && (
          <div className="space-y-4 pt-4">
            {setupData && (
              <>
                <p className="text-xs text-slate-400 text-center">
                  Scan the new QR code with Google Authenticator, then enter the 6‑digit code.
                </p>
                <div className="flex flex-col items-center gap-2">
                  <div className="p-2 bg-white rounded-2xl shadow-xl">
                    <img
                      src={setupData.qrDataUrl}
                      alt="TOTP QR code"
                      className="w-28 h-28"
                      loading="eager"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono break-all max-w-xs text-center px-2">
                    {setupData.secret.match(/.{1,4}/g)?.join(' ') ?? setupData.secret}
                  </div>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(setupData.secret);
                      setSuccess('Key copied to clipboard');
                    }}
                    className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300"
                  >
                    Copy secret key
                  </button>
                </div>

                <div className="space-y-1">
                  <input
                    autoFocus
                    maxLength={6}
                    inputMode="numeric"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123 456"
                    className="w-full text-center text-2xl font-mono font-bold text-white tracking-widest rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
                  />
                  <p className="text-[10px] text-slate-500 text-center">6‑digit code from Authenticator</p>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMode('main');
                      setError(null);
                    }}
                  >
                    Cancel
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    size="sm"
                    disabled={loading || resetCode.length < 6}
                    onClick={handleResetConfirm}
                  >
                    {loading ? 'Verifying…' : 'Confirm Reset'}
                  </GlassButton>
                </div>
              </>
            )}
          </div>
        )}

        {/* 3. Change PIN Screen */}
        {mode === 'change-pin' && (
          <div className="space-y-3 pt-4">
            <p className="text-xs text-slate-400 text-center mb-1">
              Enter your current 6‑digit backup PIN and set a new one.
            </p>
            <GlassInput
              label="Current PIN"
              type="password"
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              className="text-center font-mono text-lg tracking-widest"
            />
            <GlassInput
              label="New PIN"
              type="password"
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              className="text-center font-mono text-lg tracking-widest"
            />
            <GlassInput
              label="Confirm New PIN"
              type="password"
              maxLength={6}
              inputMode="numeric"
              placeholder="••••••"
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
              className="text-center font-mono text-lg tracking-widest"
            />

            <div className="flex justify-end gap-2.5 pt-3">
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode('main');
                  setError(null);
                }}
              >
                Cancel
              </GlassButton>
              <GlassButton
                variant="primary"
                size="sm"
                disabled={loading || currentPin.length < 6 || newPin.length < 6 || confirmNewPin.length < 6}
                onClick={handleChangePin}
              >
                {loading ? 'Saving…' : 'Update PIN'}
              </GlassButton>
            </div>
          </div>
        )}
      </GlassPanel>
    </div>,
    document.body
  );
}
