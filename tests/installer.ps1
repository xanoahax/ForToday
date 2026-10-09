$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -Raw -LiteralPath (Join-Path $projectRoot 'package.json') | ConvertFrom-Json).version
$installer = Join-Path $projectRoot "release/ForToday-$version-Setup.exe"
$runKey = 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Run'
$approvedKey = 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Explorer/StartupApproved/Run'
$uninstallRoot = 'HKCU:/Software/Microsoft/Windows/CurrentVersion/Uninstall'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'ForToday.lnk'
$startLink = Join-Path $env:APPDATA 'Microsoft/Windows/Start Menu/Programs/ForToday.lnk'
if (Get-ItemProperty -LiteralPath $runKey -Name ForToday -ErrorAction SilentlyContinue) { throw 'Existing autostart entry; refusing to alter it.' }
if (Get-ItemProperty -LiteralPath $approvedKey -Name ForToday -ErrorAction SilentlyContinue) { throw 'Existing StartupApproved entry; refusing to alter it.' }
if ((Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $startLink)) { throw 'Existing ForToday shortcut; refusing to overwrite it.' }
if (Get-ChildItem -LiteralPath $uninstallRoot | Get-ItemProperty | Where-Object { $_.DisplayName -like 'ForToday*' }) { throw 'Existing installation; use a clean Windows account for this test.' }
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('fortoday-install-test-' + [guid]::NewGuid().ToString())
$installDir = Join-Path $testRoot 'App With Spaces'
$profileDir = Join-Path $testRoot 'test-profile'
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
$resolvedRoot = [IO.Path]::GetFullPath($testRoot)
if (-not $resolvedRoot.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Test path is outside TEMP.' }
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
$savedProfile = $env:FORTODAY_DATA_DIR
$savedExecutable = $env:FORTODAY_TEST_EXE
$installed = $false
try {
  $env:FORTODAY_DATA_DIR = $profileDir
  # NSIS consumes the rest of the command line after /D=, including spaces.
  $process = Start-Process -FilePath $installer -ArgumentList "/S /currentuser /D=$installDir" -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer failed: $($process.ExitCode)" }
  $installed = $true
  $exe = Join-Path $installDir 'ForToday.exe'
  if (-not (Test-Path -LiteralPath $exe)) { throw 'Installed executable missing.' }
  if (-not (Test-Path -LiteralPath $desktopLink)) { throw 'Desktop shortcut missing.' }
  if (-not (Test-Path -LiteralPath $startLink)) { throw 'Start menu shortcut missing.' }
  $registration = Get-ChildItem -LiteralPath $uninstallRoot | Get-ItemProperty | Where-Object { $_.DisplayName -like 'ForToday*' }
  if (-not $registration) { throw 'Windows uninstall registration missing.' }
  $env:FORTODAY_TEST_EXE = $exe
  & node (Join-Path $PSScriptRoot 'native-startup.cjs')
  if ($LASTEXITCODE -ne 0) { throw 'Installed app smoke test failed.' }
  # Seed this installation's exact verified command to test the uninstaller hook.
  New-ItemProperty -LiteralPath $runKey -Name ForToday -PropertyType String -Value ('"' + $exe + '" --autostart') -Force | Out-Null
  $uninstaller = Join-Path $installDir 'Uninstall ForToday.exe'
  $process = Start-Process -FilePath $uninstaller -ArgumentList '/S /currentuser' -WindowStyle Hidden -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Uninstaller failed: $($process.ExitCode)" }
  for ($attempt = 0; $attempt -lt 40 -and (Test-Path -LiteralPath $exe); $attempt++) { Start-Sleep -Milliseconds 250 }
  if (Test-Path -LiteralPath $exe) { throw 'Installed executable was not removed.' }
  if (Get-ItemProperty -LiteralPath $runKey -Name ForToday -ErrorAction SilentlyContinue) { throw 'Autostart entry was not removed.' }
  if ((Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $startLink)) { throw 'Shortcuts were not removed.' }
  if (Get-ChildItem -LiteralPath $uninstallRoot | Get-ItemProperty | Where-Object { $_.DisplayName -like 'ForToday*' }) { throw 'Windows uninstall entry remains.' }
  $installed = $false
  Write-Output 'PASS: installer, paths with spaces, desktop/start shortcuts, installed app/autostart, uninstaller and startup cleanup.'
} finally {
  $env:FORTODAY_DATA_DIR = $savedProfile
  $env:FORTODAY_TEST_EXE = $savedExecutable
  if ($installed) {
    Write-Warning "Test installation retained for inspection: $installDir"
  } else {
    # The fully resolved generated path was checked against TEMP above.
    Remove-Item -LiteralPath $resolvedRoot -Recurse -Force
  }
}
