# ForToday

Eine kleine Windows-App für Tageslisten und eigene Listen. Lokal, schwarz-weiß, ohne Konto.

## Installieren und starten

Die aktuelle Version gibt es unter [GitHub Releases](https://github.com/xanoahax/ForToday/releases/latest).

- **Installer:** `ForToday-1.1.0-Setup.exe` herunterladen und ausführen. Installiert für den aktuellen Windows-Benutzer mit Startmenü-Eintrag, Desktop-Verknüpfung und Deinstallation über Windows. Der Installationsordner ist wählbar.
- **Portable:** `ForToday-1.1.0-Portable.exe` direkt ausführen, ohne Installation.

Windows x64; Node.js ist zum Benutzen nicht nötig. Das Fenster startet mit 420 × 780 Pixeln und lässt sich bis auf 360 Pixel Breite verkleinern. Installer und Portable-Version verwenden denselben Datenordner. Vor dem Wechsel die bisherige Version vollständig beenden.

Die EXE ist nicht mit einem kommerziellen Code-Signing-Zertifikat signiert; Windows kann beim ersten Start eine SmartScreen-Abfrage anzeigen.

## Benutzen

- **Neue Liste:** Heute, Morgen, ein Datum oder ein eigener Titel. Eine Liste pro Datum; vorhandene Tageslisten werden direkt geöffnet.
- **Aufgaben:** Text tippen und **Enter** drücken. Optional über „Dauer hinzufügen“ eine Zeit in Minuten oder Stunden angeben, beispielsweise `1,5` Stunden.
- **Bearbeiten:** Auf den Aufgabentext klicken. Dort lassen sich Text und Dauer ändern oder die Aufgabe löschen.
- **Abhaken:** Checkbox anklicken. Erledigte Aufgaben stehen separat darunter.
- **Listenoptionen:** Die drei Punkte in einer Liste öffnen Bearbeiten und Löschen. Löschen lässt sich unmittelbar rückgängig machen.
- **Menü:** Die drei Punkte auf der Startseite enthalten Einstellungen, JSON-Export, Import, Backups und den Datenordner.
- **Tastatur:** Enter speichert, Escape schließt einen Dialog oder geht zur Übersicht zurück, Strg+N legt eine Liste an.

Gespeichert wird mit Enter, Speichern oder Abhaken. Nicht abgeschickte Eingaben sind Entwürfe und nicht dauerhaft gespeichert. Die Hervorhebung von Heute folgt dem lokalen Datum deines Geräts und aktualisiert sich auch während die App geöffnet ist.

## Autostart und Tray

Unter **Menü → Einstellungen** gibt es zwei Optionen, beide zunächst ausgeschaltet:

- **Mit Windows starten:** Startet ForToday beim Anmelden. Änderungen in den Windows-Autostart-Einstellungen werden beim Öffnen der App-Einstellungen berücksichtigt. In der Entwicklungsumgebung ist die Option deaktiviert.
- **Beim Schließen ins Tray:** Das × blendet das Fenster aus; die App läuft weiter. Ein Klick auf das ForToday-Symbol im Infobereich öffnet dasselbe Fenster wieder. Rechtsklick → **Beenden** oder **Menü → ForToday beenden** beendet die App vollständig. Die normale Minimieren-Schaltfläche minimiert weiterhin in die Taskleiste.

Sind beide Optionen aktiv, startet die App beim Anmelden direkt im Hintergrund. Ein normaler Start über die Verknüpfung öffnet das Fenster immer. Windows kann das Tray-Symbol unter dem kleinen Pfeil neben der Uhr einsortieren.

Die Tray-Einstellung wird in `settings.json` gespeichert. Autostart wird in Windows registriert. Bei der Portable-Version muss die EXE an ihrem Ort bleiben; nach einem Verschieben Autostart aus- und wieder einschalten. Der Uninstaller entfernt den Autostart-Eintrag seiner Installation. Listen, Backups und Einstellungen bleiben bei einer normalen Deinstallation erhalten.

## Dateien und Sicherungen

Unter Windows: `%APPDATA%/fortoday/tasks.json`. Über **Menü → Datenordner öffnen** gelangst du direkt dorthin. Die Datei enthält sämtliche Listen und Aufgaben in einem lesbaren, versionierten JSON-Format. Die EXE kann an einem beliebigen Ort liegen; die Daten bleiben im Benutzerprofil.

Jede Änderung schreibt atomar und sichert den vorherigen Stand. Die letzten **30 automatischen Backups** liegen im Unterordner `backups`; manuelle Backups und Sicherungen vor Import/Wiederherstellung bleiben erhalten. Import und Wiederherstellung ersetzen die aktuellen Listen erst nach Bestätigung und legen vorher eine Sicherheitskopie an. JSON-Export speichert eine frei platzierbare Kopie.

Wird eine beschädigte Datendatei erkannt, lädt die App das neueste gültige Backup und bewahrt die beschädigte Datei separat auf. Ist keine Wiederherstellung möglich, bleibt die Originaldatei unverändert und die App zeigt einen Fehler. Maximal 25 MiB pro gespeicherter Datendatei, maximal 500 Zeichen pro Aufgabe und 120 pro Listentitel.

## Entwicklung

Node.js 24 oder neuer und Windows x64:

```powershell
npm ci
npm start
npm test
npm run test:app
npm run test:desktop
npm run build
npm run test:portable
```

Die App benötigt keinen Webserver und lädt keine externen Ressourcen. `src/model.cjs` validiert Daten, `src/store.cjs` speichert sie, `src/main.cjs` stellt Fenster und begrenzte IPC-Aktionen bereit, `src/desktop.cjs` verwaltet Tray und Windows-Autostart, `src/preferences.cjs` speichert die Tray-Einstellung; `src/ui/` enthält die Oberfläche.

Tests verwenden ausschließlich temporäre Datenordner. Die App-Tests steuern echte Electron-Fenster; native Dateiauswahl und Bestätigung werden dabei durch definierte Testantworten ersetzt. Screenshots liegen in `test-results/`.

Für Windows-Release-Prüfungen gibt es zusätzlich `node tests/native-startup.cjs` und `./tests/installer.ps1`. Diese prüfen echte Autostart-Einträge bzw. Installation und Deinstallation. Sie verweigern den Test bei bestehenden ForToday-Autostart-Einträgen oder einer vorhandenen Installation, damit diese nicht überschrieben werden. Auf einem sauberen Windows-Testkonto ausführen.

Electron ist mit Sandbox und Context Isolation konfiguriert; siehe [Electron-Sicherheitsdokumentation](https://www.electronjs.org/docs/latest/tutorial/security/). Die portable Windows-Ausgabe entsteht mit [electron-builder](https://www.electron.build/v26/docs/win/).
