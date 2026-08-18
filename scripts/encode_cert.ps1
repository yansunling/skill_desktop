param(
  [Parameter(Mandatory=$true)][string]$CertPath,
  [Parameter(Mandatory=$false)][string]$OutPath = ''
)

if (-not (Test-Path $CertPath)) {
  Write-Error "Cert file not found: $CertPath"
  exit 2
}

$bytes = [System.IO.File]::ReadAllBytes($CertPath)
$b64 = [System.Convert]::ToBase64String($bytes)

if ([string]::IsNullOrEmpty($OutPath)) {
  Write-Output $b64
} else {
  Set-Content -Path $OutPath -Value $b64 -NoNewline -Encoding ASCII
  Write-Host "Wrote $OutPath"
}
