# Changelog – Saidy Lehrertool

Alle wichtigen Änderungen werden hier festgehalten.
Format: Nutzersicht, auf Deutsch, für Lehrerinnen und Lehrer.

---

## [1.2] – 04.08.2026

### Neu
- **Neue Übersichtsseite**: Ganz oben stehen vier Kacheln mit den wichtigsten Zahlen des Tages – Stunden heute, noch nicht erfasste Stunden, offene Entschuldigungen und aktive Förderziele. Darunter erscheint jede Unterrichtsstunde als eigene Karte mit Zeitspanne, Klassenkürzel, Fach, Stundenthema und Fortschrittsbalken. Am Ende der Seite liegen Termine, Geburtstage und To-dos nebeneinander in einer Reihe.
- **Fortschrittsbalken am Thema**: Jede Stundenkarte zeigt, wie weit das aktuelle Thema schon behandelt ist – zum Beispiel „3 / 6 Stunden". Gezählt werden alle bereits gehaltenen Stunden, bei denen dasselbe Stundenthema notiert wurde, plus die Stunden, die bis zur Klassenarbeit noch bleiben. Der Balken lebt also davon, dass das Stundenthema beim Erfassen eingetragen wird. Ist kein Thema notiert, zeigt er nur, wie viele Stunden bis zur Arbeit noch übrig sind.
- **Grüner Plus-Knopf in der Mitte der unteren Leiste**: Fünf Schnellerfassungen von jeder Stelle der App aus – Stunde erfassen (die passende Stunde ist bereits vorausgewählt), Gespräch notieren (Kind, Art des Gesprächs mit Schüler/Eltern/Förderung, Stimmung und Text), Notiz zu einem Kind, Aufgabe und Termin.

### Verbessert
- Der Countdown bis zur Klassenarbeit steht jetzt direkt an der jeweiligen Unterrichtsstunde. Die separate Klassenarbeiten-Karte auf der Übersicht ist dafür entfallen – die Information steht dort, wo sie gebraucht wird.
- „Lange kein Eintrag" im Klassen-Dashboard nennt jetzt die Namen der Kinder und wie viele Tage der letzte Eintrag zurückliegt, statt nur blasse Punkte zu zeigen. Man sieht sofort, wen man ansprechen sollte.
- Ein Tipp auf Klasse oder Fach in der Unterrichtsliste öffnet direkt die Notenübersicht des Fachs – ein Umweg über das Menü entfällt.
- Die untere Navigationsleiste blendet sich beim Scrollen aus, damit mehr vom Bildschirm für Inhalte bleibt. Ein kleines Symbol unten links holt sie jederzeit zurück.
- „Aufgaben" ist aus der unteren Hauptleiste ins Mehr-Menü umgezogen und zusätzlich über den Plus-Knopf erreichbar. Die Hauptleiste bleibt dadurch übersichtlich.

### Für die „Was ist neu?"-Ansicht in der App

```json
{
  "version": "1.2",
  "date": "04.08.2026",
  "title": "Neue Übersicht und Schnellerfassung per Plus-Knopf",
  "highlights": [
    "Die Übersichtsseite ist neu: vier Kacheln mit den Zahlen des Tages und darunter jede Unterrichtsstunde als eigene Karte mit Thema und Fortschritt.",
    "Der grüne Plus-Knopf unten in der Mitte erfasst in Sekunden eine Stunde, ein Gespräch, eine Notiz, eine Aufgabe oder einen Termin.",
    "Der Fortschrittsbalken zeigt, wie viele Stunden ein Thema schon gelaufen ist und wie viele bis zur Klassenarbeit bleiben – sobald das Stundenthema notiert ist.",
    "Der Countdown zur Klassenarbeit steht jetzt direkt an der Stunde, und ein Tipp auf Klasse oder Fach öffnet sofort die Notenübersicht.",
    "Beim Scrollen blendet sich die untere Leiste aus; ein Symbol unten links holt sie zurück."
  ]
}
```

---

## [1.1] – 04.08.2026

### Neu
- **Morgen-Briefing „Heute im Blick"**: Beim Öffnen der App fasst Saidy den Tag in ganzen Sätzen zusammen – Stunden des Tages, knapp bevorstehende Klassenarbeiten, Termine, Geburtstage, Kinder die mehrfach gefehlt haben und noch nicht erfasste Stunden. Dringendes steht rot und zuerst; angezeigt werden drei Sätze, der Rest lässt sich aufklappen. Alles wird auf dem Gerät berechnet.
- **Wissensgebiete mit Kind-Aufschlüsselung**: Ein Tipp auf ein Thema zeigt jetzt, welche Kinder dort Lücken haben – aus der Statistik „Bruchrechnung Ø 3,8" wird eine konkrete Fördergruppe. Bereits verwendete Themen werden beim Tippen vorgeschlagen, und die Schnellerfassung übernimmt das Stundenthema automatisch für schriftliche Noten.
- **Anwesenheits-Übersicht im Klassen-Dashboard**: Die letzten 12 Wochen als Farbfeld. Je dunkler ein Tag, desto mehr Kinder haben gefehlt; rot heißt, es war eine unentschuldigte Fehlzeit dabei. Darunter steht, auf welchen Wochentag die meisten Fehltage fallen – Häufungen, die eine Liste nicht zeigt.
- **„Wen habe ich lange nicht angeschaut?"**: Ein Punkt je Kind, je blasser desto länger liegt der letzte Eintrag zurück. Macht sichtbar, welche stillen Kinder in der Dokumentation untergehen, bevor die Zeugniskonferenz ansteht.
- **Zeugnis-Fortschrittsbalken**: In der Zeugnisphase zeigt jede Klassenkarte, wie viele Zeugnisnoten schon gesetzt sind. Über mehrere Klassen hinweg auf einen Blick vergleichbar.
- **Freitags-Erinnerung ans Backup**: Optional in den Einstellungen zu aktivieren. Sie erscheint, wenn Saidy an einem Freitag geöffnet wird und das letzte Backup mindestens drei Tage her ist.

### Verbessert
- Die Backup-Erinnerung meldet sich jetzt auch, wenn seit der letzten Sicherung viel dazugekommen ist, und nennt konkret wie viele neue Noten, Notizen und Fehlzeiten das sind.
- Der Countdown bis zur Klassenarbeit zieht Ferien und schulfreie Tage ab und zählt den Prüfungstag nicht mehr als Übungsstunde. Er erscheint erst, wenn es zeitlich eng wird.
- Steht ein Fach nicht im Stundenplan, zeigt Saidy das Datum der Arbeit statt einer Stundenzahl – vorher stand dort fälschlich „Heute!".
- Fehlzeiten werden nach Kalendertagen gezählt. Nach einem WebUntis-Import wurde ein Krankheitstag mit sechs Stunden vorher als „fehlt seit 6 Tagen" angezeigt.
- Wissensgebiete-Balken laufen jetzt in die gleiche Richtung wie überall sonst in der App: lang bedeutet sicher beherrscht.
- Leere Zustände und Zusatzangaben sind deutlich besser lesbar (höherer Kontrast).
- Das Umsortieren der Startseiten-Karten ist jetzt nur noch in den Einstellungen – per Ziehen funktionierte es auf dem iPhone ohnehin nicht.

### Behoben
- Ein Tippfehler im Jahr der Klassenarbeit (z. B. 9999) konnte die App dauerhaft einfrieren.
- Ein Thema mit bestimmten Namen wie „constructor" führte zu einer weißen Seite, die auch nach dem Neuladen blieb.
- Ließen sich die gespeicherten Daten beim Start nicht lesen, zeigte Saidy stillschweigend Demodaten und überschrieb kurz darauf den echten Bestand. Jetzt erscheint stattdessen eine Wiederherstellen-Ansicht, und es wird nichts überschrieben.
- Ein Backup im privaten Modus oder bei vollem Speicher galt als nicht erstellt, obwohl die Datei da war.

### Sicherheit & DSGVO
- **Backup per E-Mail entfernt.** Es widersprach dem Hinweis der App, Backups nicht per E-Mail zu versenden, und war als einziger Weg ohne Bestätigung erreichbar. Stattdessen erklärt Saidy jetzt den einfachsten sicheren Weg: „Teilen" → „In Dateien sichern" → „Auf meinem iPhone".
- Beim Wiederherstellen werden Einstellungen aus der Datei nicht mehr blind übernommen.
- Der Entschuldigungsstatus einzelner Kinder steht nicht mehr auf dem Startbildschirm.
- „Alle Daten löschen" räumt jetzt auch die zuletzt hinzugekommenen Browser-Einträge mit auf.

---

## [1.0] – 03.08.2026

### Neu
- **Schülerprofil komplett überarbeitet**: 5 Tabs – Übersicht, Leistung, Notizen, Gespräche, Mehr. Alle Infos zu einem Kind auf einen Blick.
- **Automatische Zusammenfassung**: Lokal berechneter Kurzstatus im Übersicht-Tab – Noten, Stimmung, Aktivität der letzten 30 Tage.
- **Intelligente Signalkarten**: Farbige Hinweise bei auffälligen Schülerverläufen (Notendurchschnitt, fehlende Einträge, Geburtstage).
- **Leistungs-Tab**: Grafischer Notenverlauf, Fach-Aufschlüsselung und Trend (besser / stabil / schlechter).
- **Aktivitäts-Timeline**: Chronologischer Verlauf aller Notizen, Gespräche und Noten mit Datumsgruppen.
- **Klassen-Dashboard**: Klassen-Übersicht mit Durchschnitt, Notenverteilung, Förderbedarf-Zähler, Geburtstagen und letzter Aktivität.
- **Sprachnotizen**: Beobachtungen per Sprache diktieren – funktioniert in Safari (Apple) und Chrome (Google).
- **Floating Action Button**: Schnellzugriff auf „Schüler hinzufügen" und „Neue Klasse" direkt im Klassen-Tab.
- **Animationen**: Sanfte Übergänge beim Öffnen von Profilen, Sheets und Tab-Wechseln (respektiert „Bewegung reduzieren").
- **Countdown bis zur Klassenarbeit**: Im Fach können Datum und Titel der nächsten Klassenarbeit oder des nächsten Tests eingetragen werden. Die Schnellerfassung zeigt dann oben ein farbiges Banner mit der Anzahl der verbleibenden Unterrichtsstunden laut Stundenplan – grün wenn noch genug Zeit ist, gelb wenn es knapper wird, rot wenn es dringend ist. Auf der Startseite erscheint außerdem ein kleines Hinweis-Badge direkt am jeweiligen Fach.
- **Themen-Auswertung bei schriftlichen Noten**: Schriftliche Noten können jetzt optional mit einem Thema versehen werden – zum Beispiel „Bruchrechnung" oder „Kommasetzung". In der Fachansicht unter „Noten & Berichte" erscheint eine neue Karte „Wissensgebiete" mit dem Klassenschnitt je Thema, die schwächsten Bereiche zuerst. So sieht man auf einen Blick, wo die Klasse als Ganzes noch Lücken hat.

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
