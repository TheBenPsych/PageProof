@echo off
rem ---------------------------------------------------------------------------------------
rem  Update PageProof (Windows). Double-click this file to install or update PageProof.
rem  It downloads PageProof.zip from the "Latest build" page on GitHub and puts it into
rem  Documents\PageProof\Install (your own Documents folder, whoever you are signed in as).
rem  Your saved work is not in Install, so it is not touched. Then press Reload on
rem  PageProof's card in chrome://extensions or edge://extensions.
rem  It only uses tools that come with Windows (PowerShell, robocopy). The PowerShell part
rem  is below the ###POWERSHELL### line, so you can read exactly what it does.
rem ---------------------------------------------------------------------------------------
title PageProof update
set "PP_SELF=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$t = [IO.File]::ReadAllText($env:PP_SELF); & ([scriptblock]::Create($t.Substring($t.LastIndexOf('###POWERSHELL###'))))"
echo.
pause
exit /b

###POWERSHELL###
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # makes the download much faster in Windows PowerShell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$url = 'https://github.com/TheBenPsych/PageProof/releases/download/latest/PageProof.zip'
$docs = [Environment]::GetFolderPath('MyDocuments')   # also right when Documents is on OneDrive
$install = Join-Path $docs 'PageProof\Install'
$tmp = Join-Path $env:TEMP ('PageProof-update-' + [guid]::NewGuid().ToString('N').Substring(0, 8))

function Version-Of($folder) {
  $m = Join-Path $folder 'manifest.json'
  if (Test-Path -LiteralPath $m) { try { return (Get-Content -LiteralPath $m -Raw | ConvertFrom-Json) } catch { } }
  return $null
}

try {
  Write-Host ''
  Write-Host '  PageProof update' -ForegroundColor Cyan
  Write-Host '  ----------------'
  $old = Version-Of $install
  if ($old -and $old.name -ne 'PageProof') {
    throw "$install holds something that is not PageProof, so nothing was changed."
  }
  if (-not $old -and (Test-Path -LiteralPath $install) -and (Get-ChildItem -LiteralPath $install -Force | Select-Object -First 1)) {
    throw "$install has files in it but no PageProof, so nothing was changed. Empty it or check the folder."
  }
  Write-Host ('  Now installed:  ' + $(if ($old) { $old.version } else { 'nothing yet' }))

  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'PageProof.zip'
  Write-Host '  Downloading the newest version...'
  $new = Join-Path $tmp 'new'
  $got = $false
  # 1) The "Latest build" page. Tried 3 times, because GitHub sometimes hiccups for a moment.
  foreach ($try in 1..3) {
    try {
      Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
      Expand-Archive -LiteralPath $zip -DestinationPath $new -Force
      $got = $true; break
    } catch {
      $why = $_.Exception.Message
      if ($try -lt 3) { Start-Sleep -Seconds (3 * $try) }
    }
  }
  # 2) If that page is missing (for example while a new version is being published, or a
  #    publish failed), take the newest numbered version (v4.55.0 ...) straight from the code.
  if (-not $got) {
    Write-Host ('  The Latest build page did not answer (' + $why + ').') -ForegroundColor Yellow
    Write-Host '  Getting the newest numbered version instead...'
    $tags = Invoke-RestMethod -Uri 'https://api.github.com/repos/TheBenPsych/PageProof/tags?per_page=100' -UseBasicParsing
    $best = $tags | Where-Object { $_.name -match '^v\d+\.\d+\.\d+$' } |
      Sort-Object { [version]$_.name.Substring(1) } -Descending | Select-Object -First 1
    if (-not $best) { throw "No download found ($why)." }
    $src = Join-Path $tmp 'src'
    Invoke-WebRequest -Uri ('https://github.com/TheBenPsych/PageProof/archive/refs/tags/' + $best.name + '.zip') -OutFile $zip -UseBasicParsing
    Expand-Archive -LiteralPath $zip -DestinationPath $src -Force
    $ext = Get-ChildItem -LiteralPath $src -Directory | ForEach-Object { Join-Path $_.FullName 'extension' } |
      Where-Object { Test-Path -LiteralPath (Join-Path $_ 'manifest.json') } | Select-Object -First 1
    if (-not $ext) { throw 'The download does not look like PageProof, so nothing was changed.' }
    Move-Item -LiteralPath $ext -Destination $new
  }
  $nv = Version-Of $new
  if (-not $nv -or $nv.name -ne 'PageProof') { throw 'The download does not look like PageProof, so nothing was changed.' }
  Write-Host ('  Newest version: ' + $nv.version)

  if ($old -and $old.version -eq $nv.version) {
    Write-Host ''
    Write-Host '  You already have the newest version. Nothing to do.' -ForegroundColor Green
  } else {
    New-Item -ItemType Directory -Path $install -Force | Out-Null
    # Make Install an exact copy of the new version (old program files that are gone are removed).
    robocopy $new $install /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying into $install failed (robocopy code $LASTEXITCODE). Is the folder open in another program?" }
    Write-Host ''
    Write-Host ('  Done: PageProof ' + $nv.version + ' is in ' + $install) -ForegroundColor Green
    Write-Host ''
    if ($old) {
      Write-Host '  Last step: in Chrome or Edge, open the extensions page (chrome://extensions or'
      Write-Host '  edge://extensions) and press the round arrow (Reload) on PageProof''s card.'
    } else {
      Write-Host '  First time only: in Chrome or Edge, open chrome://extensions (or edge://extensions),'
      Write-Host '  turn on Developer mode, click Load unpacked and choose this folder:'
      Write-Host ('  ' + $install)
      Write-Host '  (If PageProof was loaded from another folder before, this takes its place.)'
      Write-Host '  After that, updating is just: double-click this file, then press Reload.'
    }
  }
} catch {
  Write-Host ''
  Write-Host ('  Update stopped: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host '  Your PageProof was not changed. You can still update by hand from:'
  Write-Host '  https://github.com/TheBenPsych/PageProof/releases/tag/latest'
} finally {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Host ''
