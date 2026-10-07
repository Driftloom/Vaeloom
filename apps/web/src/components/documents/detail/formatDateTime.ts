import { formatDate } from '@/lib/document-format';

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * `formatDate` with a time component.
 * Guaranteed never to return "Invalid Date".
 */
export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, { options: DATE_TIME_FORMAT });
}
