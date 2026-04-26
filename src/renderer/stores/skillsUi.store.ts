import { defineStore } from "pinia";

export const useSkillsUiStore = defineStore("skillsUi", {
  state: () => ({
    managerOpen: false,
    expandedByKey: {} as Record<string, boolean>,
  }),
  actions: {
    openManager() {
      this.managerOpen = true;
    },
    closeManager() {
      this.managerOpen = false;
    },
    isExpanded(key: string): boolean {
      return Boolean(this.expandedByKey[String(key ?? "").trim()]);
    },
    toggleExpanded(key: string) {
      const id = String(key ?? "").trim();
      if (!id) return;
      this.expandedByKey = { ...this.expandedByKey, [id]: !this.isExpanded(id) };
    },
  },
});
