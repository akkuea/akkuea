import { timingSafeEqual } from 'crypto';

/** Compare secrets without short-circuiting on the first differing byte. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');

  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
