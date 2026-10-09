# ForToday 1.1.0 — Desktop release

## Scope
User-requested installable Windows version, optional login startup, optional close-to-tray, and public GitHub repository named ForToday. Existing local JSON and daily-list workflow remain compatible.

## Decisions
- NSIS assisted per-user installer: choose directory, desktop/start-menu shortcuts, uninstall entry. Installer and portable output have versioned filenames.
- Both new options default off. Tray preference is stored atomically in settings.json; Windows owns the startup registration.
- Login launch uses a stable installed executable (or the outer portable EXE), with --autostart. Never register the temporary extracted portable executable or development electron.exe.
- Autostart plus tray preference starts hidden. Ordinary launch and second-instance launch show the existing window.
- Tray click and Open restore the window; Quit and Windows shutdown bypass the hide handler.
- Real uninstall removes only the matching installed startup command. Upgrades keep it; user data is preserved.
- Public source is pushed to xanoahax/ForToday. Executables are release assets, not committed blobs. No personal task data, credentials, build cache, or test profiles are published.

## Verification
- Node tests cover OS boundary behavior, persisted preferences, rejected settings, write failures, shutdown, tray quit, startup path and external disable.
- Electron tests exercise real windows, settings toggles, hide/reopen, persisted preferences and hidden startup.
- Existing end-to-end task, list, JSON export/import and backup tests remain required.
- Release checks: portable EXE smoke test; isolated installer run, actual Windows startup registration, installed app restart, and uninstall cleanup.

## Verified results
- 19 Node tests pass; existing Electron task/list tests and new desktop settings tests pass.
- The exact packaged EXE successfully registers/removes the real Windows startup value, detects external Windows disable, uses the full executable path with spaces and starts hidden with --autostart.
- Installer creates the selected directory and both shortcuts; installed EXE passes the same native test. Uninstall removes executable, shortcuts, uninstall registration and its startup value.
- Portable release EXE passes launch, write, close and restart persistence checks.
- Independent review identified two Electron 44.7 API quirks: custom startup names require launchItems, and query paths require quoting. Native testing also confirmed launchItems.args omits switches. The application handles these; the regression fixture mirrors the observed API, and the native test verifies the actual registry command.

## Sources
- [Electron login-item settings](https://www.electronjs.org/docs/latest/api/app#appsetloginitemsettingssettings)
- [Electron tray](https://www.electronjs.org/docs/latest/api/tray/)
- [NSIS configuration](https://www.electron.build/docs/nsis/)
