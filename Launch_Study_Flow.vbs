' Study Flow Organizer - Silent Windows Launcher
' Launches the standalone desktop app with zero command prompt windows.
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)

exePath = currentDir & "\Study_Flow_Organizer.exe"
distExePath = currentDir & "\dist\Study_Flow_Organizer.exe"
launcherPath = currentDir & "\desktop\launcher.js"

If fso.FileExists(exePath) Then
    WshShell.Run Chr(34) & exePath & Chr(34), 0, False
ElseIf fso.FileExists(distExePath) Then
    WshShell.Run Chr(34) & distExePath & Chr(34), 0, False
ElseIf fso.FileExists(launcherPath) Then
    WshShell.Run "node " & Chr(34) & launcherPath & Chr(34), 0, False
Else
    WshShell.Run Chr(34) & currentDir & "\app\index.html" & Chr(34), 1, False
End If

Set WshShell = Nothing
Set fso = Nothing
