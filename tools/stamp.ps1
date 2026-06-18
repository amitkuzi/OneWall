# OneWall — build-stamp helper
#
# Run this BEFORE `git commit` to bump the version label inside
# index.html and capture the same stamp for the commit message.
#
# Usage:
#   $stamp = & .\tools\stamp.ps1
#   git add index.html
#   git commit -m "fix: blah [$stamp]"
#
# The stamp format is `v0.1·MMDD-HHMMSS` — the leading v-version is
# the product version, the trailing block is the wall-clock time so
# every commit produces a uniquely-tagged build.

$ErrorActionPreference = 'Stop'

# Product version (bump manually for real releases)
$base = 'v0.1'

# Build stamp = month-day - hour-minute-second
$stamp = "$base·" + (Get-Date -Format 'MMdd-HHmmss')

# Repo root = parent of /tools
$repoRoot = Split-Path -Parent $PSScriptRoot
$html     = Join-Path $repoRoot 'index.html'

if (-not (Test-Path $html)) {
    Write-Error "index.html not found at $html"
    exit 1
}

# Replace BOTH occurrences:
#   1. <span class="ver">…</span>   (header chip)
#   2. "OneWall · …"                (About modal footer)
$content = Get-Content $html -Raw
$content = $content -replace '<span class="ver">[^<]+</span>',     "<span class=`"ver`">$stamp</span>"
$content = $content -replace 'OneWall · v0\.1[^<\s]*',             "OneWall · $stamp"
Set-Content -Path $html -Value $content -NoNewline -Encoding utf8

# Emit the stamp so the caller can splice it into the commit message
$stamp
