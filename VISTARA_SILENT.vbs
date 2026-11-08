Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

If fso.FileExists(scriptDir & "\VISTARA.exe") Then
    WshShell.Run """" & scriptDir & "\VISTARA.exe""", 0, False
ElseIf fso.FileExists(scriptDir & "\dist\Vistara-v1.0.0-win-x64\VISTARA.exe") Then
    WshShell.Run """" & scriptDir & "\dist\Vistara-v1.0.0-win-x64\VISTARA.exe""", 0, False
Else
    WshShell.Run """" & scriptDir & "\START_VISTARA.bat""", 0, False
End If
