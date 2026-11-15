# Создаёт ярлык «Дневник» на рабочем столе и в меню «Пуск».
# Ярлык открывает дневник в Edge как отдельное окно-приложение во весь экран,
# с отдельным профилем (данные не пропадут при очистке истории в обычном браузере).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$index = Join-Path $root 'index.html'

$edge = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge не найден' }

$dataDir = Join-Path $env:LOCALAPPDATA 'PaperDiary'
$profileDir = Join-Path $dataDir 'EdgeProfile'
New-Item -ItemType Directory -Force $profileDir | Out-Null

# file:///C:/.../index.html с экранированием пробелов и не-ASCII
$url = ([System.Uri]$index).AbsoluteUri

# Иконка: тетрадь в клетку
$icon = Join-Path $dataDir 'diary.ico'
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 64, 64
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.Clear([System.Drawing.Color]::Transparent)
$paper = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(251, 250, 244))
$g.FillRectangle($paper, 8, 4, 50, 56)
$gridPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(160, 150, 175, 215)), 1
for ($i = 12; $i -lt 58; $i += 6) { $g.DrawLine($gridPen, $i, 4, $i, 60); }
for ($i = 8; $i -lt 60; $i += 6) { $g.DrawLine($gridPen, 8, $i, 58, $i); }
$rule = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(63, 81, 163)), 3
$g.DrawRectangle($rule, 8, 4, 50, 56)
$g.DrawLine($rule, 8, 20, 58, 20); $g.DrawLine($rule, 8, 36, 58, 36); $g.DrawLine($rule, 8, 52, 58, 52)
$g.DrawLine($rule, 33, 4, 33, 52)
$g.Dispose()
$hIcon = $bmp.GetHicon()
$ico = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = [System.IO.File]::Create($icon); $ico.Save($fs); $fs.Close()

$edgeArgs = "--app=`"$url`" --start-fullscreen --user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check --disable-features=msEdgeSidebarV2"
$name = -join [char[]](0x0414, 0x043D, 0x0435, 0x0432, 0x043D, 0x0438, 0x043A)  # «Дневник»

$shell = New-Object -ComObject WScript.Shell
$targets = @(
  @{ Path = Join-Path ([Environment]::GetFolderPath('Desktop')) "$name.lnk"; Hotkey = 'Ctrl+Alt+D' },
  @{ Path = Join-Path ([Environment]::GetFolderPath('Programs')) "$name.lnk"; Hotkey = '' }
)
foreach ($t in $targets) {
  $lnk = $shell.CreateShortcut($t.Path)
  $lnk.TargetPath = $edge
  $lnk.Arguments = $edgeArgs
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = 'Личный дневник'
  if ($t.Hotkey) { $lnk.Hotkey = $t.Hotkey }
  $lnk.Save()
  Write-Host "Ярлык: $($t.Path)"
}
Write-Host ''
Write-Host 'Готово. Открыть дневник: ярлык на рабочем столе, «Пуск» или Ctrl+Alt+D.'
