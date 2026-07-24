import type { WorkspaceSkill } from "../types/skill";

interface SkillListProps {
  skills: WorkspaceSkill[];
  selectedSkillId: string | null;
  onSelect: (skillId: string) => void;
  onImportFolder: () => void;
  onSyncToCodex: () => void;
  onSyncToClaude: () => void;
  onDeleteCodex: () => void;
  onDeleteClaude: () => void;
}

export function SkillList({
  skills,
  selectedSkillId,
  onSelect,
  onImportFolder,
  onSyncToCodex,
  onSyncToClaude,
  onDeleteCodex,
  onDeleteClaude
}: SkillListProps) {
  return (
    <aside className="panel skill-list">
      <div className="panel-header">
        <div>
          <h2>本次导入技能</h2>
          <p className="panel-desc">导入后会保留在当前会话，并可在右侧同步面板发布到 Codex 或 Claude。</p>
        </div>
      </div>
      <div className="list-actions">
        <div className="action-group">
          <div className="action-group-head">
            <div className="action-group-label">来源同步</div>
            <p className="action-group-desc">从已有技能来源复制到另一端，适合双端技能对齐。</p>
          </div>
          <div className="toolbar-buttons command-stack sync-entry-grid">
            <button type="button" className="ghost-button command-button command-button-sync" onClick={onSyncToCodex}>
              <span className="command-title">从 Claude 同步到 Codex</span>
            </button>
            <button type="button" className="ghost-button command-button command-button-sync" onClick={onSyncToClaude}>
              <span className="command-title">从 Codex 同步到 Claude</span>
            </button>
          </div>
        </div>
        <div className="action-group">
          <div className="action-group-head">
            <div className="action-group-label">目标清理</div>
            <p className="action-group-desc">加载目标端已有技能，筛选后批量删除不再需要的内容。</p>
          </div>
          <div className="toolbar-buttons command-stack delete-entry-grid">
            <button type="button" className="ghost-button command-button danger-button" onClick={onDeleteCodex}>
              <span className="command-title">删除 Codex 技能</span>
            </button>
            <button type="button" className="ghost-button command-button danger-button" onClick={onDeleteClaude}>
              <span className="command-title">删除 Claude 技能</span>
            </button>
          </div>
        </div>
        <div className="action-group">
          <div className="action-group-head">
            <div className="action-group-label">新增技能</div>
            <p className="action-group-desc">导入本地技能文件夹到当前会话后，再从右侧同步发布。</p>
          </div>
          <div className="toolbar-buttons command-stack import-entry-grid">
            <button type="button" className="ghost-button command-button import-button" onClick={onImportFolder}>
              <span className="command-title">导入文件夹</span>
            </button>
          </div>
        </div>
      </div>
      <div className="skill-items">
        {skills.length === 0 ? (
          <div className="empty-tip">当前会话还没有导入技能。</div>
        ) : (
          skills.map((skill) => {
            const selected = skill.meta.id === selectedSkillId;
            return (
              <button
                key={skill.meta.id}
                className={`skill-item${selected ? " selected" : ""}`}
                onClick={() => onSelect(skill.meta.id)}
                type="button"
              >
                <div className="skill-item-title">{skill.meta.name || skill.meta.id}</div>
                <div className="skill-item-subtitle">{skill.meta.id}</div>
                <div className="skill-item-tags">
                  {skill.lastSyncResult ? <span className="tag status-tag">最近：{skill.lastSyncResult}</span> : null}
                  {skill.syncStatusByTarget?.map((item) => (
                    <span key={`${skill.meta.id}-${item.target}`} className="tag target-status-tag">
                      {item.target}：{item.lastSyncResult ?? "未同步"}
                    </span>
                  ))}
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
