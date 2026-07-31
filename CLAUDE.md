# Saidy – Lehrertool

React-PWA für Grundschullehrkräfte. Single-file-Build via Vite + vite-plugin-singlefile.
Alle App-Logik in `saidy.jsx`. Deployment über GitHub Pages (Branch: main → `.github/workflows/`).

## Entwicklungs-Branch

Alle Änderungen auf Branch `claude/bitte-beachten-nix4oc` committen und pushen.

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
