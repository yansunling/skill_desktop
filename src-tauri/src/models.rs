use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub sync_targets: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSkill {
    pub meta: SkillMeta,
    pub content: String,
    pub updated_at: Option<String>,
    pub last_sync_at: Option<String>,
    pub last_sync_result: Option<String>,
    #[serde(default)]
    pub sync_status_by_target: Vec<TargetSyncState>,
    pub source: Option<String>,
    #[serde(default)]
    pub source_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetSyncState {
    pub target: String,
    pub last_sync_at: Option<String>,
    pub last_sync_result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryState {
    pub skills: Vec<RegistrySkillState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySkillState {
    pub id: String,
    #[serde(default)]
    pub targets: Vec<TargetSyncState>,
    #[serde(default)]
    pub last_sync_at: Option<String>,
    #[serde(default)]
    pub last_sync_result: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDraft {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub sync_to_codex: bool,
    pub sync_to_claude: bool,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncLogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncTargetStatus {
    pub target: String,
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppBootstrap {
    pub project_root: String,
    pub workspace_root: String,
    pub skills: Vec<WorkspaceSkill>,
    pub logs: Vec<SyncLogEntry>,
    pub targets: Vec<SyncTargetStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub skill_id: String,
    pub target: String,
    pub status: String,
    pub message: String,
    pub target_path: Option<String>,
    pub backup_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub imported: Vec<WorkspaceSkill>,
    pub skipped: Vec<String>,
}
