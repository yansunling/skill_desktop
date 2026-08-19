import { useCallback } from "react";
import { relaunch } from "@tauri-apps/api/process";
import { checkUpdate, installUpdate, type UpdateManifest } from "@tauri-apps/api/updater";

export type UpdateCheckResult = {
  shouldUpdate: boolean;
  manifest?: UpdateManifest;
};

export function useAutoUpdate() {
  const check = useCallback(async (): Promise<UpdateCheckResult> => {
    const result = await checkUpdate();
    return { shouldUpdate: result.shouldUpdate, manifest: result.manifest };
  }, []);

  const install = useCallback(async () => {
    await installUpdate();
    await relaunch();
  }, []);

  return { check, install };
}

export default useAutoUpdate;
