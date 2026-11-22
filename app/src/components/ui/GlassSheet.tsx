'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';

interface GlassSheetProps {
  open: boolean;
  onClose: () => void;
  side?: 'bottom' | 'right';
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  maxWidth?: string;
}

export function GlassSheet({
  open,
  onClose,
  side = 'bottom',
  title,
  subtitle,
  children,
  footer,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
  maxWidth = 'max-w-md',
}: GlassSheetProps) {
  const [rendering, setRendering] = useState(false);
  const [closing, setClosing] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleOpen = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setClosing(false);
    setRendering(true);
  }, []);

  const handleClose = useCallback(() => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setRendering(false);
      setClosing(false);
      timerRef.current = null;
      onClose();
    }, 250);
  }, [onClose]);

  useEffect(() => {
    if (open) handleOpen();
    else handleClose();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, handleOpen, handleClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 100);
    setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 350);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleViewportChange = () => {
      const active = document.activeElement as HTMLElement | null;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && bodyRef.current?.contains(active)) {
        setTimeout(() => {
          active.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }, 150);
      }
    };
    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!rendering && !open) return null;

  const isBottom = side === 'bottom';

  const content = (
    <>
      <div
        className={clsx(
          'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm pointer-events-auto',
          closing ? 'opacity-0 transition-opacity duration-250 ease-out' : 'opacity-100 transition-opacity duration-250 ease-out'
        )}
        onClick={onClose}
      />
      <div
        className={clsx(
          'z-[201] pointer-events-auto flex flex-col',
          isBottom ? 'fixed inset-x-0 bottom-0 transition-[margin-bottom,max-height,transform,opacity] duration-250 ease-out' : 'fixed inset-y-0 right-0 w-full transition-transform duration-250 ease-out',
          className
        )}
        style={{
          marginBottom: isBottom ? 'var(--kb, 0px)' : undefined,
          maxHeight: isBottom ? 'calc(100dvh - var(--sat, 32px) - var(--kb, 0px) - 16px)' : undefined,
          paddingBottom: isBottom ? 'calc(var(--sab, 20px) + 16px)' : undefined,
          maxWidth,
          transform: closing ? (isBottom ? 'translateY(24px)' : 'translateX(100%)') : 'translateX(0) translateY(0)',
          opacity: closing ? 0 : 1,
        }}
        onClick={(e) => e.stopPropagation()}
        onFocusCapture={handleFocus}
      >
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2 sm:hidden" />
        {(title || subtitle) && (
          <div className={clsx('p-5 sm:p-6 shrink-0 border-b border-white/[0.06]', headerClassName)}>
            <div className="flex justify-between items-start">
              <div>
                {title && <h3 className="text-lg sm:text-xl font-bold text-white">{title}</h3>}
                {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
        <div
          ref={bodyRef}
          className={clsx('flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6', bodyClassName)}
          style={{ paddingBottom: isBottom && !footer ? 'calc(var(--sab, env(safe-area-inset-bottom, 0px)) + 24px)' : undefined }}
          onFocusCapture={handleFocus}
        >
          {children}
        </div>
        {footer && (
          <div
            className={clsx('shrink-0 border-t border-white/[0.08] bg-slate-900/98 flex items-center gap-3', footerClassName)}
            style={{ paddingBottom: isBottom ? 'calc(var(--sab, env(safe-area-inset-bottom, 0px)) + 16px)' : '16px' }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
