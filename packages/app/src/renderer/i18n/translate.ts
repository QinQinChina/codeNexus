import { i18n } from ".";

export function translate(key: string, params?: Record<string, unknown>): string {
  const t = i18n.global.t as (key: string, params?: Record<string, unknown>) => string;
  return params ? t(key, params) : t(key);
}
