import React from 'react';
import { useCurrentSemester } from '../hooks/useCurrentSemester';
import { TermIndicatorBadge } from './TermIndicatorBadge';

/** ป้ายภาคเรียนปัจจุบัน (อ่านสดจาก school_settings/academic_year) — วางที่ NavbarWithRoleSwitcher จุดเดียวสำหรับทุก portal */
export const TermIndicator: React.FC<{ className?: string }> = ({ className }) => {
  const { academicYear, term, isConfigured, loading } = useCurrentSemester();
  return <TermIndicatorBadge academicYear={academicYear} term={term} isConfigured={isConfigured} loading={loading} className={className} />;
};
