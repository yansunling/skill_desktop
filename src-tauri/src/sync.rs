use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;

use crate::models::SyncResult;
use crate::workspace::{
    append_log, load_skills, update_registry_sync_state, user_home_dir, workspace_root, WorkspaceError,
};

fn target_root(target: &str) -> Result<PathBuf, WorkspaceError> {
    let home = user_home_dir()?;
    Ok(match target {
        "claude" => home.join(".claude").join("skills"),
        _ => home.join(".codex").join("skills"),
    })
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

fn backup_dir_recursive(source: &Path, target: &Path) -> Result<(), WorkspaceError> {
    if !source.exists() {
        return Ok(());
    }
    copy_dir_recursive(source, target)
}

pub fn sync_skill(skill_id: &str, target: &str, overwrite: bool) -> Result<SyncResult, WorkspaceError> {
    let skills = load_skills()?;
    let skill = skills
        .into_iter()
        .find(|item| item.meta.id == skill_id)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未找到技能"))?;

    let target_root = target_root(target)?;
    fs::create_dir_all(&target_root)?;

    let workspace_skill_dir = workspace_root().join("skills").join(&skill.meta.id);
    let target_dir = target_root.join(&skill.meta.id);
    let target_markdown = target_dir.join("SKILL.md");
    let target_meta = target_dir.join("meta.json");

    if target_markdown.exists() && !overwrite {
        let current = fs::read_to_string(&target_markdown)?;
        if current != skill.content {
            let message = format!("{} 在 {} 目录中检测到内容冲突", skill.meta.id, target);
            append_log("warning", &message)?;
            update_registry_sync_state(&skill.meta.id, target, "conflict", None)?;
            return Ok(SyncResult {
                skill_id: skill.meta.id,
                target: target.to_string(),
                status: "conflict".into(),
                message,
                target_path: Some(target_markdown.to_string_lossy().to_string()),
                backup_path: None,
            });
        }
    }

    let mut backup_path = None;
    if target_dir.exists() {
        let backup_dir = workspace_root()
            .join("backups")
            .join(format!("{}-{}-{}", skill.meta.id, target, Utc::now().format("%Y%m%d%H%M%S")));
        backup_dir_recursive(&target_dir, &backup_dir)?;
        backup_path = Some(backup_dir.to_string_lossy().to_string());
    }

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)?;
    }
    copy_dir_recursive(&workspace_skill_dir, &target_dir)?;

    let meta = serde_json::json!({
        "id": skill.meta.id,
        "name": skill.meta.name,
        "description": skill.meta.description,
        "enabled": skill.meta.enabled,
        "syncTargets": skill.meta.sync_targets
    });
    fs::write(&target_meta, serde_json::to_string_pretty(&meta)?)?;

    let message = format!("已将 {} 同步到 {}", skill.meta.id, target);
    append_log("info", &message)?;
    update_registry_sync_state(&skill.meta.id, target, "synced", Some(Utc::now().to_rfc3339()))?;

    Ok(SyncResult {
        skill_id: skill.meta.id,
        target: target.to_string(),
        status: "synced".into(),
        message,
        target_path: Some(target_markdown.to_string_lossy().to_string()),
        backup_path,
    })
}
