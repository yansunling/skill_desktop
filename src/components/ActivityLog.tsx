import type { SyncLogEntry } from "../types/sync";

interface ActivityLogProps {
  logs: SyncLogEntry[];
}

export function ActivityLog({ logs }: ActivityLogProps) {
  return (
    <section className="panel activity-panel">
      <div className="panel-header">
        <div>
          <h2>本次操作日志</h2>
          <p className="panel-desc">只记录当前打开窗口后的同步动作。</p>
        </div>
      </div>
      <div className="activity-list">
        {logs.length === 0 ? (
          <p className="muted">当前会话暂无操作日志。</p>
        ) : (
          logs.map((entry, index) => (
            <article key={`${entry.timestamp}-${index}`} className={`log-entry ${entry.level}`}>
              <div className="log-time">{entry.timestamp}</div>
              <div className="log-message">{entry.message}</div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
