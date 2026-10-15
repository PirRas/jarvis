# Schliesst das Fenster (z. B. Git Bash) dieser Claude-Code-Sitzung und beendet die Sitzung, nach einer kurzen Pause,
# damit die Abschlussmeldung noch sichtbar ist. Andere Claude-Fenster und der Claude-Daemon bleiben unberührt.
# Aufruf: powershell -NoProfile -ExecutionPolicy Bypass -File fenster-schliessen.ps1 [-Delay 15] [-DryRun]
param([int]$Delay = 15, [switch]$DryRun)

function Get-Proc($id) { Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue }

# 1. Vom eigenen Prozess nach oben bis zur Claude-Sitzung laufen
$p = Get-Proc $PID
$session = $null
while ($p) {
  if ($p.Name -eq 'claude.exe' -and $p.CommandLine -notmatch 'daemon run|--bg-pty-host') { $session = $p; break }
  $p = Get-Proc $p.ParentProcessId
}
if (-not $session) { Write-Output "Keine Claude-Sitzung gefunden - nichts beendet."; exit 1 }

$targets = @($session.ProcessId)
$parent = Get-Proc $session.ParentProcessId
$background = $parent -and $parent.Name -eq 'claude.exe' -and $parent.CommandLine -match '--bg-pty-host'
if ($background) { $targets += $parent.ProcessId }  # PTY-Host gehört nur zu dieser Sitzung

# 2. Fenster finden
$windows = @()
if ($background) {
  # Hintergrund-Sitzung: Das Fenster zeigt sie nur an und hängt nicht in der Prozess-Kette.
  # Zuordnung über den Sitzungstitel, den Claude in den Fenstertitel schreibt.
  $sid = $null
  if ($session.CommandLine -match '--session-id\s+([0-9a-f-]{36})') { $sid = $Matches[1] }
  elseif ($session.CommandLine -match '([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl') { $sid = $Matches[1] }
  $title = $null
  if ($sid) {
    $log = Get-ChildItem "$env:USERPROFILE\.claude\projects\*\$sid.jsonl" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($log) {
      # Eigener Name (/rename) hat Vorrang vor dem automatischen Titel
      foreach ($key in 'customTitle', 'aiTitle') {
        $hit = Select-String -Path $log.FullName -Pattern ('"' + $key + '":"([^"]+)"') | Select-Object -Last 1
        if ($hit) { $title = $hit.Matches[0].Groups[1].Value; break }
      }
    }
  }
  if ($title) {
    $needle = $title.Substring(0, [Math]::Min(40, $title.Length))
    $windows = @(Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.Contains($needle) -and $_.ProcessName -match '^(mintty|powershell|pwsh|cmd|WindowsTerminal)$' })
  }
  if ($windows.Count -gt 1) { $windows = @() }  # nicht eindeutig: lieber kein Fenster schliessen
} elseif ($parent -and $parent.Name -match '^(powershell|pwsh|cmd|bash)\.exe$') {
  # Normales Terminal: claude läuft direkt in der Shell des Fensters
  $targets += $parent.ProcessId
}
$targets = @($windows | ForEach-Object { $_.Id }) + $targets  # Fenster zuerst, dann Sitzung

if ($DryRun) {
  Write-Output ("Fenster: " + ($(if ($windows) { ($windows | % { "$($_.Id) $($_.ProcessName) '$($_.MainWindowTitle.Trim())'" }) -join '; ' } else { 'keins gefunden' })))
  Write-Output ("Wuerde beenden: " + ($targets -join ', '))
  exit 0
}

$ids = $targets -join ','
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command',
  "Start-Sleep $Delay; Stop-Process -Id $ids -Force -ErrorAction SilentlyContinue"
if ($windows) { Write-Output "Fenster schliesst in $Delay Sekunden." }
else { Write-Output "Sitzung endet in $Delay Sekunden (Fenster nicht eindeutig gefunden - bitte selbst schliessen)." }
