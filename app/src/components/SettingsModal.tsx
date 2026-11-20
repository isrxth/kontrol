'use client';

import { useState } from 'react';
import Capacitor from '@capacitor/core';
import { AlertTriangle, Copy, Lock, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from './AuthGate';
import { GlassSheet } from '@/components/ui/GlassSheet';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { lock } = useAuth();
  const isNativeCapacitor =
    (Capacitor as { isNativePlatform?: () => boolean }).isNativePlatform?.() ?? false;
  const [mode, setMode] = useState<'main' | 'reset-totp' | 'change-pin'>('main');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<{ setupToken: string; secret: string; otpauth: string; qrDataUrl: string } | null>(null);
  const [resetCode, setResetCode] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');

  const handleLock = async () => {
    await lock();
    onClose();
  };

  const handleResetInit = async () => {
    setLoading(true);
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (!/^\d{6}$/.test(currentPin) || !/^\d{6}$/.test(newPin) || newPin !== confirmNewPin) {
      setError('Enter a valid current PIN and matching new PIN.');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN change failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgetDevice = async () => {
    if (isNativeCapacitor) {
      try {
        const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
        await NativeBiometric.deleteCredentials({ server: 'kontrol' });
      } catch {
        // ignore
      }
    }
    await lock();
    onClose();
  };

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      side="bottom"
      className="w-full sm:w-[440px] max-h-[70vh] pointer-events-auto"
      title={mode === 'main' ? 'Security' : mode === 'reset-totp' ? 'Reset Authenticator' : 'Change PIN'}
    >
      {mode === 'main' && (
        <>
          <div className="flex items-center gap-3 py-1">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="text-sm font-semibold text-slate-200">Authenticator &amp; PIN enabled</span>
          </div>
          <div className="space-y-3 pt-2">
            <button
              onClick={handleLock}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 transition-all"
            >
              <span className="flex items-center gap-2">
                <Lock size={16} /> Lock now
              </span>
              <X size={14} className="text-slate-500" />
            </button>
            <button
              onClick={handleResetInit}
              disabled={loading}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <RefreshCw size={16} /> Reset Authenticator
              </span>
              <AlertTriangle size={14} className="text-amber-400" />
            </button>
            <button
              onClick={() => setMode('change-pin')}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 transition-all"
            >
              <span className="flex items-center gap-2">
                <Copy size={16} /> Change backup PIN
              </span>
            </button>
            {isNativeCapacitor && (
              <button
                onClick={handleForgetDevice}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-rose-400 hover:bg-rose-500/10 transition-all"
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={16} /> Forget this device
                </span>
              </button>
            )}
          </div>
          {error && (
            <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
        </>
      )}

      {mode === 'reset-totp' && (
        <>
          {setupData ? (
            <>
              <p className="text-xs text-slate-400 text-center mb-3">
                Scan the new QR code with Google Authenticator, then verify with one 6‑digit code.
              </p>
              <div className="flex flex-col items-center gap-2">
                <img
                  src={setupData.qrDataUrl}
                  alt="TOTP QR code"
                  className="w-24 h-24 bg-white rounded-lg p-1 border border-white/10 shadow-xl"
                  loading="eager"
                />
                <div className="text-xs text-slate-400 font-mono break-all max-w-xs text-center">
                  {setupData.secret.match(/.{1,4}/g)?.join(' ') ?? setupData.secret}
                </div>
              </div>
              <input
                autoFocus
                maxLength={6}
                inputMode="numeric"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123 456"
                className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
              />
              <p className="text-xs text-slate-500 mt-1">6‑digit verification code</p>
              <div className="flex justify-end gap-3 mt-4 w-full px-2 sm:px-0">
                <button
                  onClick={() => setMode('main')}
                  className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  disabled={loading || resetCode.length < 6}
                  onClick={handleResetConfirm}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {loading ? 'Resetting…' : 'Confirm reset'}
                </button>
              </div>
              {error && (
                <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
                  {error}
                </div>
              )}
            </>
          ) : (
            <button
              onClick={handleResetInit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-slate-200 hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {loading ? 'Generating…' : 'Reset Authenticator'}
            </button>
          )}
        </>
      )}

      {mode === 'change-pin' && (
        <>
          <p className="text-xs text-slate-400 text-center mb-3">Enter your current 6‑digit backup PIN and a new one.</p>
          <input
            maxLength={6}
            inputMode="numeric"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Current PIN"
            className="w-full max-w-xs text-center text-xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
          />
          <input
            maxLength={6}
            inputMode="numeric"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="New PIN"
            className="w-full max-w-xs text-center text-xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60 mt-3"
          />
          <input
            maxLength={6}
            inputMode="numeric"
            value={confirmNewPin}
            onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Confirm new PIN"
            className="w-full max-w-xs text-center text-xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60 mt-3"
          />
          {error && (
            <div className="mt-3 rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 mt-4 w-full px-2 sm:px-0">
            <button
              onClick={() => setMode('main')}
              className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              disabled={loading ||
                currentPin.length < 6 ||
                newPin.length < 6 ||
                confirmNewPin.length < 6}
              onClick={handleChangePin}
              className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
            >
              {loading ? 'Saving…' : 'Change PIN'}
            </button>
          </div>
        </>
      )}
    </GlassSheet>
  );
}
