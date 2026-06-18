# OneWall - build-stamp helper
#
# Run this BEFORE `git commit` to bump the version label inside
# index.html and capture the same stamp for the commit message.
#
# Usage:
#   $stamp = & .\tools\stamp.ps1
#   git add index.html
#   git commit -m "fix: blah [$stamp]"
#
# Format: v0.1-MMDD-HHMMSS
#   v-version is the product version (bump for real releases)
#   MMDD-HHMMSS is the wall-clock time, so every commit gets a
#   uniquely-tagged build the user can grep for in the page.

$ErrorActionPreference = 'Stop'

# Product version (bump manually for real releases)
$base  = 'v0.1'
$ts    = Get-Date -Format 'MMdd-HHmmss'
$stamp = "${base}-${ts}"

# Repo root = parent of /tools
$repoRoot = Split-Path -Parent $PSScriptRoot
$html     = Join-Path $repoRoot 'index.html'

if (-not (Test-Path $html)) {
    Write-Error "index.html not found at $html"
    exit 1
}

# Read + write as UTF-8 WITHOUT BOM via .NET to avoid PowerShell 5.1's
# default ANSI / UTF-8-with-BOM behaviour that mangles unicode chars
# (em-dashes, box-drawing, etc.).
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$content   = [System.IO.File]::ReadAllText($html, $utf8NoBom)

# Middle-dot built from its code-point so the script source can stay
# in safe-ASCII (avoids any future encoding surprises).
$middot = [char]0x00B7

$verPattern  = '<span class="ver">[^<]+</span>'
$verReplace  = "<span class=`"ver`">$stamp</span>"

# Match "OneWall ` v0.1[trailing]" where ` is the middle dot.
$footPattern = "OneWall $middot v0\.1[A-Za-z0-9\-]*"
$footReplace = "OneWall $middot $stamp"

$content = $content -replace $verPattern,  $verReplace
$content = $content -replace $footPattern, $footReplace

[System.IO.File]::WriteAllText($html, $content, $utf8NoBom)

# Emit the stamp so the caller can splice it into the commit message
$stamp
