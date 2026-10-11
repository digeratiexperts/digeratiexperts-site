; Inno Setup 6.3+ recipe. Package ONLY the verified release staging folder.
; Compile: ISCC.exe /DPayloadDir=C:\build\verified-release /DProductVersion=1.11.0 /DOutputPath=C:\build\out DETechTool.iss
; No secrets, licensing changes or downloads. Sign setup before distribution.
#ifndef PayloadDir
  #error PayloadDir must point to the complete verified release staging folder
#endif
#ifndef ProductVersion
  #error ProductVersion must match the staged release version
#endif
#ifndef OutputPath
  #error OutputPath is required
#endif
#if !FileExists(PayloadDir + "\Start-DETechTool.cmd")
  #error Staging folder must contain Start-DETechTool.cmd at its root
#endif
#if !FileExists(PayloadDir + "\console\DETechConsole.ps1")
  #error Staging folder must contain the complete Windows console
#endif

[Setup]
AppId={{EB058878-62D7-4AD0-B4E1-61F731EB7003}
AppName=DE Tech Tool
AppVersion={#ProductVersion}
AppPublisher=Digerati Experts
DefaultDirName={autopf}\Digerati Experts\DE Tech Tool
DefaultGroupName=DE Tech Tool
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
MinVersion=10.0
OutputDir={#OutputPath}
OutputBaseFilename=DE-TechTool-Setup-{#ProductVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=DE Tech Tool
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\DE Tech Tool"; Filename: "{app}\Start-DETechTool.cmd"; WorkingDir: "{app}"; Comment: "Open the DE technician console"
Name: "{group}\Storage and cleanup"; Filename: "{app}\Start-DETechTool.cmd"; Parameters: "-Page Storage"; WorkingDir: "{app}"
Name: "{autodesktop}\DE Tech Tool"; Filename: "{app}\Start-DETechTool.cmd"; WorkingDir: "{app}"; Tasks: desktopicon

; Launch via the existing elevation-aware entry point only after an explicit choice.
[Run]
Filename: "{app}\Start-DETechTool.cmd"; Description: "Open DE Tech Tool"; WorkingDir: "{app}"; Flags: postinstall shellexec skipifsilent unchecked

; Deliberately no UninstallDelete of ProgramData: preserve evidence and client configuration.
