use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use serde_json::{json, Value};
use thiserror::Error;

use crate::models::{
    AppBootstrap, ImportResult, RegistrySkillState, RegistryState, SkillDraft, SkillMeta,
    SyncLogEntry, SyncTargetStatus, TargetSyncState, WorkspaceSkill,
};

const EMPTY_SKILL_TEMPLATE: &str = "---\nname: new-skill\ndescription: 请填写这个技能的用途\n---\n\n# 新技能\n\n请在这里编写技能说明。\n";

fn render_skill_markdown(name: &str, description: &str, body: &str) -> String {
    let trimmed_body = if body.trim().is_empty() {
        "# 新技能\n\n请在这里编写技能说明。".to_string()
    } else {
        strip_frontmatter(body)
    };

    format!(
        "---\nname: {}\ndescription: {}\n---\n\n{}\n",
        name,
        description,
        trimmed_body.trim()
    )
}

fn strip_frontmatter(content: &str) -> String {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return content.to_string();
    }

    let mut lines = trimmed.lines();
    let Some(first_line) = lines.next() else {
        return String::new();
    };

    if first_line.trim() != "---" {
        return content.to_string();
    }

    let mut found_end = false;
    let mut remaining = Vec::new();
    for line in lines {
        if !found_end && line.trim() == "---" {
            found_end = true;
            continue;
        }

        if found_end {
            remaining.push(line);
        }
    }

    if found_end {
        remaining.join("\n")
    } else {
        content.to_string()
    }
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<(), WorkspaceError> {
    fs::create_dir_all(target)?;

    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let path = entry.path();
        let target_path = target.join(entry.file_name());

        if entry.file_type()?.is_dir() {
            copy_dir_recursive(&path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&path, &target_path)?;
        }
    }

    Ok(())
}

fn replace_dir_contents(source: &Path, target: &Path) -> Result<(), WorkspaceError> {
    if target.exists() {
        fs::remove_dir_all(target)?;
    }
    copy_dir_recursive(source, target)
}

#[derive(Debug, Error)]
pub enum WorkspaceError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("无法获取当前用户目录")]
    HomeDirUnavailable,
}

pub fn project_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .expect("project root should be resolvable")
}

pub fn workspace_root() -> PathBuf {
    project_root().join("workspace")
}

pub fn user_home_dir() -> Result<PathBuf, WorkspaceError> {
    dirs::home_dir().ok_or(WorkspaceError::HomeDirUnavailable)
}

pub fn ensure_workspace() -> Result<(), WorkspaceError> {
    let workspace = workspace_root();
    fs::create_dir_all(workspace.join("skills"))?;
    fs::create_dir_all(workspace.join("backups"))?;
    fs::create_dir_all(workspace.join("sync-state"))?;

    let registry = workspace.join("sync-state").join("registry.json");
    let activity = workspace.join("sync-state").join("activity.log");

    if !registry.exists() {
        fs::write(&registry, "{\n  \"skills\": []\n}\n")?;
    }

    if !activity.exists() {
        fs::write(&activity, "")?;
    }

    Ok(())
}

pub fn reset_session_files() -> Result<(), WorkspaceError> {
    let workspace = workspace_root();
    let skills_dir = workspace.join("skills");
    if skills_dir.exists() {
        for entry in fs::read_dir(&skills_dir)? {
            let entry = entry?;
            let path = entry.path();
            if entry.file_type()?.is_dir() {
                fs::remove_dir_all(path)?;
            } else {
                fs::remove_file(path)?;
            }
        }
    }

    fs::write(workspace.join("sync-state").join("activity.log"), "")?;
    fs::write(workspace.join("sync-state").join("registry.json"), "{\n  \"skills\": []\n}\n")?;
    Ok(())
}

pub fn target_statuses() -> Vec<SyncTargetStatus> {
    let Ok(home) = user_home_dir() else {
        return vec![
            SyncTargetStatus {
                target: "codex".into(),
                path: "无法获取当前用户目录".into(),
                exists: false,
            },
            SyncTargetStatus {
                target: "claude".into(),
                path: "无法获取当前用户目录".into(),
                exists: false,
            },
        ];
    };
    let codex_path = home.join(".codex").join("skills");
    let claude_path = home.join(".claude").join("skills");

    vec![
        SyncTargetStatus {
            target: "codex".into(),
            path: codex_path.to_string_lossy().to_string(),
            exists: codex_path.exists(),
        },
        SyncTargetStatus {
            target: "claude".into(),
            path: claude_path.to_string_lossy().to_string(),
            exists: claude_path.exists(),
        },
    ]
}

fn codex_import_roots() -> Vec<PathBuf> {
    let Ok(home) = user_home_dir() else {
        return Vec::new();
    };
    vec![
        home.join(".codex").join("skills"),
        home.join(".agents").join("skills"),
        home.join(".codex").join("superpowers").join("skills"),
    ]
}

fn target_root(target: &str) -> Result<PathBuf, WorkspaceError> {
    let home = user_home_dir()?;
    Ok(match target {
        "claude" => home.join(".claude").join("skills"),
        _ => home.join(".codex").join("skills"),
    })
}

pub fn load_skills() -> Result<Vec<WorkspaceSkill>, WorkspaceError> {
    let skills_dir = workspace_root().join("skills");
    if !skills_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();
    let registry = load_registry()?;

    for entry in fs::read_dir(skills_dir)? {
        let entry = entry?;
        if !entry.file_type()?.is_dir() {
            continue;
        }

        let skill_dir = entry.path();
        let meta_path = skill_dir.join("meta.json");
        let markdown_path = skill_dir.join("SKILL.md");

        if !markdown_path.exists() {
            continue;
        }

        let content = fs::read_to_string(&markdown_path)?;
        let meta_value = if meta_path.exists() {
            serde_json::from_str::<Value>(&fs::read_to_string(&meta_path)?)?
        } else {
            json!({})
        };

        let id = meta_value
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_else(|| {
                skill_dir
                    .file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or("skill")
            })
            .to_string();

        let registry_entry = registry.skills.iter().find(|item| item.id == id);
        let sync_status_by_target = registry_entry
            .map(|item| item.targets.clone())
            .unwrap_or_default();
        let last_sync_state = sync_status_by_target
            .iter()
            .filter(|item| item.last_sync_at.is_some())
            .max_by(|left, right| left.last_sync_at.cmp(&right.last_sync_at));

        skills.push(WorkspaceSkill {
            meta: SkillMeta {
                id,
                name: meta_value
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("未命名技能")
                    .to_string(),
                description: meta_value
                    .get("description")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                sync_targets: meta_value
                    .get("syncTargets")
                    .and_then(Value::as_array)
                    .map(|items| {
                        items
                            .iter()
                            .filter_map(Value::as_str)
                            .map(ToString::to_string)
                            .collect::<Vec<String>>()
                    })
                    .unwrap_or_default(),
                enabled: meta_value.get("enabled").and_then(Value::as_bool).unwrap_or(true),
            },
            content,
            updated_at: None,
            last_sync_at: last_sync_state.and_then(|item| item.last_sync_at.clone()),
            last_sync_result: last_sync_state.and_then(|item| item.last_sync_result.clone()),
            sync_status_by_target,
            source: Some("workspace".into()),
            source_path: Some(skill_dir.to_string_lossy().to_string()),
        });
    }

    skills.sort_by(|left, right| left.meta.name.cmp(&right.meta.name));
    Ok(skills)
}

pub fn registry_path() -> PathBuf {
    workspace_root().join("sync-state").join("registry.json")
}

pub fn load_registry() -> Result<RegistryState, WorkspaceError> {
    let path = registry_path();
    if !path.exists() {
        return Ok(RegistryState { skills: Vec::new() });
    }

    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str::<RegistryState>(&content).unwrap_or(RegistryState {
        skills: Vec::new(),
    }))
}

pub fn save_registry(state: &RegistryState) -> Result<(), WorkspaceError> {
    fs::write(registry_path(), serde_json::to_string_pretty(state)?)?;
    Ok(())
}

pub fn update_registry_sync_state(
    skill_id: &str,
    target: &str,
    status: &str,
    synced_at: Option<String>,
) -> Result<(), WorkspaceError> {
    let mut registry = load_registry()?;
    if let Some(entry) = registry.skills.iter_mut().find(|item| item.id == skill_id) {
        if let Some(target_entry) = entry.targets.iter_mut().find(|item| item.target == target) {
            target_entry.last_sync_at = synced_at.clone();
            target_entry.last_sync_result = Some(status.to_string());
        } else {
            entry.targets.push(TargetSyncState {
                target: target.to_string(),
                last_sync_at: synced_at.clone(),
                last_sync_result: Some(status.to_string()),
            });
        }
        entry.last_sync_at = synced_at;
        entry.last_sync_result = Some(status.to_string());
    } else {
        registry.skills.push(RegistrySkillState {
            id: skill_id.to_string(),
            targets: vec![TargetSyncState {
                target: target.to_string(),
                last_sync_at: synced_at.clone(),
                last_sync_result: Some(status.to_string()),
            }],
            last_sync_at: synced_at,
            last_sync_result: Some(status.to_string()),
        });
    }

    save_registry(&registry)
}

pub fn delete_skill(
    skill_id: &str,
    remove_codex_copy: bool,
    remove_claude_copy: bool,
) -> Result<(), WorkspaceError> {
    ensure_workspace()?;

    let skill_dir = workspace_root().join("skills").join(skill_id);
    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)?;
    }

    if remove_codex_copy {
        let codex_dir = target_root("codex")?.join(skill_id);
        if codex_dir.exists() {
            fs::remove_dir_all(&codex_dir)?;
        }
    }

    if remove_claude_copy {
        let claude_dir = target_root("claude")?.join(skill_id);
        if claude_dir.exists() {
            fs::remove_dir_all(&claude_dir)?;
        }
    }

    let mut registry = load_registry()?;
    registry.skills.retain(|item| item.id != skill_id);
    save_registry(&registry)?;

    append_log(
        "info",
        &format!(
            "已删除工作区技能 {}（remove_codex_copy={}，remove_claude_copy={}）",
            skill_id, remove_codex_copy, remove_claude_copy
        ),
    )?;
    Ok(())
}

pub fn load_logs() -> Result<Vec<SyncLogEntry>, WorkspaceError> {
    let log_path = workspace_root().join("sync-state").join("activity.log");
    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(log_path)?;
    Ok(content
        .lines()
        .rev()
        .filter_map(|line| serde_json::from_str::<SyncLogEntry>(line).ok())
        .take(100)
        .collect())
}

pub fn append_log(level: &str, message: &str) -> Result<(), WorkspaceError> {
    let entry = SyncLogEntry {
        timestamp: Utc::now().to_rfc3339(),
        level: level.to_string(),
        message: message.to_string(),
    };

    let log_path = workspace_root().join("sync-state").join("activity.log");
    let existing = fs::read_to_string(&log_path).unwrap_or_default();
    let serialized = format!("{}\n", serde_json::to_string(&entry)?);
    fs::write(log_path, format!("{}{}", serialized, existing))?;
    Ok(())
}

pub fn save_skill(draft: SkillDraft) -> Result<WorkspaceSkill, WorkspaceError> {
    ensure_workspace()?;
    let registry = load_registry()?;

    let skill_dir = workspace_root().join("skills").join(&draft.id);
    fs::create_dir_all(&skill_dir)?;
    let markdown_path = skill_dir.join("SKILL.md");
    let meta_path = skill_dir.join("meta.json");

    let sync_targets = [
        draft.sync_to_codex.then_some("codex".to_string()),
        draft.sync_to_claude.then_some("claude".to_string()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<String>>();

    let meta = json!({
        "id": draft.id,
        "name": draft.name,
        "description": draft.description,
        "enabled": draft.enabled,
        "syncTargets": sync_targets
    });

    let content = if draft.content.trim().is_empty() {
        render_skill_markdown(&draft.name, &draft.description, EMPTY_SKILL_TEMPLATE)
    } else {
        render_skill_markdown(&draft.name, &draft.description, &draft.content)
    };

    fs::write(markdown_path, &content)?;
    fs::write(meta_path, serde_json::to_string_pretty(&meta)?)?;

    let saved = WorkspaceSkill {
        meta: SkillMeta {
            id: meta["id"].as_str().unwrap_or_default().to_string(),
            name: meta["name"].as_str().unwrap_or_default().to_string(),
            description: meta["description"].as_str().unwrap_or_default().to_string(),
            sync_targets: meta["syncTargets"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .map(ToString::to_string)
                .collect(),
            enabled: meta["enabled"].as_bool().unwrap_or(true),
        },
        content,
        updated_at: Some(Utc::now().to_rfc3339()),
        last_sync_at: registry
            .skills
            .iter()
            .find(|item| item.id == meta["id"].as_str().unwrap_or_default())
            .and_then(|item| item.last_sync_at.clone()),
        last_sync_result: registry
            .skills
            .iter()
            .find(|item| item.id == meta["id"].as_str().unwrap_or_default())
            .and_then(|item| item.last_sync_result.clone()),
        sync_status_by_target: registry
            .skills
            .iter()
            .find(|item| item.id == meta["id"].as_str().unwrap_or_default())
            .map(|item| item.targets.clone())
            .unwrap_or_default(),
        source: Some("workspace".into()),
        source_path: Some(skill_dir.to_string_lossy().to_string()),
    };

    append_log("info", &format!("已保存工作区技能 {}", saved.meta.id))?;
    Ok(saved)
}

fn normalize_import_target(import_path: &Path) -> Option<(String, String)> {
    if import_path.is_file() {
        if import_path.file_name().and_then(|item| item.to_str()) == Some("SKILL.md") {
            let id = import_path
                .parent()
                .and_then(|item| item.file_name())
                .and_then(|item| item.to_str())
                .unwrap_or("imported-skill")
                .to_string();
            let content = fs::read_to_string(import_path).ok()?;
            return Some((id, content));
        }
        return None;
    }

    let markdown_path = import_path.join("SKILL.md");
    if !markdown_path.exists() {
        return None;
    }

    let id = import_path
        .file_name()
        .and_then(|item| item.to_str())
        .unwrap_or("imported-skill")
        .to_string();
    let content = fs::read_to_string(markdown_path).ok()?;
    Some((id, content))
}

fn collect_skill_import_paths(root: &Path) -> Result<Vec<PathBuf>, WorkspaceError> {
    let mut collected = Vec::new();

    if !root.exists() {
        return Ok(collected);
    }

    if root.is_file() {
        if root.file_name().and_then(|item| item.to_str()) == Some("SKILL.md") {
            collected.push(root.to_path_buf());
        }
        return Ok(collected);
    }

    let markdown_path = root.join("SKILL.md");
    if markdown_path.exists() {
        collected.push(root.to_path_buf());
        return Ok(collected);
    }

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        let nested = collect_skill_import_paths(&path)?;
        collected.extend(nested);
    }

    Ok(collected)
}

fn import_one_path(import_path: &Path, source: &str) -> Result<Option<WorkspaceSkill>, WorkspaceError> {
    let Some(skill) = load_skill_from_path(import_path, source)? else {
        return Ok(None);
    };

    let saved = if import_path.is_dir() {
        save_imported_skill_dir(import_path, &skill)?
    } else {
        let draft = SkillDraft {
            id: skill.meta.id.clone(),
            name: skill.meta.name.clone(),
            description: skill.meta.description.clone(),
            enabled: skill.meta.enabled,
            sync_to_codex: skill.meta.sync_targets.iter().any(|item| item == "codex"),
            sync_to_claude: skill.meta.sync_targets.iter().any(|item| item == "claude"),
            content: skill.content,
        };

        save_skill(draft)?
    };

    Ok(Some(WorkspaceSkill {
        source: Some(source.to_string()),
        source_path: skill.source_path,
        ..saved
    }))
}

fn save_imported_skill_dir(import_path: &Path, skill: &WorkspaceSkill) -> Result<WorkspaceSkill, WorkspaceError> {
    ensure_workspace()?;
    let registry = load_registry()?;

    let skill_dir = workspace_root().join("skills").join(&skill.meta.id);
    replace_dir_contents(import_path, &skill_dir)?;

    let meta_path = skill_dir.join("meta.json");
    let meta = json!({
        "id": skill.meta.id,
        "name": skill.meta.name,
        "description": skill.meta.description,
        "enabled": skill.meta.enabled,
        "syncTargets": skill.meta.sync_targets
    });
    fs::write(meta_path, serde_json::to_string_pretty(&meta)?)?;

    Ok(WorkspaceSkill {
        meta: skill.meta.clone(),
        content: fs::read_to_string(skill_dir.join("SKILL.md"))?,
        updated_at: Some(Utc::now().to_rfc3339()),
        last_sync_at: registry
            .skills
            .iter()
            .find(|item| item.id == skill.meta.id)
            .and_then(|item| item.last_sync_at.clone()),
        last_sync_result: registry
            .skills
            .iter()
            .find(|item| item.id == skill.meta.id)
            .and_then(|item| item.last_sync_result.clone()),
        sync_status_by_target: registry
            .skills
            .iter()
            .find(|item| item.id == skill.meta.id)
            .map(|item| item.targets.clone())
            .unwrap_or_default(),
        source: Some("workspace".into()),
        source_path: Some(skill_dir.to_string_lossy().to_string()),
    })
}

fn load_skill_from_path(import_path: &Path, source: &str) -> Result<Option<WorkspaceSkill>, WorkspaceError> {
    let Some((id, content)) = normalize_import_target(import_path) else {
        return Ok(None);
    };

    let draft = SkillDraft {
        id: id.clone(),
        name: id.replace('-', " "),
        description: format!("Imported from {}", source),
        enabled: true,
        sync_to_codex: true,
        sync_to_claude: false,
        content: content.clone(),
    };

    Ok(Some(WorkspaceSkill {
        meta: SkillMeta {
            id,
            name: draft.name,
            description: draft.description,
            sync_targets: vec!["codex".into()],
            enabled: true,
        },
        content,
        updated_at: None,
        last_sync_at: None,
        last_sync_result: None,
        sync_status_by_target: Vec::new(),
        source: Some(source.to_string()),
        source_path: Some(import_path.to_string_lossy().to_string()),
    }))
}

pub fn import_skill_path(import_path: &str) -> Result<ImportResult, WorkspaceError> {
    ensure_workspace()?;
    let path = PathBuf::from(import_path);
    let imported = match import_one_path(&path, "local-import")? {
        Some(skill) => vec![skill],
        None => Vec::new(),
    };
    let skipped = if imported.is_empty() {
        vec![import_path.to_string()]
    } else {
        Vec::new()
    };

    append_log("info", &format!("Imported {} local skill item(s)", imported.len()))?;
    Ok(ImportResult { imported, skipped })
}

pub fn import_codex_skills() -> Result<ImportResult, WorkspaceError> {
    ensure_workspace()?;
    let codex_roots = codex_import_roots();
    if codex_roots.iter().all(|root| !root.exists()) {
        append_log("warning", "Codex skills directory does not exist for import")?;
        return Ok(ImportResult {
            imported: Vec::new(),
            skipped: Vec::new(),
        });
    }

    let mut imported = Vec::new();
    let mut skipped = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    for root in codex_roots {
        for path in collect_skill_import_paths(&root)? {
            let canonical = fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
            if !seen_paths.insert(canonical) {
                continue;
            }

            match import_one_path(&path, "codex-import")? {
                Some(skill) => imported.push(skill),
                None => skipped.push(path.to_string_lossy().to_string()),
            }
        }
    }

    append_log("info", &format!("Imported {} Codex skill item(s)", imported.len()))?;
    Ok(ImportResult { imported, skipped })
}

pub fn import_claude_skills() -> Result<ImportResult, WorkspaceError> {
    ensure_workspace()?;
    let claude_root = target_root("claude")?;
    if !claude_root.exists() {
        append_log("warning", "Claude skills directory does not exist for import")?;
        return Ok(ImportResult {
            imported: Vec::new(),
            skipped: Vec::new(),
        });
    }

    let mut imported = Vec::new();
    let mut skipped = Vec::new();

    for path in collect_skill_import_paths(&claude_root)? {
        match import_one_path(&path, "claude-import")? {
            Some(skill) => imported.push(skill),
            None => skipped.push(path.to_string_lossy().to_string()),
        }
    }

    append_log("info", &format!("Imported {} Claude skill item(s)", imported.len()))?;
    Ok(ImportResult { imported, skipped })
}

pub fn list_target_skills(target: &str) -> Result<ImportResult, WorkspaceError> {
    ensure_workspace()?;

    let roots = match target {
        "claude" => vec![target_root("claude")?],
        _ => codex_import_roots(),
    };

    let mut imported = Vec::new();
    let mut skipped = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    for root in roots {
        for path in collect_skill_import_paths(&root)? {
            let canonical = fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
            if !seen_paths.insert(canonical) {
                continue;
            }

            let source = if target == "claude" {
                "claude-list"
            } else {
                "codex-list"
            };

            match load_skill_from_path(&path, source)? {
                Some(skill) => imported.push(skill),
                None => skipped.push(path.to_string_lossy().to_string()),
            }
        }
    }

    Ok(ImportResult { imported, skipped })
}

pub fn delete_target_skills(target: &str, skill_ids: &[String]) -> Result<(), WorkspaceError> {
    ensure_workspace()?;

    let roots = match target {
        "claude" => vec![target_root("claude")?],
        _ => codex_import_roots(),
    };

    let selected: std::collections::HashSet<&str> = skill_ids.iter().map(String::as_str).collect();

    for root in roots {
        for path in collect_skill_import_paths(&root)? {
            let Some((id, _)) = normalize_import_target(&path) else {
                continue;
            };

            if !selected.contains(id.as_str()) {
                continue;
            }

            let delete_dir = if path.is_file() {
                path.parent().map(Path::to_path_buf).unwrap_or(path.clone())
            } else {
                path.clone()
            };

            if delete_dir.exists() {
                fs::remove_dir_all(&delete_dir)?;
            }
        }
    }

    append_log(
        "info",
        &format!("已从 {} 删除 {} 个技能", target, skill_ids.len()),
    )?;

    Ok(())
}

pub fn bootstrap() -> Result<AppBootstrap, WorkspaceError> {
    ensure_workspace()?;
    reset_session_files()?;

    Ok(AppBootstrap {
        project_root: project_root().to_string_lossy().to_string(),
        workspace_root: workspace_root().to_string_lossy().to_string(),
        skills: Vec::new(),
        logs: Vec::new(),
        targets: target_statuses(),
    })
}
