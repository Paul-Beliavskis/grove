import { platform } from 'os';
import { resolve, normalize } from 'path';

export const isWindows = platform() === 'win32';

export function normalizePath(p: string): string {
  return normalize(resolve(p));
}

export function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/');
}
