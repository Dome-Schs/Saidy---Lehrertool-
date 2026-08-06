# Saidy – Lehrertool

React-PWA für Fachlehrkräfte (Sekundarstufe I). Single-file-Build via Vite + vite-plugin-singlefile.
Alle App-Logik in `saidy.jsx`. Deployment über GitHub Pages (Branch: main → `.github/workflows/`).

## Vision (Leitstern)

> **Jedes Kind verdient, dass seine Geschichte, seine Stärken und seine Bedürfnisse nicht mit einem Lehrerwechsel verloren gehen. Saidy bewahrt dieses pädagogische Wissen, reduziert Verwaltungsaufwand und schafft Lehrkräften mehr Zeit für das, was wirklich zählt: die Arbeit mit den Kindern.**

Saidy ist **kein Notenprogramm**, sondern ein **pädagogisches Gedächtnis** — die digitale Schülerakte, die Wissen bündelt, Kontinuität schafft (auch bei Lehrerwechsel/Übergabe) und den Fokus auf die individuelle Förderung legt.

### Drei Leitprinzipien
1. **Wissen geht nie verloren** — egal ob Lehrerwechsel, Klassenwechsel, Vertretung.
2. **Alles hat Kontext** — nicht „Förderbedarf Lernen", sondern *welche Maßnahmen funktionieren*.
3. **Dokumentation wird automatisch zu Unterstützung** — aus vielen kleinen Einträgen entstehen Zeugnisbegründung, Elterngespräch, Förderplan, Übergabe.

### Filter-Frage für jedes neue Feature
> **Hilft diese Funktion einer Lehrkraft, ein Kind besser zu verstehen, fairer zu begleiten oder mehr Zeit für echte pädagogische Arbeit zu gewinnen?**

Wenn ja → gehört rein. Wenn nein → ist Beiwerk und gehört nicht in die Kern-Navigation.

Vor dem Bauen eines neuen Features den `vision`-Agent aufrufen (`/vision <Idee>`).
Er stuft ein (KERN / RAND / BEIWERK / VERSTOSS) und schlägt eine vision-nähere
Umsetzung vor.

## Projektübersicht

Lebende Übersicht (Infrastruktur, Agents, Features, Tasks):
https://claude.ai/code/artifact/1a678b08-f9f5-4556-bdba-a1beeaa82106

Nach Änderungen an `saidy.jsx` oder Agents: Artifact mit demselben Dateipfad neu publizieren (gleiche URL).

## Deployment

Alle Änderungen direkt auf `main` committen und pushen — kein Feature-Branch, kein PR.
GitHub Actions deployed `main` automatisch auf GitHub Pages.

## Wichtige Regeln

### HELP_DATA immer mitpflegen
Wenn ein neues Feature eingebaut oder ein bestehender Workflow geändert wird,
**muss die `HELP_DATA`-Konstante in `saidy.jsx` aktualisiert werden** (direkt vor `export default function App()`).

- Neues Feature → neues Item in der passenden Kategorie hinzufügen
- Geänderter Workflow → bestehende Antwort (`a`) aktualisieren
- Gelöschtes Feature → Item entfernen

### Design-Vorgaben
- Farben: `--oliv: #4F5844`, `--creme: #F4F1E8`
- Tailwind v3, CSS-Klassen `akzent-text`, `akzent-rand`, `akzent-flaeche`, `akzent-ton`
- Bottom Sheets: `pb-[max(2rem,env(safe-area-inset-bottom))]` für iPhone Home-Indicator
- Kein Backend – alles läuft lokal via `window.storage` / localStorage

### Daten
- `window.storage.get/set` für Persistenz (localStorage-Mock in `src/main.jsx`)
- Backup via `last_backup_at` in localStorage tracken
- DSGVO: keine externen Datenübertragungen
