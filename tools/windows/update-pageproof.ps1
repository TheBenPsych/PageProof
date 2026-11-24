# Updates PageProof to the newest version: downloads PageProof.zip from the "Latest build"
# page on GitHub and puts it into Documents\PageProof\Install. Your saved work (copies found,
# settings, site lists) lives in the browser and in Documents\PageProof, not in Install, so it
# is not touched. Run it by double-clicking "Update PageProof.cmd" next to this file.
# It only uses tools that come with Windows. It changes nothing outside the Install folder
# (and a temporary folder that it deletes again).
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
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  $new = Join-Path $tmp 'new'
  Expand-Archive -LiteralPath $zip -DestinationPath $new
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
    Write-Host '  Last step: in Chrome or Edge, open the extensions page (chrome://extensions or'
    Write-Host '  edge://extensions) and press the round arrow (Reload) on PageProof''s card.'
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
