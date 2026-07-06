; MedTrans AI Assistant - Windows Installer (NSIS)
; Requires NSIS (https://nsis.sourceforge.io)
; Build: makensis installer/medtrans_installer.nsi

!define APPNAME "MedTrans AI Assistant"
!define APPVERSION "1.0.0"
!define PUBLISHER "MedTrans AI"
!define INSTDIR "$PROGRAMFILES64\${APPNAME}"

Name "${APPNAME}"
OutFile "installer\MedTransAI-Setup-${APPVERSION}.exe"
InstallDir "${INSTDIR}"
RequestExecutionLevel admin

!include "MUI2.nsh"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install"
    SetOutPath "$INSTDIR"
    File /r "dist\MedTransAI\*"

    ; Desktop shortcut
    CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\MedTransAI.exe" "" "$INSTDIR\MedTransAI.exe" 0

    ; Start menu
    CreateDirectory "$SMPROGRAMS\${APPNAME}"
    CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\MedTransAI.exe"

    ; Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
        "DisplayName" "${APPNAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
        "UninstallString" "$\"$INSTDIR\uninstall.exe$\""
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
        "DisplayVersion" "${APPVERSION}"
    WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

Section "Uninstall"
    Delete "$INSTDIR\uninstall.exe"
    RMDir /r "$INSTDIR"
    Delete "$DESKTOP\${APPNAME}.lnk"
    RMDir /r "$SMPROGRAMS\${APPNAME}"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"
SectionEnd
