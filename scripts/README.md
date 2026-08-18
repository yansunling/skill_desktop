证书编码脚本

包含脚本：

- `encode_cert.sh` — POSIX shell 脚本，生成单行 base64 输出（适用于 Linux/macOS）。
- `encode_cert.ps1` — PowerShell 脚本，适用于 Windows PowerShell / PowerShell Core。

用法示例

Linux / macOS:
```bash
./scripts/encode_cert.sh path/to/cert.pfx cert.pfx.b64
cat cert.pfx.b64
```

Windows PowerShell:
```powershell
.\scripts\encode_cert.ps1 -CertPath C:\path\to\cert.pfx -OutPath cert.pfx.b64
Get-Content cert.pfx.b64 -Raw
```

把 Base64 字符串添加到 GitHub Secrets（示例使用 `gh`）：

```bash
# 登录 gh CLI
gh auth login

# 把文件内容作为 secret（替换 OWNER/REPO）
gh secret set WINDOWS_SIGNING_PFX --body "$(cat cert.pfx.b64)" --repo yansunling/skill_desktop
gh secret set WINDOWS_SIGNING_PASSWORD --body "your-pfx-password" --repo yansunling/skill_desktop
```

注意事项

- 不要把原始证书文件提交到仓库；只把 Base64 内容存为 secret。    
- 在 Windows 上复制粘贴时确保没有换行或空格被意外插入。
- 对于 Apple 签名，推荐使用 API key（更适合自动化），若使用 P12，同样可用上述方法编码并存为 secrets。
