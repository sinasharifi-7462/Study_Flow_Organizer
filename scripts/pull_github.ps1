# ==============================================================================
# STUDY FLOW ORGANIZER - AUTOMATED GIT PULL & DATA PRESERVATION DASHBOARD
# ==============================================================================

$repoDir = Split-Path $PSScriptRoot -Parent
if (-not $repoDir) { $repoDir = $PSScriptRoot }
Set-Location $repoDir

$dataDir = Join-Path $repoDir "data"
$backupsDir = Join-Path $dataDir "backups"
if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null
}

$dataFile = Join-Path $dataDir "study_flow_data.json"
$userPreserveFile = Join-Path $dataDir "study_flow_data.user.json"
$personalFile = Join-Path $dataDir "study_flow_data.personal.json"

function Get-RemoteUrl {
    $remote = git remote get-url origin 2>$null
    if (-not $remote) { $remote = git remote get-url fork 2>$null }
    if (-not $remote) { return "origin not configured" }
    return $remote
}

function Get-BestUserDataFile {
    if (Test-Path $dataFile) {
        try {
            $obj = Get-Content $dataFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($obj.subjects -and $obj.subjects.Count -gt 0) {
                return $dataFile
            }
        } catch {}
    }
    if (Test-Path $personalFile) {
        try {
            $obj = Get-Content $personalFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($obj.subjects -and $obj.subjects.Count -gt 0) {
                return $personalFile
            }
        } catch {}
    }
    if (Test-Path $userPreserveFile) {
        try {
            $obj = Get-Content $userPreserveFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($obj.subjects -and $obj.subjects.Count -gt 0) {
                return $userPreserveFile
            }
        } catch {}
    }
    if (Test-Path $dataFile) { return $dataFile }
    return $null
}

function Show-Header {
    Clear-Host
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "         STUDY FLOW ORGANIZER - GIT PULL & DATA PRESERVATION         " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host " Repository: $(Get-RemoteUrl)" -ForegroundColor Gray
    Write-Host " Local Path: $repoDir" -ForegroundColor Gray
    
    $bestSrc = Get-BestUserDataFile
    $activeCount = 0
    $subjNames = @()
    if ($bestSrc -and (Test-Path $bestSrc)) {
        try {
            $currentObj = Get-Content $bestSrc -Raw -Encoding UTF8 | ConvertFrom-Json
            $activeCount = ($currentObj.subjects).Count
            if ($activeCount -gt 0) {
                $subjNames = ($currentObj.subjects | ForEach-Object { $_.code -replace '\s+.*','' })
            }
            $displayNames = if ($subjNames.Count -gt 0) { " (" + ($subjNames -join ", ") + ")" } else { "" }
            Write-Host " Protected Data: $activeCount Subjects$displayNames" -ForegroundColor Green
        } catch {}
    } else {
        Write-Host " Active Data   : Clean starter template" -ForegroundColor Gray
    }
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Backup-UserData {
    $timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
    $backupFile = Join-Path $backupsDir "study_flow_data_backup_$timestamp.json"

    $srcToSave = Get-BestUserDataFile

    if ($srcToSave -and (Test-Path $srcToSave)) {
        Copy-Item -Path $srcToSave -Destination $backupFile -Force
        Copy-Item -Path $srcToSave -Destination $userPreserveFile -Force
        Write-Host "[1/4] Safe Snapshot: Backed up user data to data/backups/" -ForegroundColor Green
        return $backupFile
    }
    return $null
}

function Execute-SafePull {
    Write-Host "`nInitiating Safe Pull with Zero Data Loss Protection..." -ForegroundColor Cyan

    $backupPath = Backup-UserData

    $savedSubjects = @()
    $savedItems = @()
    $savedMaterials = @()
    $savedUser = "student"

    $sourceForPreserve = Get-BestUserDataFile
    if ($sourceForPreserve -and (Test-Path $sourceForPreserve)) {
        try {
            $parsed = Get-Content $sourceForPreserve -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($parsed.subjects) { $savedSubjects = $parsed.subjects }
            if ($parsed.items) { $savedItems = $parsed.items }
            if ($parsed.materials) { $savedMaterials = $parsed.materials }
            if ($parsed.user.username) { $savedUser = $parsed.user.username }
        } catch {}
    }

    Write-Host "[2/4] Checking working tree..." -ForegroundColor Yellow
    $diffStatus = git status --porcelain

    if ($diffStatus) {
        $null = git stash save "Auto-stash before pull $(Get-Date)" 2>&1
    }

    $currentBranch = (git branch --show-current 2>$null)
    if (!$currentBranch) { $currentBranch = "main" }

    Write-Host "[3/4] Pulling updates from origin $currentBranch..." -ForegroundColor Yellow
    $pullOutput = git pull origin $currentBranch 2>&1 | Out-String

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nWarning: Git pull reported an error:" -ForegroundColor Red
        Write-Host $pullOutput -ForegroundColor DarkRed
        Read-Host -Prompt "Press Enter to return"
        return
    }

    Write-Host $pullOutput -ForegroundColor Gray

    Write-Host "[4/4] Merging previous subjects and schedule..." -ForegroundColor Green
    
    if (Test-Path $dataFile) {
        try {
            $remoteData = Get-Content $dataFile -Raw -Encoding UTF8 | ConvertFrom-Json

            if ($savedSubjects.Count -gt 0) {
                $remoteData.subjects = $savedSubjects
                $remoteData.items = $savedItems
                $remoteData.materials = $savedMaterials
                if ($savedUser -and $savedUser -ne "student") {
                    $remoteData.user.username = $savedUser
                }
                $remoteData.metadata.lastSaved = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

                $remoteData | ConvertTo-Json -Depth 6 | Set-Content $dataFile -Encoding UTF8
                Write-Host "`nSUCCESS: Restored $($savedSubjects.Count) subjects, $($savedItems.Count) items, and $($savedMaterials.Count) folders!" -ForegroundColor Green
            } else {
                Write-Host "`nSUCCESS: Clean pull completed (Repository data is up to date)." -ForegroundColor Green
            }
        } catch {
            if ($sourceForPreserve -and (Test-Path $sourceForPreserve)) {
                Copy-Item -Path $sourceForPreserve -Destination $dataFile -Force
            }
        }
    }

    if ($diffStatus) {
        $null = git stash pop 2>&1
    }

    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host "                PULL & MERGE COMPLETED SUCCESSFULLY!                  " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Cyan
    
    $latestCommit = git log -1 --pretty=format:"Latest Commit: %h - %s (%an, %ar)"
    Write-Host $latestCommit -ForegroundColor Magenta
    if ($backupPath) {
        Write-Host "Safety Backup: $backupPath" -ForegroundColor DarkGray
    }
    Write-Host "======================================================================" -ForegroundColor Cyan
    Write-Host ""
    Read-Host -Prompt "Press Enter to return to menu"
}

# Menu
while ($true) {
    Show-Header
    Write-Host "Select an action:" -ForegroundColor White
    Write-Host " [1] " -NoNewline -ForegroundColor Green; Write-Host "Safe Pull (Pull latest contributions & PRESERVE all your data)"
    Write-Host " [2] " -NoNewline -ForegroundColor Yellow; Write-Host "View Recent Contributions / Git Log"
    Write-Host " [3] " -NoNewline -ForegroundColor Yellow; Write-Host "Create Manual Data Backup Snapshot"
    Write-Host " [4] " -NoNewline -ForegroundColor Yellow; Write-Host "Restore Previous Backup Snapshot"
    Write-Host " [5] " -NoNewline -ForegroundColor Green; Write-Host "Restore Personal Subjects into active data"
    Write-Host " [6] " -NoNewline -ForegroundColor Red; Write-Host "Exit"
    Write-Host ""
    $choice = Read-Host -Prompt "Enter option [1-6]"

    switch ($choice) {
        "1" { Execute-SafePull }
        "2" {
            Write-Host "`n--- Recent Repository Commits ---" -ForegroundColor Cyan
            git log -5 --graph --pretty=format:"%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset" --abbrev-commit
            Write-Host "`n"
            Read-Host -Prompt "Press Enter to return"
        }
        "3" {
            $bk = Backup-UserData
            Write-Host "Manual backup created at: $bk" -ForegroundColor Green
            Start-Sleep -Seconds 2
        }
        "4" {
            $backups = Get-ChildItem -Path $backupsDir -Filter "*.json" | Sort-Object LastWriteTime -Descending
            if ($backups.Count -eq 0) {
                Write-Host "No backups found in data/backups/" -ForegroundColor Yellow
            } else {
                Write-Host "`nAvailable backups:" -ForegroundColor Cyan
                for ($i = 0; $i -lt [Math]::Min(5, $backups.Count); $i++) {
                    Write-Host " [$($i+1)] $($backups[$i].Name) ($($backups[$i].LastWriteTime))"
                }
                $bChoice = Read-Host -Prompt "Enter number to restore (or Enter to cancel)"
                if ($bChoice -match '^[1-5]$') {
                    $selected = $backups[[int]$bChoice - 1]
                    Copy-Item -Path $selected.FullName -Destination $dataFile -Force
                    Write-Host "Restored $($selected.Name) to data/study_flow_data.json!" -ForegroundColor Green
                }
            }
            Start-Sleep -Seconds 2
        }
        "5" {
            if (Test-Path $personalFile) {
                Copy-Item -Path $personalFile -Destination $dataFile -Force
                Write-Host "`nSUCCESS: Restored personal subjects from data/study_flow_data.personal.json into data/study_flow_data.json!" -ForegroundColor Green
            } else {
                Write-Host "`nNo personal file found at data/study_flow_data.personal.json" -ForegroundColor Yellow
            }
            Start-Sleep -Seconds 2
        }
        "6" {
            Write-Host "Exiting. Goodbye!" -ForegroundColor Green
            exit 0
        }
        default {
            Write-Host "Invalid option. Please enter 1 to 6." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}
