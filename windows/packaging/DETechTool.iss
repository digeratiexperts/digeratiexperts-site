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
#if !FileExists(PayloadDir + "\windows\Start-DETechTool.cmd")
  #error Staging folder must contain windows\Start-DETechTool.cmd
#endif
#if !FileExists(PayloadDir + "\windows\console\DETechConsole.ps1")
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
ArchitecturesAllowed=x64os
ArchitecturesInstallIn64BitMode=x64os
MinVersion=10.0
OutputDir={#OutputPath}
OutputBaseFilename=DE-TechTool-Setup-{#ProductVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=DE Tech Tool
UninstallDisplayIcon={app}\msp-ai-kit\windows\DE-TechTool.exe
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

; This subtree is immutable installed code. Mutable evidence, profiles and state
; live outside {app}; never include ProgramData or a user data directory here.
; Replace the complete owned payload so obsolete executable code cannot survive
; a reinstall/upgrade. InitializeSetup refuses downgrades before this phase.
[InstallDelete]
Type: filesandordirs; Name: "{app}\msp-ai-kit"

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}\msp-ai-kit"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\DE Tech Tool"; Filename: "{app}\msp-ai-kit\windows\DE-TechTool.exe"; WorkingDir: "{app}\msp-ai-kit\windows"; Comment: "Open the DE technician console"
Name: "{group}\Storage and cleanup"; Filename: "{app}\msp-ai-kit\windows\DE-TechTool.exe"; Parameters: "--storage"; WorkingDir: "{app}\msp-ai-kit\windows"
Name: "{autodesktop}\DE Tech Tool"; Filename: "{app}\msp-ai-kit\windows\DE-TechTool.exe"; WorkingDir: "{app}\msp-ai-kit\windows"; Tasks: desktopicon

; Launch via the existing elevation-aware entry point only after an explicit choice.
[Run]
Filename: "{app}\msp-ai-kit\windows\DE-TechTool.exe"; Description: "Open DE Tech Tool"; WorkingDir: "{app}\msp-ai-kit\windows"; Flags: postinstall shellexec skipifsilent unchecked

; Deliberately no UninstallDelete of ProgramData: preserve evidence and client configuration.


[Code]
function InitializeSetup(): Boolean;
var
  InstalledVersion: String;
  ExistingPacked, IncomingPacked: Int64;
begin
  Result := False;
  if not StrToVersion('{#ProductVersion}', IncomingPacked) then
  begin
    Log('REFUSED: invalid incoming product version');
    Exit;
  end;
  if RegQueryStringValue(HKLM64,
    'Software\Microsoft\Windows\CurrentVersion\Uninstall\{EB058878-62D7-4AD0-B4E1-61F731EB7003}_is1',
    'DisplayVersion', InstalledVersion) then
  begin
    if not StrToVersion(InstalledVersion, ExistingPacked) then
    begin
      Log('REFUSED: installed version is invalid; repair the existing installation first');
      SuppressibleMsgBox('The existing DE Tech Tool version could not be verified. Contact DE before replacing it.', mbError, MB_OK, IDOK);
      Exit;
    end;
    if ComparePackedVersion(ExistingPacked, IncomingPacked) > 0 then
    begin
      Log('REFUSED: newer DE Tech Tool version already installed (' + InstalledVersion + ')');
      SuppressibleMsgBox('A newer DE Tech Tool version is installed. This installer cannot downgrade it.', mbError, MB_OK, IDOK);
      Exit;
    end;
  end;
  Result := True;
end;
