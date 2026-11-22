import React from 'react';
import clsx from 'clsx';

interface GlassySkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function GlassySkeleton({ className, ...props }: GlassySkeletonProps) {
  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-2xl bg-[#161b2e]/60 border border-white/[0.08] backdrop-blur-md',
        'before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/[0.06] before:to-transparent',
        className
      )}
      {...props}
    />
  );
}

/**
 * Mobile Overview First Cold-Load Skeleton matching MobileShell layout
 */
export function DashboardMobileSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-1 animate-pulse">
      {/* Hero Metric Skeleton */}
      <GlassySkeleton className="w-full h-32 rounded-3xl" />

      {/* Module Carousel Skeleton */}
      <div className="flex gap-3 overflow-hidden py-1">
        <GlassySkeleton className="w-[85vw] max-w-[340px] h-44 rounded-3xl shrink-0" />
        <GlassySkeleton className="w-[85vw] max-w-[340px] h-44 rounded-3xl shrink-0 opacity-40" />
      </div>

      {/* 3-Button Action Row Skeleton */}
      <div className="grid grid-cols-3 gap-2">
        <GlassySkeleton className="h-11 rounded-2xl" />
        <GlassySkeleton className="h-11 rounded-2xl" />
        <GlassySkeleton className="h-11 rounded-2xl" />
      </div>

      {/* UpNext Banner Skeleton */}
      <GlassySkeleton className="w-full h-12 rounded-2xl" />

      {/* UpNext List Skeletons */}
      <div className="space-y-2.5 pt-1">
        <GlassySkeleton className="w-full h-16 rounded-2xl" />
        <GlassySkeleton className="w-full h-16 rounded-2xl" />
        <GlassySkeleton className="w-full h-16 rounded-2xl" />
      </div>
    </div>
  );
}

/**
 * Desktop Overview First Cold-Load Skeleton matching Bento layout
 */
export function DashboardDesktopSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero Primary Target Card Skeleton */}
      <GlassySkeleton className="w-full h-52 rounded-3xl" />

      {/* 3x2 Module Grid Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassySkeleton key={i} className="h-44 rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
