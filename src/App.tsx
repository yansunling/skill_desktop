import { useEffect, useState } from "react";
import type { UpdateManifest } from "@tauri-apps/api/updater";
import { ActivityLog } from "./components/ActivityLog";
import { SkillList } from "./components/SkillList";
import { SyncPanel } from "./components/SyncPanel";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import {
  bootstrapApp,
  deleteTargetSkills,
  importClaudeSkills,
  importCodexSkills,
  importSkillPath,
  listTargetSkills,
  pickSkillImportPath,
  syncWorkspaceSkill
} from "./services/tauriClient";
import type { WorkspaceSkill } from "./types/skill";
import type { SyncConflictState, SyncLogEntry, SyncTargetStatus } from "./types/sync";

type SyncTarget = "codex" | "claude";
type ModalMode = "sync" | "delete";

export default function App() {
  const { check: checkForUpdate, install: installUpdate } = useAutoUpdate();
  const [targets, setTargets] = useState<SyncTargetStatus[]>([]);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [skills, setSkills] = useState<WorkspaceSkill[]>([]);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conflict, setConflict] = useState<SyncConflictState | null>(null);
  const [modalTarget, setModalTarget] = useState<SyncTarget | null>(null);
  const [modalSource, setModalSource] = useState<SyncTarget | null>(null);
  const [modalSkills, setModalSkills] = useState<WorkspaceSkill[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentSyncTarget, setCurrentSyncTarget] = useState<SyncTarget | null>(null);
  const [modalFilter, setModalFilter] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<UpdateManifest | null>(null);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);

  useEffect(() => {
    bootstrapApp()
      .then((payload) => {
        setTargets(payload.targets);
        setLogs(payload.logs ?? []);
        setSkills(payload.skills ?? []);
        setSelectedSkillId(payload.skills[0]?.meta.id ?? null);
      })
      .catch((error) => {
        appendLog("error", `初始化失败：${String(error)}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  useEffect(() => {
    checkForUpdate()
      .then((result) => {
        if (result.shouldUpdate && result.manifest) {
          setAvailableUpdate(result.manifest);
          appendLog("info", `发现新版本 ${result.manifest.version}，等待安装。`);
        }
      })
      .catch((error) => {
        appendLog("warning", `检查更新失败：${String(error)}`);
      });
  }, [checkForUpdate]);

  const selectedSkill = skills.find((skill) => skill.meta.id === selectedSkillId) ?? null;

  function appendLog(level: SyncLogEntry["level"], message: string) {
    setLogs((current) => [{ timestamp: new Date().toISOString(), level, message }, ...current].slice(0, 100));
  }

  async function handleInstallUpdate() {
    if (!availableUpdate || isInstallingUpdate) {
      return;
    }

    setIsInstallingUpdate(true);
    appendLog("info", `正在安装版本 ${availableUpdate.version}。`);
    try {
      await installUpdate();
    } catch (error) {
      appendLog("error", `自动更新失败：${String(error)}`);
      setIsInstallingUpdate(false);
    }
  }

  async function handleImportFolder() {
    try {
      const selectedPath = await pickSkillImportPath();
      if (!selectedPath) {
        return;
      }

      const result = await importSkillPath(selectedPath);
      if (result.imported.length > 0) {
        setSkills((current) => mergeSkills(current, result.imported));
        setSelectedSkillId(result.imported[0]?.meta.id ?? null);
      }
      appendLog(
        result.imported.length > 0 ? "info" : "warning",
        result.imported.length > 0
          ? `已从本地路径导入 ${result.imported.length} 个技能。`
          : "所选文件夹中没有找到有效的 SKILL.md。"
      );
    } catch (error) {
      appendLog("error", `导入失败：${String(error)}`);
    }
  }

  async function openSourceSyncModal(source: SyncTarget, target: SyncTarget) {
    setModalMode("sync");
    setModalSource(source);
    setModalTarget(target);
    setModalSkills([]);
    setSelectedIds([]);
    setModalFilter("");
    setConflict(null);
    setIsPreparing(true);

    try {
      const result = source === "codex" ? await importCodexSkills() : await importClaudeSkills();
      setModalSkills(result.imported);
      setSelectedIds([]);
      appendLog(
        "info",
        `已读取 ${source === "codex" ? "Codex" : "Claude"} 当前已有技能 ${result.imported.length} 个。`
      );
    } catch (error) {
      appendLog("error", `读取 ${source === "codex" ? "Codex" : "Claude"} 技能失败：${String(error)}`);
    } finally {
      setIsPreparing(false);
    }
  }

  async function openDeleteModal(target: SyncTarget) {
    setModalMode("delete");
    setModalSource(null);
    setModalTarget(target);
    setModalSkills([]);
    setSelectedIds([]);
    setModalFilter("");
    setConflict(null);
    setIsPreparing(true);

    try {
      const result = await listTargetSkills(target);
      setModalSkills(result.imported);
      appendLog("info", `已读取 ${target === "codex" ? "Codex" : "Claude"} 当前已有技能 ${result.imported.length} 个。`);
    } catch (error) {
      appendLog("error", `读取 ${target === "codex" ? "Codex" : "Claude"} 技能失败：${String(error)}`);
    } finally {
      setIsPreparing(false);
    }
  }

  function closeModal(force = false) {
    if (isSyncing && !force) {
      return;
    }
    setModalSource(null);
    setModalTarget(null);
    setModalMode(null);
    setModalSkills([]);
    setSelectedIds([]);
    setModalFilter("");
    setIsPreparing(false);
  }

  function toggleSkill(skillId: string) {
    setSelectedIds((current) =>
      current.includes(skillId) ? current.filter((id) => id !== skillId) : [...current, skillId]
    );
  }

  function selectAllSkills() {
    setSelectedIds((current) => {
      const merged = new Set(current);
      filteredModalSkills.forEach((skill) => merged.add(skill.meta.id));
      return [...merged];
    });
  }

  function clearSelectedSkills() {
    const filteredIds = new Set(filteredModalSkills.map((skill) => skill.meta.id));
    setSelectedIds((current) => current.filter((id) => !filteredIds.has(id)));
  }

  const filteredModalSkills = modalSkills.filter((skill) => {
    const keyword = modalFilter.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return (
      (skill.meta.name || "").toLowerCase().includes(keyword) ||
      skill.meta.id.toLowerCase().includes(keyword)
    );
  });

  async function handleConfirmSync() {
    if (!modalTarget || !modalSource || selectedIds.length === 0) {
      return;
    }

    setIsSyncing(true);
    setConflict(null);

    try {
      for (const skillId of selectedIds) {
        const sourceSkill = modalSkills.find((skill) => skill.meta.id === skillId);
        const result = await syncWorkspaceSkill(skillId, modalTarget, false);
        if (sourceSkill) {
          setSkills((current) => {
            const syncedAt = new Date().toISOString();
            const next = mergeSkills(current, [
              {
                ...sourceSkill,
                lastSyncResult: result.status,
                lastSyncAt: syncedAt,
                syncStatusByTarget: [
                  ...(sourceSkill.syncStatusByTarget ?? []).filter((entry) => entry.target !== modalTarget),
                  {
                    target: modalTarget,
                    lastSyncAt: syncedAt,
                    lastSyncResult: result.status
                  }
                ]
              }
            ]);
            return next;
          });
        }

        if (result.status === "conflict") {
          setConflict({
            skillId,
            target: modalTarget,
            message: result.message,
            targetPath: result.targetPath,
            backupPath: result.backupPath
          });
        }

        appendLog(
          result.status === "conflict" ? "warning" : result.status === "failed" ? "error" : "info",
          `从 ${modalSource === "codex" ? "Codex" : "Claude"} 同步到 ${
            modalTarget === "codex" ? "Codex" : "Claude"
          }：${result.message}`
        );
      }

      closeModal(true);
    } catch (error) {
      appendLog("error", `同步失败：${String(error)}`);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleConfirmDelete() {
    if (!modalTarget || selectedIds.length === 0) {
      return;
    }

    setIsSyncing(true);

    try {
      await deleteTargetSkills(modalTarget, selectedIds);
      appendLog(
        "info",
        `已从 ${modalTarget === "codex" ? "Codex" : "Claude"} 删除 ${selectedIds.length} 个技能。`
      );
      closeModal(true);
    } catch (error) {
      appendLog("error", `删除技能失败：${String(error)}`);
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSyncSelectedSkill(target: SyncTarget) {
    if (!selectedSkill) {
      return;
    }

    setCurrentSyncTarget(target);
    setConflict(null);

    try {
      const result = await syncWorkspaceSkill(selectedSkill.meta.id, target, false);
      const syncedAt = new Date().toISOString();

      setSkills((current) =>
        current.map((item) =>
          item.meta.id === selectedSkill.meta.id
            ? {
                ...item,
                lastSyncResult: result.status,
                lastSyncAt: syncedAt,
                syncStatusByTarget: [
                  ...(item.syncStatusByTarget ?? []).filter((entry) => entry.target !== target),
                  {
                    target,
                    lastSyncAt: syncedAt,
                    lastSyncResult: result.status
                  }
                ]
              }
            : item
        )
      );

      if (result.status === "conflict") {
        setConflict({
          skillId: selectedSkill.meta.id,
          target,
          message: result.message,
          targetPath: result.targetPath,
          backupPath: result.backupPath
        });
      }

      appendLog(
        result.status === "conflict" ? "warning" : result.status === "failed" ? "error" : "info",
        `导入技能 ${selectedSkill.meta.name || selectedSkill.meta.id} 同步到 ${
          target === "codex" ? "Codex" : "Claude"
        }：${result.message}`
      );
    } catch (error) {
      appendLog("error", `同步当前技能失败：${String(error)}`);
    } finally {
      setCurrentSyncTarget(null);
    }
  }

  async function handleOverwriteConflict() {
    if (!conflict) {
      return;
    }

    try {
      const result = await syncWorkspaceSkill(conflict.skillId, conflict.target, true);
      const syncedAt = new Date().toISOString();
      setSkills((current) =>
        current.map((item) =>
          item.meta.id === conflict.skillId
            ? {
                ...item,
                lastSyncResult: result.status,
                lastSyncAt: syncedAt,
                syncStatusByTarget: [
                  ...(item.syncStatusByTarget ?? []).filter((entry) => entry.target !== conflict.target),
                  {
                    target: conflict.target,
                    lastSyncAt: syncedAt,
                    lastSyncResult: result.status
                  }
                ]
              }
            : item
        )
      );
      appendLog("info", `覆盖同步：${result.message}`);
      setConflict(null);
    } catch (error) {
      appendLog("error", `覆盖同步失败：${String(error)}`);
    }
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <h1>技能同步工具</h1>
          <p className="hero-subtitle">先导入本次会话要用的技能，再同步到 Codex 或 Claude。</p>
        </div>
      </header>
      {availableUpdate ? (
        <section className="update-banner" aria-live="polite">
          <div>
            <strong>发现新版本 {availableUpdate.version}</strong>
            <span>{availableUpdate.body || "新版本已可以安装。"}</span>
          </div>
          <div className="update-actions">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setAvailableUpdate(null)}
              disabled={isInstallingUpdate}
            >
              稍后
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleInstallUpdate}
              disabled={isInstallingUpdate}
            >
              {isInstallingUpdate ? "正在更新..." : "立即更新并重启"}
            </button>
          </div>
        </section>
      ) : null}
      {isLoading ? (
        <section className="panel loading-panel">正在初始化同步工具...</section>
      ) : (
        <>
          <div className="workspace-grid">
            <SkillList
              skills={skills}
              selectedSkillId={selectedSkillId}
              onSelect={setSelectedSkillId}
              onImportFolder={handleImportFolder}
              onSyncToCodex={() => openSourceSyncModal("claude", "codex")}
              onSyncToClaude={() => openSourceSyncModal("codex", "claude")}
              onDeleteCodex={() => openDeleteModal("codex")}
              onDeleteClaude={() => openDeleteModal("claude")}
            />
            <SyncPanel
              selectedSkill={selectedSkill}
              importedCount={skills.length}
              targets={targets}
              conflict={conflict}
              isSyncingSelectedSkill={currentSyncTarget !== null}
              currentSyncTarget={currentSyncTarget}
              onSyncSelectedSkill={handleSyncSelectedSkill}
              onOverwriteSync={handleOverwriteConflict}
              onDismissConflict={() => setConflict(null)}
            />
          </div>
          <ActivityLog logs={logs} />
        </>
      )}
      {modalTarget && modalMode ? (
        <div className="modal-backdrop" role="presentation" onClick={() => closeModal()}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={
              modalMode === "sync"
                ? `选择要从 ${modalSource === "codex" ? "Codex" : "Claude"} 同步到 ${
                    modalTarget === "codex" ? "Codex" : "Claude"
                  } 的技能`
                : `选择要从 ${modalTarget === "codex" ? "Codex" : "Claude"} 删除的技能`
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header modal-header">
              <div>
                {modalMode === "sync" ? (
                  <>
                    <h2>
                      选择要从 {modalSource === "codex" ? "Codex" : "Claude"} 同步到{" "}
                      {modalTarget === "codex" ? "Codex" : "Claude"} 的技能
                    </h2>
                    <p className="panel-desc">这里加载的是来源平台当前已有的技能，可多选后确认同步。</p>
                  </>
                ) : (
                  <>
                    <h2>选择要从 {modalTarget === "codex" ? "Codex" : "Claude"} 删除的技能</h2>
                    <p className="panel-desc">这里加载的是目标平台当前已有的技能，可多选后确认删除。</p>
                  </>
                )}
              </div>
              <button type="button" className="ghost-button" onClick={() => closeModal()} disabled={isSyncing}>
                关闭
              </button>
            </div>
            {isPreparing ? (
              <div className="empty-sync-state">正在读取来源技能...</div>
            ) : (
              <div className="modal-content">
                <div className="modal-toolbar">
                  <input
                    type="text"
                    className="modal-filter-input"
                    value={modalFilter}
                    onChange={(event) => setModalFilter(event.target.value)}
                    placeholder="筛选技能名称或 ID"
                    disabled={isSyncing}
                  />
                  <button type="button" className="ghost-button" onClick={selectAllSkills} disabled={isSyncing}>
                    全选
                  </button>
                  <button type="button" className="ghost-button" onClick={clearSelectedSkills} disabled={isSyncing}>
                    取消全选
                  </button>
                  <span className="selection-count">已选 {selectedIds.length} 个</span>
                </div>
                <div className="modal-skill-list">
                  {modalSkills.length === 0 ? (
                    <div className="empty-sync-state">当前来源没有读取到可同步技能。</div>
                  ) : filteredModalSkills.length === 0 ? (
                    <div className="empty-sync-state">没有匹配当前筛选条件的技能。</div>
                  ) : (
                    filteredModalSkills.map((skill) => {
                      const checked = selectedIds.includes(skill.meta.id);
                      return (
                        <label key={skill.meta.id} className="modal-skill-item">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSkill(skill.meta.id)}
                            disabled={isSyncing}
                          />
                          <div className="modal-skill-copy">
                            <strong>{skill.meta.name || skill.meta.id}</strong>
                            <span>{skill.meta.id}</span>
                            <span className="modal-skill-path">{skill.sourcePath || "未记录绝对路径"}</span>
                          </div>
                          {skill.lastSyncResult ? (
                            <span className="tag target-status-tag">{skill.lastSyncResult}</span>
                          ) : null}
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={modalMode === "sync" ? handleConfirmSync : handleConfirmDelete}
                    disabled={selectedIds.length === 0 || isSyncing}
                  >
                    {isSyncing ? (modalMode === "sync" ? "同步中..." : "删除中...") : modalMode === "sync" ? "确认同步" : "确认删除"}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}

function mergeSkills(current: WorkspaceSkill[], imported: WorkspaceSkill[]) {
  const map = new Map(current.map((item) => [item.meta.id, item]));
  imported.forEach((item) => {
    map.set(item.meta.id, item);
  });
  return [...map.values()];
}
