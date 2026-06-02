import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_USER_LOCAL_SETTINGS,
  mergeUserLocalSettings,
  normalizeUserLocalSettings,
  type UserLocalSettings,
  type UserLocalSettingsPatch,
} from "@codenexus/shared/localSettings";

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class LocalSettingsService {
  private writeQueue: Promise<UserLocalSettings> = Promise.resolve(
    normalizeUserLocalSettings(DEFAULT_USER_LOCAL_SETTINGS)
  );

  constructor(private readonly filePath: string) {}

  get path(): string {
    return this.filePath;
  }

  private async readFromDisk(): Promise<{ exists: boolean; settings: UserLocalSettings }> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return { exists: true, settings: normalizeUserLocalSettings(tryParseJson(raw)) };
    } catch {
      return { exists: false, settings: normalizeUserLocalSettings(DEFAULT_USER_LOCAL_SETTINGS) };
    }
  }

  async read(): Promise<{ exists: boolean; settings: UserLocalSettings }> {
    await this.writeQueue.catch(() => undefined);
    return this.readFromDisk();
  }

  async patch(patch: UserLocalSettingsPatch | null | undefined): Promise<UserLocalSettings> {
    const task = this.writeQueue
      .catch(() => normalizeUserLocalSettings(DEFAULT_USER_LOCAL_SETTINGS))
      .then(async () => {
        const current = await this.readFromDisk();
        const next = mergeUserLocalSettings(current.settings, patch ?? {});
        await mkdir(dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
        return next;
      });
    this.writeQueue = task;
    return task;
  }
}
