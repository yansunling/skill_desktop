# 技能管理器 (codex-skill-manager)

这是一个基于 Tauri 的桌面应用，用于管理和同步技能到 Codex / Claude。仓库包含前端 React + Tauri 后端（Rust）。

## 自动更新

程序启动后自动检查 GitHub Releases。发现新版本时显示版本说明，用户确认后下载、校验签名、安装并重启。

更新地址配置在 `src-tauri/tauri.conf.json`。`.github/workflows/release.yml` 在推送版本标签后构建 Windows 安装包、签名 updater 产物并生成 `latest.json`。

首次发布前，在本地生成 Tauri updater 密钥：

```powershell
npx tauri signer generate -w $env:USERPROFILE\.tauri\skill-manager.key
```

然后：

1. 将命令输出的公钥写入 `src-tauri/tauri.conf.json` 的 `tauri.updater.pubkey`。
2. 将私钥文件完整内容保存为 GitHub Secret `TAURI_PRIVATE_KEY`。
3. 若生成密钥时设置了密码，将密码保存为 GitHub Secret `TAURI_KEY_PASSWORD`；无密码时无需创建。

私钥不可提交到仓库。当前配置中的公钥必须与 GitHub Secret 中的私钥配对，否则客户端会拒绝安装更新。

## 发布新版本

先同步修改以下三个版本号，且版本必须高于已安装版本：

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

提交后创建并推送同版本标签：

```bash
git tag v0.1.2
git push origin v0.1.2
```

工作流会创建 GitHub Release，并上传 MSI、updater 签名包及 `latest.json`。
