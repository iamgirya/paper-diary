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

# Иконка лежит в репозитории (перерисовать: python tools/make_icon.py icon)
$icon = Join-Path $root 'icon.ico'

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
