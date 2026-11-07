# ==============================================================================
# STUDY FLOW ORGANIZER - GITHUB AUTOMATION & SYNC DASHBOARD
# ==============================================================================

$repoDir = Split-Path $PSScriptRoot -Parent
if (-not $repoDir) { $repoDir = $PSScriptRoot }
Set-Location $repoDir

$dataDir = Join-Path $repoDir "data"
$dataFile = Join-Path $dataDir "study_flow_data.json"
$personalFile = Join-Path $dataDir "study_flow_data.personal.json"

function Get-RemoteUrl {
    $remote = git remote get-url origin 2>$null
    if (-not $remote) { $remote = git remote get-url fork 2>$null }
    if (-not $remote) { return "origin not configured" }
    return $remote
}

function Show-Header {
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "             STUDY FLOW ORGANIZER - GITHUB SYNC DASHBOARD            " -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host " Repository: $(Get-RemoteUrl)" -ForegroundColor Gray
    Write-Host " Location  : $repoDir" -ForegroundColor Gray
    
    # Check subjects in data/study_flow_data.json
    if (Test-Path $dataFile) {
        try {
            $data = Get-Content $dataFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $subjCount = ($data.subjects).Count
            $itemsCount = ($data.items).Count
            $foldersCount = ($data.materials).Count
            Write-Host " Local Data: $subjCount Subjects | $itemsCount Tasks & Events | $foldersCount Folders" -ForegroundColor Green
        } catch {
            Write-Host " Local Data: study_flow_data.json present" -ForegroundColor Gray
        }
    }
    
    # Check git status
    $branch = (git branch --show-current 2>$null)
    if (!$branch) { $branch = "main" }
    Write-Host " Git Branch: $branch" -ForegroundColor Magenta
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Push-ToGitHub {
    param([string]$CommitMessage)

    Write-Host "`n[1/3] Staging changes..." -ForegroundColor Yellow
    git add -A

    $status = git status --porcelain
    if (-not $status) {
        Write-Host "No changes to commit. Everything is up to date!" -ForegroundColor Green
        Read-Host -Prompt "Press Enter to return to menu"
        return
    }

    Write-Host "[2/3] Creating commit: '$CommitMessage'..." -ForegroundColor Yellow
    git commit -m "$CommitMessage"

    $branch = (git branch --show-current 2>$null)
    if (!$branch) { $branch = "main" }

    Write-Host "[3/3] Pushing to origin $branch..." -ForegroundColor Yellow
    $pushResult = git push origin $branch 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nSUCCESS: Successfully pushed to GitHub!" -ForegroundColor Green
        Write-Host "Repository remote: $(Get-RemoteUrl)" -ForegroundColor Cyan
    } else {
        Write-Host "`nPush encountered an issue:" -ForegroundColor Red
        Write-Host $pushResult -ForegroundColor DarkRed
    }

    Write-Host ""
    Read-Host -Prompt "Press Enter to return to menu"
}

function Push-RawTemplate {
    Write-Host "`nPreparing clean public raw planner template..." -ForegroundColor Yellow
    
    # Backup current data first
    if (Test-Path $dataFile) {
        try {
            $existing = Get-Content $dataFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($existing.subjects -and $existing.subjects.Count -gt 0) {
                Copy-Item -Path $dataFile -Destination $personalFile -Force
                Write-Host "Backed up personal subjects to: data/study_flow_data.personal.json" -ForegroundColor Green
            }
        } catch {}
    }

    $templateFile = Join-Path $dataDir "study_flow_data.template.json"
    if (Test-Path $templateFile) {
        Copy-Item -Path $templateFile -Destination $dataFile -Force
    }

    Write-Host "data/study_flow_data.json reset to raw starter template (0 subjects)." -ForegroundColor Green
    Push-ToGitHub -CommitMessage "Release clean raw planner template for repository"
}

# Main Loop
while ($true) {
    Show-Header
    Write-Host "Select an action:" -ForegroundColor White
    Write-Host " [1] " -NoNewline -ForegroundColor Yellow; Write-Host "Quick Push (Auto-commit with date & time)"
    Write-Host " [2] " -NoNewline -ForegroundColor Yellow; Write-Host "Push with Custom Commit Message"
    Write-Host " [3] " -NoNewline -ForegroundColor Yellow; Write-Host "Push Raw Public Planner Template (Clean starter template)"
    Write-Host " [4] " -NoNewline -ForegroundColor Green; Write-Host "Restore Personal Subjects into active data"
    Write-Host " [5] " -NoNewline -ForegroundColor Yellow; Write-Host "View Git Status & Pending Changes"
    Write-Host " [6] " -NoNewline -ForegroundColor Cyan; Write-Host "Pull Latest Changes from GitHub"
    Write-Host " [7] " -NoNewline -ForegroundColor Red; Write-Host "Exit"
    Write-Host ""
    $choice = Read-Host -Prompt "Enter option [1-7]"

    switch ($choice) {
        "1" {
            $msg = "Update study flow: " + (Get-Date).ToString("yyyy-MM-dd HH:mm")
            Push-ToGitHub -CommitMessage $msg
        }
        "2" {
            $customMsg = Read-Host -Prompt "Enter commit message"
            if ($customMsg -and $customMsg.Trim()) {
                Push-ToGitHub -CommitMessage $customMsg.Trim()
            } else {
                Write-Host "Commit message cannot be empty." -ForegroundColor Red
                Start-Sleep -Seconds 1
            }
        }
        "3" {
            Push-RawTemplate
        }
        "4" {
            if (Test-Path $personalFile) {
                Copy-Item -Path $personalFile -Destination $dataFile -Force
                Write-Host "`nSUCCESS: Restored personal subjects from data/study_flow_data.personal.json into data/study_flow_data.json!" -ForegroundColor Green
            } else {
                Write-Host "`nNo personal file found at data/study_flow_data.personal.json" -ForegroundColor Yellow
            }
            Start-Sleep -Seconds 2
        }
        "5" {
            Write-Host "`n--- Git Status ---" -ForegroundColor Cyan
            git status
            Write-Host "`n"
            Read-Host -Prompt "Press Enter to return"
        }
        "6" {
            $pullScript = Join-Path $PSScriptRoot "pull_github.ps1"
            if (Test-Path $pullScript) {
                & $pullScript
            }
        }
        "7" {
            Write-Host "Exiting. Goodbye!" -ForegroundColor Green
            exit 0
        }
        default {
            Write-Host "Invalid option. Please enter 1 to 7." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
