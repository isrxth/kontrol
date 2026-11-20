'use client';

import { useCallback, useContext, useEffect, useRef, useState, createContext } from 'react';
import { Capacitor } from '@capacitor/core';
import { ShieldAlert, ShieldCheck, WifiOff, RefreshCw } from 'lucide-react';
import { setAuthToken, api, BASE } from '@/lib/api';
import { GlassSheet } from '@/components/ui/GlassSheet';

interface AuthContextValue {
  authenticated: boolean;
  initialized: boolean;
  lock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthGate');
  return ctx;
}

const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
const BIOMETRIC_SERVER = 'com.kontrol.app';

function loadNativePlugins() {
  return Promise.all([
    import('@capgo/capacitor-native-biometric'),
    import('@capacitor/app'),
  ] as const);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'setup' | 'locked' | 'authenticated' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'secret' | 'pin'>('secret');
  const [setupData, setSetupData] = useState<{
    setupToken: string;
    secret: string;
    otpauth: string;
    qrDataUrl: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [usePinMode, setUsePinMode] = useState(false);
  const promptingRef = useRef(false);
  const firstLaunchRef = useRef(true);

  const attemptBiometricUnlock = useCallback(async () => {
    if (!isNative) return;
    if (promptingRef.current) return;
    promptingRef.current = true;
    try {
      const [{ NativeBiometric }] = await loadNativePlugins();
      const available = await NativeBiometric.isAvailable();
      if (!available.isAvailable) {
        setStatus('locked');
        return;
      }
      await NativeBiometric.verifyIdentity({
        reason: 'Unlock Kontrol',
        title: 'Biometric Unlock',
      });
      const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
      if (creds && creds.password) {
        setAuthToken(creds.password);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kontrol_token', creds.password);
        }
        setStatus('authenticated');
        setError(null);
        return;
      }
      setStatus('locked');
    } catch {
      setStatus('locked');
    } finally {
      promptingRef.current = false;
    }
  }, []);

  const saveToken = useCallback(async (token: string) => {
    setAuthToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kontrol_token', token);
    }
    if (isNative) {
      try {
        const [{ NativeBiometric }] = await loadNativePlugins();
        await NativeBiometric.setCredentials({
          username: 'owner',
          password: token,
          server: BIOMETRIC_SERVER,
        });
      } catch {
        // ignore
      }
    }
  }, []);

  const checkStatus = useCallback(async () => {
    try {
      const data = await api.authStatus();
      if (data.authenticated) {
        setStatus('authenticated');
      } else if (!data.initialized) {
        setStatus('setup');
      } else {
        setStatus('locked');
        if (isNative) {
          void attemptBiometricUnlock();
        }
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auth check failed');
      setStatus('error');
    }
  }, [attemptBiometricUnlock]);

  const lock = useCallback(async () => {
    setAuthToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kontrol_token');
    }
    setStatus('locked');
    setError(null);
  }, []);

  const mount = useCallback(async () => {
    try {
      await checkStatus();
    } finally {
      firstLaunchRef.current = false;
    }
  }, [checkStatus]);

  useEffect(() => {
    void mount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native biometric unlock / resume prompt
  useEffect(() => {
    if (!isNative) return;

    let mounted = true;
    let subs: { remove: () => void } | null = null;

    const onResume = async () => {
      await lock();
      await attemptBiometricUnlock();
    };

    const setupListener = async () => {
      try {
        const [, { App }] = await loadNativePlugins();
        if (!mounted) return;
        const sub = await App.addListener('appStateChange', (state: { isActive: boolean }) => {
          if (state.isActive) {
            void onResume();
          }
        });
        if (!mounted) {
          sub.remove();
        } else {
          subs = sub;
        }
      } catch {
        // ignore
      }
    };

    void setupListener();

    return () => {
      mounted = false;
      subs?.remove();
    };
  }, [attemptBiometricUnlock, lock]);

  // Global 401 lock
  useEffect(() => {
    const onLock = () => {
      void lock();
    };
    window.addEventListener('kontrol:lock', onLock);
    return () => window.removeEventListener('kontrol:lock', onLock);
  }, [lock]);

  // ---------- setup ----------
  const handleSetupInit = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.authSetupInit();
      setSetupData(data);
      setSetupStep('secret');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupFinalize = async () => {
    if (!setupData) return;
    if (!/^\d{6}$/.test(totpCode)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    if (!/^\d{6}$/.test(pin) || pin !== confirmPin) {
      setError('Set a matching 6-digit backup PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.authSetupFinalize({
        setupToken: setupData.setupToken,
        code: totpCode,
        pin,
      });
      await saveToken(data.token);
      setSetupData(null);
      setSetupStep('secret');
      setTotpCode('');
      setPin('');
      setConfirmPin('');
      setStatus('authenticated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  // ---------- locked ----------
  const handleVerifyTotp = async () => {
    if (!/^\d{6}$/.test(totpCode)) {
      setError('Enter a valid 6-digit code.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.verifyTotp(totpCode);
      await saveToken(data.token);
      setStatus('authenticated');
      setTotpCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPin = async () => {
    if (!/^\d{6}$/.test(enteredPin)) {
      setError('Enter a valid 6-digit PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.verifyPin(enteredPin);
      await saveToken(data.token);
      setStatus('authenticated');
      setEnteredPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  // ---------- render ----------
  const LockScreen = () => {
    return (
      <GlassSheet
        open={status === 'locked'}
        onClose={() => {}}
        side="bottom"
        className="w-full sm:w-[420px] max-h-[60vh] pointer-events-auto"
      >
        <div className="flex flex-col items-center justify-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-slate-900/80 border border-white/10 flex items-center justify-center">
            <ShieldAlert size={32} className="text-rose-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Kontrol is locked</h2>
          <p className="text-center text-slate-400 text-sm max-w-xs">
            Authenticate to access your attendance, timetable, and vault data.
          </p>
          {error && (
            <div className="w-full rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
          {!usePinMode ? (
            <>
              <input
                autoFocus
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123 456"
                className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
              />
              <p className="text-xs text-slate-500 mt-1">6‑digit Google Authenticator code</p>
              <button
                onClick={() => setUsePinMode(true)}
                className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300 transition-colors"
              >
                Use backup PIN
              </button>
              <div className="flex justify-end gap-3 mt-3">
                <button
                  disabled={loading || totpCode.length < 6}
                  onClick={handleVerifyTotp}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {loading ? 'Verifying…' : 'Unlock'}
                </button>
              </div>
            </>
          ) : (
            <>
              <input
                autoFocus
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={enteredPin}
                onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                placeholder="123 456"
                className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
              />
              <p className="text-xs text-slate-500 mt-1">6‑digit backup PIN</p>
              <button
                onClick={() => setUsePinMode(false)}
                className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300 transition-colors"
              >
                Use Google Authenticator
              </button>
              <div className="flex justify-end gap-3 mt-3">
                <button
                  disabled={loading || enteredPin.length < 6}
                  onClick={handleVerifyPin}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {loading ? 'Verifying…' : 'Unlock'}
                </button>
              </div>
            </>
          )}
        </div>
      </GlassSheet>
    );
  };

  const SetupScreen = () => {
    const showQr = setupStep === 'secret' && setupData;
    return (
      <GlassSheet
        open={status === 'setup'}
        onClose={() => {}}
        side="bottom"
        className="w-full sm:w-[440px] max-h-[75vh] pointer-events-auto"
      >
        <div className="flex flex-col items-center gap-4 p-4 sm:p-6">
          <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center">
            <ShieldCheck size={32} className="text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">One‑time security setup</h2>
          <p className="text-center text-slate-400 text-sm max-w-xs">
            Set up Google Authenticator and a backup PIN so only you can open Kontrol.
          </p>

          {setupStep === 'secret' && (
            <>
              {showQr && (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={setupData.qrDataUrl}
                    alt="TOTP QR code"
                    className="w-32 h-32 bg-white rounded-xl p-1 border border-white/10 shadow-2xl"
                    loading="eager"
                  />
                  <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-slate-400 font-mono break-all max-w-xs">
                    {setupData.secret.match(/.{1,4}/g)?.join(' ') ?? setupData.secret}
                  </div>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(setupData.secret);
                    }}
                    className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300 transition-colors"
                  >
                    Copy setup key
                  </button>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Scan with Google Authenticator, then enter the 6‑digit code below.
                  </p>
                  <input
                    autoFocus
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123 456"
                    className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
                  />
                  <p className="text-xs text-slate-500 mt-1">6‑digit verification code</p>
                  <div className="flex justify-end gap-3 mt-3 w-full px-2 sm:px-0">
                    <button
                      disabled={loading || totpCode.length < 6}
                      onClick={() => {
                        setSetupStep('pin');
                      }}
                      className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                    >
                      {loading ? 'Verifying…' : 'Verify code'}
                    </button>
                  </div>
                </div>
              )}
              {!showQr && (
                <button
                  onClick={handleSetupInit}
                  disabled={loading}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {loading ? 'Generating…' : 'Set up Authenticator'}
                </button>
              )}
            </>
          )}

          {setupStep === 'pin' && (
            <>
              <p className="text-xs text-slate-400 text-center mb-2">Create a 6‑digit backup PIN</p>
              <input
                autoFocus
                maxLength={6}
                inputMode="numeric"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="123 456"
                className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
              />
              <p className="text-xs text-slate-500 mt-2">Confirm PIN</p>
              <input
                maxLength={6}
                inputMode="numeric"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                placeholder="123 456"
                className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-wider rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
              />
              {error && (
                <div className="w-full rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300 mt-2">
                  {error}
                </div>
              )}
              <div className="flex justify-end gap-3 mt-4 w-full px-2 sm:px-0">
                <button
                  onClick={() => setSetupStep('secret')}
                  className="rounded-xl px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  Back
                </button>
                <button
                  disabled={loading || pin.length < 6 || confirmPin.length < 6}
                  onClick={handleSetupFinalize}
                  className="rounded-xl bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-400 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                >
                  {loading ? 'Saving…' : 'Finish setup'}
                </button>
              </div>
            </>
          )}
        </div>
      </GlassSheet>
    );
  };

  if (status === 'loading') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070707]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-[spin_1s_linear_infinite]" />
          <p className="text-slate-400 text-xs">Initializing security…</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#070707] p-4">
        <div className="flex flex-col items-center max-w-sm text-center gap-4 p-6 rounded-3xl bg-[#161b2e]/90 border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <WifiOff size={28} className="text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Connection Error</h2>
            <p className="text-xs text-slate-400 mt-1">
              Could not reach the Kontrol server. Please check your internet connection or server status.
            </p>
            {error && (
              <div className="mt-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[11px] font-mono text-rose-300 break-all text-left">
                {error}
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-2 font-mono">Endpoint: {BASE}</p>
          </div>
          <button
            onClick={() => {
              setStatus('loading');
              void checkStatus();
            }}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 active:scale-[0.98] py-2.5 text-xs font-semibold text-white transition-all shadow-lg shadow-indigo-500/20"
          >
            <RefreshCw size={14} /> Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated: status === 'authenticated', initialized: true, lock }}>
      {status !== 'authenticated' && (
        <div className="fixed inset-0 z-[199] bg-[#070707]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_120%_at_50%_-10%,rgba(37,99,235,0.18),transparent)]" />
        </div>
      )}
      {status === 'setup' && <SetupScreen />}
      {status === 'locked' && <LockScreen />}
      {status === 'authenticated' && children}
    </AuthContext.Provider>
  );
}