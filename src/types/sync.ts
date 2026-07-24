import type { SyncTarget, WorkspaceSkill } from "./skill";

export interface SyncLogEntry {
  timestamp: string;
  level: "info" | "warning" | "error";
  message: string;
}

export interface SyncTargetStatus {
  target: SyncTarget;
  path: string;
  exists: boolean;
}

export interface SyncResult {
  skillId: string;
  target: SyncTarget;
  status: "synced" | "skipped" | "conflict" | "failed";
  message: string;
  targetPath?: string;
  backupPath?: string;
}

export interface ImportResult {
  imported: WorkspaceSkill[];
  skipped: string[];
}

export interface SyncConflictState {
  skillId: string;
  target: SyncTarget;
  message: string;
  targetPath?: string;
  backupPath?: string;
}

export interface AppBootstrap {
  projectRoot: string;
  workspaceRoot: string;
  skills: WorkspaceSkill[];
  logs: SyncLogEntry[];
  targets: SyncTargetStatus[];
}
