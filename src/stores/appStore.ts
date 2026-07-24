import { create } from "zustand";
import type { SkillDraft, WorkspaceSkill } from "../types/skill";
import type { AppBootstrap, SyncLogEntry, SyncTargetStatus } from "../types/sync";

interface AppState {
  projectRoot: string;
  workspaceRoot: string;
  skills: WorkspaceSkill[];
  selectedSkillId: string | null;
  draft: SkillDraft | null;
  logs: SyncLogEntry[];
  targets: SyncTargetStatus[];
  isLoading: boolean;
  setBootstrap: (payload: AppBootstrap) => void;
  setTargets: (targets: SyncTargetStatus[]) => void;
  selectSkill: (skillId: string) => void;
  updateDraft: (patch: Partial<SkillDraft>) => void;
  upsertSkill: (skill: WorkspaceSkill) => void;
  removeSkill: (skillId: string) => void;
  updateSkillSyncState: (skillId: string, target: "codex" | "claude", status: string) => void;
  appendLog: (entry: SyncLogEntry) => void;
}

function toDraft(skill: WorkspaceSkill): SkillDraft {
  return {
    id: skill.meta.id,
    name: skill.meta.name,
    description: skill.meta.description,
    enabled: skill.meta.enabled,
    syncToCodex: skill.meta.syncTargets.includes("codex"),
    syncToClaude: skill.meta.syncTargets.includes("claude"),
    content: skill.content
  };
}

export const useAppStore = create<AppState>((set, get) => ({
  projectRoot: "",
  workspaceRoot: "",
  skills: [],
  selectedSkillId: null,
  draft: null,
  logs: [],
  targets: [],
  isLoading: true,
  setBootstrap: (payload) => {
    const firstSkill = payload.skills[0] ?? null;
    set({
      projectRoot: payload.projectRoot,
      workspaceRoot: payload.workspaceRoot,
      skills: payload.skills,
      selectedSkillId: firstSkill?.meta.id ?? null,
      draft: firstSkill ? toDraft(firstSkill) : null,
      logs: payload.logs,
      targets: payload.targets,
      isLoading: false
    });
  },
  setTargets: (targets) => {
    set({ targets });
  },
  selectSkill: (skillId) => {
    const skill = get().skills.find((item) => item.meta.id === skillId) ?? null;
    set({
      selectedSkillId: skillId,
      draft: skill ? toDraft(skill) : null
    });
  },
  updateDraft: (patch) => {
    const current = get().draft;
    if (!current) {
      return;
    }
    set({ draft: { ...current, ...patch } });
  },
  upsertSkill: (skill) => {
    const skills = [...get().skills];
    const index = skills.findIndex((item) => item.meta.id === skill.meta.id);
    if (index >= 0) {
      skills[index] = skill;
    } else {
      skills.push(skill);
    }
    set({
      skills,
      selectedSkillId: skill.meta.id,
      draft: toDraft(skill)
    });
  },
  removeSkill: (skillId) => {
    const nextSkills = get().skills.filter((item) => item.meta.id !== skillId);
    const nextSelected = nextSkills[0] ?? null;
    set({
      skills: nextSkills,
      selectedSkillId: nextSelected?.meta.id ?? null,
      draft: nextSelected ? toDraft(nextSelected) : null
    });
  },
  updateSkillSyncState: (skillId, target, status) => {
    const skills = get().skills.map((item) =>
      item.meta.id === skillId
        ? {
            ...item,
            lastSyncAt: new Date().toISOString(),
            lastSyncResult: status,
            syncStatusByTarget: [
              ...(item.syncStatusByTarget ?? []).filter((entry) => entry.target !== target),
              {
                target,
                lastSyncAt: new Date().toISOString(),
                lastSyncResult: status
              }
            ]
          }
        : item
    );
    set({ skills });
  },
  appendLog: (entry) => {
    set({ logs: [entry, ...get().logs].slice(0, 100) });
  }
}));
