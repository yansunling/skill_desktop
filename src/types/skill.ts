export type SyncTarget = "codex" | "claude";

export interface TargetSyncState {
  target: SyncTarget;
  lastSyncAt?: string;
  lastSyncResult?: string;
}

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  syncTargets: SyncTarget[];
  enabled: boolean;
}

export interface WorkspaceSkill {
  meta: SkillMeta;
  content: string;
  updatedAt?: string;
  lastSyncAt?: string;
  lastSyncResult?: string;
  syncStatusByTarget?: TargetSyncState[];
  source?: string;
  sourcePath?: string;
}

export interface SkillDraft {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  syncToCodex: boolean;
  syncToClaude: boolean;
  content: string;
}
