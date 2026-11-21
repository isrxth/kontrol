'use client';

import { useCallback, useContext, useEffect, useRef, useState, createContext } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { ShieldAlert, ShieldCheck, WifiOff, RefreshCw, Fingerprint } from 'lucide-react';
import { setAuthToken, api, BASE } from '@/lib/api';
import { GlassPanel } from '@/components/glassyui/glass-panel';
import { GlassButton } from '@/components/glassyui/glass-button';

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

  const attemptBiometricUnlock = useCallback(async () => {
    if (!isNative) return;
    if (localStorage.getItem('kontrol_biometric_enabled') !== 'true') return;
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
        useFallback: true,
      });
      const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
      if (creds && creds.password) {
        setAuthToken(creds.password);
        if (typeof window !== 'undefined') {
          localStorage.setItem('kontrol_token', creds.password);
        }
        const st = await api.authStatus();
        if (st.authenticated) {
          setStatus('authenticated');
          setError(null);
          return;
        }
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
        localStorage.setItem('kontrol_biometric_enabled', 'true');
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
        if (isNative && localStorage.getItem('kontrol_biometric_enabled') === 'true') {
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

  useEffect(() => {
    void checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native biometric auto-unlock on launch and app resume
  useEffect(() => {
    if (!isNative) return;

    let mounted = true;
    let subs: { remove: () => void } | null = null;

    const setupListener = async () => {
      try {
        const [, { App }] = await loadNativePlugins();
        if (!mounted) return;
        const sub = await App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            // Backgrounded: lock app
            setStatus('locked');
          } else {
            // Reopened / active: attempt biometric auto-unlock
            if (localStorage.getItem('kontrol_biometric_enabled') === 'true') {
              void attemptBiometricUnlock();
            }
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
  }, [attemptBiometricUnlock]);

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

  // Render centered portal overlay for non-authenticated states
  if (status !== 'authenticated') {
    return (
      <>
        {createPortal(
          <div className="fixed inset-0 z-50 w-screen h-dvh flex items-center justify-center p-4 bg-[#070707]/95 backdrop-blur-xl">
            {/* Loading State */}
            {status === 'loading' && (
              <GlassPanel className="w-full max-w-md mx-auto rounded-3xl p-6 sm:p-8 shadow-2xl border-white/10 bg-[#161b2e]/90 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-10 h-10 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-[spin_1s_linear_infinite]" />
                <p className="text-slate-300 text-sm font-medium">Initializing security…</p>
              </GlassPanel>
            )}

            {/* Network / Offline Error State */}
            {status === 'error' && (
              <GlassPanel className="w-full max-w-md mx-auto rounded-3xl p-6 sm:p-8 shadow-2xl border-rose-500/30 bg-[#161b2e]/90 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                  <WifiOff size={28} className="text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Connection Error</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Could not reach the Kontrol server. Please verify your connection or server status.
                  </p>
                  {error && (
                    <div className="mt-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-[11px] font-mono text-rose-300 break-all text-left">
                      {error}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-2 font-mono">Endpoint: {BASE}</p>
                </div>
                <GlassButton
                  onClick={() => {
                    setStatus('loading');
                    void checkStatus();
                  }}
                  variant="primary"
                  size="md"
                  className="w-full justify-center gap-2"
                >
                  <RefreshCw size={14} /> Retry Connection
                </GlassButton>
              </GlassPanel>
            )}

            {/* Setup Screen */}
            {status === 'setup' && (
              <GlassPanel className="w-full max-w-md mx-auto rounded-3xl p-6 sm:p-8 shadow-2xl border-white/10 bg-[#161b2e]/90 flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center">
                  <ShieldCheck size={32} className="text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">One‑Time Security Setup</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Set up Google Authenticator and a backup PIN to protect your academic data.
                  </p>
                </div>

                {setupStep === 'secret' && (
                  <>
                    {setupData ? (
                      <div className="flex flex-col items-center gap-3 w-full">
                        <div className="p-2 bg-white rounded-2xl shadow-2xl">
                          <img
                            src={setupData.qrDataUrl}
                            alt="TOTP QR code"
                            className="w-32 h-32"
                            loading="eager"
                          />
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono break-all max-w-xs">
                          {setupData.secret.match(/.{1,4}/g)?.join(' ') ?? setupData.secret}
                        </div>
                        <button
                          onClick={() => void navigator.clipboard.writeText(setupData.secret)}
                          className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300"
                        >
                          Copy setup key
                        </button>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Scan with Google Authenticator, then enter the 6‑digit code.
                        </p>
                        <input
                          autoFocus
                          maxLength={6}
                          inputMode="numeric"
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123 456"
                          className="w-full max-w-xs text-center text-2xl font-mono font-bold text-white tracking-widest rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
                        />
                        <div className="flex justify-end gap-3 mt-3 w-full">
                          <GlassButton
                            disabled={loading || totpCode.length < 6}
                            onClick={() => setSetupStep('pin')}
                            variant="primary"
                            size="md"
                            className="w-full justify-center"
                          >
                            Continue to Backup PIN
                          </GlassButton>
                        </div>
                      </div>
                    ) : (
                      <GlassButton
                        onClick={handleSetupInit}
                        disabled={loading}
                        variant="primary"
                        size="md"
                        className="w-full justify-center"
                      >
                        {loading ? 'Generating…' : 'Set up Authenticator'}
                      </GlassButton>
                    )}
                  </>
                )}

                {setupStep === 'pin' && (
                  <div className="w-full space-y-3 text-left">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Set 6‑Digit Backup PIN</label>
                      <input
                        autoFocus
                        maxLength={6}
                        type="password"
                        inputMode="numeric"
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full text-center text-xl font-mono font-bold text-white tracking-widest rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 outline-none focus:border-indigo-400/60"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Confirm Backup PIN</label>
                      <input
                        maxLength={6}
                        type="password"
                        inputMode="numeric"
                        value={confirmPin}
                        onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••••"
                        className="w-full text-center text-xl font-mono font-bold text-white tracking-widest rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 outline-none focus:border-indigo-400/60"
                      />
                    </div>
                    {error && (
                      <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
                        {error}
                      </div>
                    )}
                    <div className="flex gap-2.5 pt-2">
                      <GlassButton
                        variant="ghost"
                        size="md"
                        onClick={() => setSetupStep('secret')}
                        className="w-1/3 justify-center"
                      >
                        Back
                      </GlassButton>
                      <GlassButton
                        variant="primary"
                        size="md"
                        disabled={loading || pin.length < 6 || confirmPin.length < 6}
                        onClick={handleSetupFinalize}
                        className="w-2/3 justify-center"
                      >
                        {loading ? 'Saving…' : 'Finish Setup'}
                      </GlassButton>
                    </div>
                  </div>
                )}
              </GlassPanel>
            )}

            {/* Lock Screen */}
            {status === 'locked' && (
              <GlassPanel className="w-full max-w-md mx-auto rounded-3xl p-6 sm:p-8 shadow-2xl border-white/10 bg-[#161b2e]/90 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-900/80 border border-white/10 flex items-center justify-center">
                  <ShieldAlert size={32} className="text-rose-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Kontrol is Locked</h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">
                    Authenticate to access your attendance, timetable, and vault data.
                  </p>
                </div>

                {error && (
                  <div className="w-full rounded-xl bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-300">
                    {error}
                  </div>
                )}

                {/* Explicit Fingerprint Unlock button on Android Native */}
                {isNative && (
                  <GlassButton
                    onClick={() => void attemptBiometricUnlock()}
                    variant="ghost"
                    size="sm"
                    className="w-full flex items-center justify-center gap-2 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10 py-2.5"
                  >
                    <Fingerprint size={16} /> Unlock with Fingerprint
                  </GlassButton>
                )}

                {!usePinMode ? (
                  <div className="w-full space-y-3">
                    <input
                      autoFocus
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123 456"
                      className="w-full text-center text-2xl font-mono font-bold text-white tracking-widest rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
                    />
                    <p className="text-[11px] text-slate-500">6‑digit Google Authenticator code</p>
                    <button
                      onClick={() => setUsePinMode(true)}
                      className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300 transition-colors"
                    >
                      Use backup PIN instead
                    </button>
                    <GlassButton
                      disabled={loading || totpCode.length < 6}
                      onClick={handleVerifyTotp}
                      variant="primary"
                      size="md"
                      className="w-full justify-center mt-2"
                    >
                      {loading ? 'Verifying…' : 'Unlock'}
                    </GlassButton>
                  </div>
                ) : (
                  <div className="w-full space-y-3">
                    <input
                      autoFocus
                      maxLength={6}
                      type="password"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={enteredPin}
                      onChange={(e) => setEnteredPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full text-center text-2xl font-mono font-bold text-white tracking-widest rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-indigo-400/60"
                    />
                    <p className="text-[11px] text-slate-500">6‑digit backup PIN</p>
                    <button
                      onClick={() => setUsePinMode(false)}
                      className="text-xs text-indigo-400 font-semibold underline underline-offset-4 hover:text-indigo-300 transition-colors"
                    >
                      Use Google Authenticator instead
                    </button>
                    <GlassButton
                      disabled={loading || enteredPin.length < 6}
                      onClick={handleVerifyPin}
                      variant="primary"
                      size="md"
                      className="w-full justify-center mt-2"
                    >
                      {loading ? 'Verifying…' : 'Unlock'}
                    </GlassButton>
                  </div>
                )}
              </GlassPanel>
            )}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <AuthContext.Provider value={{ authenticated: true, initialized: true, lock }}>
      {children}
    </AuthContext.Provider>
  );
}
