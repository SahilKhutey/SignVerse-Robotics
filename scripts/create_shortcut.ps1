# create_shortcut.ps1
$TargetFile = "c:\Users\User\Documents\SignVerse-Robotics\sign-verse-robotics\Launch_SignVerse.bat"
$ShortcutFile = "C:\Users\User\Desktop\SignVerse OS.lnk"

# Create COM Object for Windows Script Host Shell
$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutFile)
$Shortcut.TargetPath = $TargetFile
$Shortcut.WorkingDirectory = "c:\Users\User\Documents\SignVerse-Robotics\sign-verse-robotics"
$Shortcut.IconLocation = "c:\Users\User\Documents\SignVerse-Robotics\sign-verse-robotics\logo.ico" # Premium custom AI/Robotics logo
$Shortcut.Save()

Write-Host "Success: Desktop shortcut 'SignVerse OS' created at $ShortcutFile" -ForegroundColor Green
