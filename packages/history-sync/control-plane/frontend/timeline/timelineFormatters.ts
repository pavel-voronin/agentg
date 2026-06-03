export function formatDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 16).replace('T', ' ');
}

export function formatDuration(milliseconds: number): string {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${String(days)}d`);
  if (hours > 0) parts.push(`${String(hours)}h`);
  if (remainingMinutes > 0 || parts.length === 0) parts.push(`${String(remainingMinutes)}m`);
  return parts.join(' ');
}

export function formatInteger(value: number): string {
  return new Intl.NumberFormat().format(Number.isFinite(value) ? value : 0);
}

export function formatSignedDuration(milliseconds: number): string {
  if (milliseconds === 0) {
    return '0m';
  }
  return `${milliseconds < 0 ? '-' : '+'}${formatDuration(Math.abs(milliseconds))}`;
}

export function formatTimelineDate(date: Date): string {
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 19).replace('T', ' ');
}
