# ForToday

## Ziel
Eine direkt ausführbare Windows-App, keine gehostete Webseite. Schmaler Fokusbereich (420 × 780 px einschließlich Fensterrahmen), Light Mode, Schwarz/Weiß, monospace Typografie. Keine Lernfunktionen, Konten, Cloud oder Beispieldaten.

## Bedienung
Startseite zeigt vorhandene Listen mit Fortschritt und Vorschau. Die Liste des lokalen heutigen Datums steht zuerst und wird schwarz hervorgehoben. Neue Liste öffnet eine Auswahl zwischen Tag und eigenem Titel. Tageslisten erhalten Heute/Morgen/Datum; je Tag existiert genau eine Liste. Eigene Titel dürfen unabhängig vom Datum bestehen. Tageswechsel wird im offenen Fenster erkannt.

Liste öffnen, Aufgabe tippen, Enter drücken: sofort dauerhaft speichern. Optional Minuten oder Stunden vor dem Speichern setzen. Aufgaben abhaken, bearbeiten, löschen mit Rückgängig. Listentitel bzw. Datum ändern und Listen mit Bestätigung löschen. Detailansicht zeigt offene geschätzte Dauer; Aufgaben ohne Zeit bleiben ohne Schätzung.

## Daten und Fehler
Electron Hauptprozess besitzt das Dateisystem. Renderer erhält ausschließlich benannte IPC-Aktionen, läuft isoliert und sandboxed. Versioniertes JSON in Electron userData, atomarer Austausch über temporäre Datei. Jede Änderung erzeugt vorher ein Backup, maximal 30 automatische Backups. Manuelle Backups bleiben erhalten. Import wird vollständig validiert und nach Bestätigung ersetzt; zuvor Sicherheitskopie. Beschädigte Datei bleibt erhalten, ein valides Backup kann automatisch wiederhergestellt werden; sonst kein Überschreiben. Fehler erscheinen sichtbar, erfolglose Änderungen gelten nicht als gespeichert.

## Menü
JSON exportieren/importieren, Backup erstellen, Backup auswählen/wiederherstellen, Datenordner öffnen. Die Hauptansicht enthält nur Listen und Neue Liste.

## Architektur und Prüfung
Vanilla HTML/CSS/JS als lokale Electron-Oberfläche; keine externe Schrift, kein Server. model.cjs validiert und verarbeitet Aktionen, store.cjs schreibt und sichert, main.cjs verwaltet Fenster/IPC/native Dateidialoge. Node-Tests prüfen Modell und echte Dateien. Playwright steuert die tatsächliche Electron-App für Erstellen, Enter, Dauer, Bearbeiten, Erledigen, Undo, Tageswechsel, Neustart und Import/Export. Portable EXE wird gebaut und gestartet.

## Entscheidungen
Electron statt WPF (einfacher präzise gestaltbar) oder Tauri (zusätzliche Rust-Toolchain). Einzelne portable Windows-EXE, Daten getrennt im Benutzerprofil. Umsetzung in dieser Sitzung gemäß ausdrücklichem Wunsch nach funktionierendem ersten Run, ohne zusätzliche Designfreigaben.
