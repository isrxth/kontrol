export interface CourseStats {
    code: string;
    name: string;
    totalLectures: number;
    requiredRatio: number;
    skippedCount: number;
}

export function calculateAttendanceRisk(stats: CourseStats) {
    const { totalLectures, requiredRatio, skippedCount } = stats;

    const maxSafeSkips = Math.floor(totalLectures * (1 - requiredRatio));
    const remainingSkips = maxSafeSkips - skippedCount;

    let riskLevel: 'SAFE' | 'WARNING' | 'DANGER' = 'SAFE';

    if (remainingSkips < 0) {
        riskLevel = 'DANGER';
    } else if (remainingSkips <= 1) {
        riskLevel = 'WARNING';
    }

    return {
        maxSafeSkips,
        remainingSkips,
        riskLevel,
        attendancePercentage: Math.round(((totalLectures - skippedCount) / totalLectures) * 100),
    };
}