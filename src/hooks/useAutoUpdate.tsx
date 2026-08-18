import { useCallback } from "react";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";

export type UpdateCheckResult = {
  shouldUpdate: boolean;
  manifest?: any;
};

export function useAutoUpdate() {
  const check = useCallback(async (): Promise<UpdateCheckResult> => {
    try {
      const res = await checkUpdate();
      return { shouldUpdate: res.shouldUpdate, manifest: res.manifest };
    } catch (e) {
      console.warn("update: check failed", e);
      return { shouldUpdate: false };
    }
  }, []);

  const install = useCallback(async () => {
    try {
      await installUpdate();
    } catch (e) {
      console.warn("update: install failed", e);
    }
  }, []);

  return { check, install };
}

export default useAutoUpdate;
