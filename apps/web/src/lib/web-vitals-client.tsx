'use client';

import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals, onReport } from './web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    reportWebVitals(metric);
    onReport(metric);
  });

  return null;
}
