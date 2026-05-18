import { createI18n } from "vue-i18n";
import type { UiLanguage } from "../../shared/localSettings";
import zhCN from "./messages/zh-CN";
import enUS from "./messages/en-US";

export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN" as UiLanguage,
  fallbackLocale: "zh-CN",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

export function setUiI18nLanguage(language: UiLanguage): void {
  i18n.global.locale.value = language;
  try {
    document.documentElement.lang = language;
  } catch {}
}
