1. State summary: identity Entra joined to tenant Alamo (dsregcmd AzureAdJoined YES, DomainJoined NO); BitLocker on with a RecoveryPassword protector (manage-bde); OneDrive active with Known Folder Move; break-glass administrator absent; local Administrators hold only the disabled built-in account and AzureAD\SuzetteThompson; no pending reboot.
2. Gate board:
   - Break-glass: BLOCKED. Create DE-BreakGlass, hide it from sign-in, verify an interactive sign-in as .\DE-BreakGlass.
   - BitLocker: WARN until the recovery protector id is checked against the escrow record and entered (the id only).
   - OneDrive: WARN until the client shows Up to date and sync is paused.
   - Username and profile mapping: READY. No existing sthompson account or profile; source profile C:\Users\SuzetteThompson will be preserved.
   - Security controls: READY for Guardz, SentinelOne and the Prisma Browser Extension after migration.
3. Phase plan: create and verify break-glass; record the BitLocker protector id; confirm and pause OneDrive; run JumpCloud ADMU from the break-glass session with AzureAD\SuzetteThompson as source, sthompson as destination, UpdateHomePath off, leave Entra on; restart; verify local sign-in as sthompson and profile ownership; bind sthompson in JumpCloud as a standard user and primary user; reconnect Microsoft 365, Teams, Outlook and OneDrive; deploy and verify Guardz, SentinelOne and PABX; write the receipt.
4. Locked steps: Entra leave and ADMU migration stay locked until break-glass, BitLocker and OneDrive pass; JumpCloud takeover stays locked until the local account owns the profile.
5. Code: not requested (PLAN).
6. Technician view: header "ALAMO laptop · sthompson · Alamo · Business"; cards for identity, encryption, OneDrive, break-glass; next action "Create and verify break-glass"; receipt fields per step.
7. Risks and questions: files outside OneDrive in the profile; whether Alamo wants the Entra registration kept for Intune (profile says no); who verifies the break-glass sign-in on site; the Windows Hello PIN will stop working and must be re-enrolled after the first local sign-in.
