import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskEmail(email?: string): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim().toLowerCase();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0 || atIdx === trimmed.length - 1) return '';

  const localPart = trimmed.slice(0, atIdx);
  const domainPart = trimmed.slice(atIdx + 1);

  const firstChar = localPart[0] || '';
  return `${firstChar}***@${domainPart}`;
}
