# Beendet NUR diese Claude-Code-Sitzung (und ihr Terminal-Fenster bzw. ihren Tab), nach einer kurzen Pause,
# damit die Abschlussmeldung noch sichtbar ist. Andere Claude-Fenster und der Claude-Daemon bleiben unberührt.
# Aufruf: powershell -NoProfile -ExecutionPolicy Bypass -File fenster-schliessen.ps1 [-Delay 15] [-DryRun]
param([int]$Delay = 15, [switch]$DryRun)

function Get-Proc($id) { Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue }

# Vom eigenen Prozess nach oben bis zur Claude-Sitzung laufen
$p = Get-Proc $PID
$session = $null
while ($p) {
  if ($p.Name -eq 'claude.exe' -and $p.CommandLine -notmatch 'daemon run|--bg-pty-host') { $session = $p; break }
  $p = Get-Proc $p.ParentProcessId
}
if (-not $session) { Write-Output "Keine Claude-Sitzung gefunden - nichts beendet."; exit 1 }

$targets = @($session.ProcessId)
$parent = Get-Proc $session.ParentProcessId
if ($parent) {
  if ($parent.Name -eq 'claude.exe' -and $parent.CommandLine -match '--bg-pty-host') {
    # Hintergrund-Sitzung: der PTY-Host gehört nur zu dieser Sitzung
    $targets += $parent.ProcessId
  } elseif ($parent.Name -match '^(powershell|pwsh|cmd|bash)\.exe$') {
    # Normales Terminal: die Shell, in der claude gestartet wurde, schliesst den Tab/das Fenster
    $targets += $parent.ProcessId
  }
}

if ($DryRun) { Write-Output ("Wuerde beenden: " + ($targets -join ', ')); exit 0 }

$ids = $targets -join ','
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile', '-Command',
  "Start-Sleep $Delay; Stop-Process -Id $ids -Force -ErrorAction SilentlyContinue"
Write-Output "Fenster schliesst in $Delay Sekunden."
