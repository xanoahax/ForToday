; Remove only this installation's startup registration on a real uninstall.
; Upgrades keep the user's choice, and task/settings JSON is never removed.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ForToday"
    StrCpy $R1 '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --autostart'
    ${if} $R0 == $R1
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "ForToday"
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "ForToday"
    ${endif}
  ${endif}
!macroend
