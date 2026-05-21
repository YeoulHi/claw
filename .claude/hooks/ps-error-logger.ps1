# PostToolUse hook: PowerShell error detector -> append to notes/windows-ps76-issues.md
# Input: JSON via stdin (hook_event_name, tool_name, tool_input, tool_result)
# Anchor: <!-- ps76-pending-anchor --> marks the insert point in the notes file

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

# Build entry
$date        = Get-Date -Format "yyyy-MM-dd"
$cmd_preview = if ($command.Length -gt 60) { $command.Substring(0, 60) + "..." } else { $command }
$stderr_lines = ($stderr -split "`n") | Where-Object { $_.Trim() }
$stderr_first = if ($stderr_lines) { $stderr_lines[0] } else { "(no stderr)" }
$exit_str    = if ($null -ne $exit_code) { $exit_code.ToString() } else { "N/A" }

$entry = "### [$date] PS auto-logged: $cmd_preview`n`n**symptom:** ``$command`` -> ``$stderr_first```n**cause:** (auto-logged - unverified)`n**fix:** (unverified - manual investigation needed)`n**ref:** auto-logged by PostToolUse hook (exit_code=$exit_str)"

# Find notes file and insert before anchor
$notes_path = Join-Path $env:CLAUDE_PROJECT_DIR "notes\windows-ps76-issues.md"
if (-not (Test-Path $notes_path)) { exit 0 }

$content = [System.IO.File]::ReadAllText($notes_path, [System.Text.Encoding]::UTF8)
$anchor  = "<!-- ps76-pending-anchor -->"

if ($content -notmatch [regex]::Escape($anchor)) { exit 0 }

$new_content = $content -replace [regex]::Escape($anchor), "$entry`n`n$anchor"
[System.IO.File]::WriteAllText($notes_path, $new_content, [System.Text.Encoding]::UTF8)
