# PostToolUse hook: PowerShell error detector -> append to notes/windows-ps76-issues.md
# Input: JSON via stdin (hook_event_name, tool_name, tool_input, tool_result)
# Anchor: <!-- ps76-pending-anchor --> marks the insert point in the notes file
# Note: uses LastIndexOf to avoid matching anchor strings inside code blocks

param()

$raw = $input | Out-String
if (-not $raw.Trim()) { exit 0 }

try {
    $data = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$event     = $data.hook_event_name
$command   = $data.tool_input.command
$exit_code = $data.tool_result.exit_code
$stderr    = $data.tool_result.stderr

# Specific error patterns (avoids false positives from substrings like "NativeCommandError")
$is_real_error_stderr = $stderr -match "Error:|Exception:|Cannot find|Access is denied|command not found|not recognized as"

# NativeCommandError with exit_code=0 and no real error content -> false positive, skip
$is_native_false_positive = ($stderr -match "NativeCommandError") -and
                             ($null -eq $exit_code -or $exit_code -eq 0) -and
                             (-not $is_real_error_stderr)
if ($is_native_false_positive) { exit 0 }

# Error detection
$is_error = ($event -eq "PostToolUseFailure") -or
            (($null -ne $exit_code) -and ($exit_code -ne 0)) -or
            $is_real_error_stderr
if (-not $is_error) { exit 0 }

# Build entry — null-safe command handling
$date        = Get-Date -Format "yyyy-MM-dd"
$safe_cmd    = if (-not $command) { "(null)" } else { $command }
$cmd_preview = if ($safe_cmd.Length -gt 60) { $safe_cmd.Substring(0, 60) + "..." } else { $safe_cmd }
$stderr_lines = @(($stderr -split "`n") | Where-Object { $_.Trim() })
$stderr_first = if ($stderr_lines.Count -gt 0) { $stderr_lines[0] } else { "(no stderr)" }
$exit_str    = if ($null -ne $exit_code) { $exit_code.ToString() } else { "N/A" }

$entry = "`n### [$date] PS auto-logged: $cmd_preview`n`n**symptom:** ``$safe_cmd`` -> ``$stderr_first```n**cause:** (auto-logged - unverified)`n**fix:** (unverified - manual investigation needed)`n**ref:** auto-logged by PostToolUse hook (exit_code=$exit_str)"

# Resolve project dir: env var with fallback to script location (.claude/hooks/ -> project root)
$project_dir = if ($env:CLAUDE_PROJECT_DIR) {
    $env:CLAUDE_PROJECT_DIR
} else {
    Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

$notes_path = Join-Path $project_dir "notes\windows-ps76-issues.md"
if (-not (Test-Path $notes_path)) { exit 0 }

$content = [System.IO.File]::ReadAllText($notes_path, [System.Text.Encoding]::UTF8)
$anchor  = "<!-- ps76-pending-anchor -->"

# LastIndexOf: avoids matching anchor strings inside code block examples
$anchor_idx = $content.LastIndexOf($anchor)
if ($anchor_idx -lt 0) { exit 0 }

$insert_pos  = $anchor_idx + $anchor.Length
$new_content = $content.Substring(0, $insert_pos) + $entry + $content.Substring($insert_pos)
[System.IO.File]::WriteAllText($notes_path, $new_content, [System.Text.Encoding]::UTF8)
