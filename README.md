# 技能管理器 (codex-skill-manager)

这是一个基于 Tauri 的桌面应用，用于管理和同步技能到 Codex / Claude。仓库包含前端 React + Tauri 后端（Rust）。

自动更新支持
----------------
项目已集成 Tauri Updater 支持，配置文件在 `src-tauri/tauri.conf.json`，默认指向 GitHub Releases 的 `latest.json`：

- 请确保你在发布 Release 时包含 `latest.json`（工作流已经在 `.github/workflows/release.yml` 中自动生成并上传）。

证书编码与 Secrets
---------------------
仓库内提供了用于将证书转为 Base64 的脚本，方便把证书内容安全地存为 GitHub Actions Secrets：

- `scripts/encode_cert.sh` — Linux/macOS
- `scripts/encode_cert.ps1` — Windows PowerShell
- `scripts/README.md` — 使用示例和 gh CLI 上传命令

把证书转 Base64 后，按 workflow 需要将其保存为下列 Secrets：

- `WINDOWS_SIGNING_PFX`
- `WINDOWS_SIGNING_PASSWORD`
- `MAC_SIGNING_P12`
- `MAC_SIGNING_P12_PASSWORD`
- `MAC_KEYCHAIN_PASSWORD`
- `APPLE_ID`
- `APPLE_PASSWORD`

如何触发 Release（快速演示）
--------------------------------
在本地创建并推送 tag 能触发 CI：

```bash
# 创建签名 tag
git tag v0.1.0
git push origin v0.1.0
```

这会触发 `.github/workflows/release.yml`，构建并上传平台安装包与 `latest.json`。
