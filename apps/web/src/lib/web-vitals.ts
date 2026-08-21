const ANALYTICS_ENDPOINT = process.env['NEXT_PUBLIC_ANALYTICS_ENDPOINT'] ?? '';

interface Metric {
  id: string;
  name: string;
  value: number;
  rating: string;
  delta: number;
  entries: PerformanceEntry[];
  navigationType: string;
  attribution?: Record<string, unknown>;
}

export function reportWebVitals(metric: Metric): void {
  console.info('[Web Vitals]', {
    // eslint-disable-line no-console
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  });
}

export function onReport(metric: Metric): void {
  if (ANALYTICS_ENDPOINT && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
        id: metric.id,
        navigationType: metric.navigationType,
        url: window.location.href,
        userAgent: navigator.userAgent,
      });
      navigator.sendBeacon(ANALYTICS_ENDPOINT, body);
    } catch {
      // Fail silently
    }
  }
}
