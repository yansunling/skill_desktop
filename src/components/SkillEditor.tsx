import type { SkillDraft } from "../types/skill";

interface SkillEditorProps {
  draft: SkillDraft | null;
  onChange: (patch: Partial<SkillDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  removeCodexCopy: boolean;
  removeClaudeCopy: boolean;
  onDeleteOptionChange: (patch: { removeCodexCopy?: boolean; removeClaudeCopy?: boolean }) => void;
}

export function SkillEditor({
  draft,
  onChange,
  onSave,
  onDelete,
  removeCodexCopy,
  removeClaudeCopy,
  onDeleteOptionChange
}: SkillEditorProps) {
  if (!draft) {
    return (
      <section className="panel editor-panel empty-state">
        <p>还没有选中技能，请先新建或导入。</p>
      </section>
    );
  }

  return (
    <section className="panel editor-panel">
      <div className="panel-header">
        <div>
          <h2>技能编辑</h2>
          <p className="panel-desc">编辑名称、说明和技能内容。</p>
        </div>
        <div className="toolbar-buttons">
          <button type="button" className="danger-button" onClick={onDelete}>
            删除
          </button>
          <button type="button" className="primary-button" onClick={onSave}>
            保存
          </button>
        </div>
      </div>
      <div className="form-section">
        <div className="section-title">基本信息</div>
        <div className="field-grid">
        <label>
          <span>ID</span>
          <input value={draft.id} onChange={(event) => onChange({ id: event.target.value })} />
        </label>
        <label>
          <span>名称</span>
          <input value={draft.name} onChange={(event) => onChange({ name: event.target.value })} />
        </label>
        <label className="full-width">
          <span>说明</span>
          <input
            value={draft.description}
            onChange={(event) => onChange({ description: event.target.value })}
          />
        </label>
      </div>
      </div>
      <div className="form-section">
        <div className="section-title">状态与清理</div>
        <label className="toggle-row compact-toggle-row">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          <span>启用工作区技能</span>
        </label>
        <div className="delete-options">
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={removeCodexCopy}
              onChange={(event) => onDeleteOptionChange({ removeCodexCopy: event.target.checked })}
            />
            <span>删除时一并移除 Codex 同步副本</span>
          </label>
          <label className="toggle-row compact-toggle-row">
            <input
              type="checkbox"
              checked={removeClaudeCopy}
              onChange={(event) => onDeleteOptionChange({ removeClaudeCopy: event.target.checked })}
            />
            <span>删除时一并移除 Claude 同步副本</span>
          </label>
        </div>
      </div>
      <div className="form-section">
        <label className="markdown-field">
          <span className="section-title">SKILL.md 内容</span>
          <textarea
            value={draft.content}
            onChange={(event) => onChange({ content: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
