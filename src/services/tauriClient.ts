import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import type { SkillDraft, WorkspaceSkill } from "../types/skill";
import type { AppBootstrap, ImportResult, SyncResult } from "../types/sync";

export async function bootstrapApp(): Promise<AppBootstrap> {
  return invoke<AppBootstrap>("bootstrap_app");
}

export async function saveSkill(draft: SkillDraft): Promise<WorkspaceSkill> {
  return invoke<WorkspaceSkill>("save_skill", { draft });
}

export async function deleteSkill(
  skillId: string,
  removeCodexCopy: boolean,
  removeClaudeCopy: boolean
): Promise<void> {
  return invoke<void>("delete_skill", { skillId, removeCodexCopy, removeClaudeCopy });
}

export async function syncWorkspaceSkill(
  skillId: string,
  target: "codex" | "claude",
  overwrite = false
): Promise<SyncResult> {
  return invoke<SyncResult>("sync_skill", { skillId, target, overwrite });
}

export async function pickSkillImportPath(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "选择技能文件夹"
  });

  if (typeof selected === "string") {
    return selected;
  }

  return null;
}

export async function importSkillPath(importPath: string): Promise<ImportResult> {
  return invoke<ImportResult>("import_skill_path", { importPath });
}

export async function importCodexSkills(): Promise<ImportResult> {
  return invoke<ImportResult>("import_codex_skills");
}

export async function importClaudeSkills(): Promise<ImportResult> {
  return invoke<ImportResult>("import_claude_skills");
}

export async function listTargetSkills(target: "codex" | "claude"): Promise<ImportResult> {
  return invoke<ImportResult>("list_target_skills", { target });
}

export async function deleteTargetSkills(target: "codex" | "claude", skillIds: string[]): Promise<void> {
  return invoke<void>("delete_target_skills", { target, skillIds });
}
