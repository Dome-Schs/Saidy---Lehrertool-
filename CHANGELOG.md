# Changelog – Saidy Lehrertool

Alle wichtigen Änderungen werden hier festgehalten.
Format: Nutzersicht, auf Deutsch, für Lehrerinnen und Lehrer.

---

## [1.0] – 03.08.2026

### Neu
- **Schülerprofil komplett überarbeitet**: 5 Tabs – Übersicht, Leistung, Notizen, Gespräche, Mehr. Alle Infos zu einem Kind auf einen Blick.
- **KI-Zusammenfassung**: Automatisch generierter Kurzstatus im Übersicht-Tab – Noten, Stimmung, Aktivität der letzten 30 Tage.
- **Intelligente Signalkarten**: Farbige Hinweise bei auffälligen Schülerverläufen (Notendurchschnitt, fehlende Einträge, Geburtstage).
- **Leistungs-Tab**: Grafischer Notenverlauf, Fach-Aufschlüsselung und Trend (besser / stabil / schlechter).
- **Aktivitäts-Timeline**: Chronologischer Verlauf aller Notizen, Gespräche und Noten mit Datumsgruppen.
- **Klassen-Dashboard**: Klassen-Übersicht mit Durchschnitt, Notenverteilung, Förderbedarf-Zähler, Geburtstagen und letzter Aktivität.
- **Sprachnotizen**: Beobachtungen per Sprache diktieren – funktioniert in Safari (Apple) und Chrome (Google).
- **Floating Action Button**: Schnellzugriff auf „Schüler hinzufügen" und „Neue Klasse" direkt im Klassen-Tab.
- **Animationen**: Sanfte Übergänge beim Öffnen von Profilen, Sheets und Tab-Wechseln (respektiert „Bewegung reduzieren").

### Verbessert
- Touch-Targets auf mindestens 44 px vergrößert – einfacher zu treffen auch mit Handschuhen oder bei Eile.
- Notenfarben-Einstellung in den Einstellungen wirkt jetzt auch im Schülerprofil.
- PWA aktualisiert sich automatisch – kein manuelles Cache-Leeren mehr nötig.
- iOS-Statusleiste wird jetzt korrekt freigehalten (Safe-Area-Inset).
- Sprachnotiz-Fehler werden mit klarer Meldung angezeigt statt stumm hängen zu bleiben.

### Sicherheit & DSGVO
- Sprachnotiz-Einwilligungsdialog nennt Apple (Safari) und Google (Chrome/Edge) als Datenempfänger in die USA.
- Förderstatus-Feld mit DSGVO-Hinweis (Art. 9) und „Tags leeren"-Button.
- Medical-Consent-Bypass geschlossen: Abbrechen defokussiert das Eingabefeld.
- Backup-Import prüft Dateigröße vor dem Einlesen (max. 50 MB).
- Nutzungshinweis und erweiterter Haftungsausschluss in der App hinterlegt.

---

## [0.5] – 30.07.2026

### Neu
- **30-Tage-Papierkorb**: Gelöschte Klassen und Schülerinnen/Schüler werden nicht sofort endgültig entfernt, sondern landen zunächst im Papierkorb. Dort bleiben sie 30 Tage lang erhalten und können mit einem Klick auf „Wiederherstellen" vollständig zurückgeholt werden. In den Einstellungen gibt es dafür einen neuen Abschnitt „Papierkorb" mit einer Übersicht aller gelöschten Einträge. Nach 30 Tagen werden sie automatisch und endgültig gelöscht.

---

## [0.4] – 30.07.2026

### Verbessert
- Schüler können jetzt nicht mehr aus Versehen gelöscht werden – die App fragt vorher nach einer Bestätigung
- Alle technischen Begriffe wurden vereinfacht: statt „CSV-Datei" steht jetzt „Klassenliste", statt „Backup importieren" steht „Gesichertes wiederherstellen"
- Der Kalender ist auf dem Handy jetzt direkt erreichbar (war vorher hinter „Mehr" versteckt)
- Die zwei kleinen Buttons oben rechts auf der Startseite haben jetzt Beschriftungen, damit klar ist was sie tun
- Wenn ein Kind sein Material vergessen hat und automatisch eine Note 5 eingetragen wird, erscheint jetzt ein deutlicher Hinweis direkt am Button
- Der Entschuldigungsstatus „ausstehend" heißt jetzt „Entschuldigung fehlt noch"

---

## [0.3] – 30.07.2026

### Neu
- **Fehlzeiten-Import aus WebUntis**: CSV-Datei aus WebUntis hochladen, Fehlzeiten werden automatisch den richtigen Kindern zugeordnet
- **Duplikat-Erkennung beim Import**: Wenn dieselbe Datei versehentlich zweimal hochgeladen wird, werden bereits vorhandene Einträge erkannt und übersprungen
- **Erinnerungs-Symbol auf der Startseite**: Ein kleines Icon erinnert daran, regelmäßig Fehlzeiten aus WebUntis zu importieren (Intervall frei wählbar: täglich bis monatlich)
- **Fehlzeiten-Übersicht im Einstellungen-Bereich**: Direkt WebUntis-Datei importieren und letzten Importzeitpunkt einsehen

---

## [0.2] – 30.07.2026

### Neu
- **Kindgespräche**: Pro Kind können Gesprächsnotizen erfasst werden – unabhängig von Noten und Schulthemen
- **Stimmungsmarkierung**: Jedes Kindgespräch kann mit einer Stimmung versehen werden (😊 gut / 😐 ok / 😟 nicht so gut)
- **Kindgespräche im Elternsprechtag**: Die Gesprächsnotizen fließen automatisch in die Elternsprechtag-Vorbereitung ein

---

## [0.1] – Erstversion

### Grundfunktionen
- Klassen und Schülerinnen/Schüler anlegen und verwalten
- Stundenplan erstellen
- Noten erfassen (mündlich, schriftlich, Hausaufgaben)
- Schnellerfassung im Unterricht (Note, Notiz, Material vergessen)
- Sammelbewertung für die ganze Klasse
- Zeugnisnoten pro Halbjahr
- Kalender mit Schulferien (automatisch nach Bundesland)
- Aufgabenlisten
- Dienste-Rotation (Tafeldienst etc.)
- Elternsprechtag-Vorbereitung mit Gesprächsleitfaden
- Datensicherung (Export/Import als Datei)
- Funktioniert ohne Internet, komplett offline
