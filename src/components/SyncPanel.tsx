import type { SyncTarget, WorkspaceSkill } from "../types/skill";
import type { SyncConflictState, SyncTargetStatus } from "../types/sync";

interface SyncPanelProps {
  selectedSkill: WorkspaceSkill | null;
  importedCount: number;
  targets: SyncTargetStatus[];
  conflict: SyncConflictState | null;
  isSyncingSelectedSkill: boolean;
  currentSyncTarget: SyncTarget | null;
  onSyncSelectedSkill: (target: SyncTarget) => void;
  onOverwriteSync: () => void;
  onDismissConflict: () => void;
}

export function SyncPanel({
  selectedSkill,
  importedCount,
  targets,
  conflict,
  isSyncingSelectedSkill,
  currentSyncTarget,
  onSyncSelectedSkill,
  onOverwriteSync,
  onDismissConflict
}: SyncPanelProps) {
  return (
    <aside className="panel sync-panel">
      <div className="panel-header">
        <div>
          <h2>同步面板</h2>
          <p className="panel-desc">选中左侧导入技能后，可直接同步到 Codex 或 Claude。</p>
        </div>
      </div>
      <div className="summary-card current-skill-card">
        <div className="summary-row">
          <span className="summary-label">本次导入数量</span>
          <strong>{importedCount}</strong>
        </div>
        <div className="summary-row">
          <span className="summary-label">当前技能</span>
          <strong>{selectedSkill ? selectedSkill.meta.name || selectedSkill.meta.id : "未选择技能"}</strong>
        </div>
        <div className="summary-row">
          <span className="summary-label">技能 ID</span>
          <span>{selectedSkill?.meta.id || "请选择左侧技能后再同步。"}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">技能说明</span>
          <span>{selectedSkill?.meta.description || "当前未选择技能或没有填写说明。"}</span>
        </div>
        <div className="sync-actions current-skill-actions">
          <button
            type="button"
            className="ghost-button"
            onClick={() => onSyncSelectedSkill("codex")}
            disabled={!selectedSkill || isSyncingSelectedSkill}
          >
            {currentSyncTarget === "codex" ? "同步到 Codex..." : "同步到 Codex"}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => onSyncSelectedSkill("claude")}
            disabled={!selectedSkill || isSyncingSelectedSkill}
          >
            {currentSyncTarget === "claude" ? "同步到 Claude..." : "同步到 Claude"}
          </button>
        </div>
      </div>
      {conflict ? (
        <div className="conflict-card">
          <strong>检测到冲突</strong>
          <span>{conflict.message}</span>
          {conflict.targetPath ? <code className="path-chip">{conflict.targetPath}</code> : null}
          {conflict.backupPath ? <code className="path-chip">{conflict.backupPath}</code> : null}
          <div className="sync-actions">
            <button type="button" onClick={onOverwriteSync}>
              覆盖并继续
            </button>
            <button type="button" className="ghost-button" onClick={onDismissConflict}>
              关闭
            </button>
          </div>
        </div>
      ) : null}
      <div className="form-section target-section">
        <div className="section-title">目标目录</div>
        <div className="target-list">
          {targets.map((target) => {
            const targetStatus = selectedSkill?.syncStatusByTarget?.find((item) => item.target === target.target);
            return (
              <div key={target.target} className="target-card">
                <div className="target-card-head">
                  <strong>{target.target === "codex" ? "Codex" : "Claude"}</strong>
                  <em>{target.exists ? "已就绪" : "未找到"}</em>
                </div>
                <span>{target.path}</span>
                <div className="target-meta-row">
                  <span className="tag target-status-tag">
                    状态：{targetStatus?.lastSyncResult || (selectedSkill ? "未同步" : "待选择技能")}
                  </span>
                  {targetStatus?.lastSyncAt ? <span className="target-sync-time">{targetStatus.lastSyncAt}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
