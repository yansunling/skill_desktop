#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod sync;
mod workspace;

use models::{AppBootstrap, ImportResult, SkillDraft, SyncResult, WorkspaceSkill};

#[tauri::command]
fn bootstrap_app() -> Result<AppBootstrap, String> {
    workspace::bootstrap().map_err(|error| error.to_string())
}

#[tauri::command]
fn save_skill(draft: SkillDraft) -> Result<WorkspaceSkill, String> {
    workspace::save_skill(draft).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_skill(
    skill_id: String,
    remove_codex_copy: bool,
    remove_claude_copy: bool,
) -> Result<(), String> {
    workspace::delete_skill(&skill_id, remove_codex_copy, remove_claude_copy)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn import_skill_path(import_path: String) -> Result<ImportResult, String> {
    workspace::import_skill_path(&import_path).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_codex_skills() -> Result<ImportResult, String> {
    workspace::import_codex_skills().map_err(|error| error.to_string())
}

#[tauri::command]
fn import_claude_skills() -> Result<ImportResult, String> {
    workspace::import_claude_skills().map_err(|error| error.to_string())
}

#[tauri::command]
fn list_target_skills(target: String) -> Result<ImportResult, String> {
    workspace::list_target_skills(&target).map_err(|error| error.to_string())
}

#[tauri::command]
fn delete_target_skills(target: String, skill_ids: Vec<String>) -> Result<(), String> {
    workspace::delete_target_skills(&target, &skill_ids).map_err(|error| error.to_string())
}

#[tauri::command]
fn sync_skill(skill_id: String, target: String, overwrite: bool) -> Result<SyncResult, String> {
    sync::sync_skill(&skill_id, &target, overwrite).map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bootstrap_app,
            save_skill,
            delete_skill,
            import_skill_path,
            import_codex_skills,
            import_claude_skills,
            list_target_skills,
            delete_target_skills,
            sync_skill
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
