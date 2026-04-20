import type { Snippet } from "svelte";

export interface NavBarConfig {
  title?: string;
  backAction?: () => void;
  actions?: Snippet;
  hasUnsavedChanges?: boolean;
  /** When true, the page manages its own LeftPanel layout (sticky) — HeaderNav should not apply ml-96 to EventTabs */
  stickyLeftPanel?: boolean;
}

class NavBarStore {
  #config = $state<NavBarConfig>({
    title: "",
  });

  get title() {
    return this.#config.title || "ENKA Cookbook";
  }

  get backAction() {
    return this.#config.backAction;
  }

  get actions() {
    return this.#config.actions;
  }

  get hasUnsavedChanges() {
    return this.#config.hasUnsavedChanges || false;
  }

  get stickyLeftPanel() {
    return this.#config.stickyLeftPanel || false;
  }

  setConfig(config: NavBarConfig) {
    this.#config = {
      ...config,
    };
  }

  reset() {
    this.#config = {
      title: "",
    };
  }
}

export const navBarStore = new NavBarStore();
