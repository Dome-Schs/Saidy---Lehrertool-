import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Papa from "papaparse";
import {
  LayoutGrid, Users, CalendarDays, GraduationCap,
  Plus, X, Trash2, ChevronLeft, ChevronRight, ChevronDown, Settings2, Check,
  Clock, StickyNote, ClipboardCheck, Copy, CheckCircle2, AlertCircle, AlertTriangle,
  ListChecks, Inbox, FolderCheck, Sparkles, ShoppingBag, Zap, Briefcase,
  FileText, AlarmClock, Bookmark, MessageSquare, Smile, Image as ImageIcon,
  Calculator, PartyPopper, Bell, ShoppingCart, ThumbsDown, Phone, Printer, TrendingUp, TrendingDown, Download, Upload, ShieldCheck, MoreHorizontal, BarChart2, RefreshCw, Search, GripVertical, Target, Mic,
  Lightbulb, BookOpen, Paperclip, Camera, FolderOpen,
} from "lucide-react";

/* ---------- Konstanten ---------- */

const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];
const DAY_LABELS = { Mo: "Montag", Di: "Dienstag", Mi: "Mittwoch", Do: "Donnerstag", Fr: "Freitag" };
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

const CATS = [
  { key: "muendlich", label: "Mündlich" },
  { key: "schriftlich", label: "Schriftlich" },
];

const DEFAULT_WEIGHTS = { muendlich: 50, schriftlich: 50 };

const GRADE_OPTIONS = [
  { label: "1+", value: 0.75 }, { label: "1", value: 1 }, { label: "1-", value: 1.25 },
  { label: "2+", value: 1.75 }, { label: "2", value: 2 }, { label: "2-", value: 2.25 },
  { label: "3+", value: 2.75 }, { label: "3", value: 3 }, { label: "3-", value: 3.25 },
  { label: "4+", value: 3.75 }, { label: "4", value: 4 }, { label: "4-", value: 4.25 },
  { label: "5+", value: 4.75 }, { label: "5", value: 5 }, { label: "5-", value: 5.25 },
  { label: "6", value: 6 },
];

// Schnellskala für die mündliche Mitarbeit im Alltag: ++ / + / o / - / -- statt der feinen Notenskala
const QUICK_SYMBOLS = [
  { symbol: "++", value: 1, color: "#047857" },
  { symbol: "+", value: 2, color: "#65A30D" },
  { symbol: "o", value: 3, color: "#B45309" },
  { symbol: "–", value: 4, color: "#C2410C" },
  { symbol: "– –", value: 5, color: "#B91C1C" },
];

/* `documents` haelt nur die Eintraege (Name, Typ, Groesse, Zuordnung) - die
   Dateien selbst liegen in IndexedDB. So bleibt die normale Datensicherung
   klein, und nach dem Wiederherstellen auf einem neuen Geraet ist wenigstens
   sichtbar, welche Unterlagen es gab. */
const EMPTY_DATA = { classes: [], students: [], notes: [], timetable: [], events: [], grades: [], periodTimes: {}, subjectColors: {}, faecher: [], taskLists: [], tasks: [], incidents: [], finalGrades: [], duties: [], lessonTopics: [], absences: [], documents: [], sitzplaene: {}, deletedSnapshot: null, settings: { dashboardOrder: ["unterricht", "aufgaben", "kalender", "geburtstage"], bundesland: null, ferienAdded: false, showFerienCountdown: true, countdownSchooldaysOnly: true, fehlzeitenImportInterval: 7, fehlzeitenLastImport: null, notenfarben: true, colorMode: false } };

/* Sortierbar sind nur die Karten im unteren Raster.
   Fest sitzen: „Unterricht" als Hauptkarte sowie die Dreierreihe aus Terminen,
   Geburtstagen und To-dos – deren Platz ergibt sich aus dem Seitenaufbau.
   Die frühere „Klassenarbeiten"-Karte gibt es nicht mehr, der Countdown
   sitzt jetzt direkt an der jeweiligen Stunde. */
const DASHBOARD_SECTIONS = {
  dienste: "Dienste",
  fehlzeiten: "Offene Entschuldigungen",
};

const IMPORT_INTERVALS = [
  { label: "Täglich", days: 1 },
  { label: "2× pro Woche", days: 3 },
  { label: "Wöchentlich", days: 7 },
  { label: "2-wöchentlich", days: 14 },
  { label: "Monatlich", days: 30 },
];

const WEEKDAY_KURZ = ["Mo", "Di", "Mi", "Do", "Fr"];
const WEEKDAY_LANG = ["Montage", "Dienstage", "Mittwoche", "Donnerstage", "Freitage"];
const EXCUSE_STATUS = {
  ausstehend: { label: "Entschuldigung fehlt noch", color: "#B45309" },
  eingereicht: { label: "Eingereicht", color: "#1D4ED8" },
  entschuldigt: { label: "Entschuldigt", color: "#15803D" },
  unentschuldigt: { label: "Unentschuldigt", color: "#B91C1C" },
};

// Erkennt WebUntis-CSV-Spalten anhand typischer Bezeichnungen
const UNTIS_COL_KEYS = {
  studentName: ["name", "schüler", "schüler/in", "schülername", "student", "nachname"],
  date: ["datum", "date", "tag"],
  excused: ["entschuldigt", "status", "excused", "entsch.", "entschuldigung"],
  reason: ["grund", "art", "text", "kommentar", "nachweis", "reason", "type"],
};

function detectUntisColumns(headers) {
  const lower = headers.map((h) => (h || "").toLowerCase().trim());
  const find = (patterns) => {
    for (const p of patterns) {
      const idx = lower.findIndex((h) => h.includes(p));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  return {
    studentName: find(UNTIS_COL_KEYS.studentName),
    date: find(UNTIS_COL_KEYS.date),
    excused: find(UNTIS_COL_KEYS.excused),
    reason: find(UNTIS_COL_KEYS.reason),
  };
}

function parseUntisExcused(val) {
  if (!val) return "ausstehend";
  const v = val.trim().toLowerCase();
  if (["j", "ja", "1", "yes", "entschuldigt", "excused"].includes(v)) return "entschuldigt";
  if (["n", "nein", "0", "no", "unentschuldigt"].includes(v)) return "unentschuldigt";
  if (["ausstehend", "offen", "pending"].includes(v)) return "ausstehend";
  return "ausstehend";
}

function parseUntisDate(val) {
  if (!val) return null;
  const v = val.trim();
  // ISO-Format: 2026-10-04
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Deutsches Format: 04.10.2026 oder 04.10.26
  const dm = v.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (dm) {
    const year = dm[3].length === 2 ? `20${dm[3]}` : dm[3];
    return `${year}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`;
  }
  // Format mit Wochentag: "Mo, 04.10" → ergänze aktuelles Jahr
  const wm = v.match(/\d{1,2}\.\d{1,2}$/);
  if (wm) {
    const parts = wm[0].split(".");
    const year = new Date().getFullYear();
    return `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
  }
  return null;
}

function matchStudentByName(name, students) {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  // Exakter Treffer
  let found = students.find((s) => s.name.toLowerCase() === n);
  if (found) return found.id;
  // "Nachname, Vorname" → "Vorname Nachname"
  if (n.includes(",")) {
    const [last, first] = n.split(",").map((p) => p.trim());
    found = students.find((s) => {
      const sl = s.name.toLowerCase();
      return sl === `${first} ${last}` || sl.includes(last);
    });
    if (found) return found.id;
  }
  // Nachname-Teilübereinstimmung (letztes Wort)
  const nameParts = n.split(/\s+/);
  const lastName = nameParts[nameParts.length - 1];
  found = students.find((s) => s.name.toLowerCase().endsWith(lastName));
  return found?.id ?? null;
}

// Bundesländer für die Ferienauswahl
const BUNDESLAENDER = [
  { code: "NW", name: "Nordrhein-Westfalen" },
  { code: "BW", name: "Baden-Württemberg" },
  { code: "BY", name: "Bayern" },
  { code: "BE", name: "Berlin" },
  { code: "BB", name: "Brandenburg" },
  { code: "HB", name: "Bremen" },
  { code: "HH", name: "Hamburg" },
  { code: "HE", name: "Hessen" },
  { code: "MV", name: "Mecklenburg-Vorpommern" },
  { code: "NI", name: "Niedersachsen" },
  { code: "RP", name: "Rheinland-Pfalz" },
  { code: "SL", name: "Saarland" },
  { code: "SN", name: "Sachsen" },
  { code: "ST", name: "Sachsen-Anhalt" },
  { code: "SH", name: "Schleswig-Holstein" },
  { code: "TH", name: "Thüringen" },
];

/* Offizielle Ferientermine 2026/2027 (Quellen: Kultusministerien der Länder).
   Format: [Titel, Start ISO, Ende ISO (letzter Ferientag)] */
const FERIEN = {
  BW: [
    ["Osterferien", "2026-03-30", "2026-04-10"],
    ["Pfingstferien", "2026-06-09", "2026-06-19"],
    ["Sommerferien", "2026-07-30", "2026-09-12"],
    ["Herbstferien", "2026-10-26", "2026-10-30"],
    ["Weihnachtsferien", "2026-12-23", "2027-01-09"],
    ["Osterferien", "2027-03-29", "2027-04-09"],
    ["Pfingstferien", "2027-05-25", "2027-06-04"],
    ["Sommerferien", "2027-07-29", "2027-09-11"],
    ["Herbstferien", "2027-10-25", "2027-10-29"],
    ["Weihnachtsferien", "2027-12-22", "2028-01-07"],
  ],
  BY: [
    ["Osterferien", "2026-03-30", "2026-04-10"],
    ["Pfingstferien", "2026-05-26", "2026-06-05"],
    ["Sommerferien", "2026-07-30", "2026-09-14"],
    ["Herbstferien", "2026-10-26", "2026-10-30"],
    ["Weihnachtsferien", "2026-12-23", "2027-01-05"],
    ["Osterferien", "2027-03-29", "2027-04-09"],
    ["Pfingstferien", "2027-05-25", "2027-06-04"],
    ["Sommerferien", "2027-07-29", "2027-09-13"],
    ["Herbstferien", "2027-10-25", "2027-10-29"],
    ["Weihnachtsferien", "2027-12-22", "2028-01-04"],
  ],
  BE: [
    ["Winterferien", "2026-02-02", "2026-02-06"],
    ["Osterferien", "2026-04-02", "2026-04-14"],
    ["Sommerferien", "2026-06-25", "2026-08-07"],
    ["Herbstferien", "2026-10-05", "2026-10-16"],
    ["Weihnachtsferien", "2026-12-22", "2027-01-01"],
    ["Winterferien", "2027-02-01", "2027-02-05"],
    ["Osterferien", "2027-04-01", "2027-04-13"],
    ["Sommerferien", "2027-06-24", "2027-08-06"],
    ["Herbstferien", "2027-10-04", "2027-10-15"],
    ["Weihnachtsferien", "2027-12-22", "2027-12-31"],
  ],
  BB: [
    ["Winterferien", "2026-02-02", "2026-02-06"],
    ["Osterferien", "2026-04-02", "2026-04-14"],
    ["Sommerferien", "2026-06-25", "2026-08-07"],
    ["Herbstferien", "2026-10-05", "2026-10-16"],
    ["Weihnachtsferien", "2026-12-22", "2027-01-02"],
    ["Winterferien", "2027-02-01", "2027-02-05"],
    ["Osterferien", "2027-04-01", "2027-04-13"],
    ["Sommerferien", "2027-06-24", "2027-08-06"],
    ["Herbstferien", "2027-10-04", "2027-10-15"],
    ["Weihnachtsferien", "2027-12-22", "2028-01-01"],
  ],
  HB: [
    ["Osterferien", "2026-03-23", "2026-04-03"],
    ["Sommerferien", "2026-07-02", "2026-08-12"],
    ["Herbstferien", "2026-10-12", "2026-10-23"],
    ["Weihnachtsferien", "2026-12-21", "2027-01-05"],
    ["Osterferien", "2027-03-22", "2027-04-02"],
    ["Sommerferien", "2027-07-01", "2027-08-11"],
    ["Herbstferien", "2027-10-11", "2027-10-22"],
    ["Weihnachtsferien", "2027-12-20", "2028-01-04"],
  ],
  HH: [
    ["Osterferien", "2026-03-09", "2026-03-20"],
    ["Sommerferien", "2026-06-25", "2026-08-05"],
    ["Herbstferien", "2026-10-05", "2026-10-16"],
    ["Weihnachtsferien", "2026-12-18", "2027-01-02"],
    ["Osterferien", "2027-03-08", "2027-03-19"],
    ["Sommerferien", "2027-07-01", "2027-08-11"],
    ["Herbstferien", "2027-10-04", "2027-10-15"],
    ["Weihnachtsferien", "2027-12-17", "2028-01-01"],
  ],
  HE: [
    ["Osterferien", "2026-03-30", "2026-04-11"],
    ["Sommerferien", "2026-07-13", "2026-08-21"],
    ["Herbstferien", "2026-10-05", "2026-10-17"],
    ["Weihnachtsferien", "2026-12-21", "2027-01-09"],
    ["Osterferien", "2027-03-29", "2027-04-10"],
    ["Sommerferien", "2027-07-12", "2027-08-20"],
    ["Herbstferien", "2027-10-04", "2027-10-16"],
    ["Weihnachtsferien", "2027-12-20", "2028-01-08"],
  ],
  MV: [
    ["Winterferien", "2026-02-02", "2026-02-13"],
    ["Osterferien", "2026-04-02", "2026-04-11"],
    ["Sommerferien", "2026-06-22", "2026-08-01"],
    ["Herbstferien", "2026-10-05", "2026-10-16"],
    ["Weihnachtsferien", "2026-12-21", "2026-12-31"],
    ["Winterferien", "2027-02-01", "2027-02-12"],
    ["Osterferien", "2027-04-01", "2027-04-10"],
    ["Sommerferien", "2027-06-21", "2027-07-31"],
    ["Herbstferien", "2027-10-04", "2027-10-15"],
    ["Weihnachtsferien", "2027-12-20", "2027-12-30"],
  ],
  NI: [
    ["Osterferien", "2026-03-23", "2026-04-08"],
    ["Pfingstferien", "2026-05-22", "2026-05-22"],
    ["Sommerferien", "2026-07-16", "2026-08-26"],
    ["Herbstferien", "2026-10-12", "2026-10-23"],
    ["Weihnachtsferien", "2026-12-21", "2027-01-05"],
    ["Osterferien", "2027-03-22", "2027-04-02"],
    ["Sommerferien", "2027-07-15", "2027-08-25"],
    ["Herbstferien", "2027-10-11", "2027-10-22"],
    ["Weihnachtsferien", "2027-12-20", "2028-01-04"],
  ],
  NW: [
    ["Osterferien", "2026-03-30", "2026-04-11"],
    ["Pfingstferien", "2026-05-26", "2026-05-26"],
    ["Sommerferien", "2026-07-20", "2026-09-01"],
    ["Herbstferien", "2026-10-17", "2026-10-31"],
    ["Weihnachtsferien", "2026-12-23", "2027-01-06"],
    ["Osterferien", "2027-03-22", "2027-04-03"],
    ["Sommerferien", "2027-07-16", "2027-08-28"],
    ["Herbstferien", "2027-10-16", "2027-10-30"],
    ["Weihnachtsferien", "2027-12-23", "2028-01-07"],
  ],
  RP: [
    ["Osterferien", "2026-03-30", "2026-04-10"],
    ["Sommerferien", "2026-06-29", "2026-08-07"],
    ["Herbstferien", "2026-10-12", "2026-10-23"],
    ["Weihnachtsferien", "2026-12-23", "2027-01-08"],
    ["Osterferien", "2027-03-29", "2027-04-09"],
    ["Sommerferien", "2027-06-28", "2027-08-06"],
    ["Herbstferien", "2027-10-11", "2027-10-22"],
    ["Weihnachtsferien", "2027-12-22", "2028-01-07"],
  ],
  SL: [
    ["Osterferien", "2026-03-30", "2026-04-10"],
    ["Sommerferien", "2026-06-29", "2026-08-07"],
    ["Herbstferien", "2026-10-12", "2026-10-23"],
    ["Weihnachtsferien", "2026-12-23", "2027-01-05"],
    ["Osterferien", "2027-03-29", "2027-04-09"],
    ["Sommerferien", "2027-06-28", "2027-08-06"],
    ["Herbstferien", "2027-10-11", "2027-10-22"],
    ["Weihnachtsferien", "2027-12-22", "2028-01-04"],
  ],
  SN: [
    ["Winterferien", "2026-02-09", "2026-02-21"],
    ["Osterferien", "2026-04-02", "2026-04-11"],
    ["Sommerferien", "2026-06-22", "2026-08-01"],
    ["Herbstferien", "2026-10-05", "2026-10-17"],
    ["Weihnachtsferien", "2026-12-19", "2027-01-02"],
    ["Winterferien", "2027-02-08", "2027-02-20"],
    ["Osterferien", "2027-04-01", "2027-04-10"],
    ["Sommerferien", "2027-06-21", "2027-07-31"],
    ["Herbstferien", "2027-10-04", "2027-10-16"],
    ["Weihnachtsferien", "2027-12-18", "2028-01-01"],
  ],
  ST: [
    ["Winterferien", "2026-02-02", "2026-02-06"],
    ["Osterferien", "2026-04-02", "2026-04-14"],
    ["Sommerferien", "2026-06-22", "2026-07-31"],
    ["Herbstferien", "2026-10-10", "2026-10-23"],
    ["Weihnachtsferien", "2026-12-21", "2027-01-02"],
    ["Winterferien", "2027-02-01", "2027-02-05"],
    ["Osterferien", "2027-04-01", "2027-04-13"],
    ["Sommerferien", "2027-06-21", "2027-07-30"],
    ["Herbstferien", "2027-10-09", "2027-10-22"],
    ["Weihnachtsferien", "2027-12-20", "2028-01-01"],
  ],
  SH: [
    ["Osterferien", "2026-04-01", "2026-04-17"],
    ["Sommerferien", "2026-06-29", "2026-08-08"],
    ["Herbstferien", "2026-10-05", "2026-10-17"],
    ["Weihnachtsferien", "2026-12-21", "2027-01-06"],
    ["Osterferien", "2027-03-31", "2027-04-16"],
    ["Sommerferien", "2027-06-28", "2027-08-07"],
    ["Herbstferien", "2027-10-04", "2027-10-16"],
    ["Weihnachtsferien", "2027-12-20", "2028-01-05"],
  ],
  TH: [
    ["Winterferien", "2026-02-02", "2026-02-06"],
    ["Osterferien", "2026-04-02", "2026-04-11"],
    ["Sommerferien", "2026-06-22", "2026-08-01"],
    ["Herbstferien", "2026-10-10", "2026-10-24"],
    ["Weihnachtsferien", "2026-12-19", "2026-12-31"],
    ["Winterferien", "2027-02-01", "2027-02-05"],
    ["Osterferien", "2027-04-01", "2027-04-10"],
    ["Sommerferien", "2027-06-21", "2027-07-31"],
    ["Herbstferien", "2027-10-09", "2027-10-23"],
    ["Weihnachtsferien", "2027-12-18", "2027-12-30"],
  ],
};

const TASK_COLORS = ["#2E3328", "#A3402F", "#B07D2B", "#5F7A45", "#41697E"];

const RECURRENCE_OPTIONS = [
  { value: "", label: "Kein" },
  { value: "weekly", label: "Wöchentlich" },
  { value: "biweekly", label: "Alle 2 Wochen" },
  { value: "monthly", label: "Monatlich" },
];
const RECURRENCE_LABELS = { weekly: "Wöchentlich", biweekly: "Alle 2 Wo.", monthly: "Monatlich" };

const LIST_ICON_MAP = {
  sparkles: Sparkles, shoppingbag: ShoppingBag, zap: Zap, briefcase: Briefcase,
  filetext: FileText, alarmclock: AlarmClock, bookmark: Bookmark, message: MessageSquare,
  clipboard: ClipboardCheck, smile: Smile, image: ImageIcon, calculator: Calculator,
  party: PartyPopper, bell: Bell, cart: ShoppingCart, thumbsdown: ThumbsDown, note: StickyNote,
};
const LIST_ICON_KEYS = Object.keys(LIST_ICON_MAP);

const COLOR_PALETTE = [
  "#4F5844", "#A3402F", "#B07D2B", "#3F5A6B", "#5F7A45", "#8C5A2B",
  "#41697E", "#6B5B7B", "#96566B", "#7C8B3F", "#4A7A73", "#7A4E63",
];

function nextPaletteColor(usedColors) {
  const used = Object.values(usedColors || {});
  const free = COLOR_PALETTE.find((c) => !used.includes(c));
  return free || COLOR_PALETTE[Object.keys(usedColors || {}).length % COLOR_PALETTE.length];
}

function subjectColor(subjectColors, name) {
  return (subjectColors && subjectColors[name]) || "#78716C";
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const SAIDY_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAqDElEQVR42u19S4wd15kelUwywABZZJMEyGPihyRLFkW9rCdNkdIoGlqSNaZES12P231PVd3mrapTzacoS5ZBaTy2BcvGjAKPoQSa2QdIZjnIIstkkU2ALLIIspkkSBYTxMhgxrbIvuemzv+uVneTtDTsJlUHIPt1H3XrnPOf///+7//+AwfGMY5xjGMc4xjHOMYxjnGMYxzjGMc4xjGOcYxjHOO4NcalS5f+Bn///ffeKJ86/sj/u+f+L4SDD94enjh6aHNl9YX/+b0ff7sY79QtMh5/8tBifq4MRZstKz9ZFm2+LOP38HPWf58uiybr//Vf6Xfwc5uFqv9dfGzR5PC85rX1xf0P3xHGu7qPd/c9939+OevW+onL+0nGCa/6CXVN0v/DyS7rFP6OiyHpf06WhYdJ77/iAsGJ7x8XF4lP++dm+Pj+Z+fjc9Nle3EWjjzzwM/HO79347b43z2HPrdZwYTjBBZdnMRJnORQxgmNv4sT30xoYulxcWL7nV7S7o//eHKjBYBJb/rXACuRwiKJz3e0OKreMjiyKLPTbvlSdvzPxim5gaO5UMFOdv3E9JMR+kkNOJH9zu1ymKT4tzJOfr8gYMK6LIB5h8dN4LHwfR0XxSTE14PH1zksiJIWRkG/h9eOFqVNAywGn9DjcllEVZteGWfnr3HMNlbRNNP5jCY7xX+NmbiaTHpNf5MJjZMOR0Dg31X8Wj6Fry4+hs2+Pi84ft34HLAkYEVw0cT37q9rRtaou1iN/sKnOap+V/dOWpBdGc9jMsXTFr4PcRKq/lzvd34oaFFUNEEV+wCwUNKlmPbGLADa4eQc0vGQmufExyX9+yXgFzh+vTrj1w5wXXEheVwIG6/PNsfZ+yQTD6YZJiHAje5y2nV07oNJTvjslq9slmHimlQWTv81FN1wIcFx0VuEOOlFm4g5j+8Hk2kXDPgBSYgWIEYNVfy9T/W48GBhev8jW1jH8rkTR0eLcD3j/Bunvlt2aIZxgugMZpOL5y1NMB8DCZjoykwgHw2wIDy+FuzsuEMbnLyiTul9cnx+v8vtpDuIFOLXeASs0PVwCIlWAZ/HTiY5jN6EnfEx/c+//+G7d46zexXv/tRZBx72tE3F08YbncsZDDvXpwtYAPM0UPwOi8TRAoF/8xSeE60Eh3eVx0Xg6GvR6HEAr9FPuKtTOGLA6sBREhdJghMf/xYXTZ0EeF70M2q8huhzTOuMnEVdhPA8CCuzpb9QjI7iTqPwq7AbHeyauCsnOEltThPJphgnzNHkuTYnLz1OSI6TR+d30fIZjc93hAPAYup3Ztms0Pc46Y6Ojvg32ek1HQ1gQRLwO/C4Sc2CwespyWo4eo34eMYbXDOBSCS+5jjbBsS58+DnFpXPF64hU9zwmU27r+YJz8QZg380CeyN4+MwJOTJB1NfG6sQF4ans7tOKcRDU+3qiZh+OteD+hc6wfEaK5/oYhTfI6VriwuCMIg48bVaAHwMRiG//fUjf/mZXwDdt06hs9RlC54gMvFwsysPcXjA3ZfDJGOYFj3/LMDNbfB3HPJVEKvn5OUngUNHAIf6v+ExkC1mHT2WUL8qXgP8baWfNPQTohNZ9JMtr0G/i3+raIGVXq0MYgkJ4RK9w9mBJVoUA99EQ8xnXzzy2XUQ188wdBvDLtphvbkErJ5MMoZaGPKV6GgFutEhgjIF7374PYV7EqKlOEHRF/ArYb3LPnopfe6j/hz+l7td18OP377Zvb7+UbmRXYEFAe/Tn+8NLtICwk7wRYJMerQG80yuHeHkFIAlDkU5NI2RQsQjZrQQ6vPFZ28R4C6nyaO4WXcS7fI6I0css6ZZJx12usbpZF7R8WpWQjyLmwvuyvk3Zm9+kmt98ZWnLs98GpxxGqdwvb0lkEVHxwk4pSlbAjqKNILh7+GzNQw+5cv5OffZwQwAv/cEvXYxBs/FS9ezP2MMQJwxBl0cgjYLDOEwwRMnAxYEo39N9svd8gjkf/za9Vz3A498frHeUY6gTWVCo0UoILmEDiAuxkSxiUaPIMQaJuDbgN/hU0Qm+7/V58vFZwHcwdjc49mpmTuBaAPDutXWDB2Y0ox2nUHqal5AK4v56dWPdnE4f+3+h29fRkgZk0IJO46DjGAMRe/48j/ccTJemTy/Wfp0eG1xYhuNFNhXKSmErTgUhKMsF6wBLUMeKvq83Rv1rRsmrp92y1n/YTG+50wdfu8MyMP/ptGjrzFBA05YzYsGw8Syn8BKvPAkPPW1R/58p0gDHEKYdFiAYebpNSFTSAsSLBMtBI+Zxbiotn3NDy79RhWPAJ+pFQJrFUO9nPICOR1r+QDEKikKqDBlHQq6H5i97J/b5beeJagvzBDChZs7oZuvu6gkFK6SBEwizlxFiGBF8XulkC8cA6fOrl7e0deokx+zlYmTX4H5zdkZw/eacyYQQ8yqYSs0CXg9k+XXXjzyF9u9/qmNyYJgaYgm+Ix3TC6J6WX6GT6vLK5+4mlBF3wktjl/tvDY4btvHazgvge/ED90iGcfAzF4DOTitBWcVEGnaFEYIKfkCKCDXD2AKUDo6M/8+ZmdJz8rviFpXvDcPZ7fZUfZQIGSAb8P4Ix68jFoQhBAQmdufm66uX2yahLg9Tm8q1OBgeNrR0thCScYUjJEzRgDWQw6LkpIgCV/ckssAPngBIxEEyiQLcXgBaVUK+P4uUbjazhTawKKyPFaPzvZ0XNuLs7EspRzep+afA1wxtCXwDifINtaJg2dTcICHGcK++9PnVnb9j3LLqE8A4aoau4TSTrF154h/QwwDPB3ZEFQFERJK/jeT27+8LACeBfP2kqw8cwkUzgSyALugBTDuy5hBg+YSthFNcbedObv6Cw9/tWDuJtbjRIqYvpIboGOGTdgA+WLsk5k4VXMGVQMgvL9s23PaHJUAzm0SwaLhlSzRI6esl2B65IoAf0I9A885i1m/ee9ec/9MwWY0qplAgWZVKJbVWRagb0DzB0yy4TuAQZPSRlH0C2EUXUaHnriruWuYSbsIsL0m8w6Y2HK+YXGYAiw44cpYScLgBM6lPzpX+vue/7Rxybm6G89cJkfT68bNCdBFs1rqroSECuFDeI4Y8mQMTmRz/7OkZvPH7j49sZ6dLjYa4ebZxk4cTfN1cxz9o0yaQESKT7HfD9l8ThRM21e2clLvm3W8RFBOwucOokU4PkzYgQp4QMWJFgaZyeHsYlGED6yVBjqbWsF4mesMyWetIRoek0xV40NayfyOA4bSyaw0FEV/37TJXjE6ek97xmHSfwBPWP1lJdnb7zOiYQ5YSZvKBsLEMHjFrsfOeBILdjJrAR5SyMZJC5IxP7rTFlDNfEFiRPIVkHgZ80jqB+D53T4uL+TK22NznLYBJQDqFpDUm2ZP0Cfv+V7RdemRFW4BzfNAkiLbww83bLVeL8Qvv2EdgWyeAtK4EBuXTJxORE4YyiFu3f99OqOjt/zJ47y60kox2CS7LgOjwZneAZCKEGLAdcxbRmwweOJdmbAXZsrvdzrgvzKV+/9K0wuIVQMm4BZSUxkYaYyhH4mlS3hLzmq9L7AVqLFf9e9/3h5U+x+2Hkc1rQJp2chHlZTyABQKuwZJFemhqEbSR9E5UKTunj8yYN/tWO00eUcaweLNs5aS+0mBjEcDQn6GewwCikEH4O8Q3Q6mRlEJJFQeOUccDjH1oFo6oHT25KCrillLUgm1icg8JQunH1+nTCBtf+e/KPeWd73C6APk0wVTm69cDKtZBX4XPQK7Mwo7Vs1yuJlfAB/n+xu/jvMskFql8JKPAZyMemVxPiaaRRmj8dEDtcCMANIyCZ0/VM288wb8Axbp5IyZvIKZwchOuAQE/AIRUIr8o8o8YWPw80g94usTjj67KP72wpU9OEg5hbELTN0bqJZAcOHSROpmNuKQ6BGiZgFRQanzuwOkRYE71aE7TtcfEAo5RAU4F0w9zRhc3bMUoj7OTQsG5OdZK8eiB2JTA4nrsBvqI3jSJiCkE0azfwBH8E8Dq837m6momOkUoqzqEcCOtH7GBvwF9Yx3h8kSUzhRK0s2soQPaGiB5k0gT310meccycYNV/WF6ZXdwDBa84RWet4AdIZPM/FsXMchjLLB2hffB0YCk6RGxgQFOKFqNTzGDYyVwAXcUKhqqGxNUothwUzzzjTCZEOREoGK6jqdJDmFiZRk0vO4slnHtx/VuDkyZN/EzB+9Jjx3CdaddHRWcbhYCOgx3LmDVhCBRlK8U5DJSnV/oafenXXnPlMnEpmDeMNtVU+VctUcAwPZ00ynAAK21yjHjoeQ2gdKkn1EmOp1WNALEWrdLMZlZTFr9M2kc9fkYMotPImEfIpooRbjtFGoeR9mSxK104sxHnjWr1Gq3Qcm7M58/HJvCJpYiEkCuHd4W6hIwBi9MNP3X95t2s4+2YbqGooaD2ArRmYSH1gKWggJKGC6xKJ+Z0BipCalgTxCXxuik0SDCdrLhABn8HwBYijOCdmkiS+cl5InNOgRQ7XFyrmGXBGsWYfgKDr/nePHbt3uc/O/lXc1RurGut6E/oRKDSLiRNvznqPu4PLusgvEDiVogGwBM+8cHjXBXD6tfm/nkEEoOd3RdfB2UQs6zJxeMOOKPL+IlbAv3OMHpKT6Dh64fpBj3ByJTtaGcmVgEzskzCtXVPHAodzGprPf85JUPIKJ38SKsI24D76fP8wiP7gg3ePVa0JeSS9m6vX7zEm52iAs3wVmdpiTkRQCMHywDQxImpAJrHqJh9dfSFmai6bXGneGgkgONMJZRx+xoWXB8b+baUR8wwLSkbx67KFgEUDjiBm/mDSDSu5svCwT4eAkFctgkrqFwlEos0jaWsv7Ck4YvfNAmjPV0quaCYa2tWZsmKMMwi+AhdVWnCIbqxkAQ0SCEUV54urnn33PvS5TbpxhrDJi9BU83qNEIhhTDUJCR8hC1enhoaWie9ScNwvuX90FhHyTeSaHRNHiQdQMNLY5lo80uRSrSxRR60RAUYbueAYApz1z3vh5DNX9on57y9qIwPgA/LfrWX25Bo22coeWtlTSs+6hkM1cqhqxAQcmVUHTJlry4ydOr2GLGOvzp9w9IkVxJoArjXkVKkpzASRdOT0Oa+JITmzKdoYOH/GajCewQ5loewhRDa5rpGIL1ANVeeaMIJjKVU0MlpHz9YCopy9dwbf/6P37pZYls9Fr5NvK3OKBncHOjJ0PrZ07tpECZl/judFxqW99tSoIGpwEyeS5xciRpsS+YPIGANQhoka/QTPjZwMYQuDQhCitAt7qebPkkDxiCZ2kiXB2eigdqkJhXMTOjN3ITNo4QC2DpKf2A/HwPz0Gpo34MhPBN0TwKe1hRua6aoa86EFA5+YQs3EgjCCpT/wlTuvedXH+H+dsmroQKn1kfwEX2uNVqakPL7UGGDxKHAJpvNEnDbciUxbyynrl2gZOi2+COMWpjaRM42IcubEByAMwYSTtGkoqpGvClfT10e/enC5x+afdlU3kTPWEaBRcjEmI4FchDlPNcRijjzn5+f8PDXLcSI5N3+tx4BgA506TbhAOVuoeXcVl8i5BEw0BvC6EpOuJgyAq4VIjQSJKpS6JoAJLYCmwgtGIzsOC5nOjtfnsCiG6GOogOI6KoGvB8dP4KNhdnqyt8fArNWbWLVM68qkxq80Sh4M9ZYmxakECBJzqA1t2jB4ZHf0X4+/+NX/dn1OanGZUcWqzcwupcmPFqLLSFYmVWkYNtENlYi3KfH4aTFwoqsZnuXCCxQyCbOLEgGZiPaG7B+jSFJRRIIhJd2/uUFNGxa9wCOx3xB7twDe++dvH4/YP8fXPNkSvsmEE/+fz/wapdgANPEapgl5gsPDmtQ+qLyKzfd696vh4bPI4JVMpYkQcAEEW7kD4ItEAOS11xDLY1aT/QshlyaR8k7hr5JKK4t+1rIpEOsXZFEKUEMp1jO3UUFQ9DSjcDqXApQ9WwDPvnBEsHVmtBqqFdXtx7gbc/QOkDNh6YoHbmv0p3BzEjnvoP6vyQPX//HEtRfKX2kRvPW9bz1Rxkrkfvc6qSjWaKViMMdTWXi8+YDpZwvKVyjCyT4Nf18LzyAIQsjMJMk+JgIvV40SY3jDzIyqCZahq1pZqZVEmlHtf3fo4Tt+uTecv3NuaC4pRHHEeFUTj+Zs2g5NmWsU8y8aIWTQmTksvy5tLI4VReGhx7/0iVa/f63aRA6gqf6l95q2nDCi3Uy5fNeuGPkZ8uqF+pUESS/7hHyPZFBCLhQzk4MoTPkbfz/lo4jJK7AIJ0pWNdyKM280e7MAYCIifYudIK8hi6pqUT1cTRp+fpjmdUa/B5U3tMZe4WEDm3oSZIp/O50vj5948hPX2D/38pNhtsGl4Thxzi5KqU8gppJn1hI4iAuwbIrkISAk6WhZxIvo0JWkdFI2mQhIFCYcFLCJKHGu1twKf25HR8WUq6I39oguBjj+cOdIoSfmtzk+RoKnmNtG+XaM2w8SMPF8pNJurqLlos/CnIMllGBlyzs/JarUiy8f+7OYmCp9Yi0bhmBGUsZZk24SP0wEkWykNwkuQu/kbOeUsSkZc4KN5FScwoteGcJCGhWeRX8PNibLPbIAEZmaSE2dVeEoDMJWejH3SNVCZq7sAoaBGUMvaWc4o/3zMeWOAWEzW/qL1afqDQO9TFTActEGFHSzthFFJnhH2WS2aphkaVBwwsjdhEqqkLSsXRBA4k2A+W8oRVybnESjHAlIOW/ke7MAAJJkNS8GWzrmvqcDkAS0e0xtP9fOlzXBqfUQkeNaPazY0TPUeaMiogsjcI7hhz/94d/7dBc5xukMLVP1DtT8iTClz0zYyhxAKnDFuoeA1LIt0VGMgmKqGansWlrmOazMB1wF1+ZDoI3C5WqvuIIU8gU+y5lrByaMSBQzs3MlZKozlW1ryetuhnAyPXaBNwEFm5D0ySXiuZSM8XtXlHVsriFpdD3j6yee/O+zLt9SvUxHAB1tpZlcWJCM+mGkIUhmIcBTarQOU0Nhy4aiEl2u5eX0OZ0k0lJWOb3xC+BHP/3e82r6KeZFrR86C7dKtbL3qzeG0TjJeLWGqMH1AEZypWpZ409vUuUFMw+VYfHEm+svfLqCCxe/4xfkvQfcian4OIVRH7VCF6IEYqIacDA9HX3eCE0Z3aHCHqk+ofdSLaTKOqf9PXn//fd//cYigN3kw4Lz/JL1YtZKQuGg1uaJw2MZwk06zLm3Bo1rFLErBH5VtmzVCOlTbkJhLQjtDCjoPL22vF41kJ3GsWfu/xmyeFYkXTtUKTNOYbul0seEtCoPEwtWjI/Dz/dKKHWefQ5iWXW5VkwTkPXjf/GDL9/QBbA6++Z/4ry2ZbkKFYy5+HVmzr5ULEZhk0Netf8qcQoRk3etCj65Rl+zbLKPw8WNSfK0ln2TSV3e8a8f+T+fygaoVyBsrAzBtWAMQzQIrTxMorzHRo8v5kuAJQN/aBIKQ5px7Ff4dIAXyAKgYtsf/P6lIzd0AeSzk/8RAZmclLkZDZTiCmXPeJV1JcctFCTrArBnR7uHky0NhneFyYpJWTgjZ1HgkcqnACply+H5OhhYoepiponRNR7+rQc+seccnS85i6n4k2sJSgGQUixGNZnAiuofioE/YaTpOenjreWcbImuUhMhZcuffPgHh2/oAnjtO6ffEc6elXxplcOO3PhcS57IURMyqIRNRKGuc2XgSKijMHNZW3XuXDOIjXLwy0ZrDOz3Tnj5SC9jyzA/sxY+2VGIUK9C13oc8Gdn0ohoHVrFMPTkA2cMnU35SsQ0USVzOeposWPJ/PLdD9/9Ozd0AcQ3LAZnu6h7SGzP1CZnTJpVARUWDjV5wJAQkTQnEjEit8LQqyqK8LlZK5BSsVJooxJ0hcCsuYm3U9lxsDi6JJIsb/uVLAHDsrWButstvoA9/8V3SREStmigVziYQSMunK2ooEX0DGhhRd3BvcEB/ITq+sADlzhWFbjN+dbojh0uBKjECc6kU12bW6l2hFZr0yDCmEBnSCW8EIDAYdKyRLc2nL5V3VGG1x9xjOdfevq6b+YHH1z6jdITn99ztk/9FPD4sQCWJpkmk/obDZVSzOLlOsYON9mU6wK8OT7waLvxKWEoATceuAowMFybCv9f6gTafCCryomdgVljYWXWEUAh5mArjEqWiqk1JGQkMr4W1hhSdY+hpRUCIBlZOGoMVbFzSSIU/bgua7Cy+vwmePNdbuJ3gnVZP7jl2sQJdhjxGskgnmDQQHSWg4SKXSpCUwyHz7Tn0Y23AFAJVOcDfRvRuPHZoAJ2JiXiRvSpNr5CO0gJI/Ex+ghzJVEMeHfmORoFIPhk9YKFWt7YOr3EmOpUnU/G4ZnH1z/3qePXVYh5W0VYRNVoNQ8jlkJEZYawZCCpFpEWYlkzF8JYMK9sZEk4YcYwMEi0N0hg9II9fTif2k4dQvqEv3W6ONTE5YoIGoeHK4Ldx+LpnHoEZEazJzWZxmyAl5dSU0fZysjZp7rFgfdNXH1hMW2Rdp1trF6zeX3tre6nUclMcgZcE9DaxavMqJmpH+AeBlwBVDF9nmDoivsaUbVQ5BpG0x8fu75XtLCZKWVmEoMkTTjdKahZNiSB1qlUBTuGkBtNfjA7SFHBREu6YilXyzUDhEV4U0ncaO8eKrAIFrpli1X5TIo5S1Ex2YbW3SbXbGKLxughxcVn5OYHPkyrYSkvPOEokmNsIyyTEwgIB7MTmCybs2t7UyV07tvNojQaOtjgQdW7C3v+Npj0iWcZT5qbKxZuUD2SbSNWDWHrbk6s3SYRJS3RFvKpkFGK2K/HWI3SkjFaYhZ5BYr4RrJGgJBSyIoVvLA3ro2GdvCBz19maRjpPMY+kolOJKXcII9iWJbOwlm5UUOfDPwiOkLh8/z2i0f3hhDyxFP3/RJSwtG0moYIQoGuCejxqvZZcOVNm2+BgVOT7qRwst6C8olyGJNMMoO65dTKhWrwiFYudfo1Q9SZQssGPSQfBACa5uz0Sne+/Dff+t2z65VHSni8zvrs9JoWQSkKIgb65tSy7UQqNf9psFJ0VmdQ7gHh/5WRnWXk8Tu/d/bpPeMFlrSrSoVdQ6l5+6Wtb+PeerbAgZE0Zxw2V+ciClHaxeGVeMEFm6Xl6El1bzJYOIX5WZQ4OEVrZFsctI959WPlVgxUxev/wfvvHLraPTm1sSokEshW+o8jfvHsnxkr5UhUgsCkwCV2ju8hF6RKF1Qlo+wpLVyEHAyCJbE5s3ttJS4VUAirtlafgMEjx/19OCwTrzjRvPhA+g13hpsneObPqWyLySXskJpkESKNtLvh+5Xl9NQr252lt5WtopLxuVe7J3cd+hxU/nAJF8rQcvFrol1NrfXxWk+oxSNg2RYqTZ8pAIaLN8xO73GVcHuulLAPnBNvdlkz1AtQx8VYCJM74O+5ARPl+sOMIGBKvyKlnJHCocqmVtKS6XVbu4K1w3Zv8d8UQs1Xty20PHVmqkweoqjddeifXHURSEWwIc06UiMTeJwcxqpOlT/IIaJA2NzqNh86qgSUnXm9/sWeLoD7H779Suk5HTtRRK6ms2yg/J2rY9ZYgkVKsvDmnGb1TiqQlMKRVqqNApMryy11dbrzyYLUmaGra6gJ7N+63/n19sKThx78ovL+jALIendVK3Ab+0SiVBJ9lk5JIIWAZ4wOpnJUiq4SU+SYAm6EI9j8X3yre/fAXg8UMsjDrGGRJvJu57kpaqS8AMiy0Iehwg+QZYsTNaddbzV9G62pExi5Jo39RkmUQsVqEsUjauUdsjyca7Eog0q6l9PZyW1FJ95+7+3jugOzwC3sSCcgvP++//XdCbP5sGs507mE/yiVxIuCilAcZf2c0S+0IpmOQlrxB9p0f0jFQF2gmF2NX20TCNfYrp84gc62UjGavHxEoNhiFop2kEMPU9LXK6XhAsOmqViIwrJxYoKoQ4tUQEMHaASxXDv18uWdYG6RaSXBSUlds4CTTy9fnVRqq34mGgHUuSV4oqgEtq9lJTDpZC7NsBteLNQcC4CkZH/oA9x96DdDyYmNbmLyAXlQlZChBpCaNNEH0CweZxmZl89+xXxlub6RhYP3/eby8NF7L6+3hhWztSO4yL4nhkmLxEsH4lPJ5i5hnAVh8BjrpD9wiAUa1VWOAbCKHvsQYJMKw0dgYQlRPwGMJFQDjaWMC1kptDV5FALV0uLF/3Jgvwy7ggvLwmky6ZLBQEvV5EaJe2Jozpb2nQpg4qhfYO9LfGzXRdWQYS8Cix5mg77AUrRZ76w2tvH6jESquVsp8/RZ/wcXxrrfPQWLZBEmjWZCY8NFNVHRKO4h1G6BuFkijxd1Y9VNYOHsry5jzbkyaPkWN1SeKPGBmjThyp8YXpzNcpmWrLaLKL3GIzvUwl/4jr9SsTI4I4pMwzbAyTSa/dk3L++M4n1BRaGYj4eFmdrBTBo+Xc0CqPK5sxiAWeisFlbYPEA9JISwPiGgprSY4/3qXj/10b5aAH/4h9//uxWZRoiBa0OW9LnxpHMJ6YqBB79CFcOq3lEa8ki88U8cO3R5Z6crWXBFUWlayjpmG/U+w9rs5OIqVowiDMwkFsYLlzI2zkD6XQGY26pulUx4ivdEZWUDCWpIrWTFSSKvOQlHcLAzlDaQmI1HWpfsT7VQlnVRPR1zpncT1PsxFTQ2AeLYDNbpsJtIa8QVut0rYL72wmNXyg5rBgojF9s/94qbr2xebfJ1ASTEOk6klU3BiuKt6AzsOgluSwa0kF5COeVJlLQ6bZTy5Vis0lgLhMYTYVgV7av7Uy/46DMP/azigo9as2lCBrEZLTaxVk9XSrVjr10SbvameCJmvi5Uu07ko4e/JCFWzA1Edc5+8neXmD29ajiNKhMnOgcdm3Mseee6v51e7ytPHPoIKqbIWXOUebQNpFkEg0vgufM5vTcqjXs4PoKz0G//u++/99aDB/briB9wasw7dutiWvZEmTjSXj1V4SgDFYsjqOzgwFU3h4/ds+sOePzYwU0uOFmrT+762Fem35DdWInjNazkKbR1XZCyt118gOZ8JSQY16o2IIpMYH2kA1KHLRFPguz22lDIOcVO+Yp+Ye3vFrMvvPT0/4KV2qXD4oXWNF7yqQnRjHNklLHkAxPHTn7GI2Xx9PFHfr7bdUzKb/znyfruZ/5sY/XHTGR1jaqHie/QcLl3JiXfkJruf79+erJLGElcAyieTVVhxCS+RGfQc5pboebSHBFOBLTQar7xztm1A/t9qDdPAk2kElpQVkvLx418aq3ceUfSKYy+zZgH5wVNi6/5iRwhamsDreQLnwqaSGTW4EQKbqI8PAxHwSSffbPdFoQ5kX79f8DkdhNqc2ccXe2EEobk2NRshslQk4C6osbNsVYnN0+DaVQMTwzlKycFzlz0/0xKl7h0OLlOyBqJUsPqTJhCZc2RxK9eFo1hWCKxPuckODsJ6WlDFimpwhnqGfoJ/skf/+QfbGtVOlUSrai7uGPCSsty8oYxLItgRahylTeaiSwd4/Obq3HU6YvrV1iLt6Dum+xEyfnmkQVDdOeABFCUb4UzEmNiML/TWnv4OascVl+/SFJ9oVpq1TErik7oKID3WZCgo8ETtDH0zGfbhqPfevt8VXDvISj+JFNeKwsI+x9o3oJZPlFF3fl0IJoNvlMdkchXl7Nu+vMDN9uoTEWvlY0tTVkUa904W9XTpoO268zUiTd3qnrCgZI8UTDqmk3jvQ/dvulYy5gqeyvRFbYUMboeK/VORJXHjt37v7fHIjLtJeTToNFEPkxHt0oQLUkPSSqbuZWt0QboX/fm7Cj+1jvnHsRMYaYlUd7QmszNEJKk8PfF9FNHsUwEH60KKYM0/+z5x67JErC0jOgWm+JLEGyQMvWEnDNl9GL9QLq5U/5gEN83KpStVVCpqU3IBvUOjBwigoqwekUw+gcfzP7WgZt1RIpVJZo+CmeWVAfPjNcpybC4xnQa4Ymnc9iaSFHcqlW188FH7wxXdU47bcY4jDxSJa/WqUjGwXt3zHTenjSSVS//u2KLMkpBlC7VOs4HncU17udi0lwFs6T2L12czF64fOBmH6ewSUTAvrmJ7DxXp9xtC2XlIOyZcCNHSeIURhSBOYPYXRRl2GzOfceQj4UbKbRjlJLi9EVpVMhE6r1JDVt4ezAploVBM+hWSKWhYPAGPldikE/m+xG72TTGKGxxLUPPzcrmgVtlVJ7PvURq+EpTRQNkEJ8OGcJGf8fVubZhqSeizwOePOntF2hpPmYFnjh6EJtPx5SrYeFU1IpGpd4tuRTPZuQvptvt/Nsu/atLf7uSvj6ZfZ2hsysaCMmwTF7qJ4igatTQXHsLTf4W5pAAQaU0VcxNkWeu8e+g4UIkU+q5zMoYpWkMLbK0JmR687vnVkqu3qW0tCO9Qteqlm9pHbR4/vcTsRYnf7596jipXv63ToSwWS3dViSl6uB6FpiinobcMIOwDqn2aaTwNRy4FYebn/zTyhRjihJmI00aDGqWWepU0AaSfDRE7CChZtK2jEzpVkLqoHw8af2Fyki3sD6hM4IUrl7ZrDaS8OUHvrjtkbJ+ds1EMJkWk4hvwXE8E10TbQUH3McJ9ik2xwOXiPXXs3j3/UsnDtyq47mXj1xmpkvF5MaNPBSmoISPi0Lg00xbrIhwknjToRzsnkzSsFgTONHu395WBeVKr264zXy/OLo09M7kthM/P+v+tPKKDpaddgIRfQAjTOFa0zPQJ6aT2ISLZwOzpYnMGh4/dl84cKuPR4/c9ZelUbkoTIfOwqR/qzqRySwHNGsr8KwSq+I3tCrmXBlugQpVwGstAJiav7oo/crmkafv28mBvO0rj9/JhZqyy7XQIxFom8EtC+8W5nqV3kYcAPt522Tzi3f9/eWBz8o4fuLIX5TUC0ck4jzvDhJm7FKjxJltrztQ59oFhFqwcmOIorXs4nSZFCf//OnnHvnZ7/3o2xevdn2Hn7p/OevWqOP4ZIBZoAR8Iu9bUKs6LmiZUks8yDH4RMJK7RKOwpYVJYb6I2zzSw/808/O5Asku7H6J6Vt8+a18kXxc6OFU0vZtUqwS1dP7TwyY6BoUEdnVDVISGr9zNqy2lhbrm9MwTEsjAY/9zUGxq4XYiu2kfWSxxdFk8KnWvMwN00pNI+vnELCGipKfL2UP/vvD3yWRz9ZmyUJPPB5Si3VIPXKuoKYJMm56DNwwefA8TI1/0W7pZyKE0mk1ysdTL1txkTQNbFwZ1aksk0HcnSVZuyGXUqN/A0fOW4gj49t6938m5sHxkFgkUdChGPlUQqdnJ6hIVLCUCtwYvr1ZYMys4o9es9l49r5s9ja2Yzb0lvpmS41HU8S7Q9s9A8lj9/a9u5qETD0S40+koJO2HQ62azalSvjrG8Z59+Yb1aNwcUb00BRUDru8q0JpKjKMRCT8NTOjR00qs4FmpbU5REsW2eDpozOm9bzNrKgHr+utd3PEi05a01fRCpLi+f/dCNV2TtYNElYWTvxi3G2d/ILTucfrpPySGUbMkqXLYMP1DSB0no9EeIIOljcr8+ii7YwQxtCSdu4jhZZp80mBdNnK+EzW5kcykEZlwJAhUkCxfeabUw2f/eH335qnOVrGGfenF+xki9Djh6rfSTkpKXCuhUMgaKGaWtCMVgcE1H0hCOkTkS4SSjZctZrEWtcJNNBCGo0AX0qymXqF1DpW408iPrc6uVxVq9zvPnds4+ubyBDqPRDsUWWhIGwDyDWFUQHvQgpB6vhz1i9nO+tyKygQmmrUrO2FFvErjuihTe2Bbz6ADNBN2NXUC7qSOKxM078Jx0PPXHHZWw7nw7apbhG8XxgIzNvsMmV2mXOccf+g3TkyLZoA6UDHZ/Sklng9WlyTRmaaPvWmeU0hvmZ1cWLrzzzf8fZ+zQXwqN3bFLNXRCPuqXCUhP7a0mZNq90jOJxrp5BoprJq0mQsjDJVibKEG51EWmBBhe3pnykhPnp1c3Dxw6NTt5fK24wf/W/9hNxhbWDbVfyqtUsYdFaeJZkbb2Vlk+BYlZxx85msmCkjzEHZvZwu3muZqqooSR6/Cvh1EYa3vnRW4fG2bnRkPLvHL4S26ij6JNW8tqO3wAve2T0Fo2VYVcqunQgaYeqHaUkj7RCB/GJZLl+Ol089MTdy3EW9sl48LE7llVvgte7bDOKSXK6GZy3SBvbUEy/Iqm4KUx8zO6tCFwMTGXm6ZNmIJSzdcmyPe+WDz725TDe7ZtgHH3mviv95P9itpFeriLS6LPNPkpYxAJS7AZGXUNjLWIUcuiSTRB06JD8WbavLmZddsXV3/wP490cxzjGMY5xjGMc4xjHOMYxjnGMYxzjGMc4xjGOcYxjHOMYxzjGMY5xjGMcN8v4/wSd3Ci0Ch4CAAAAAElFTkSuQmCC";

function SaidyLogoMark({ size = 32, className = "" }) {
  return (
    <img
      src={SAIDY_LOGO}
      width={size}
      height={size}
      alt="Saidy"
      className={"rounded-full " + className}
      style={{ width: size, height: size, objectFit: "cover" }}
    />
  );
}

// Klassennamen hochzählen: "5c" → "6c", "10a" → "11a"; führende Zahl +1, Rest bleibt
function promotedName(name) {
  const m = String(name).match(/^(\d+)(.*)$/);
  if (!m) return name;
  return `${Number(m[1]) + 1}${m[2]}`;
}

/* Erzeugt Kalendereinträge (type "ferien") für ein Bundesland, ohne Duplikate */
function buildFerienEvents(code, existing) {
  const list = FERIEN[code] || [];
  const have = new Set((existing || []).filter((e) => e.type === "ferien").map((e) => `${e.title}|${e.date}`));
  const out = [];
  list.forEach(([title, start, end]) => {
    const key = `${title}|${start}`;
    if (!have.has(key)) {
      out.push({ id: uid(), title, date: start, endDate: end, time: "", type: "ferien", done: false });
    }
  });
  return out;
}

function currentHalbjahr() {
  const m = new Date().getMonth() + 1; // 1-12
  return m >= 2 && m <= 7 ? 2 : 1;
}

function gradeWord(n) {
  if (n <= 1.5) return "sehr gut";
  if (n <= 2.5) return "gut";
  if (n <= 3.5) return "befriedigend";
  if (n <= 4.5) return "ausreichend";
  if (n <= 5.5) return "mangelhaft";
  return "ungenügend";
}

function gradeColor(n, colored = true) {
  if (!colored) return "text-stone-700";
  if (n <= 2.5) return "text-emerald-600";
  if (n <= 3.5) return "text-amber-600";
  return "text-red-600";
}

function fmt(n) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* Nächstliegende Option der Notenskala (inkl. Tendenz) – Basis für Anzeige UND Zeugnisvorschlag,
   damit beides nie auseinanderfällt (z. B. Schnitt 2,50 → Anzeige "2-" → Vorschlag "2-"). */
function nearestGrade(v) {
  if (v == null) return null;
  let best = GRADE_OPTIONS[0];
  for (const o of GRADE_OPTIONS) {
    if (Math.abs(o.value - v) < Math.abs(best.value - v)) best = o;
  }
  return best;
}

/* Dezimalwert → Schulnote mit Tendenz (z. B. 2,50 → "2-") */
function gradeLabel(v) {
  if (v == null) return "—";
  return nearestGrade(v).label;
}

function parseFlexibleDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); // 12.05.2013 oder 12.5.13
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = (Number(y) > 30 ? "19" : "20") + y;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); // ISO
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function tendencyInfo(avg) {
  if (avg == null) return null;
  const boundaries = [1.5, 2.5, 3.5, 4.5, 5.5];
  let nearest = boundaries[0], dist = Math.abs(avg - boundaries[0]);
  boundaries.forEach((b) => {
    const d = Math.abs(avg - b);
    if (d < dist) { dist = d; nearest = b; }
  });
  if (dist > 0.3) return null;
  const lowerGrade = Math.floor(nearest);
  const upperGrade = lowerGrade + 1;
  const currentRounded = avg < nearest ? lowerGrade : upperGrade;
  const potential = avg < nearest ? upperGrade : lowerGrade;
  const strength = dist <= 0.15 ? "sehr knapp" : "knapp";
  const direction = potential < currentRounded ? "besseren" : "schwächeren";
  // Tendenznoten (z. B. "2-", "3+") statt glatter Ziffern für die Anzeige
  const currentLabel = gradeLabel(avg);
  const potentialLabel = gradeLabel(potential < currentRounded ? nearest - 0.25 : nearest + 0.25);
  return { currentRounded, potential, strength, direction, dist, currentLabel, potentialLabel };
}

function calcOverall(grades, weights) {
  const byCat = {};
  CATS.forEach((c) => {
    const items = grades.filter((g) => g.category === c.key);
    const sumFactor = items.reduce((s, g) => s + (g.factor || 1), 0);
    byCat[c.key] = items.length
      ? { avg: items.reduce((s, g) => s + g.value * (g.factor || 1), 0) / sumFactor, count: items.length }
      : null;
  });
  const present = CATS.filter((c) => byCat[c.key]);
  if (!present.length) return { overall: null, byCat };
  const w = weights || DEFAULT_WEIGHTS;
  const sumW = present.reduce((s, c) => s + (w[c.key] ?? DEFAULT_WEIGHTS[c.key]), 0);
  const overall = present.reduce((s, c) => s + byCat[c.key].avg * (w[c.key] ?? DEFAULT_WEIGHTS[c.key]), 0) / sumW;
  return { overall, byCat };
}

/* Baut ein sicheres tel:-Ziel. Alles ausser Ziffern und den ueblichen
   Telefonzeichen faellt raus, damit eine importierte oder eingetippte
   Nummer nichts Fremdes in die URL bringt. Ohne Ziffer: kein Link. */
function telHref(raw) {
  const clean = String(raw || "").replace(/[^0-9+()\-\s]/g, "").trim();
  return /\d/.test(clean) ? `tel:${clean.replace(/\s/g, "")}` : null;
}

/* ---------- Dokumentenablage ----------
   Die Dateien selbst liegen in IndexedDB, nicht in localStorage. Der gesamte
   uebrige Datenbestand ist ein einziger JSON-String unter „app_data"; Safari
   gibt dafuer rund 5 MB. Ein einziges abfotografiertes Attest wuerde dieses
   Budget spuerbar angreifen und im Zweifel das Speichern der Noten verhindern.
   IndexedDB hat ein eigenes, deutlich groesseres Kontingent.

   Getrennt bleiben auch die Sicherungen: die normale Datensicherung enthaelt
   nur die Eintraege (Name, Datum, Zuordnung), die Dateien wandern in eine
   eigene Dokument-Sicherung. So bleibt die taegliche Sicherung klein, und die
   besonders heikle Datei entsteht nur, wenn sie bewusst angefordert wird. */

const DOC_DB = "saidy_dokumente";
const DOC_STORE = "dateien";
/* Obergrenze je Datei. Bilder werden vorher verkleinert, das greift also vor
   allem bei PDFs. 25 MB ist grosszuegig fuer ein Gutachten und haelt zugleich
   einzelne Ausreisser aus dem Speicher. */
const DOC_MAX_BYTES = 25 * 1024 * 1024;

function docDbOeffnen() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB nicht verfügbar"));
    const req = indexedDB.open(DOC_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) db.createObjectStore(DOC_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function docAktion(modus, fn) {
  return docDbOeffnen().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(DOC_STORE, modus);
        const req = fn(tx.objectStore(DOC_STORE));
        tx.oncomplete = () => { db.close(); resolve(req?.result); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      })
  );
}

const docSpeichern = (id, blob) => docAktion("readwrite", (st) => st.put(blob, id));
const docLaden = (id) => docAktion("readonly", (st) => st.get(id));
const docLoeschen = (id) => docAktion("readwrite", (st) => st.delete(id));
const docAlleIds = () => docAktion("readonly", (st) => st.getAllKeys());
const docAllesLoeschen = () => docAktion("readwrite", (st) => st.clear());

/* Safari raeumt Browser-Speicher auf, wenn eine Seite laenger nicht benutzt
   wird. Der Antrag auf dauerhaften Speicher senkt dieses Risiko - er wird nicht
   immer bewilligt, kostet aber nichts. */
async function dauerhaftenSpeicherAnfordern() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      return await navigator.storage.persist();
    }
    return true;
  } catch {
    return false;
  }
}

async function speicherBelegung() {
  try {
    const { usage, quota } = (await navigator.storage?.estimate?.()) || {};
    return typeof usage === "number" ? { belegt: usage, gesamt: quota || null } : null;
  } catch {
    return null;
  }
}

function byteText(n) {
  if (typeof n !== "number") return "–";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* Bilder verkleinern, bevor sie in den Speicher wandern. Ein iPhone-Foto hat
   3-5 MB; eine abfotografierte Entschuldigung bleibt bei 2000 px Kante gut
   lesbar und braucht danach nur einen Bruchteil davon. PDFs bleiben unberuehrt -
   sie neu zu kodieren wuerde sie eher beschaedigen als verkleinern. */
function dateiVorbereiten(file, maxKante = 2000) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei nicht lesbar"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bild nicht lesbar"));
      img.onload = () => {
        const faktor = Math.min(1, maxKante / Math.max(img.width, img.height));
        if (faktor === 1 && file.size < 800 * 1024) return resolve(file);
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * faktor);
        c.height = Math.round(img.height * faktor);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(
          (blob) => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file),
          "image/jpeg",
          0.8
        );
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Einwilligung fuer Gesundheitsdaten (Art. 9 DSGVO) ----------
   Die Einwilligung der Erziehungsberechtigten gilt immer fuer ein bestimmtes
   Kind, nie pauschal fuer die ganze Klasse. Deshalb wird sie pro studentId
   vermerkt. Der alte globale Schluessel „saidy_medical_consent" wird beim
   ersten Zugriff auf die Kinder uebertragen, bei denen bereits Gesundheits-
   daten stehen - fuer die hatte die Lehrkraft die Einwilligung ja schon
   bestaetigt. Neue Kinder werden weiterhin einzeln gefragt.
   Bewusst in localStorage und nicht im Backup: die Bestaetigung gehoert zu
   diesem Geraet und dieser Lehrkraft, nicht in eine weitergegebene Datei. */
const MEDICAL_CONSENT_KEY = "saidy_medical_consent_ids";
const MEDICAL_CONSENT_ALT = "saidy_medical_consent";

function medicalConsentIds() {
  try {
    const roh = JSON.parse(localStorage.getItem(MEDICAL_CONSENT_KEY) || "[]");
    return Array.isArray(roh) ? roh.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function hatMedicalConsent(studentId) {
  return !!studentId && medicalConsentIds().includes(studentId);
}

function setMedicalConsent(studentId) {
  if (!studentId) return;
  try {
    const ids = medicalConsentIds();
    if (!ids.includes(studentId)) localStorage.setItem(MEDICAL_CONSENT_KEY, JSON.stringify([...ids, studentId]));
  } catch { /* privater Modus */ }
}

/* Einmalige Uebernahme der alten pauschalen Bestaetigung auf die Kinder,
   bei denen schon Gesundheitsdaten hinterlegt sind. */
function migriereMedicalConsent(students) {
  try {
    if (!localStorage.getItem(MEDICAL_CONSENT_ALT)) return;
    const bereits = medicalConsentIds();
    const dazu = (students || [])
      .filter((s) => s?.id && typeof s.medicalInfo === "string" && s.medicalInfo.trim() && !bereits.includes(s.id))
      .map((s) => s.id);
    localStorage.setItem(MEDICAL_CONSENT_KEY, JSON.stringify([...bereits, ...dazu]));
    localStorage.removeItem(MEDICAL_CONSENT_ALT);
  } catch { /* privater Modus */ }
}

/* ---------- Sanitisierung importierter Datensicherungen ----------
   Eine fremde oder beschaedigte Backup-Datei darf weder den Speicher
   sprengen noch Werte einschleusen, die an heiklen Stellen landen
   (Farben gehen in style-Attribute, Datumsfelder in Vergleiche).
   Grundsatz: bekannte Felder pruefen und kuerzen, den Rest unangetastet
   durchreichen - Felder zu verwerfen wuerde beim Wiederherstellen
   womoeglich echte Daten loeschen. */

const S_TEXT = (v, n) => (typeof v === "string" ? v.slice(0, n) : typeof v === "number" ? v : null);
/* Das Muster allein reicht nicht: „2026-13-45" und „9999-99-99" haben die
   richtige Form, sind aber keine Daten. Ein zu grosses Jahr hat frueher schon
   die App eingefroren, deshalb hier echte Bereichspruefung samt Rueckrechnung
   (faengt auch den 31. Februar, der sonst still in den Maerz rutscht). */
const S_DATUM = (v) => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const [j, m, t] = v.split("-").map(Number);
  if (j < 1900 || j > 2200 || m < 1 || m > 12 || t < 1 || t > 31) return null;
  const d = new Date(j, m - 1, t);
  return d.getFullYear() === j && d.getMonth() === m - 1 && d.getDate() === t ? v : null;
};
const S_ZEIT = (v) => {
  if (typeof v !== "string" || !/^\d{2}:\d{2}$/.test(v)) return null;
  const [h, min] = v.split(":").map(Number);
  return h <= 23 && min <= 59 ? v : null;
};
const S_LISTE = (v) => (Array.isArray(v) ? v : []);
/* Farben landen direkt in style={{ backgroundColor: ... }}. Ein Wert wie
   url(https://…) wuerde von dort aus nachladen - das widerspricht dem
   Versprechen, dass Saidy nichts nach aussen sendet. */
const S_FARBE = (v) => (typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : null);
/* Schluessel wie __proto__ oder constructor haben in Nutzdaten nichts zu
   suchen und haben frueher schon zu weissen Seiten gefuehrt. */
const S_HEIKEL = new Set(["__proto__", "constructor", "prototype"]);
const S_SAUBER = (o) => {
  if (!o || typeof o !== "object") return {};
  const raus = {};
  for (const k of Object.keys(o)) if (!S_HEIKEL.has(k)) raus[k] = o[k];
  return raus;
};
/* Obergrenze pro Sammlung. So hoch angesetzt, dass keine reale Lehrkraft
   sie erreicht - gekuerzt wird nur bei absurden Dateien, und das wird
   danach gemeldet statt still hinzunehmen. */
const S_MAX = 100000;

function sanitizeImport(imported) {
  const gekuerzt = [];
  const map = (name, fn) => {
    let arr = S_LISTE(imported[name]);
    if (arr.length > S_MAX) { gekuerzt.push(name); arr = arr.slice(0, S_MAX); }
    return arr.filter((x) => x && typeof x === "object").map((x) => fn(S_SAUBER(x)));
  };

  const raus = {
    classes: map("classes", (c) => ({ ...c, name: S_TEXT(c.name, 100), deletedAt: S_DATUM(c.deletedAt) })),
    notes: map("notes", (n) => ({
      ...n, text: S_TEXT(n.text, 5000), date: S_DATUM(n.date),
      type: S_TEXT(n.type, 30), mood: S_TEXT(n.mood, 30), gesprTyp: S_TEXT(n.gesprTyp, 30),
    })),
    incidents: map("incidents", (i) => ({ ...i, label: S_TEXT(i.label, 100), date: S_DATUM(i.date), note: S_TEXT(i.note, 2000) })),
    absences: map("absences", (a) => ({
      ...a, date: S_DATUM(a.date), reason: S_TEXT(a.reason, 500),
      excuseStatus: Object.keys(EXCUSE_STATUS).includes(a.excuseStatus) ? a.excuseStatus : "ausstehend",
      source: S_TEXT(a.source, 50),
    })),
    events: map("events", (e) => ({
      ...e, title: S_TEXT(e.title, 200), date: S_DATUM(e.date), time: S_ZEIT(e.time),
      type: S_TEXT(e.type, 50), color: S_FARBE(e.color), done: e.done === true,
    })),
    timetable: map("timetable", (t) => ({
      ...t, day: WEEKDAY_KURZ.includes(t.day) ? t.day : null,
      period: Number.isInteger(t.period) && t.period >= 0 && t.period <= 20 ? t.period : null,
    })).filter((t) => t.day && t.period !== null),
    tasks: map("tasks", (t) => ({ ...t, title: S_TEXT(t.title, 300), color: S_FARBE(t.color), dueDate: S_DATUM(t.dueDate), done: t.done === true })),
    taskLists: map("taskLists", (l) => ({ ...l, name: S_TEXT(l.name, 100), icon: S_TEXT(l.icon, 50) })),
    lessonTopics: map("lessonTopics", (t) => ({ ...t, text: S_TEXT(t.text, 300), date: S_DATUM(t.date) })),
    duties: map("duties", (d) => ({
      ...d, name: S_TEXT(d.name, 100), color: S_FARBE(d.color),
      queue: S_LISTE(d.queue).filter((x) => typeof x === "string"),
      done: S_LISTE(d.done).filter((x) => typeof x === "string"),
      log: S_LISTE(d.log).slice(0, 5000),
      slots: Number.isInteger(d.slots) && d.slots > 0 && d.slots <= 40 ? d.slots : 1,
    })),
    finalGrades: map("finalGrades", (f) => ({ ...f, value: typeof f.value === "number" ? f.value : null })),
    /* Nur die Eintraege - die Dateien kommen aus der getrennten Dokument-
       Sicherung. `scope` steuert, wo ein Dokument auftaucht; ein fremder Wert
       wuerde es unauffindbar machen, deshalb Rueckfall auf „frei". */
    documents: map("documents", (d) => ({
      ...d,
      name: S_TEXT(d.name, 200),
      mime: S_TEXT(d.mime, 100),
      note: S_TEXT(d.note, 500),
      addedAt: S_DATUM(d.addedAt),
      size: Number.isFinite(d.size) && d.size >= 0 ? d.size : 0,
      scope: ["student", "class", "fach", "frei"].includes(d.scope) ? d.scope : "frei",
      scopeId: typeof d.scopeId === "string" ? d.scopeId.slice(0, 100) : null,
    })),
  };
  return { daten: raus, gekuerzt };
}

/* ---------- Foto-Verarbeitung & Avatar ---------- */

function resizeImageFile(file, size = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = () => reject(new Error("Bild konnte nicht geladen werden"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden"));
    reader.readAsDataURL(file);
  });
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase();
}

function nameColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
}

function StudentAvatar({ student, size = 32 }) {
  if (student.photo) {
    return (
      <img
        src={student.photo}
        alt=""
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, backgroundColor: nameColor(student.name), fontSize: size * 0.38 }}
    >
      {initials(student.name)}
    </div>
  );
}

/* ---------- Kleine UI-Bausteine ---------- */

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-10 h-[22px] rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[color:var(--oliv)] ${checked ? "akzent-flaeche" : "bg-stone-200"}`}
    >
      <span className={`absolute top-[3px] left-[3px] w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0"}`} />
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={`karte rounded-xl ${className}`}>{children}</div>;
}

/* Sicherheitsabfrage vor dem Löschen. Gesteuert über einen State { title, message, onConfirm }. */
function ConfirmDialog({ open, title, message, confirmLabel = "Löschen", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[80]" onClick={onCancel}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2.5 mb-4">
          <span className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0"><Trash2 size={17} /></span>
          <div>
            <div className="font-semibold text-stone-800">{title}</div>
            {message && <p className="text-sm text-stone-500 mt-0.5">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onCancel} className="flex-1 justify-center">Abbrechen</Button>
          <Button variant="danger" onClick={onConfirm} className="flex-1 justify-center">{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

function Button({ children, onClick, variant = "primary", className = "", type = "button", disabled }) {
  const base = "inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[44px] rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed";
  const variants = {
    primary: "akzent-flaeche",
    ghost: "bg-transparent text-stone-600 hover:bg-stone-100",
    danger: "bg-transparent text-red-600 hover:bg-red-50",
    subtle: "bg-stone-100 text-stone-700 hover:bg-stone-200",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Abbr({ short, long }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="underline decoration-dotted decoration-green-500 underline-offset-2 cursor-help font-[inherit] text-[inherit]"
      >
        {short}
      </button>
      {open && (
        <span className="absolute left-0 top-full mt-1 z-50 text-[10px] text-green-700 bg-green-50 border border-green-200 rounded-lg px-2 py-1 whitespace-nowrap shadow-sm">
          {long}
        </span>
      )}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-stone-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:border-transparent";

/* Farbwähler für Fächer – Wunschfarbe per Klick auswählen */
function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-3.5 h-3.5 rounded-full ring-2 ring-white shadow shrink-0"
        style={{ backgroundColor: value }}
        aria-label="Farbe wählen"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 top-6 left-0 bg-white border border-stone-200 rounded-lg shadow-lg p-2 flex flex-wrap gap-1.5 w-32">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => { onChange(c); setOpen(false); }}
                className="w-5 h-5 rounded-full"
                style={{ backgroundColor: c, boxShadow: c === value ? "0 0 0 2px white, 0 0 0 3.5px #292524" : "0 0 0 2px white" }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* Tendenz-Meter: horizontaler Streifen 1–6 mit Marker, das Signature-Element */
function TendencyMeter({ value, colored = true }) {
  if (value == null) return null;
  const pct = Math.min(100, Math.max(0, ((value - 1) / 5) * 100));
  return (
    <div className="w-full">
      <div className="relative h-3.5">
        <span
          className={`absolute -translate-x-1/2 text-sm leading-none font-bold ${gradeColor(value, colored)}`}
          style={{ left: `${pct}%`, top: 0 }}
        >
          ▼
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-400">
        {[1.5, 2.5, 3.5, 4.5].map((b) => (
          <div key={b} className="absolute top-0 h-2.5 w-px bg-white/70" style={{ left: `${((b - 1) / 5) * 100}%` }} />
        ))}
        <div
          className="absolute top-0 h-2.5 w-0.5 bg-white shadow"
          style={{ left: `calc(${pct}% - 1px)` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-stone-400 mt-1 px-0.5">
        {[1, 2, 3, 4, 5, 6].map((n) => <span key={n}>{n}</span>)}
      </div>
    </div>
  );
}

/* ---------- Hauptkomponente ---------- */

/* WebUntis Fehlzeiten-CSV importieren */
function WebUntisImportModal({ students, existingAbsences, onImport, onClose }) {
  const [rows, setRows] = useState(null);     // parsed CSV rows
  const [headers, setHeaders] = useState([]); // CSV headers
  const [cols, setCols] = useState(null);     // detected column indices
  const [preview, setPreview] = useState([]); // matched preview rows
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const existingFingerprints = useMemo(() => {
    const set = new Set();
    (existingAbsences || []).forEach((a) => set.add(`${a.studentId}|${a.date}|${a.excuseStatus}|${a.reason || ""}`));
    return set;
  }, [existingAbsences]);

  function handleFile(file) {
    if (!file) return;
    setError("");
    if (file.size > 5 * 1024 * 1024) { setError("Diese Datei ist zu groß (max. 5 MB). Bitte wähle eine CSV-Exportdatei."); return; }
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (res) => {
        const data = res.data;
        if (!data.length) { setError("Die Datei enthält keine Daten."); return; }
        const hdrs = data[0].map((h) => String(h));
        const detected = detectUntisColumns(hdrs);
        setHeaders(hdrs);
        setCols(detected);
        const dataRows = data.slice(1);
        setRows(dataRows);
        // Vorschau: erste 5 gematchte Zeilen
        const prev = dataRows.slice(0, 8).map((r) => {
          const name = detected.studentName >= 0 ? r[detected.studentName] : "";
          const date = detected.date >= 0 ? r[detected.date] : "";
          const excusedRaw = detected.excused >= 0 ? r[detected.excused] : "";
          const reason = detected.reason >= 0 ? r[detected.reason] : "";
          const studentId = matchStudentByName(name, students);
          const student = students.find((s) => s.id === studentId);
          return { name, date: parseUntisDate(date) || date, excusedRaw, excuseStatus: parseUntisExcused(excusedRaw), reason, studentId, studentName: student?.name };
        });
        setPreview(prev);
      },
      error: () => setError("Die Datei konnte nicht gelesen werden. Bitte CSV-Format prüfen."),
    });
  }

  function doImport() {
    if (!rows || !cols) return;
    const newAbsences = [];
    let skipped = 0;
    rows.forEach((r) => {
      const name = cols.studentName >= 0 ? r[cols.studentName] : "";
      const dateRaw = cols.date >= 0 ? r[cols.date] : "";
      const excusedRaw = cols.excused >= 0 ? r[cols.excused] : "";
      const reason = cols.reason >= 0 ? r[cols.reason] : "";
      const studentId = matchStudentByName(name, students);
      if (!studentId) return;
      const date = parseUntisDate(dateRaw);
      if (!date) return;
      const excuseStatus = parseUntisExcused(excusedRaw);
      const fingerprint = `${studentId}|${date}|${excuseStatus}|${reason || ""}`;
      if (existingFingerprints.has(fingerprint)) { skipped++; return; }
      newAbsences.push({ id: uid(), studentId, date, excuseStatus, reason: reason || null, source: "webuntis" });
    });
    onImport(newAbsences, skipped);
  }

  const matched = preview.filter((p) => p.studentId).length;

  const { newCount, dupCount } = useMemo(() => {
    if (!rows || !cols) return { newCount: 0, dupCount: 0 };
    let newC = 0, dupC = 0;
    rows.forEach((r) => {
      const name = cols.studentName >= 0 ? r[cols.studentName] : "";
      const dateRaw = cols.date >= 0 ? r[cols.date] : "";
      const excusedRaw = cols.excused >= 0 ? r[cols.excused] : "";
      const reason = cols.reason >= 0 ? r[cols.reason] : "";
      const studentId = matchStudentByName(name, students);
      if (!studentId) return;
      const date = parseUntisDate(dateRaw);
      if (!date) return;
      const excuseStatus = parseUntisExcused(excusedRaw);
      const fp = `${studentId}|${date}|${excuseStatus}|${reason || ""}`;
      if (existingFingerprints.has(fp)) dupC++; else newC++;
    });
    return { newCount: newC, dupCount: dupC };
  }, [rows, cols, students, existingFingerprints]);

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-[60]" onClick={onClose}>
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10">
          <div>
            <div className="font-semibold text-stone-800">WebUntis Fehlzeiten importieren</div>
            <div className="text-xs text-stone-400"><Abbr short="CSV" long="Komma-getrennte Tabellendatei, aus WebUntis exportierbar" />-Export aus WebUntis hochladen</div>
          </div>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
        </div>
        <div className="p-4 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
          <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-600 space-y-1">
            <p className="font-medium text-stone-700">So geht's in WebUntis:</p>
            <p>1. Klassenbuch → Fehlzeiten → Zeitraum wählen</p>
            <p>2. Export als <Abbr short="CSV" long="Komma-getrennte Tabellendatei" /> herunterladen</p>
            <p>3. Hier hochladen</p>
          </div>

          {!rows && (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-stone-200 rounded-xl py-8 text-center hover:border-stone-400 transition-colors"
            >
              <Upload size={24} className="mx-auto mb-2 text-stone-300" />
              <div className="text-sm text-stone-500">WebUntis-Datei hochladen</div>
              <div className="text-xs text-stone-400 mt-0.5">Klassenbuch → Fehlzeiten → Als Datei exportieren</div>
            </button>
          )}
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
          {error && <p className="text-sm text-red-600">{error}</p>}

          {rows && cols && (
            <>
              <div className="bg-stone-50 rounded-xl p-3 space-y-1.5 text-xs">
                <div className="font-medium text-stone-600 mb-2">Erkannte Spalten:</div>
                {[
                  { key: "studentName", label: "Schüler:in" },
                  { key: "date", label: "Datum" },
                  { key: "excused", label: "Entschuldigt" },
                  { key: "reason", label: "Grund" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-stone-500">{label}</span>
                    {cols[key] >= 0
                      ? <span className="font-medium text-stone-700">„{headers[cols[key]]}"</span>
                      : <span className="text-stone-400">nicht gefunden – wird übersprungen</span>
                    }
                  </div>
                ))}
              </div>

              {cols.reason >= 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
                  <ShieldCheck size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <span>Diese Datei enthält Begründungen (z. B. Krankheit) – das sind besondere Daten nach <strong>Art. 9 DSGVO</strong>. Nur importieren, wenn eine schriftliche Einwilligung der Erziehungsberechtigten vorliegt.</span>
                </div>
              )}
              {preview.length > 0 && (
                <div>
                  <div className="text-[11px] font-medium text-stone-400 uppercase tracking-wide mb-2">
                    Vorschau ({matched} von {preview.length} Zeilen zugeordnet)
                  </div>
                  <ul className="space-y-1.5">
                    {preview.map((p, i) => (
                      <li key={i} className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${p.studentId ? "bg-stone-50" : "bg-red-50"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.studentId ? "bg-green-500" : "bg-red-400"}`} />
                        <span className="flex-1 text-stone-700 truncate">
                          {p.studentName || <span className="text-red-500">{p.name} (nicht gefunden)</span>}
                        </span>
                        <span className="text-stone-400 shrink-0">{p.date}</span>
                        <span className="shrink-0" style={{ color: EXCUSE_STATUS[p.excuseStatus]?.color }}>
                          {EXCUSE_STATUS[p.excuseStatus]?.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {matched === 0 && (
                    <p className="text-xs text-red-600 mt-2">Keine Schüler:innen konnten zugeordnet werden. Bitte prüfe, ob die Namen in Saidy und WebUntis übereinstimmen.</p>
                  )}
                </div>
              )}

              {dupCount > 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  {dupCount === rows.length
                    ? "Alle Einträge sind bereits vorhanden – es gibt nichts Neues zu importieren."
                    : `${dupCount} bereits vorhandene Einträge werden übersprungen.`}
                </p>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setRows(null); setPreview([]); }} className="flex-1 justify-center">Andere Datei</Button>
                <Button onClick={doImport} disabled={newCount === 0} className="flex-1 justify-center">
                  <Upload size={15} /> {newCount > 0 ? `${newCount} neue Einträge importieren` : "Nichts Neues"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LegalModal({ onClose }) {
  const [activeTab, setActiveTab] = useState("impressum");
  const tabs = [["impressum", "Impressum"], ["nutzung", "Nutzung"], ["datenschutz", "Datenschutz"]];
  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-[60]" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="font-semibold text-stone-800">Rechtliches</div>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="flex border-b border-stone-100 px-5 gap-1">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2.5 px-2 text-sm font-medium border-b-2 transition-colors ${activeTab === key ? "border-[var(--oliv)] akzent-text" : "border-transparent text-stone-400 hover:text-stone-600"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="p-5 pb-[max(2rem,env(safe-area-inset-bottom))] text-sm text-stone-700 leading-relaxed space-y-5">
          {activeTab === "nutzung" ? (
            <>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Zielgruppe</div>
                <p className="text-xs text-stone-600">Saidy richtet sich ausschließlich an volljährige Lehrkräfte für den beruflichen Gebrauch. Die App ist nicht für die Nutzung durch Schülerinnen und Schüler oder Erziehungsberechtigte bestimmt.</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Gerätesicherheit</div>
                <div className="space-y-2 text-xs text-stone-600">
                  <p>Saidy speichert alle Daten lokal im Browser-Speicher. Daher gilt:</p>
                  <div className="space-y-1.5 pl-1">
                    <div className="flex items-start gap-2"><span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span><span>Nicht auf geteilten Schulcomputern oder öffentlichen Geräten nutzen</span></div>
                    <div className="flex items-start gap-2"><span className="text-red-500 font-bold shrink-0 mt-0.5">✕</span><span>Nicht im privaten Browser-Modus (InPrivate / Inkognito) – Daten gehen beim Schließen verloren</span></div>
                    <div className="flex items-start gap-2"><span className="akzent-text font-bold shrink-0 mt-0.5">✓</span><span>Nur auf dem eigenen, gesperrten und passwortgeschützten Gerät verwenden</span></div>
                    <div className="flex items-start gap-2"><span className="akzent-text font-bold shrink-0 mt-0.5">✓</span><span>Gerät sperren, wenn die App nicht aktiv genutzt wird</span></div>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Backup & Datenverlust</div>
                <div className="space-y-1.5 text-xs text-stone-600">
                  <p>Da alle Daten nur lokal gespeichert sind, liegt Datensicherung in der Verantwortung der Lehrkraft.</p>
                  <div className="flex items-start gap-2"><span className="akzent-text font-bold shrink-0 mt-0.5">✓</span><span>Regelmäßige Backups erstellen (Einstellungen → Backup → Sichern)</span></div>
                  <div className="flex items-start gap-2"><span className="akzent-text font-bold shrink-0 mt-0.5">✓</span><span>Backup vor jedem Gerätewechsel oder Browser-Update</span></div>
                  <div className="flex items-start gap-2"><span className="akzent-text font-bold shrink-0 mt-0.5">✓</span><span>Am Ende des Schuljahres Daten löschen oder sicher archivieren</span></div>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Haftungsausschluss</div>
                <div className="space-y-2 text-xs text-stone-600">
                  <p>Die App wird <strong className="text-stone-800">ohne Gewähr</strong> zur Verfügung gestellt. Der Entwickler übernimmt keine Haftung für:</p>
                  <div className="space-y-1 pl-1">
                    <div className="flex items-start gap-2"><span className="text-stone-400 shrink-0">·</span><span>Datenverlust durch Browser-Updates, Gerätewechsel oder Cache-Leerung</span></div>
                    <div className="flex items-start gap-2"><span className="text-stone-400 shrink-0">·</span><span>Fehlerhafte Notenberechnungen oder Anzeigefehler</span></div>
                    <div className="flex items-start gap-2"><span className="text-stone-400 shrink-0">·</span><span>Datenschutzverstöße durch unsachgemäße Nutzung (z. B. auf geteilten Geräten)</span></div>
                    <div className="flex items-start gap-2"><span className="text-stone-400 shrink-0">·</span><span>Ausfälle oder Datenverlust durch Drittdienste (Apple/Google Spracherkennung, GitHub Pages)</span></div>
                    <div className="flex items-start gap-2"><span className="text-stone-400 shrink-0">·</span><span>Rechtliche Konsequenzen aus der Nutzung (z. B. Schuldatenschutz-Verletzungen)</span></div>
                  </div>
                  <p>Die datenschutzrechtliche Verantwortung für eingegebene Schüler- und Klassendaten liegt gemäß <strong className="text-stone-800">Art. 4 Nr. 7 DSGVO</strong> ausschließlich bei der nutzenden Lehrkraft.</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
                Saidy ist ein privates Werkzeug, kein offiziell geprüftes Schulverwaltungssystem. Ob die Nutzung mit den Datenschutzrichtlinien deiner Schule und deines Bundeslandes vereinbar ist, kläre bitte mit deiner Schulleitung oder dem Datenschutzbeauftragten.
              </div>
            </>
          ) : activeTab === "impressum" ? (
            <>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">Angaben gemäß § 5 DDG</div>
                <p className="font-medium text-stone-800">[VORNAME NACHNAME]</p>
                <p>[STRASSE HAUSNUMMER]</p>
                <p>[PLZ ORT]</p>
                <p>Deutschland</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1">Kontakt</div>
                <p>E-Mail: [EMAIL]</p>
              </div>
              <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 space-y-1.5">
                <p>Dieses Projekt wird als privates, nicht-kommerzielles Vorhaben ohne Gewinnerzielungsabsicht betrieben.</p>
                <p>Es besteht kein Handelsregistereintrag und keine Umsatzsteuer-Identifikationsnummer.</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1">Streitschlichtung</div>
                <p className="text-xs text-stone-500">Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">1. Verantwortlicher (Webangebot)</div>
                <p className="text-xs text-stone-600 mb-1">Verantwortlicher für das Webangebot im Sinne der DSGVO:</p>
                <p className="font-medium text-stone-800">[VORNAME NACHNAME]</p>
                <p className="text-xs text-stone-600">[STRASSE HAUSNUMMER], [PLZ ORT]</p>
                <p className="text-xs text-stone-600">E-Mail: [EMAIL]</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">2. Hosting (GitHub Pages)</div>
                <p className="text-xs text-stone-600">Diese App wird über GitHub Pages gehostet:</p>
                <p className="text-xs font-medium text-stone-800 mt-1">GitHub, Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, USA</p>
                <p className="text-xs text-stone-500 mt-1">GitHub verarbeitet beim Aufruf technische Zugriffsdaten (IP-Adresse, Zeitstempel, Browsertyp) in Server-Logfiles. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Serverstandort: USA. Weitere Infos: docs.github.com/privacy</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">3. App-Daten (Schüler, Noten, Klassen)</div>
                <div className="space-y-2 text-xs text-stone-600">
                  <p>Alle in der App eingegebenen Daten werden <strong className="text-stone-800">ausschließlich lokal</strong> auf deinem Gerät gespeichert (Browser-localStorage). Es erfolgt <strong className="text-stone-800">keine Übertragung</strong> an den Entwickler oder Dritte.</p>
                  <p>Der Entwickler hat keinen Zugriff auf eingegebene Daten.</p>
                  <p>Die nutzende Lehrkraft ist gemäß <strong className="text-stone-800">Art. 4 Nr. 7 DSGVO</strong> selbst datenschutzrechtlich Verantwortliche:r für die eingegebenen Schüler- und Klassendaten und dafür verantwortlich, geltende schulrechtliche Datenschutzvorgaben einzuhalten (z. B. Einwilligungen bei Fotos oder Gesundheitsdaten).</p>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">4. Lokale Datenspeicherung</div>
                <p className="text-xs text-stone-600">Saidy verwendet ausschließlich den localStorage des Browsers. Es werden keine Tracking-Cookies gesetzt. Die gespeicherten Daten verlassen das Gerät nicht automatisch.</p>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-2">5. Haftungsausschluss</div>
                <p className="text-xs text-stone-600">Die App wird ohne Gewähr bereitgestellt. Der Entwickler übernimmt keine Haftung für Datenverlust, fehlerhafte Berechnungen oder Folgen aus der Nutzung. Für die DSGVO-konforme Nutzung ist die nutzende Lehrkraft selbst verantwortlich.</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
                Diese Seite ersetzt keine individuelle Rechtsberatung. Für steuerliche Fragen konsultiere bitte eine:n Steuerberater:in.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Einstellungen: Reihenfolge der Dashboard-Karten per Pfeiltasten anpassen */
function SettingsModal({ data, update, halbjahr, setHalbjahr, onExport, onShare, onImport, onExportDocuments, onImportDocuments, onReset, onClose, onOpenUntisImport }) {
  const gespeicherteReihenfolge = data.settings?.dashboardOrder || Object.keys(DASHBOARD_SECTIONS);
  const order = [
    ...gespeicherteReihenfolge.filter((k) => DASHBOARD_SECTIONS[k]),
    ...Object.keys(DASHBOARD_SECTIONS).filter((k) => !gespeicherteReihenfolge.includes(k)),
  ];
  const currentBundesland = data.settings?.bundesland || "";
  const importInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null); // { ok, msg }
  const [confirmImport, setConfirmImport] = useState(null); // File
  /* Getrennte Dokument-Sicherung: eigener Datei-Input und eigene Meldung,
     damit die beiden Vorgaenge nicht durcheinandergeraten. */
  const dokImportRef = useRef(null);
  const [dokMsg, setDokMsg] = useState(null);
  const [speicher, setSpeicher] = useState(null);
  const dokAnzahl = (data.documents || []).length;
  useEffect(() => { speicherBelegung().then(setSpeicher); }, [dokAnzahl]);
  const [confirmBackupAction, setConfirmBackupAction] = useState(null); // 'export' | 'share'
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [confirmDeleteSnapshot, setConfirmDeleteSnapshot] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showICloudSteps, setShowICloudSteps] = useState(false);
  const [confirmICloud, setConfirmICloud] = useState(false);
  const [showPromote, setShowPromote] = useState(false);
  const [showLegal, setShowLegal] = useState(false);

  function promoteClasses(ids) {
    update((d) => {
      d.classes.forEach((c) => {
        if (ids.includes(c.id)) c.name = promotedName(c.name);
      });
      return d;
    });
    setShowPromote(false);
  }

  function setSetting(key, value) {
    update((d) => {
      d.settings = { ...(d.settings || {}), [key]: value };
      return d;
    });
  }

  function setBundesland(code) {
    update((d) => {
      d.settings = { ...(d.settings || {}), bundesland: code };
      return d;
    });
  }

  function addFerien() {
    const code = data.settings?.bundesland;
    if (!code) return;
    update((d) => {
      d.events = [...(d.events || []), ...buildFerienEvents(code, d.events)];
      d.settings = { ...(d.settings || {}), ferienAdded: true };
      return d;
    });
  }

  function removeFerien() {
    update((d) => {
      d.events = (d.events || []).filter((e) => e.type !== "ferien");
      d.settings = { ...(d.settings || {}), ferienAdded: false };
      return d;
    });
  }

  const ferienCount = (data.events || []).filter((e) => e.type === "ferien").length;

  function move(index, dir) {
    const target = index + dir;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    update((d) => {
      d.settings = { ...(d.settings || {}), dashboardOrder: next };
      return d;
    });
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={onClose}>
      <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="font-semibold text-stone-800">Einstellungen</div>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Schuljahr</div>
        <div className="text-xs font-medium text-stone-500 mb-2">Bundesland & Schulferien</div>
        <select className={`${inputCls} mb-2`} value={currentBundesland} onChange={(e) => setBundesland(e.target.value)}>
          <option value="">Bundesland wählen …</option>
          {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
        </select>
        {currentBundesland && !FERIEN[currentBundesland] && (
          <p className="text-xs text-amber-700 mb-2">Für dieses Bundesland sind noch keine Ferientermine hinterlegt.</p>
        )}
        <div className="flex gap-2 mb-4">
          {ferienCount > 0 ? (
            <Button variant="ghost" onClick={removeFerien} className="flex-1 justify-center">Ferien entfernen ({ferienCount})</Button>
          ) : (
            <Button variant="subtle" onClick={addFerien} disabled={!FERIEN[currentBundesland]} className="flex-1 justify-center">Schulferien eintragen</Button>
          )}
        </div>

        <div className="border-t border-stone-100 pt-3 mt-1" />
        <div className="text-xs font-medium text-stone-500 mb-2">Halbjahr</div>
        <div className="flex gap-1.5 mb-4">
          {[1, 2].map((h) => (
            <button
              key={h}
              onClick={() => setHalbjahr(h)}
              className={`flex-1 text-sm py-2 rounded-lg border ${
                halbjahr === h ? "akzent-flaeche akzent-rand" : "border-stone-200 text-stone-500 hover:bg-stone-50"
              }`}
            >
              {h}. Halbjahr
            </button>
          ))}
        </div>

        <div className="border-t border-stone-100 pt-3 mt-1" />
        <div className="text-xs font-medium text-stone-500 mb-1">Neues Schuljahr</div>
        <Button variant="subtle" onClick={() => setShowPromote(true)} disabled={!data.classes.length} className="w-full justify-center mb-5 pb-2">
          <ChevronRight size={15} className="-rotate-90" /> Schuljahreswechsel: Klassen versetzen
        </Button>
        <div className="border-b border-stone-100 mb-5" />

        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Übersicht (Startseite)</div>

        <div className="flex items-center justify-between gap-2 py-2">
          <span className="text-sm text-stone-700">Ferien-Countdown anzeigen</span>
          <Toggle checked={!!data.settings?.showFerienCountdown} onChange={(v) => setSetting("showFerienCountdown", v)} />
        </div>
        {data.settings?.showFerienCountdown && (
          <div className="flex items-center justify-between gap-2 py-2 pl-3 mb-2">
            <span className="text-xs text-stone-500">Nur Schultage zählen (Mo–Fr)</span>
            <Toggle checked={!!data.settings?.countdownSchooldaysOnly} onChange={(v) => setSetting("countdownSchooldaysOnly", v)} />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 py-2 mb-2">
          <span className="text-xs text-stone-500">Notenfarben anzeigen (grün / gelb / rot)</span>
          <Toggle checked={data.settings?.notenfarben !== false} onChange={(v) => setSetting("notenfarben", v)} />
        </div>

        <div className="text-xs font-medium text-stone-500 mb-2">Reihenfolge der Karten</div>
        <ul className="space-y-1.5 mb-2">
          {order.map((key, i) => (
            <li key={key} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-stone-700">{DASHBOARD_SECTIONS[key] || key}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-11 h-11 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={15} className="rotate-90" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="w-11 h-11 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={15} className="rotate-90" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-400 mb-4">Legt fest, in welcher Reihenfolge die unteren Karten auf der Übersicht erscheinen. Kennzahlen, Unterricht sowie Termine, Geburtstage und To-dos haben einen festen Platz.</p>

        {/* Was in der "Seit deinem letzten Besuch"-Karte im Schuelerprofil erscheint.
            Default: alle sechs Kategorien an. Setzt der Nutzer eine ab, wird sie nicht mehr
            aufgelistet - der Besuchszeitpunkt selbst wird unabhaengig davon getrackt. */}
        <div className="pt-5 border-t border-stone-100">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">„Was ist neu"-Karte im Schülerprofil</div>
          <p className="text-xs text-stone-500 mb-3">
            Waehle aus, was in der Karte „Seit deinem letzten Besuch" oben im Profil erscheint. Alles was du hier abschaltest, wird dort nicht mehr aufgelistet.
          </p>
          {[
            ["noten", "Neue Noten"],
            ["notizen", "Neue Notizen"],
            ["gespraeche", "Neue Gespräche (mit Stimmung)"],
            ["fehlzeiten", "Neue Fehlzeiten"],
            ["incidents", "Neue Klassenbuch-Einträge"],
            ["ziele", "Neue oder erledigte Förderziele"],
          ].map(([key, label]) => {
            const aktiv = (data.settings?.neuSeitAnzeige || {})[key] !== false;
            return (
              <label key={key} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4"
                  style={{ accentColor: "#4F5844" }}
                  checked={aktiv}
                  onChange={(e) => setSetting("neuSeitAnzeige", { ...(data.settings?.neuSeitAnzeige || {}), [key]: e.target.checked })}
                />
                <span className="text-sm text-stone-700">{label}</span>
              </label>
            );
          })}
        </div>

        {/* Unterrichtstipp-Kachel abschaltbar. Grundstock im Code, spaeter kommen eigene
            Karten dazu (Editor/Import); die Auswahl kann jederzeit wieder eingeschaltet werden. */}
        <div className="pt-5 border-t border-stone-100">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Unterrichtstipps</div>
          <p className="text-xs text-stone-500 mb-3">
            Zeigt ganz unten auf der Übersicht einen Unterrichtstipp des Tages – ein Tipp aus dem Wissenspool. Aktuell {TIPP_KARTEN.length} Karten von Grundschul- bis Sekundarstufe.
          </p>
          <label className="flex items-center gap-2.5 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4"
              style={{ accentColor: "#4F5844" }}
              checked={data.settings?.tippsAn !== false}
              onChange={(e) => setSetting("tippsAn", e.target.checked)}
            />
            <span className="text-sm text-stone-700">Tipp des Tages auf der Übersicht anzeigen</span>
          </label>
        </div>

        <div className="pt-5 border-t border-stone-100">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Datensicherung</div>
          <p className="text-xs text-stone-500 mb-3">
            Deine Daten liegen auf diesem Gerät. Sichere sie regelmäßig als Datei, damit bei Geräteverlust oder App-Neuinstallation nichts verloren geht.
          </p>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 mb-3 flex items-start gap-2">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-stone-600 leading-relaxed">
              <strong>Geteilte Schulcomputer:</strong> Saidy speichert Daten im Browser. Wenn mehrere Lehrkräfte dasselbe Browser-Profil nutzen, können alle auf diese Daten zugreifen. Nutze Saidy nur in deinem <strong>eigenen, privaten Browser-Profil</strong>.
            </p>
          </div>
          <div className="flex gap-2 mb-2">
            <Button variant="subtle" onClick={() => setConfirmBackupAction("export")} className="flex-1 justify-center"><Download size={15} /> Sichern</Button>
            <Button variant="subtle" onClick={() => setConfirmBackupAction("share")} className="flex-1 justify-center"><Upload size={15} /> Teilen</Button>
          </div>
          <Button variant="ghost" onClick={() => importInputRef.current?.click()} className="w-full justify-center"><Upload size={15} /> Gesichertes wiederherstellen</Button>
          <input
            ref={importInputRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setConfirmImport(f); e.target.value = ""; }}
          />
          {importMsg && (
            <p className={`text-xs mt-2 ${importMsg.ok ? "akzent-text" : "text-red-600"}`}>{importMsg.msg}</p>
          )}
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-[11px] font-semibold text-amber-800 mb-1 flex items-center gap-1.5">
              <ShieldCheck size={12} className="shrink-0" />
              Vor dem Sichern kurz lesen
            </div>
            <ul className="text-[11px] text-stone-700 space-y-0.5 leading-snug">
              <li>• <strong>Nicht per E-Mail oder Messenger</strong> teilen.</li>
              <li>• <strong>Nicht in Google Drive, Dropbox oder iCloud</strong> ablegen.</li>
              <li>• Nur auf dem eigenen Gerät oder Schul-Server aufbewahren.</li>
            </ul>
          </div>

          {/* Dokumente werden getrennt gesichert - sie wuerden die taegliche
              Sicherung sonst stark aufblaehen und sind besonders heikel. */}
          <div className="mt-4 pt-3 border-t border-stone-100">
            <div className="text-xs font-medium text-stone-500 mb-1">Dokumente sichern</div>
            <p className="text-[11px] text-stone-500 mb-2 leading-relaxed">
              Abgelegte Dateien (Atteste, Gutachten, Fotos) stecken <strong>nicht</strong> in der normalen Datensicherung –
              sie brauchen eine eigene Datei. {dokAnzahl ? `Aktuell ${dokAnzahl} ${dokAnzahl === 1 ? "Dokument" : "Dokumente"}.` : "Aktuell sind keine abgelegt."}
              {speicher && ` Belegt: ${byteText(speicher.belegt)}${speicher.gesamt ? ` von ${byteText(speicher.gesamt)}` : ""}.`}
            </p>
            <div className="flex gap-2 mb-2">
              <Button variant="subtle" onClick={() => onExportDocuments?.((r) => setDokMsg(r))} className="flex-1 justify-center">
                <Download size={15} /> Dokumente sichern
              </Button>
              <Button variant="ghost" onClick={() => dokImportRef.current?.click()} className="flex-1 justify-center">
                <Upload size={15} /> Einspielen
              </Button>
            </div>
            <input
              ref={dokImportRef} type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportDocuments?.(f, (r) => setDokMsg(r)); e.target.value = ""; }}
            />
            {dokMsg && <p className={`text-xs ${dokMsg.ok ? "akzent-text" : "text-red-600"}`}>{dokMsg.msg}</p>}
            <p className="text-[11px] text-amber-700 mt-1.5 leading-snug">
              Diese Datei enthält Atteste und Gutachten im Klartext – dieselben Regeln wie oben, nur noch strenger.
            </p>
          </div>

          {/* Empfohlener Weg: auf dem Gerät ablegen statt verschicken */}
          <div className="mt-3 bg-stone-50 rounded-xl px-3 py-2.5">
            <div className="text-xs font-medium text-stone-600 mb-1">Am einfachsten: auf dem Gerät ablegen</div>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              „Teilen" → <strong>In Dateien sichern</strong> → <strong>Auf meinem iPhone</strong>. Ein Schritt, kein Tippen,
              und die Daten verlassen dein Gerät nicht. Verschicke Backups nicht per E-Mail oder Messenger –
              sie enthalten alle Schülerdaten im Klartext.
            </p>
          </div>

          {/* Freitags-Erinnerung */}
          {"Notification" in window && (
            <div className="mt-4 border-t border-stone-100 pt-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-stone-500">Freitags-Erinnerung</div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    Erinnert dich freitags beim Öffnen von Saidy, wenn dein letztes Backup älter als 3 Tage ist.
                  </div>
                </div>
                <Toggle
                  checked={!!data.settings?.backupNotifications}
                  onChange={async () => {
                    if (data.settings?.backupNotifications) {
                      setSetting("backupNotifications", false);
                      return;
                    }
                    try {
                      const perm = await Notification.requestPermission();
                      if (perm !== "granted") return;
                      setSetting("backupNotifications", true);
                      notify("Saidy – Erinnerung aktiv", "Du wirst freitags daran erinnert, dein Backup zu erneuern.");
                    } catch {
                      // Manche Browser (u. a. ältere Android-WebViews) werfen hier – Schalter bleibt dann aus
                    }
                  }}
                />
              </div>
              {Notification.permission === "denied" && (
                <p className="text-[11px] text-amber-700 mt-1.5">
                  Benachrichtigungen sind im Browser blockiert. Du kannst sie in den Browser-Einstellungen für diese Seite wieder erlauben.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="pt-5 border-t border-stone-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide">iCloud / Geräteübergreifend</div>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Nicht DSGVO-konform</span>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
            <p className="text-[11px] font-semibold text-amber-800 mb-1">Rechtlicher Hinweis</p>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Die Speicherung von Schülerdaten in privaten Cloud-Diensten (iCloud, Google Drive, Dropbox) entspricht in der Regel nicht den datenschutzrechtlichen Anforderungen an Schulen in Deutschland (DSGVO Art. 32; landesrechtliche Schulgesetze). Die Nutzung dieser Option erfolgt ausschließlich auf eigene Verantwortung der jeweiligen Lehrkraft. Der Anbieter dieser App übernimmt keine Haftung für datenschutzrechtliche Verstöße, die sich aus der Ablage in nicht genehmigten Diensten ergeben.
            </p>
          </div>
          {confirmICloud && (
            <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmICloud(false)}>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
                <div className="font-semibold text-stone-800 mb-2">Auf eigene Verantwortung?</div>
                <p className="text-sm text-stone-600 mb-4">
                  Du bist dir bewusst, dass die Nutzung von iCloud für Schülerdaten in Deutschland <strong>nicht DSGVO-konform</strong> ist und in deiner eigenen Verantwortung liegt?
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmICloud(false)} className="flex-1 justify-center">Abbrechen</Button>
                  <Button variant="danger" onClick={() => { setShowICloudSteps(true); setConfirmICloud(false); }} className="flex-1 justify-center">Ja, ich übernehme die Verantwortung</Button>
                </div>
              </div>
            </div>
          )}
          {!showICloudSteps ? (
            <button
              onClick={() => setConfirmICloud(true)}
              className="w-full text-xs text-stone-400 hover:text-stone-600 border border-dashed border-stone-200 rounded-xl py-2.5 transition-colors"
            >
              Trotzdem nutzen – auf eigene Verantwortung
            </button>
          ) : (
            <>
              <p className="text-xs text-stone-500 mb-2">So nutzt du iCloud Drive zur manuellen Synchronisation:</p>
              <ol className="text-xs text-stone-500 space-y-1 mb-3 pl-4 list-decimal">
                <li>„Sichern" → Datei in <strong>iCloud Drive → Saidy</strong> ablegen</li>
                <li>Auf dem anderen Gerät: „Gesichertes wiederherstellen" → Datei aus iCloud Drive wählen</li>
              </ol>
              <div className="flex gap-2">
                <Button variant="subtle" onClick={() => setConfirmBackupAction("export")} className="flex-1 justify-center"><Download size={14} /> Sichern</Button>
                <Button variant="subtle" onClick={() => importInputRef.current?.click()} className="flex-1 justify-center"><Upload size={14} /> Laden</Button>
              </div>
            </>
          )}
        </div>

        <div className="pt-5 border-t border-stone-100">
          <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">WebUntis / Fehlzeiten</div>
          <div className="text-xs font-medium text-stone-500 mb-1.5">Erinnerungsintervall für Import</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {IMPORT_INTERVALS.map((iv) => {
              const active = (data.settings?.fehlzeitenImportInterval ?? 7) === iv.days;
              return (
                <button
                  key={iv.days}
                  onClick={() => setSetting("fehlzeitenImportInterval", iv.days)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${active ? "akzent-flaeche akzent-rand" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}
                >
                  {iv.label}
                </button>
              );
            })}
          </div>
          {data.settings?.fehlzeitenLastImport && (
            <p className="text-xs text-stone-400 mb-2">
              Letzter Import: {new Date(data.settings.fehlzeitenLastImport).toLocaleDateString("de-DE")}
            </p>
          )}
          <Button variant="subtle" onClick={() => onOpenUntisImport?.()} className="w-full justify-center">
            <Upload size={15} /> Fehlzeiten aus WebUntis importieren
          </Button>
        </div>

        {(() => {
          const deletedStudents = (data.students || []).filter((s) => s.deletedAt);
          const deletedClasses = (data.classes || []).filter((c) => c.deletedAt);
          const snapshot = data.deletedSnapshot;
          const snapshotValid = snapshot && (Date.now() - new Date(snapshot.deletedAt).getTime()) < 30 * 86400000;
          const daysLeftSnapshot = snapshotValid
            ? Math.max(1, 30 - Math.floor((Date.now() - new Date(snapshot.deletedAt).getTime()) / 86400000))
            : 0;
          const total = deletedStudents.length + deletedClasses.length + (snapshotValid ? 1 : 0);
          if (total === 0) return null;
          function restoreStudent(id) {
            update((d) => { const s = d.students.find((s) => s.id === id); if (s) delete s.deletedAt; return d; });
          }
          function restoreClass(id) {
            update((d) => {
              const c = d.classes.find((c) => c.id === id);
              if (c) delete c.deletedAt;
              d.students.filter((s) => s.classId === id && s.deletedAt).forEach((s) => { delete s.deletedAt; });
              return d;
            });
          }
          function restoreAllData() {
            update((d) => { const saved = d.deletedSnapshot?.data; return saved ? { ...saved, deletedSnapshot: null } : d; });
          }
          return (
            <div className="pt-5 border-t border-stone-100">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Papierkorb</div>
              <p className="text-xs text-stone-500 mb-3">Gelöschte Einträge bleiben 30 Tage wiederherstellbar, dann werden sie endgültig entfernt.</p>
              <ul className="space-y-1.5">
                {snapshotValid && (
                  <li className="flex-col gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-stone-700 truncate">Alle Daten (Reset vom {new Date(snapshot.deletedAt).toLocaleDateString("de-DE")})</span>
                      <span className="text-[11px] text-stone-400 shrink-0">{daysLeftSnapshot}T</span>
                      <button onClick={restoreAllData} className="text-xs text-green-700 font-medium hover:underline shrink-0">Wiederherstellen</button>
                    </div>
                    <button
                      onClick={() => setConfirmDeleteSnapshot(true)}
                      className="text-[11px] text-red-500 hover:underline mt-1"
                    >
                      Jetzt endgültig löschen (auch Gesundheitsdaten & Fotos)
                    </button>
                  </li>
                )}
                {deletedClasses.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                    <span className="flex-1 text-sm text-stone-600 truncate">Klasse: {c.name}</span>
                    <button onClick={() => restoreClass(c.id)} className="text-xs text-green-700 font-medium hover:underline shrink-0">Wiederherstellen</button>
                  </li>
                ))}
                {deletedStudents.map((s) => {
                  const cls = (data.classes || []).find((c) => c.id === s.classId);
                  return (
                    <li key={s.id} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
                      <span className="flex-1 text-sm text-stone-600 truncate">{s.name}{cls ? ` (${cls.name})` : ""}</span>
                      <button onClick={() => restoreStudent(s.id)} className="text-xs text-green-700 font-medium hover:underline shrink-0">Wiederherstellen</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()}

        <div className="pt-5 border-t border-stone-100">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs font-semibold text-stone-400 uppercase tracking-wide"
          >
            <span>Erweiterte Einstellungen</span>
            <ChevronDown size={14} className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
          {showAdvanced && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-stone-500">
                Alle Klassen, Schüler, Noten und Notizen werden gelöscht. Die Daten landen für 30 Tage im Papierkorb und können dort wiederhergestellt werden.
              </p>
              <Button variant="danger" onClick={() => { setResetInput(""); setConfirmReset(true); }} className="w-full justify-center">
                Alle Daten löschen
              </Button>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-stone-100 mt-2">
          <button
            onClick={() => setShowLegal(true)}
            className="w-full flex items-center gap-2 text-xs text-stone-400 hover:text-stone-600 py-2 justify-center transition-colors"
          >
            <FileText size={13} /> Impressum & Datenschutz
          </button>
        </div>

        <Button onClick={onClose} className="w-full justify-center mt-3">Schließen</Button>
        </div>

        {showLegal && <LegalModal onClose={() => setShowLegal(false)} />}

        {showPromote && (
          <PromoteModal
            classes={data.classes}
            promotedName={promotedName}
            onPromote={promoteClasses}
            onClose={() => setShowPromote(false)}
          />
        )}

        {confirmImport && (
          <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmImport(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-stone-800 mb-2">Datensicherung wiederherstellen?</div>
              <p className="text-sm text-stone-600 mb-4">
                Alle aktuell in der App gespeicherten Daten werden durch die Datensicherung <strong>ersetzt</strong>. Am besten vorher einmal „Sichern".
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmImport(null)} className="flex-1 justify-center">Abbrechen</Button>
                <Button variant="danger" onClick={() => { onImport(confirmImport, (r) => setImportMsg(r)); setConfirmImport(null); }} className="flex-1 justify-center">Ersetzen</Button>
              </div>
            </div>
          </div>
        )}

        {confirmBackupAction && (
          <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmBackupAction(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start gap-2.5 mb-3">
                <span className="w-9 h-9 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><ShieldCheck size={17} /></span>
                <div>
                  <div className="font-semibold text-stone-800">Datenschutz-Hinweis</div>
                  <p className="text-sm text-stone-500 mt-0.5">Das Backup enthält alle Schülerdaten im Klartext.</p>
                </div>
              </div>
              <ul className="text-xs text-stone-600 space-y-1.5 mb-4 pl-1">
                <li className="flex items-start gap-1.5"><span className="text-red-500 font-bold shrink-0">✕</span> Nicht in Google Drive, Dropbox oder iCloud speichern</li>
                <li className="flex items-start gap-1.5"><span className="text-red-500 font-bold shrink-0">✕</span> Nicht per E-Mail oder Messenger versenden</li>
                <li className="flex items-start gap-1.5"><span className="akzent-text font-bold shrink-0">✓</span> Nur auf dem eigenen Gerät oder Schul-Server ablegen</li>
              </ul>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmBackupAction(null)} className="flex-1 justify-center">Abbrechen</Button>
                <Button onClick={() => { confirmBackupAction === "share" ? onShare() : onExport(); setConfirmBackupAction(null); }} className="flex-1 justify-center">
                  {confirmBackupAction === "share" ? "Teilen" : "Herunterladen"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {confirmReset && (
          <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmReset(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-stone-800 mb-2">Alle Daten löschen?</div>
              <p className="text-sm text-stone-600 mb-3">
                Alle Daten werden für <strong>30 Tage in den Papierkorb</strong> verschoben und können dort wiederhergestellt werden. Danach ist die Löschung endgültig.
                Abgelegte <strong>Dokumente werden sofort und endgültig gelöscht</strong> – sichere sie vorher, falls du sie noch brauchst.
              </p>
              <p className="text-xs text-stone-400 mb-1.5">Tippe <strong>LÖSCHEN</strong> zur Bestätigung:</p>
              <input
                className={inputCls}
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder="LÖSCHEN"
                autoFocus
              />
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" onClick={() => setConfirmReset(false)} className="flex-1 justify-center">Abbrechen</Button>
                <Button variant="danger" disabled={resetInput.trim().toUpperCase() !== "LÖSCHEN"} onClick={() => { onReset(); setConfirmReset(false); }} className="flex-1 justify-center">Löschen</Button>
              </div>
            </div>
          </div>
        )}

        {confirmDeleteSnapshot && (
          <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmDeleteSnapshot(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
              <div className="font-semibold text-stone-800 mb-2">Endgültig löschen?</div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
                <p className="text-[11px] text-red-800 leading-relaxed">
                  <strong>Diese Aktion kann nicht rückgängig gemacht werden.</strong> Alle Daten – einschließlich Gesundheitsdaten und Fotos – werden unwiederbringlich gelöscht. Es gibt keine Wiederherstellung.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setConfirmDeleteSnapshot(false)} className="flex-1 justify-center">Abbrechen</Button>
                <Button variant="danger" onClick={() => { update((d) => { d.deletedSnapshot = null; return d; }); setConfirmDeleteSnapshot(false); }} className="flex-1 justify-center">Endgültig löschen</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatHM(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Stunden, die laut Stundenplan heute schon vorbei sind, aber noch keine Note in diesem Fach haben
function computePendingLessons(data, now) {
  const todayStr = isoDate(now);
  const dayKey = DAYS[(now.getDay() + 6) % 7]; // Mo–Fr, am Wochenende undefined
  if (!dayKey) return [];
  const nowHM = formatHM(now);

  /* Mehrere Stunden desselben Fachs an einem Tag – etwa eine Doppelstunde – werden zu
     einem Eintrag zusammengefasst. Das ist keine Vereinfachung, sondern entspricht dem
     Datenmodell: Noten tragen nur ein Datum, keine Stundenangabe. Zwei getrennte Einträge
     ließen sich deshalb nie einzeln abhaken – das Erfassen der einen würde die andere
     stillschweigend mit erledigen. Als ein Eintrag stimmen Zählung und Verhalten überein. */
  const proFach = new Map();
  data.timetable
    .filter((t) => t.day === dayKey)
    .forEach((t) => {
      const fach = data.faecher.find((f) => f.id === t.fachId);
      if (!fach) return;
      const pt = data.periodTimes?.[t.period];
      if (!pt?.end || nowHM < pt.end) return;
      if (data.grades.some((g) => g.fachId === fach.id && g.date === todayStr)) return;
      const vorhanden = proFach.get(fach.id);
      if (vorhanden) {
        vorhanden.anzahl += 1;
        vorhanden.period = Math.max(vorhanden.period, t.period);
        if (pt.start < vorhanden.start) vorhanden.start = pt.start;
        if (pt.end > vorhanden.end) vorhanden.end = pt.end;
        return;
      }
      proFach.set(fach.id, {
        key: `${fach.id}-${todayStr}`,
        fach,
        cls: data.classes.find((c) => c.id === fach.classId),
        period: t.period,
        start: pt.start,
        end: pt.end,
        anzahl: 1,
      });
    });

  return [...proFach.values()].sort((a, b) => b.period - a.period); // neueste Stunde zuerst
}

/* Benachrichtigung sicher senden. Auf Android Chrome wirft `new Notification()` einen
   „Illegal constructor" – dort sind nur Service-Worker-Benachrichtigungen erlaubt.
   Das Icon wird relativ zum Deployment-Pfad aufgelöst (GitHub Pages liegt im Unterordner).
   Schlägt alles fehl, bleibt es folgenlos – eine Benachrichtigung ist nie kritisch. */
function notify(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const icon = new URL("icon-192.png", document.baseURI).href;
    if (navigator.serviceWorker?.ready) {
      navigator.serviceWorker.ready
        .then((reg) => reg.showNotification(title, { body, icon }))
        .catch(() => { try { new Notification(title, { body, icon }); } catch { /* ignoriert */ } });
      return;
    }
    new Notification(title, { body, icon });
  } catch { /* ignoriert */ }
}

/* Verbleibende Unterrichtsstunden eines Fachs bis zur nächsten Klassenarbeit.
   Gezählt wird von heute bis zum Vortag der Arbeit – der Prüfungstag selbst ist
   keine Übungsstunde mehr. Ferien und schulfreie Tage zählen nicht mit.
   Rückgabe null bedeutet „keine Aussage möglich": Fach steht nicht im Stundenplan
   oder das Datum ist ungültig. Null darf NICHT als „heute" interpretiert werden –
   ob die Arbeit heute ist, ergibt sich allein aus dem Datum. */
function remainingLessonsForFach(fachId, testDateStr, timetable, events) {
  const slots = (timetable || []).filter((t) => t.fachId === fachId);
  if (!slots.length) return null;
  const testDate = localDate(testDateStr);
  if (isNaN(testDate)) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const freieZeiten = (events || []).filter((e) => e.type === "ferien" || e.type === "frei");
  const istFrei = (iso) => freieZeiten.some((e) => e.date <= iso && iso <= (e.endDate || e.date));
  let count = 0;
  const cursor = new Date(today);
  let safety = 0; // Schutz vor Tippfehlern im Jahr (z. B. 9999) – max. gut ein Schuljahr
  while (cursor < testDate && safety++ < 400) {
    const dayKey = DAYS[(cursor.getDay() + 6) % 7];
    /* Ein Tag mit Unterricht in diesem Fach zählt als eine Unterrichtseinheit – egal ob
       einzelne 45 Minuten oder eine Doppelstunde aus zwei Blöcken. So rechnet auch die
       Erfassung: eine Doppelstunde wird einmal bewertet, nicht zweimal. */
    if (dayKey && !istFrei(isoDate(cursor)) && slots.some((t) => t.day === dayKey)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/* Bereits vergebene Themen eines Fachs – als Vorschlagsliste, damit „Bruchrechnung"
   und „bruchrechnung" nicht als zwei getrennte Wissensgebiete auseinanderlaufen. */
function bekannteThemen(grades, fachId) {
  const gesehen = Object.create(null);
  (grades || []).forEach((g) => {
    if (g.fachId !== fachId || typeof g.topic !== "string") return;
    const t = g.topic.trim();
    if (t) gesehen[t.toLowerCase()] = t;
  });
  return Object.keys(gesehen).map((k) => gesehen[k]).sort((a, b) => a.localeCompare(b, "de"));
}

/* Klassenradar: pro Klasse berechnete Auffaelligkeitssignale fuer die Uebersicht.
   Drei Regeln, jeweils Warn- und Krit-Stufe. Wenn keine Regel greift, hat die Klasse
   keine Signale und taucht in der Radar-Kachel gar nicht auf.

   Zeitfenster fuer alle Signale: 14 Tage. Kurz genug, dass Alt-Ereignisse nicht die
   Wahrnehmung verzerren; lang genug, dass Trends sichtbar werden. */
function computeKlassenradar(data, klasse, todayStr) {
  const fensterStart = isoDate(addDays(localDate(todayStr), -14));
  const klassenSchueler = (data.students || []).filter((s) => s.classId === klasse.id && !s.deletedAt);
  const schuelerIds = new Set(klassenSchueler.map((s) => s.id));
  const signale = [];

  // Signal 1: haeufige Klassenbucheintraege (incidents wie „Sportzeug vergessen").
  // Warn ab 3 in 14 Tagen, krit ab 5.
  const incs = (data.incidents || []).filter(
    (i) => schuelerIds.has(i.studentId) && i.date >= fensterStart && i.date <= todayStr
  );
  if (incs.length >= 3) {
    signale.push({
      typ: "incidents",
      level: incs.length >= 5 ? "krit" : "warn",
      kurz: `${incs.length} Klassenbuch-Einträge`,
    });
  }

  // Signal 2: Klassenschnitt in einem Fach schlechter als 3,5 (schulnahe Schwelle).
  // Nur Faecher mit mindestens 3 Noten - sonst Rauschen. Krit ab 4,0.
  let schlechtestesFach = null;
  (data.faecher || []).filter((f) => f.classId === klasse.id).forEach((fach) => {
    const noten = (data.grades || []).filter(
      (g) => g.fachId === fach.id && typeof g.value === "number" && schuelerIds.has(g.studentId)
    );
    if (noten.length < 3) return;
    const wSumme = noten.reduce((acc, g) => acc + (g.factor || 1), 0);
    const summe = noten.reduce((acc, g) => acc + g.value * (g.factor || 1), 0);
    const schnitt = summe / wSumme;
    if (schnitt >= 3.5 && (!schlechtestesFach || schnitt > schlechtestesFach.schnitt)) {
      schlechtestesFach = { fach: fach.subject, schnitt };
    }
  });
  if (schlechtestesFach) {
    signale.push({
      typ: "noten",
      level: schlechtestesFach.schnitt >= 4.0 ? "krit" : "warn",
      kurz: `${schlechtestesFach.fach}: ⌀ ${schlechtestesFach.schnitt.toFixed(1)}`,
    });
  }

  // Signal 3: schwache Stimmung in Gespraechen - gezaehlt werden Kinder (nicht Eintraege),
  // damit ein Kind mit drei schlechten Gespraechen die Statistik nicht dominiert.
  // Warn ab 4 Kindern, krit ab 6.
  const stimmungKinder = new Set();
  (data.notes || []).forEach((n) => {
    if (n.type !== "gespraech") return;
    if (n.date < fensterStart || n.date > todayStr) return;
    if (!schuelerIds.has(n.studentId)) return;
    if (n.mood === "nicht_so_gut" || n.mood === "schlecht") stimmungKinder.add(n.studentId);
  });
  if (stimmungKinder.size >= 4) {
    signale.push({
      typ: "stimmung",
      level: stimmungKinder.size >= 6 ? "krit" : "warn",
      kurz: `${stimmungKinder.size} Kinder mit tiefer Stimmung`,
    });
  }

  const rang = { krit: 0, warn: 1 };
  signale.sort((a, b) => (rang[a.level] ?? 9) - (rang[b.level] ?? 9));
  return signale;
}

/* Vorschlaege fuer das Stundenthema-Feld in der Schnellerfassung. Zieht Themen aus
   frueheren Stunden (lessonTopics) UND aus schriftlichen Noten (grades) zusammen -
   beide Quellen fuellen sich gegenseitig, damit ein Thema, das man in einer Klassen-
   arbeit vergeben hat, in einer folgenden Stunde als Vorschlag erscheint (und umgekehrt).
   Dedupliziert case-insensitive. */
function bekannteStundenthemen(lessonTopics, grades, fachId) {
  const gesehen = Object.create(null);
  const sammeln = (t) => {
    if (typeof t !== "string") return;
    const s = t.trim();
    if (s) gesehen[s.toLowerCase()] = s;
  };
  (lessonTopics || []).forEach((x) => { if (x.fachId === fachId) sammeln(x.text); });
  (grades || []).forEach((g) => { if (g.fachId === fachId) sammeln(g.topic); });
  return Object.keys(gesehen).map((k) => gesehen[k]).sort((a, b) => a.localeCompare(b, "de"));
}

/* Aufbereiteter Klassenarbeits-Countdown für die Anzeige.
   Liefert null, wenn nichts anzuzeigen ist (kein Termin oder Termin vorbei). */
function testCountdown(fach, timetable, events) {
  if (!fach?.nextTestDate) return null;
  const todayStr = isoDate(new Date());
  if (fach.nextTestDate < todayStr) return null;
  const istHeute = fach.nextTestDate === todayStr;
  const rem = remainingLessonsForFach(fach.id, fach.nextTestDate, timetable, events);
  const datum = localDate(fach.nextTestDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return {
    istHeute,
    rem, // null = Fach steht nicht im Stundenplan, Stunden nicht zählbar
    datum,
    label: fach.nextTestTitle || "Klassenarbeit",
    level: istHeute ? "krit" : rem === null ? "info" : rem <= 1 ? "krit" : rem <= 3 ? "warn" : "neutral",
    kurz: istHeute ? "heute" : rem === null ? datum : `noch ${rem}×`,
    lang: istHeute
      ? "ist heute"
      : rem === null
        ? `am ${datum} – trag das Fach in den Stundenplan ein, dann zähle ich die Stunden`
        : rem === 0
          ? `am ${datum} – davor liegt keine Unterrichtsstunde mehr`
          : `noch ${rem} ${rem === 1 ? "Unterrichtsstunde" : "Unterrichtsstunden"} Zeit zum Üben`,
  };
}

function demoData() {
  const classId = uid();
  const class2Id = uid();
  const fachMatheId = uid();
  const fachSportId = uid();
  const fachSport7aId = uid();
  const maxId = uid();
  const jennyId = uid();
  const jenny2Id = uid();
  const leonId = uid();
  const aylinId = uid();
  const hj = currentHalbjahr();
  const eventDate = isoDate(addDays(new Date(), 4));

  const now = new Date();
  const todayDayKey = DAYS[(now.getDay() + 6) % 7]; // Mo–Fr, am Wochenende undefined
  const lessonEnd = addDays(now, 0); // Kopie
  lessonEnd.setMinutes(now.getMinutes() - 1); // Stunde ist gerade eben zu Ende gegangen
  const lessonStart = new Date(lessonEnd);
  lessonStart.setMinutes(lessonEnd.getMinutes() - 45);

  const d = (offset) => isoDate(addDays(now, -offset));

  // Namenspool für die weiteren Beispielkinder (Vornamen + Nachnamen)
  const VORNAMEN = [
    "Emma", "Noah", "Mia", "Ben", "Sofia", "Luca", "Hannah", "Elias", "Lea", "Finn",
    "Lina", "Paul", "Marie", "Jonas", "Emilia", "Luis", "Clara", "Felix", "Ida", "Henry",
    "Mila", "Theo", "Frieda", "Anton", "Nele", "Moritz", "Greta", "Julian", "Zoe", "David",
    "Charlotte", "Samuel", "Amelie", "Oskar", "Johanna", "Matteo", "Lotte", "Emil", "Pia", "Jakob",
    "Ella", "Tim", "Romy", "Vincent", "Alia", "Konstantin", "Melina", "Simon", "Yara", "Erik",
    "Malik", "Fatima", "Deniz", "Sena",
  ];
  const NACHNAMEN = [
    "Müller", "Schmidt", "Schneider", "Weber", "Wagner", "Becker", "Hoffmann", "Koch", "Bauer", "Richter",
    "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hofmann", "Lange",
    "Werner", "Krause", "Lehmann", "Schmitz", "Maier", "Köhler", "Herrmann", "Walter", "König", "Peters",
    "Yilmaz", "Demir", "Nowak", "Petrov", "Rossi", "Öztürk", "Sahin", "Kaya", "Aydın", "Popović",
    "Horváth", "Nagy", "Kowalski", "Fischer", "Meyer", "Weiß", "Jung", "Vogel", "Frank", "Berger",
    "Kramer", "Huber", "Schulz", "Böhm",
  ];

  // Namen ohne Duplikate der bereits benannten Kinder
  const usedNames = new Set(["Max Mustermann", "Jenny Reuter", "Leon Fischer", "Aylin Kaya"]);
  function makeNames(count, seedOffset) {
    const out = [];
    let vi = seedOffset % VORNAMEN.length;
    let ni = (seedOffset * 7) % NACHNAMEN.length;
    while (out.length < count) {
      const name = `${VORNAMEN[vi % VORNAMEN.length]} ${NACHNAMEN[ni % NACHNAMEN.length]}`;
      vi++; ni += 3;
      if (usedNames.has(name)) continue;
      usedNames.add(name);
      out.push(name);
    }
    return out;
  }

  const students = [
    { id: maxId, name: "Max Mustermann", classId, birthday: null },
    { id: jennyId, name: "Jenny Reuter", classId, birthday: null },
    { id: jenny2Id, name: "Jenny Schmidt", classId, birthday: null },
    { id: leonId, name: "Leon Fischer", classId: class2Id, birthday: null },
    { id: aylinId, name: "Aylin Kaya", classId: class2Id, birthday: null },
  ];

  // Je Klasse auf 28 Kinder auffüllen
  makeNames(26, 0).forEach((name) => students.push({ id: uid(), name, classId, birthday: null }));
  makeNames(26, 40).forEach((name) => students.push({ id: uid(), name, classId: class2Id, birthday: null }));

  const grades = [
    // Max – Mathematik: solide, aber knapp
    { id: uid(), studentId: maxId, classId, fachId: fachMatheId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(14), halbjahr: hj },
    { id: uid(), studentId: maxId, classId, fachId: fachMatheId, category: "muendlich", value: 3, factor: 1, title: "Mitarbeit", date: d(7), halbjahr: hj },
    { id: uid(), studentId: maxId, classId, fachId: fachMatheId, category: "schriftlich", value: 3.25, factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj, topic: "Bruchrechnung" },
    // Max – Sport: stark, inkl. einer automatischen 5 wegen Sportzeug
    { id: uid(), studentId: maxId, classId, fachId: fachSportId, category: "muendlich", value: 1, factor: 1, title: "Mitarbeit", date: d(12), halbjahr: hj },
    { id: uid(), studentId: maxId, classId, fachId: fachSportId, category: "muendlich", value: 5, factor: 1, title: "Sportzeug vergessen", date: d(5), halbjahr: hj, auto: true, reason: "Sportzeug" },
    // Jenny – Mathematik: sehr gut
    { id: uid(), studentId: jennyId, classId, fachId: fachMatheId, category: "muendlich", value: 1, factor: 1, title: "Mitarbeit", date: d(14), halbjahr: hj },
    { id: uid(), studentId: jennyId, classId, fachId: fachMatheId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(7), halbjahr: hj },
    { id: uid(), studentId: jennyId, classId, fachId: fachMatheId, category: "schriftlich", value: 1.75, factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj, topic: "Bruchrechnung" },
    // Jenny – Sport
    { id: uid(), studentId: jennyId, classId, fachId: fachSportId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(12), halbjahr: hj },
    // Jenny Schmidt – Mathematik: gut
    { id: uid(), studentId: jenny2Id, classId, fachId: fachMatheId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(14), halbjahr: hj },
    { id: uid(), studentId: jenny2Id, classId, fachId: fachMatheId, category: "muendlich", value: 3, factor: 1, title: "Mitarbeit", date: d(7), halbjahr: hj },
    { id: uid(), studentId: jenny2Id, classId, fachId: fachMatheId, category: "schriftlich", value: 2.5, factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj, topic: "Bruchrechnung" },
    // Jenny Schmidt – Sport
    { id: uid(), studentId: jenny2Id, classId, fachId: fachSportId, category: "muendlich", value: 3, factor: 1, title: "Mitarbeit", date: d(12), halbjahr: hj },
    // Leon – Sport 7a: mittelmäßig mit Ausreißern
    { id: uid(), studentId: leonId, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: 3, factor: 1, title: "Mitarbeit", date: d(13), halbjahr: hj },
    { id: uid(), studentId: leonId, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(6), halbjahr: hj },
    { id: uid(), studentId: leonId, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: 4, factor: 1, title: "Mitarbeit", date: d(2), halbjahr: hj },
    // Aylin – Sport 7a: sehr gut
    { id: uid(), studentId: aylinId, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: 1, factor: 1, title: "Mitarbeit", date: d(13), halbjahr: hj },
    { id: uid(), studentId: aylinId, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: 1, factor: 1, title: "Mitarbeit", date: d(6), halbjahr: hj },
    { id: uid(), studentId: aylinId, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(2), halbjahr: hj },
  ];

  // Für die restlichen Kinder ein paar plausibel verteilte Noten erzeugen (deterministisch)
  const muendlichWerte = [1, 1.75, 2, 2.25, 2.75, 3, 3.25, 3.75, 4];
  const schriftlichWerte = [1.75, 2, 2.25, 3, 3.25, 3.75, 4];
  let seed = 3;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

  students.forEach((s) => {
    if ([maxId, jennyId, jenny2Id, leonId, aylinId].includes(s.id)) return;
    if (s.classId === classId) {
      // 5c: Mathematik (2 mündlich + 1 Arbeit) und Sport (2 mündlich)
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachMatheId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(14), halbjahr: hj });
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachMatheId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(7), halbjahr: hj });
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachMatheId, category: "schriftlich", value: pick(schriftlichWerte), factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj, topic: "Bruchrechnung" });
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachSportId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(12), halbjahr: hj });
    } else {
      // 7a: Sport (3 mündlich)
      grades.push({ id: uid(), studentId: s.id, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(13), halbjahr: hj });
      grades.push({ id: uid(), studentId: s.id, classId: class2Id, fachId: fachSport7aId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(6), halbjahr: hj });
    }
  });

  const incidents = [
    { id: uid(), studentId: maxId, fachId: fachSportId, label: "Sportzeug", date: d(5), note: "nur die Schuhe vergessen" },
    { id: uid(), studentId: students[4]?.id, fachId: fachSportId, label: "Sportzeug", date: d(12) },
    { id: uid(), studentId: students[4]?.id, fachId: fachSportId, label: "Sportzeug", date: d(5) },
    { id: uid(), studentId: students[7]?.id, fachId: fachMatheId, label: "Hausaufgaben", date: d(3) },
  ].filter((i) => i.studentId);

  // --- Stammdaten der Kinder vervollständigen (Geburtstag, Eltern, Besonderheiten) ---
  const heute = new Date();
  const BESONDERHEITEN = [
    "Asthma – Spray in der Sporttasche",
    "Nussallergie, bitte auf Snacks achten",
    "Heuschnupfen, im Frühjahr oft müde",
    "Brille, sitzt besser weiter vorne",
    "Knieprobleme – kein Sprung über den Kasten",
  ];
  students.forEach((s, i) => {
    const nachname = s.name.split(" ").slice(-1)[0];
    // Jahrgang passend zur Klasse (5c ≈ 10 Jahre, 7a ≈ 12 Jahre)
    const geburtsjahr = s.classId === classId ? 2015 + (i % 2) : 2013 + (i % 2);
    const monat = ((i * 5) % 12) + 1;
    const tag = ((i * 7) % 27) + 1;
    s.birthday = `${geburtsjahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
    s.parentName = `${i % 2 === 0 ? "Frau" : "Herr"} ${nachname}`;
    s.parentPhone = `0151 ${String(2340000 + i * 137).slice(0, 7)}`;
    if (i % 9 === 0) s.medicalInfo = BESONDERHEITEN[(i / 9) % BESONDERHEITEN.length];
  });
  // Zwei Kinder haben heute Geburtstag, damit die Karte gefüllt ist
  const heuteMD = `-${String(heute.getMonth() + 1).padStart(2, "0")}-${String(heute.getDate()).padStart(2, "0")}`;
  [students[2], students[30]].forEach((s) => {
    if (!s) return;
    s.birthday = `${s.classId === classId ? 2015 : 2013}${heuteMD}`;
  });

  // --- Stundenplan: ganze Woche ---
  const plan = [
    ["Mo", 1, fachMatheId], ["Mo", 2, fachMatheId], ["Mo", 3, fachSport7aId], ["Mo", 5, fachSportId],
    ["Di", 1, fachSportId], ["Di", 2, fachSportId], ["Di", 4, fachMatheId], ["Di", 6, fachSport7aId],
    ["Mi", 2, fachMatheId], ["Mi", 3, fachMatheId], ["Mi", 5, fachSport7aId],
    ["Do", 1, fachSport7aId], ["Do", 3, fachMatheId], ["Do", 4, fachMatheId], ["Do", 6, fachSportId],
    ["Fr", 2, fachMatheId], ["Fr", 3, fachSportId], ["Fr", 4, fachSport7aId],
  ].map(([day, period, fachId]) => ({ id: uid(), day, period, fachId }));

  // Zusätzlich eine Stunde, die gerade eben zu Ende ging (zeigt das "Jetzt bewerten"-Banner)
  const timetable = todayDayKey
    ? [...plan, { id: uid(), day: todayDayKey, period: 7, fachId: fachMatheId }]
    : plan;

  const periodTimes = {
    1: { start: "07:55", end: "08:40" },
    2: { start: "08:45", end: "09:30" },
    3: { start: "09:50", end: "10:35" },
    4: { start: "10:40", end: "11:25" },
    5: { start: "11:45", end: "12:30" },
    6: { start: "12:35", end: "13:20" },
    7: { start: formatHM(lessonStart), end: formatHM(lessonEnd) },
  };

  // --- Dienste ---
  const ids5c = students.filter((s) => s.classId === classId).map((s) => s.id);
  const ids7a = students.filter((s) => s.classId === class2Id).map((s) => s.id);

  function makeDuty(cid, alle, name, color, slots, { erledigt = 0, verschoben = null, wiederholung = null } = {}) {
    const done = alle.slice(0, erledigt);
    let queue = alle.slice(erledigt);
    const log = done.map((sid, i) => ({ studentId: sid, date: d(7 * (erledigt - i)), status: "erledigt" }));
    const repeats = {};
    if (verschoben && queue.includes(verschoben)) {
      queue = [...queue.filter((x) => x !== verschoben), verschoben];
      log.unshift({ studentId: verschoben, date: d(7), status: "verschoben" });
    }
    if (wiederholung && queue.includes(wiederholung)) {
      queue = [wiederholung, ...queue.filter((x) => x !== wiederholung)];
      repeats[wiederholung] = 1;
      log.unshift({ studentId: wiederholung, date: d(7), status: "wiederholen" });
    }
    return { id: uid(), classId: cid, name, color, slots, queue, done, round: 1, log, repeats };
  }

  // --- Aufgabenlisten und Aufgaben ---
  const listSchuleId = uid();
  const listPrivatId = uid();
  const taskLists = [
    { id: listSchuleId, name: "Schule", icon: "clipboard" },
    { id: listPrivatId, name: "Persönlich", icon: "smile" },
  ];
  const tasks = [
    { id: uid(), title: "Klassenarbeit 5c korrigieren", color: TASK_COLORS[1], listId: listSchuleId, dueDate: isoDate(heute), done: false },
    { id: uid(), title: "Sporthalle für Bundesjugendspiele reservieren", color: TASK_COLORS[2], listId: listSchuleId, dueDate: isoDate(heute), done: false },
    { id: uid(), title: "Material für Bruchrechnung kopieren", color: TASK_COLORS[0], listId: listSchuleId, dueDate: isoDate(addDays(heute, 2)), done: false },
    { id: uid(), title: "Elterngespräch Leon vorbereiten", color: TASK_COLORS[3], listId: listSchuleId, dueDate: isoDate(addDays(heute, 5)), done: false },
    { id: uid(), title: "Fortbildung anmelden", color: TASK_COLORS[4], listId: listPrivatId, dueDate: isoDate(addDays(heute, 9)), done: false },
    { id: uid(), title: "Zeugnisvorlagen sichten", color: TASK_COLORS[0], listId: listSchuleId, dueDate: isoDate(addDays(heute, -3)), done: true },
  ];

  // --- Termine ---
  const events = [
    { id: uid(), title: "Elternabend", date: eventDate, time: "18:00", type: "termin", color: TASK_COLORS[0], done: false },
    { id: uid(), title: "Teamsitzung Jahrgang 5", date: isoDate(heute), time: "13:45", type: "termin", color: TASK_COLORS[4], done: false },
    { id: uid(), title: "Klassenarbeit Nr. 2 (5c Mathe)", date: isoDate(addDays(heute, 12)), time: "08:45", type: "termin", color: TASK_COLORS[1], done: false },
    { id: uid(), title: "Zeugniskonferenz", date: isoDate(addDays(heute, 21)), time: "14:30", type: "termin", color: TASK_COLORS[2], done: false },
    { id: uid(), title: "Wandertag 7a", date: isoDate(addDays(heute, 30)), time: "", type: "termin", color: TASK_COLORS[3], done: false },
    { id: uid(), title: "Sportzeug einsammeln nicht vergessen", date: isoDate(addDays(heute, 1)), time: "", type: "erinnerung", color: TASK_COLORS[2], done: false },
  ];

  // --- Beispielhafte Zeugnisnoten (nur für einen Teil, damit "offen" sichtbar bleibt) ---
  const finalGrades = [
    { id: uid(), studentId: maxId, fachId: fachMatheId, halbjahr: hj, value: 3 },
    { id: uid(), studentId: jennyId, fachId: fachMatheId, halbjahr: hj, value: 1.75 },
    { id: uid(), studentId: jenny2Id, fachId: fachMatheId, halbjahr: hj, value: 2 },
    { id: uid(), studentId: leonId, fachId: fachSport7aId, halbjahr: hj, value: 3 },
    { id: uid(), studentId: aylinId, fachId: fachSport7aId, halbjahr: hj, value: 1.25 },
  ];

  const duties = [
    makeDuty(classId, ids5c, "Tafeldienst", COLOR_PALETTE[0], 2, { erledigt: 4 }),
    makeDuty(classId, ids5c, "Ordnungsdienst", COLOR_PALETTE[2], 2, { erledigt: 2 }),
    makeDuty(classId, ids5c, "Austeilen", COLOR_PALETTE[4], 2, { erledigt: 6 }),
    makeDuty(classId, ids5c, "Blumendienst", COLOR_PALETTE[6], 1, { erledigt: 3, verschoben: ids5c[3] }),
    makeDuty(classId, ids5c, "Fegen", COLOR_PALETTE[8], 2, { erledigt: 0 }),
    makeDuty(classId, ids5c, "Papierdienst", COLOR_PALETTE[10], 1, { erledigt: 5, wiederholung: ids5c[5] }),
    makeDuty(class2Id, ids7a, "Tafeldienst", COLOR_PALETTE[0], 2, { erledigt: 8 }),
    makeDuty(class2Id, ids7a, "Fegen", COLOR_PALETTE[8], 2, { erledigt: 3 }),
    makeDuty(class2Id, ids7a, "Austeilen", COLOR_PALETTE[4], 1, { erledigt: 1 }),
  ];

  return {
    ...EMPTY_DATA,
    classes: [
      { id: classId, name: "5c" },
      { id: class2Id, name: "7a" },
    ],
    faecher: [
      { id: fachMatheId, classId, subject: "Mathematik", color: COLOR_PALETTE[0], room: "0.107", weights: DEFAULT_WEIGHTS, nextTestDate: isoDate(addDays(heute, 3)), nextTestTitle: "Bruchrechnen" },
      { id: fachSportId, classId, subject: "Sport", color: COLOR_PALETTE[2], room: "Sporthalle", weights: { muendlich: 100, schriftlich: 0 }, nextTestDate: isoDate(addDays(heute, 10)), nextTestTitle: "Bundesjugendspiele" },
      { id: fachSport7aId, classId: class2Id, subject: "Sport", color: COLOR_PALETTE[2], room: "Sporthalle", weights: { muendlich: 100, schriftlich: 0 }, nextTestDate: isoDate(addDays(heute, 6)), nextTestTitle: "Leichtathletik-Test" },
    ],
    students,
    subjectColors: { Mathematik: COLOR_PALETTE[0], Sport: COLOR_PALETTE[2] },
    events,
    tasks,
    taskLists,
    finalGrades,
    grades,
    incidents,
    notes: [
      { id: uid(), studentId: maxId, date: d(7), text: "Arbeitet konzentrierter als zu Schuljahresbeginn." },
      { id: uid(), studentId: maxId, date: d(2), text: "Meldet sich häufiger, traut sich auch bei Textaufgaben." },
      { id: uid(), studentId: jennyId, date: d(9), text: "Hilft anderen beim Rechnen, sehr zuverlässig." },
      { id: uid(), studentId: leonId, date: d(2), text: "Heute unkonzentriert, Streit in der Pause." },
      { id: uid(), studentId: aylinId, date: d(6), text: "Übernimmt beim Aufwärmen gerne die Leitung." },
      ...(students[4] ? [{ id: uid(), studentId: students[4].id, date: d(5), text: "Zweimal Sportzeug vergessen – Eltern informieren." }] : []),
      ...(students[10] ? [{ id: uid(), studentId: students[10].id, date: d(4), text: "Braucht bei Gruppenarbeit klare Rollen." }] : []),
    ],
    timetable,
    periodTimes,
    duties,
  };
}

/* Erststart: Bundesland wählen, um Schulferien in den Kalender zu übernehmen */
function OnboardingModal({ onSave, onDone, onSkip }) {
  const [step, setStep] = useState(1);
  const [code, setCode] = useState("NW");
  const [withFerien, setWithFerien] = useState(true);
  const [className, setClassName] = useState("");

  function handleStep1() {
    onSave(code, withFerien);
    setStep(2);
  }

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex flex-col items-center mb-4">
          <SaidyLogoMark size={56} className="mb-3" />
          <div className="text-xl font-semibold tracking-widest text-stone-800 uppercase">Saidy</div>
          <div className="text-xs text-stone-400 tracking-widest uppercase mt-0.5">Noten. Notizen. Organisiert.</div>
        </div>

        <div className="flex justify-center gap-1.5 mb-5">
          <span className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? "bg-stone-800" : "bg-stone-300"}`} />
          <span className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? "bg-stone-800" : "bg-stone-300"}`} />
        </div>

        {step === 1 && (
          <>
            <div className="font-semibold text-stone-800 mb-1">Willkommen!</div>
            <p className="text-sm text-stone-500 mb-4">
              Damit ich die Schulferien deines Bundeslandes direkt in den Kalender einzutragen kann, wähle kurz deinen Standort.
            </p>
            <Field label="Bundesland">
              <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}>
                {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </Field>
            <label className="flex items-center gap-2.5 mt-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 shrink-0"
                style={{ accentColor: "#4F5844" }}
                checked={withFerien}
                onChange={(e) => setWithFerien(e.target.checked)}
              />
              <span className="text-sm text-stone-600">Schulferien automatisch eintragen</span>
            </label>
            <div className="flex flex-col gap-2 mt-5">
              <Button onClick={handleStep1} className="w-full justify-center">
                Weiter <ChevronRight size={15} />
              </Button>
              <button onClick={onSkip} className="text-sm text-stone-400 hover:text-stone-600 py-2 px-3">
                Später einrichten
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="font-semibold text-stone-800 mb-1">Erste Klasse anlegen</div>
            <p className="text-sm text-stone-500 mb-4">
              Wie heißt deine Klasse? Du kannst jederzeit weitere Klassen hinzufügen.
            </p>
            <Field label="Klassenname">
              <input
                className={inputCls}
                placeholder="z. B. 3b oder 4a"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                maxLength={30}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && className.trim()) onDone(className.trim()); }}
              />
            </Field>
            <div className="flex flex-col gap-2 mt-5">
              <Button onClick={() => onDone(className.trim())} disabled={!className.trim()} className="w-full justify-center">
                Los geht's!
              </Button>
              <button onClick={() => onDone("")} className="text-sm text-stone-400 hover:text-stone-600 py-2 px-3">
                Ohne Klasse starten
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Hilfe-Inhalte ----------
   WICHTIG: Wird ein neues Feature eingebaut oder ein bestehender Workflow geändert,
   muss HELP_DATA hier entsprechend aktualisiert werden. */
/* Unterrichtstipps als Wissenskarten. Grundstock vom Nutzer geliefert (100 Karten),
   spaeter erweiterbar per Editor/Import. Duplikate wurden verschmolzen - die spaetere,
   ausfuehrlichere Karte gewinnt jeweils.

   Kapitel-Struktur folgt dem Plan des Nutzers (9 Kapitel), die feineren "Kategorien"
   bleiben als Schlagwort erhalten und speisen die Filter der Wissensbibliothek. */
const TIPP_KAPITEL = [
  "Classroom Management",
  "Kommunikation & Gesprächsführung",
  "Unterrichtsmethoden",
  "Motivation & Aktivierung",
  "Klassenklima & Beziehung",
  "Organisation & Lehreralltag",
  "Leistungsbewertung & Feedback",
  "Referendariat & Berufseinstieg",
  "Lehrergesundheit & Selbstmanagement",
];

/* Zuordnung feine Kategorie -> Kapitel. Neue Kategorien fallen in "Unterrichtsmethoden",
   sofern nicht anders zugeordnet - so bleiben spaetere Erweiterungen sichtbar. */
const KATEGORIE_ZU_KAPITEL = {
  "Classroom Management": "Classroom Management",
  "Klassenraumgestaltung": "Classroom Management",
  "Unterrichtsgespräch": "Kommunikation & Gesprächsführung",
  "Gesprächsführung": "Kommunikation & Gesprächsführung",
  "Kommunikation": "Kommunikation & Gesprächsführung",
  "Elternarbeit": "Kommunikation & Gesprächsführung",
  "Unterrichtsmethoden": "Unterrichtsmethoden",
  "Kooperatives Lernen": "Unterrichtsmethoden",
  "Unterrichtseinstieg": "Unterrichtsmethoden",
  "Unterrichtsabschluss": "Unterrichtsmethoden",
  "Visualisierung": "Unterrichtsmethoden",
  "Differenzierung": "Unterrichtsmethoden",
  "Diskussion": "Unterrichtsmethoden",
  "Reflexion": "Unterrichtsmethoden",
  "Stationenlernen": "Unterrichtsmethoden",
  "Problemorientiertes Lernen": "Unterrichtsmethoden",
  "Lernstrategien": "Unterrichtsmethoden",
  "Projektarbeit": "Unterrichtsmethoden",
  "Didaktik": "Unterrichtsmethoden",
  "Motivation": "Motivation & Aktivierung",
  "Aktivierung": "Motivation & Aktivierung",
  "Partizipation": "Motivation & Aktivierung",
  "Selbstständiges Lernen": "Motivation & Aktivierung",
  "Beziehungsarbeit": "Klassenklima & Beziehung",
  "Klassenklima": "Klassenklima & Beziehung",
  "Konfliktmanagement": "Klassenklima & Beziehung",
  "Unterrichtsorganisation": "Organisation & Lehreralltag",
  "Unterrichtsplanung": "Organisation & Lehreralltag",
  "Professionalisierung": "Organisation & Lehreralltag",
  "Lehrerrolle": "Organisation & Lehreralltag",
  "Organisation": "Organisation & Lehreralltag",
  "Professionelles Handeln": "Organisation & Lehreralltag",
  "Feedback": "Leistungsbewertung & Feedback",
  "Diagnostik": "Leistungsbewertung & Feedback",
  "Referendariat": "Referendariat & Berufseinstieg",
  "Berufseinstieg": "Referendariat & Berufseinstieg",
  "Unterrichtsbesuch": "Referendariat & Berufseinstieg",
  "Mentoring": "Referendariat & Berufseinstieg",
  "Selbstfürsorge": "Lehrergesundheit & Selbstmanagement",
  "Stressmanagement": "Lehrergesundheit & Selbstmanagement",
  "Zeitmanagement": "Lehrergesundheit & Selbstmanagement",
  "Gesundheit": "Lehrergesundheit & Selbstmanagement",
  "Kollegiale Zusammenarbeit": "Lehrergesundheit & Selbstmanagement",
};

/* Feste Grundkarten - der Editor speichert eigene Karten separat in data.settings,
   damit ein spaeteres Update dieses Grundstocks eigene Eintraege nicht ueberschreibt. */
const TIPP_KARTEN = [
  { id: 1, titel: "Investiere Zeit in die ersten zwei Wochen", warum: "Die ersten Unterrichtswochen legen den Grundstein für Routinen, Regeln und das Klassenklima. Gut eingeübte Abläufe sparen im Laufe des Schuljahres Zeit und reduzieren Unterrichtsstörungen.", umsetzung: ["Rituale täglich wiederholen.", "Erwartungen klar formulieren.", "Abläufe gemeinsam üben.", "Positives Verhalten sofort verstärken."], merksatz: "Ein guter Start erleichtert das ganze Schuljahr.", kategorie: "Classroom Management" },
  { id: 2, titel: "Wenige Regeln wirken stärker als viele", warum: "Zu viele Regeln sind schwer zu merken und konsequent umzusetzen. Wenige Kernregeln schaffen Orientierung und Verlässlichkeit.", umsetzung: ["Beschränke dich auf 3–5 Kernregeln.", "Formuliere sie positiv und verständlich.", "Erkläre den Sinn jeder Regel.", "Wiederhole sie regelmäßig."], merksatz: "Klarheit entsteht durch Einfachheit.", kategorie: "Classroom Management" },
  { id: 3, titel: "Übe Regeln statt sie nur zu erklären", warum: "Regeln werden erst durch wiederholtes Anwenden zu Routinen. Reines Erklären reicht selten aus.", umsetzung: ["Situationen gemeinsam nachspielen.", "Verhalten vormachen lassen.", "Mehrfach üben.", "Gelungenes Verhalten sofort loben."], merksatz: "Regeln entstehen durch Übung.", kategorie: "Classroom Management", quelle: "Kounin – Klassenführung" },
  { id: 4, titel: "Rituale schaffen Sicherheit", warum: "Wiederkehrende Abläufe geben Orientierung, reduzieren Unsicherheit und schaffen mehr Zeit für das Lernen.", umsetzung: ["Einheitlichen Stundenbeginn etablieren.", "Feste Abschlussroutine nutzen.", "Übergänge ritualisieren.", "Rituale konsequent beibehalten."], merksatz: "Routinen entlasten alle.", kategorie: "Classroom Management" },
  { id: 5, titel: "Blickkontakt wirkt oft besser als Ermahnen", warum: "Viele kleinere Störungen lassen sich durch nonverbale Signale unterbrechen, ohne den Unterricht zu unterbrechen.", umsetzung: ["Blickkontakt aufnehmen.", "Kurz warten.", "Bei Bedarf Nähe herstellen.", "Erst danach verbal eingreifen."], merksatz: "Nonverbale Signale wirken oft stärker als Worte.", kategorie: "Classroom Management" },
  { id: 6, titel: "Nutze Nähe statt Lautstärke", warum: "Die räumliche Nähe zur störenden Person genügt häufig, um Aufmerksamkeit zurückzugewinnen.", umsetzung: ["Ruhig zum Arbeitsplatz gehen.", "Weiter unterrichten.", "Diskussion vermeiden.", "Gespräch bei Bedarf später führen."], merksatz: "Nähe beruhigt – Lautstärke eskaliert.", kategorie: "Classroom Management" },
  { id: 7, titel: "Sprich leiser statt lauter", warum: "Eine ruhige Stimme signalisiert Sicherheit und Kontrolle. Lautes Sprechen erhöht häufig die Anspannung.", umsetzung: ["Stimme bewusst senken.", "Langsam sprechen.", "Pausen zulassen.", "Ruhige Körpersprache zeigen."], merksatz: "Ruhe ist ansteckend.", kategorie: "Classroom Management" },
  { id: 8, titel: "Zeig der Klasse, dass du alles mitbekommst", warum: "Kounin nennt es „Withitness\": Klassen verhalten sich anders, wenn sie merken, dass die Lehrkraft im Blick hat, was im Raum passiert – auch hinten und während der Tafelarbeit. Der Effekt entsteht durch die Wahrnehmung, nicht durch das Eingreifen.", umsetzung: ["Beim Schreiben an der Tafel regelmäßig zur Klasse drehen.", "Beim Rundgang unvorhersehbare Wege nehmen, nicht immer dieselbe Runde.", "Auf die richtige Person reagieren – ein Fehlgriff kostet Glaubwürdigkeit.", "Die erste, nicht die lauteste Störung ansprechen."], merksatz: "Gesehen werden wirkt stärker als ermahnt werden.", kategorie: "Classroom Management", quelle: "Kounin – Withitness" },
  { id: 9, titel: "Suche zuerst die Ursache", warum: "Störungen können viele Ursachen haben – von Überforderung bis Langeweile. Wer die Ursache kennt, kann angemessen reagieren.", umsetzung: ["Situation beobachten.", "Mögliche Ursache überlegen.", "Passende Maßnahme wählen.", "Nach der Stunde das Gespräch suchen."], merksatz: "Erst verstehen – dann handeln.", kategorie: "Classroom Management" },
  { id: 10, titel: "Konsequenz braucht Beziehung", warum: "Konsequenzen werden eher akzeptiert, wenn Schülerinnen und Schüler sich gleichzeitig respektiert und fair behandelt fühlen.", umsetzung: ["Verhalten statt Person ansprechen.", "Ruhig bleiben.", "Konsequenzen nachvollziehbar erklären.", "Nach dem Konflikt wieder positiv in Kontakt treten."], merksatz: "Konsequenz und Wertschätzung gehören zusammen.", kategorie: "Classroom Management" },
  { id: 11, titel: "Lobe konkret statt allgemein", warum: "Pauschales Lob wie „Gut gemacht!\" motiviert kurzfristig, zeigt aber nicht, welches Verhalten erfolgreich war. Konkretes Feedback hilft Schülerinnen und Schülern, gute Strategien zu wiederholen.", umsetzung: ["Beschreibe genau, was gelungen ist.", "Beziehe dich auf Verhalten oder Strategie.", "Erkläre, warum es gut war.", "Nutze Lob zeitnah."], merksatz: "Konkretes Lob fördert gezieltes Lernen.", kategorie: "Feedback" },
  { id: 12, titel: "Verstärke positives Verhalten bewusst", warum: "Wer erwünschtes Verhalten benennt statt nur Störungen zu korrigieren, lenkt die Aufmerksamkeit der Klasse darauf. Wichtig ist die Echtheit: Übertriebenes oder rein routiniertes Loben verliert seine Wirkung und kann die Eigenmotivation sogar schwächen.", umsetzung: ["Erwünschtes Verhalten konkret benennen, nicht nur „gut gemacht\".", "Kleine Fortschritte anerkennen.", "Positives häufiger erwähnen als Störungen.", "Nur loben, wenn es ehrlich gemeint ist – Kinder merken den Unterschied."], merksatz: "Was du benennst, davon bekommst du mehr – wenn du es ehrlich meinst.", kategorie: "Classroom Management" },
  { id: 13, titel: "Warte nach einer Frage mindestens drei Sekunden", warum: "Viele Lernende benötigen Zeit zum Nachdenken. Eine kurze Wartezeit erhöht die Qualität der Antworten und beteiligt mehr Schülerinnen und Schüler. Auch im Plenumsgespräch: Wer sofort Antworten erwartet, erreicht oft nur die schnellsten Lernenden.", umsetzung: ["Frage stellen.", "Drei bis fünf Sekunden schweigen.", "Blickkontakt halten.", "Notizen erlauben.", "Erst danach jemanden aufrufen."], merksatz: "Denkzeit ist Lernzeit.", kategorie: "Unterrichtsgespräch", quelle: "Rowe – Wait Time" },
  { id: 14, titel: "Arbeitsaufträge müssen glasklar sein", warum: "Unklare Aufgaben führen zu Rückfragen und Unruhe. Klare Anweisungen schaffen Sicherheit und sparen Zeit.", umsetzung: ["Auftrag kurz formulieren.", "Ziel nennen.", "Zeitrahmen angeben.", "Verständnis überprüfen."], merksatz: "Klarheit verhindert Chaos.", kategorie: "Unterrichtsorganisation" },
  { id: 15, titel: "Zeige den Arbeitsauftrag sichtbar an", warum: "Mündliche Informationen werden leicht vergessen. Ein sichtbarer Auftrag entlastet das Arbeitsgedächtnis und reduziert Nachfragen.", umsetzung: ["Auftrag an Tafel oder Bildschirm schreiben.", "Arbeitsschritte nummerieren.", "Zeit ergänzen.", "Während der Arbeitsphase sichtbar lassen."], merksatz: "Sichtbarkeit schafft Orientierung.", kategorie: "Unterrichtsorganisation" },
  { id: 16, titel: "Hole Aufmerksamkeit mit festen Signalen zurück", warum: "Feste Signale sind effizienter als wiederholte Aufforderungen und werden mit der Zeit zur Routine.", umsetzung: ["Ein eindeutiges Signal vereinbaren.", "Signal regelmäßig üben.", "Erst sprechen, wenn Ruhe eingekehrt ist.", "Konsequenz bewahren."], merksatz: "Routinen sparen Worte.", kategorie: "Classroom Management" },
  { id: 17, titel: "Übergänge brauchen Planung", warum: "Viele Störungen entstehen beim Wechsel zwischen Unterrichtsphasen. Klare Übergänge schaffen Ruhe und Struktur.", umsetzung: ["Übergang ankündigen.", "Nächsten Schritt erklären.", "Material vorbereiten lassen.", "Erst starten, wenn alle bereit sind."], merksatz: "Gute Übergänge halten den Unterricht im Fluss.", kategorie: "Classroom Management" },
  { id: 18, titel: "Nutze die Sitzordnung als pädagogisches Werkzeug", warum: "Die Sitzordnung beeinflusst Konzentration, Zusammenarbeit und Kommunikation. Sie sollte bewusst geplant werden.", umsetzung: ["Störende Konstellationen vermeiden.", "Unterstützende Lernpartner zusammensetzen.", "Sicht auf Tafel und Lehrkraft beachten.", "Regelmäßig überprüfen."], merksatz: "Sitzordnung gestaltet Unterricht mit.", kategorie: "Klassenraumgestaltung" },
  { id: 19, titel: "Sei im Klassenraum präsent", warum: "Lehrkräfte, die sich im Raum bewegen und aufmerksam sind, erkennen Schwierigkeiten früher und wirken störungspräventiv.", umsetzung: ["Durch den Raum gehen.", "Alle Bereiche im Blick behalten.", "Nähe zu Lernenden suchen.", "Nicht dauerhaft am Pult bleiben."], merksatz: "Präsenz schafft Sicherheit.", kategorie: "Classroom Management" },
  { id: 20, titel: "Sichere am Stundenende das Ergebnis", warum: "Ohne bewussten Abschluss bleibt am Ende oft nur die letzte Aufgabe hängen, nicht das Gelernte. Eine kurze gemeinsame Ergebnissicherung ordnet die Stunde und schafft den Anschluss für das nächste Mal.", umsetzung: ["Die zentrale Erkenntnis in einem Satz festhalten lassen.", "Ergebnis sichtbar notieren (Tafel, Heft, Merkkasten).", "Offene Fragen sammeln.", "Ausblick auf die nächste Stunde geben."], merksatz: "Was nicht gesichert wird, ist am nächsten Tag weg.", kategorie: "Unterrichtsabschluss" },
  { id: 21, titel: "Aktiviere Vorwissen vor jedem neuen Thema", warum: "Neues Wissen wird leichter verstanden, wenn es an bereits vorhandenes Wissen anknüpft. Das erhöht die Lernbereitschaft und erleichtert das Verstehen.", umsetzung: ["Stelle eine Einstiegsfrage.", "Sammle Vorwissen an der Tafel.", "Nutze Bilder oder Gegenstände als Impuls.", "Lass Vermutungen formulieren."], merksatz: "Neues Lernen beginnt mit Bekanntem.", kategorie: "Unterrichtsmethoden", quelle: "Ausubel – Advance Organizer" },
  { id: 22, titel: "Sprich weniger – lass mehr arbeiten", warum: "Lernen entsteht durch aktives Denken und Handeln. Je mehr Zeit Schülerinnen und Schüler selbst arbeiten, desto nachhaltiger lernen sie.", umsetzung: ["Erklärungen kurz halten.", "Schnell in Arbeitsphasen wechseln.", "Offene Aufgaben stellen.", "Ergebnisse gemeinsam reflektieren."], merksatz: "Wer aktiv arbeitet, behält Inhalte meist besser.", kategorie: "Unterrichtsmethoden" },
  { id: 23, titel: "Eine gute Frage ist mehr wert als eine schnelle Antwort", warum: "Offene Fragen regen zum Denken an und fördern tiefere Lernprozesse als reine Wissensabfragen.", umsetzung: ["Warum-Fragen stellen.", "Nach Begründungen fragen.", "Mehrere Lösungswege zulassen.", "Nachfragen statt vorsagen."], merksatz: "Fragen öffnen Denken.", kategorie: "Unterrichtsgespräch" },
  { id: 24, titel: "Plane Bewegung bewusst ein", warum: "Nach längeren Sitzphasen lässt die Aufmerksamkeit nach. Eine kurze Bewegungsphase gibt einen klaren Einschnitt und hilft vielen Kindern zurück in die Konzentration. Die genaue Wirkmechanik ist in der Forschung umstritten – der praktische Nutzen als Zäsur ist unbestritten.", umsetzung: ["Mini-Bewegungspausen einbauen.", "Lernspiele mit Bewegung nutzen.", "Partnerwechsel ermöglichen.", "Stehphasen einplanen."], merksatz: "Eine kurze Bewegungspause setzt einen Schnitt – danach geht es leichter weiter.", kategorie: "Aktivierung" },
  { id: 25, titel: "Nutze Think – Pair – Share", warum: "Diese Methode aktiviert alle Lernenden. Jeder denkt zunächst selbst nach, tauscht sich anschließend mit einer Partnerin oder einem Partner aus und bringt danach die Ergebnisse ins Plenum ein. So beteiligen sich deutlich mehr Schülerinnen und Schüler.", umsetzung: ["Stelle eine offene Frage.", "Gib 1–2 Minuten Denkzeit.", "Lasse Partnergespräche führen.", "Sammle anschließend Ergebnisse im Plenum."], merksatz: "Erst denken – dann reden.", kategorie: "Kooperatives Lernen", quelle: "Lyman – Think-Pair-Share" },
  { id: 26, titel: "Lass Fehler sichtbar werden", warum: "Fehler liefern wichtige Informationen über den Lernstand. Eine konstruktive Fehlerkultur fördert Lernprozesse.", umsetzung: ["Fehler gemeinsam analysieren.", "Nach Lösungswegen fragen.", "Verbesserungen würdigen.", "Fehler nicht bloßstellen."], merksatz: "Fehler sind Lernchancen.", kategorie: "Feedback" },
  { id: 27, titel: "Nutze Exit-Tickets am Stundenende", warum: "Exit-Tickets liefern dir eine schnelle Rückmeldung über den Lernstand und helfen bei der Planung der nächsten Stunde.", umsetzung: ["Eine bis drei Fragen vorbereiten.", "Kurz vor Stundenende beantworten lassen.", "Antworten auswerten.", "Nächste Stunde darauf aufbauen."], merksatz: "Unterricht endet mit Feedback.", kategorie: "Diagnostik" },
  { id: 28, titel: "Gib Schülerinnen und Schülern Wahlmöglichkeiten", warum: "Selbstbestimmung erhöht Motivation und Verantwortungsgefühl. Schon kleine Wahlmöglichkeiten können die Lernbereitschaft steigern.", umsetzung: ["Aufgaben auswählen lassen.", "Reihenfolge selbst bestimmen lassen.", "Präsentationsformen variieren.", "Schwierigkeitsgrade anbieten.", "Sozialform wählen lassen."], merksatz: "Mitbestimmung motiviert.", kategorie: "Motivation" },
  { id: 29, titel: "Plane genügend Pufferzeit ein", warum: "Unterricht verläuft selten exakt nach Plan. Zeitreserven verhindern Hektik und schaffen Raum für Fragen.", umsetzung: ["Aufgaben realistisch planen.", "Nicht jede Minute verplanen.", "Reserveaufgaben bereithalten.", "Zeit regelmäßig überprüfen."], merksatz: "Puffer schaffen Gelassenheit.", kategorie: "Unterrichtsorganisation" },
  { id: 30, titel: "Reflektiere jede Unterrichtsstunde", warum: "Kurze Reflexionen helfen, erfolgreiche Elemente zu erkennen und Unterricht kontinuierlich weiterzuentwickeln.", umsetzung: ["Was lief gut?", "Was war schwierig?", "Was ändere ich nächstes Mal?", "Notizen direkt nach der Stunde machen."], merksatz: "Guter Unterricht wächst durch Reflexion.", kategorie: "Professionalisierung" },
  { id: 31, titel: "Starte jede Stunde mit einem klaren Ziel", warum: "Lernende arbeiten motivierter und zielgerichteter, wenn sie wissen, worauf sie hinarbeiten. Ein transparentes Lernziel erhöht die Orientierung und den Lernerfolg.", umsetzung: ["Formuliere das Lernziel in einfacher Sprache.", "Schreibe es sichtbar an.", "Beziehe dich während der Stunde darauf.", "Greife es im Abschluss wieder auf."], merksatz: "Wer das Ziel kennt, findet leichter den Weg.", kategorie: "Unterrichtsplanung" },
  { id: 32, titel: "Beginne mit einem aktivierenden Einstieg", warum: "Ein guter Einstieg weckt Interesse und aktiviert Vorwissen. Dadurch fällt der Einstieg in das Thema leichter.", umsetzung: ["Nutze ein Bild oder Objekt.", "Stelle eine überraschende Frage.", "Erzähle eine kurze Geschichte.", "Starte mit einem kleinen Rätsel."], merksatz: "Ein guter Anfang weckt Neugier.", kategorie: "Unterrichtseinstieg" },
  { id: 33, titel: "Ersetze das Melden durch Techniken, die alle einbeziehen", warum: "Beim Melden antworten überwiegend dieselben Kinder – die Übrigen können sich dauerhaft ausklinken. Antwortformate, bei denen alle gleichzeitig zeigen müssen, machen den Lernstand der ganzen Klasse sichtbar.", umsetzung: ["Namen ziehen (Stäbchen, Karten) statt Melden abwarten.", "Mini-Whiteboards: alle schreiben, alle heben gleichzeitig hoch.", "Daumenprobe für schnelle Einschätzungen.", "Ankündigen, dass jede und jeder drankommen kann – das verändert schon die Aufmerksamkeit."], merksatz: "Wer nie drankommt, hört irgendwann auf mitzudenken.", kategorie: "Aktivierung" },
  { id: 34, titel: "Eine Aufgabe nach der anderen", warum: "Zu viele Informationen auf einmal überfordern das Arbeitsgedächtnis. Schrittweise Arbeitsaufträge erhöhen die Erfolgswahrscheinlichkeit.", umsetzung: ["Aufgaben nummerieren.", "Nur den nächsten Schritt erklären.", "Nach jedem Schritt kurz überprüfen.", "Erst dann weitermachen."], merksatz: "Kleine Schritte führen sicher ans Ziel.", kategorie: "Unterrichtsorganisation" },
  { id: 35, titel: "Visualisiere wichtige Informationen", warum: "Sichtbare Informationen entlasten das Gedächtnis und helfen besonders Lernenden, die Inhalte besser zu strukturieren.", umsetzung: ["Stichpunkte statt Fließtext.", "Farben gezielt einsetzen.", "Symbole verwenden.", "Ergebnisse sichtbar hängen lassen."], merksatz: "Was sichtbar ist, bleibt leichter im Kopf.", kategorie: "Visualisierung" },
  { id: 36, titel: "Gib Verständnisfragen an die Klasse zurück", warum: "Wenn ein Kind nachfragt, ist die schnellste Reaktion die eigene Erklärung – aber oft erklärt ein Mitkind es in der passenderen Sprache. Gleichzeitig verarbeitet das erklärende Kind den Inhalt tiefer.", umsetzung: ["Bei einer Verständnisfrage zuerst in die Klasse geben: „Wer kann das erklären?\"", "Erklärung abwarten, ohne sofort zu korrigieren.", "Danach ergänzen, wenn etwas fehlt.", "Nicht immer dieselben erklären lassen."], merksatz: "Die zweitbeste Erklärung von einem Kind schlägt oft die beste von dir.", kategorie: "Kooperatives Lernen" },
  { id: 37, titel: "Plane Erfolgserlebnisse ein", warum: "Erfolgreiche Erfahrungen stärken Motivation und Selbstvertrauen. Kleine Fortschritte sind oft wirksamer als große Ziele.", umsetzung: ["Mit einer leichten Aufgabe beginnen.", "Fortschritte sichtbar machen.", "Zwischenerfolge würdigen.", "Lernfortschritte dokumentieren."], merksatz: "Erfolg motiviert zu weiterem Lernen.", kategorie: "Motivation" },
  { id: 38, titel: "Nutze offene Aufgaben", warum: "Offene Aufgaben ermöglichen unterschiedliche Lösungswege und fördern kreatives sowie vertieftes Denken.", umsetzung: ["Mehrere Lösungen zulassen.", "Begründungen einfordern.", "Vergleiche ermöglichen.", "Diskussionen anregen."], merksatz: "Gute Aufgaben haben mehr als eine Antwort.", kategorie: "Unterrichtsmethoden" },
  { id: 41, titel: "Namen schaffen Beziehungen", warum: "Wer Schülerinnen und Schüler mit ihrem Namen anspricht, signalisiert Aufmerksamkeit und Wertschätzung. Das stärkt die Beziehung und erhöht die Mitarbeit.", umsetzung: ["Begrüße Lernende möglichst mit Namen.", "Nutze Sitzpläne zum Einprägen.", "Sprich positive Beiträge mit Namen an.", "Übe Namen bewusst in den ersten Wochen."], merksatz: "Ein Name ist der kürzeste Weg zu einer Beziehung.", kategorie: "Beziehungsarbeit" },
  { id: 42, titel: "Höre erst zu, bevor du bewertest", warum: "Wer vorschnell urteilt, übersieht oft die eigentliche Ursache eines Problems. Zuhören schafft Verständnis und Vertrauen.", umsetzung: ["Stelle offene Fragen.", "Lasse ausreden.", "Fasse Gehörtes zusammen.", "Erst danach gemeinsam Lösungen suchen."], merksatz: "Verstehen kommt vor Bewerten.", kategorie: "Gesprächsführung" },
  { id: 43, titel: "Frage im Gespräch nach, statt zu vermuten", warum: "In Eltern- und Kollegengesprächen entstehen Konflikte oft aus unausgesprochenen Annahmen. Eine echte Nachfrage bringt die Sicht der anderen Seite auf den Tisch, bevor man auf eine falsche Annahme reagiert.", umsetzung: ["Bei Ärger zuerst fragen: „Wie sehen Sie die Situation?\"", "Nachfragen, bevor du Position beziehst.", "Das Gehörte in eigenen Worten spiegeln.", "Erst danach die eigene Sicht schildern."], merksatz: "Erst verstehen, dann verstanden werden.", kategorie: "Kommunikation" },
  { id: 44, titel: "Lobe die Anstrengung, nicht nur das Ergebnis", warum: "Wenn Anstrengung und Strategien gewürdigt werden, entwickeln Lernende eher Ausdauer und Lernbereitschaft.", umsetzung: ["Betone den Lernprozess.", "Hebe gute Strategien hervor.", "Anerkenne Ausdauer.", "Zeige Entwicklung auf."], merksatz: "Fortschritt beginnt mit Anstrengung.", kategorie: "Feedback", quelle: "Dweck – Growth Mindset" },
  { id: 45, titel: "Korrigiere diskret", warum: "Öffentliche Kritik kann Beziehungen belasten. Eine diskrete Rückmeldung wahrt die Würde der Lernenden.", umsetzung: ["Leise ansprechen.", "Nähe suchen.", "Nach der Stunde weiterreden.", "Vor der Klasse nicht bloßstellen."], merksatz: "Kritik wirkt besser ohne Publikum.", kategorie: "Kommunikation" },
  { id: 46, titel: "Zeige Interesse am Menschen", warum: "Lernende arbeiten engagierter mit Lehrkräften zusammen, wenn sie sich wahrgenommen fühlen.", umsetzung: ["Frage nach Interessen.", "Höre aufmerksam zu.", "Merke dir kleine Details.", "Zeige ehrliche Wertschätzung."], merksatz: "Beziehung entsteht durch echtes Interesse.", kategorie: "Beziehungsarbeit" },
  { id: 47, titel: "Halte deine Zusagen ein", warum: "Verlässlichkeit schafft Vertrauen. Wer Ankündigungen konsequent umsetzt, wirkt glaubwürdig.", umsetzung: ["Nur realistische Zusagen machen.", "Vereinbarungen notieren.", "Konsequenzen wie angekündigt umsetzen.", "Fehler offen eingestehen."], merksatz: "Vertrauen wächst durch Verlässlichkeit.", kategorie: "Lehrerrolle" },
  { id: 48, titel: "Lächle bewusst", warum: "Ein freundlicher Gesichtsausdruck wirkt einladend und kann Hemmschwellen abbauen. Gleichzeitig unterstützt er eine positive Lernatmosphäre.", umsetzung: ["Begrüße freundlich.", "Lächle authentisch.", "Verbinde Freundlichkeit mit klaren Erwartungen.", "Bleibe auch in stressigen Situationen respektvoll."], merksatz: "Eine freundliche Begrüßung senkt die Hürde, sich zu melden.", kategorie: "Klassenklima" },
  { id: 49, titel: "Konflikte möglichst zeitnah klären", warum: "Ungeklärte Konflikte belasten Beziehungen und können den Unterricht langfristig beeinträchtigen.", umsetzung: ["Gespräch zeitnah vereinbaren.", "Beide Seiten anhören.", "Gemeinsam Lösungen entwickeln.", "Vereinbarungen festhalten."], merksatz: "Konflikte lösen sich selten von allein.", kategorie: "Konfliktmanagement" },
  { id: 50, titel: "Jeder Tag ist eine neue Chance", warum: "Lernende entwickeln sich. Wer ihnen nach Fehlern einen echten Neuanfang ermöglicht, stärkt Motivation und Beziehung.", umsetzung: ["Vergangene Konflikte nicht ständig ansprechen.", "Neue Chancen bewusst geben.", "Fortschritte wahrnehmen.", "Entwicklung anerkennen."], merksatz: "Jeder Unterrichtstag darf ein Neustart sein.", kategorie: "Beziehungsarbeit" },
  { id: 52, titel: "Arbeite mit einem Gallery Walk", warum: "Beim Gallery Walk betrachten Schülerinnen und Schüler die Ergebnisse anderer Gruppen. Dadurch entstehen Austausch, Reflexion und gegenseitiges Feedback.", umsetzung: ["Gruppen erstellen Plakate.", "Hänge alle Ergebnisse sichtbar auf.", "Lasse die Gruppen herumgehen.", "Nutze Feedbackbögen oder Leitfragen."], merksatz: "Lernen wird sichtbar.", kategorie: "Kooperatives Lernen" },
  { id: 53, titel: "Setze ein Gruppenpuzzle ein", warum: "Beim Gruppenpuzzle wird jede Schülerin und jeder Schüler Expertin oder Experte für einen Teilbereich und gibt dieses Wissen anschließend weiter. Das stärkt Eigenverantwortung und Zusammenarbeit.", umsetzung: ["Thema in Teilbereiche aufteilen.", "Expertengruppen bilden.", "Wissen erarbeiten.", "Stammgruppen gegenseitig unterrichten lassen."], merksatz: "Wer erklärt, lernt doppelt.", kategorie: "Kooperatives Lernen", quelle: "Aronson – Jigsaw / Gruppenpuzzle" },
  { id: 54, titel: "Nutze ein Placemat", warum: "Das Placemat verbindet Einzelarbeit und Gruppenarbeit. Alle bringen zunächst eigene Ideen ein und entwickeln anschließend eine gemeinsame Lösung.", umsetzung: ["Blatt in vier Felder und eine Mitte teilen.", "Jede Person schreibt zunächst allein.", "Anschließend gemeinsame Ergebnisse in der Mitte festhalten.", "Gemeinsam präsentieren."], merksatz: "Erst eigene Ideen – dann gemeinsam denken.", kategorie: "Kooperatives Lernen" },
  { id: 55, titel: "Arbeite mit einem Kugellager", warum: "Das Kugellager sorgt dafür, dass viele kurze Gespräche entstehen. Lernende wiederholen Inhalte mehrfach und üben freies Sprechen.", umsetzung: ["Zwei Kreise bilden.", "Gegenüberstehende Paare tauschen sich aus.", "Nach jeder Runde weiterrücken.", "Neue Gesprächspartner kennenlernen."], merksatz: "Viele kurze Gespräche fördern sicheres Sprechen.", kategorie: "Kommunikation" },
  { id: 56, titel: "Nutze das Lerntempoduett", warum: "Schnellere Lernende helfen anderen oder vertiefen ihr Wissen, ohne untätig zu warten.", umsetzung: ["Einzelarbeit beginnen.", "Fertige Lernende zusammenführen.", "Ergebnisse vergleichen.", "Gemeinsam weiterarbeiten."], merksatz: "Lernen endet nicht mit dem Fertigsein.", kategorie: "Differenzierung" },
  { id: 57, titel: "Diskutiere mit der Fishbowl-Methode", warum: "Fishbowl ermöglicht strukturierte Diskussionen. Eine kleine Gruppe diskutiert, während die übrigen beobachten und später einsteigen.", umsetzung: ["Innenkreis diskutiert.", "Außenkreis beobachtet.", "Plätze regelmäßig wechseln.", "Diskussion gemeinsam auswerten."], merksatz: "Struktur macht Diskussionen besser.", kategorie: "Diskussion" },
  { id: 58, titel: "Nutze Concept Maps", warum: "Concept Maps helfen dabei, Zusammenhänge sichtbar zu machen und komplexes Wissen zu strukturieren.", umsetzung: ["Zentralen Begriff notieren.", "Unterbegriffe ergänzen.", "Beziehungen mit Pfeilen verbinden.", "Gemeinsam reflektieren."], merksatz: "Zusammenhänge bleiben besser im Gedächtnis.", kategorie: "Visualisierung" },
  { id: 60, titel: "Plane ein Blitzlicht ein", warum: "Beim Blitzlicht äußert jede Person kurz ihre Meinung oder Erkenntnis. Dadurch kommen viele Stimmen zu Wort.", umsetzung: ["Eine Leitfrage stellen.", "Jede Person antwortet in einem Satz.", "Nicht diskutieren.", "Erst anschließend Ergebnisse zusammenfassen."], merksatz: "Jede Stimme zählt.", kategorie: "Reflexion" },
  { id: 61, titel: "Nutze Lernstationen", warum: "Stationenlernen ermöglicht individuelles Lerntempo und abwechslungsreiche Zugänge zu einem Thema.", umsetzung: ["Mehrere Stationen vorbereiten.", "Arbeitsaufträge klar formulieren.", "Laufzettel einsetzen.", "Ergebnisse gemeinsam sichern."], merksatz: "Vielfalt fördert Lernen.", kategorie: "Stationenlernen" },
  { id: 62, titel: "Lass ein Lernprodukt für andere entstehen", warum: "Ein Erklärplakat, ein kurzes Lernvideo oder eine Merkkarte für die Parallelklasse zwingt zur Auswahl des Wesentlichen. Ein echtes Publikum erhöht die Sorgfalt spürbar.", umsetzung: ["Ein konkretes Publikum benennen (Parallelklasse, jüngerer Jahrgang, Eltern).", "Format und Umfang klar begrenzen (ein Plakat, 90 Sekunden Video).", "Kriterien vorher gemeinsam festlegen.", "Produkte am Ende tatsächlich weitergeben – sonst verpufft der Effekt."], merksatz: "Für ein echtes Publikum arbeitet man anders.", kategorie: "Aktivierung" },
  { id: 63, titel: "Nutze ein Lernplakat", warum: "Lernplakate helfen dabei, Wissen zu strukturieren und dauerhaft sichtbar zu machen.", umsetzung: ["Überschrift formulieren.", "Kernaussagen ergänzen.", "Grafiken nutzen.", "Im Klassenraum aufhängen."], merksatz: "Sichtbares Wissen bleibt präsent.", kategorie: "Visualisierung" },
  { id: 64, titel: "Arbeite mit Fallbeispielen", warum: "Authentische Situationen fördern problemlösendes Denken und zeigen den Praxisbezug von Unterrichtsinhalten.", umsetzung: ["Realistische Fälle auswählen.", "Gemeinsam analysieren.", "Lösungen entwickeln.", "Ergebnisse vergleichen."], merksatz: "Praxis macht Lernen bedeutsam.", kategorie: "Problemorientiertes Lernen" },
  { id: 65, titel: "Plane regelmäßige Wiederholungen ein", warum: "Lernen wird nachhaltiger, wenn Inhalte mehrfach über einen längeren Zeitraum wiederholt werden.", umsetzung: ["Kurze Wiederholungen zu Stundenbeginn.", "Quizfragen nutzen.", "Alte Inhalte aufgreifen.", "Verbindungen zu neuen Themen herstellen."], merksatz: "Wiederholung sichert Wissen.", kategorie: "Lernstrategien", quelle: "Ebbinghaus / Cepeda – Spacing-Effekt" },
  { id: 66, titel: "Nutze Quizformate bewusst", warum: "Kurze Quiz erhöhen die Aktivierung und geben dir gleichzeitig Rückmeldung über den Lernstand.", umsetzung: ["Wenige Fragen auswählen.", "Lösungen gemeinsam besprechen.", "Fehler erklären.", "Quiz als Lernchance nutzen."], merksatz: "Quiz können Lernen sichtbar machen.", kategorie: "Diagnostik", quelle: "Roediger & Karpicke – Testing Effect" },
  { id: 67, titel: "Lass Lernende Fragen entwickeln", warum: "Eigene Fragen zeigen, wie tief ein Thema verstanden wurde, und fördern selbstständiges Denken.", umsetzung: ["Jede Person formuliert zwei Fragen.", "Fragen austauschen.", "Gemeinsam beantworten.", "Gute Fragen sammeln."], merksatz: "Gute Fragen zeigen gutes Denken.", kategorie: "Aktivierung" },
  { id: 68, titel: "Nutze Peer-Feedback", warum: "Rückmeldungen von Mitschülerinnen und Mitschülern fördern Reflexion und helfen, Arbeiten gezielt zu verbessern.", umsetzung: ["Klare Feedbackregeln vereinbaren.", "Positives zuerst nennen.", "Konkrete Verbesserungsvorschläge geben.", "Zeit zur Überarbeitung einplanen."], merksatz: "Feedback hilft beim Wachsen.", kategorie: "Feedback" },
  { id: 69, titel: "Plane Lernprodukte", warum: "Wenn am Ende ein sichtbares Produkt entsteht, arbeiten viele Lernende zielgerichteter und reflektierter.", umsetzung: ["Produkt früh ankündigen.", "Kriterien transparent machen.", "Zeit für Überarbeitung einplanen.", "Ergebnisse präsentieren."], merksatz: "Ein Ziel macht Lernen greifbar.", kategorie: "Projektarbeit" },
  { id: 70, titel: "Methoden sind Mittel – nicht das Ziel", warum: "Eine Methode ist dann gut, wenn sie das Lernziel unterstützt. Nicht jede beliebte Methode passt zu jedem Thema oder jeder Lerngruppe.", umsetzung: ["Lernziel zuerst festlegen.", "Methode passend auswählen.", "Nach der Stunde reflektieren.", "Bei Bedarf anpassen."], merksatz: "Das Lernziel bestimmt die Methode – nicht umgekehrt.", kategorie: "Unterrichtsplanung" },
  { id: 71, titel: "Nutze die Interessen und Lebenswelt der Klasse", warum: "Lerninhalte wirken motivierender, wenn sie an die Lebenswelt der Schülerinnen und Schüler anknüpfen. Bekannte Themen und authentische Beispiele erleichtern den Zugang zu neuen Inhalten.", umsetzung: ["Frage nach Hobbys und Interessen.", "Nutze aktuelle Beispiele.", "Lass Lernende Beispiele einbringen.", "Greife Alltagssituationen auf.", "Beziehe lokale Ereignisse ein."], merksatz: "Interesse ist der Motor des Lernens.", kategorie: "Motivation" },
  { id: 72, titel: "Gib Lernenden Verantwortung", warum: "Wer Verantwortung übernimmt, identifiziert sich stärker mit dem Unterricht und entwickelt Selbstständigkeit.", umsetzung: ["Klassenämter vergeben.", "Materialdienste einführen.", "Moderationen übertragen.", "Ergebnisse präsentieren lassen."], merksatz: "Verantwortung fördert Selbstständigkeit.", kategorie: "Partizipation" },
  { id: 73, titel: "Nutze Lernziele statt Arbeitsaufträge", warum: "Arbeitsaufträge beschreiben, was getan werden soll. Lernziele machen deutlich, was am Ende verstanden oder gekonnt werden soll.", umsetzung: ["Lernziel zu Beginn nennen.", "Am Ende darauf zurückkommen.", "Lernziel gemeinsam überprüfen.", "Erfolg sichtbar machen."], merksatz: "Ein Auftrag beschäftigt – ein Lernziel orientiert.", kategorie: "Unterrichtsplanung" },
  { id: 74, titel: "Plane Aufgaben auf mehreren Niveaus", warum: "Lernende unterscheiden sich in Vorwissen, Lerntempo und Unterstützungsbedarf. Aufgaben knapp über dem aktuellen Können motivieren am meisten – zu leichte langweilen, zu schwere frustrieren.", umsetzung: ["Basisaufgaben anbieten.", "Erweiterungsaufgaben ergänzen.", "Freiwillige Zusatzaufgaben entwickeln.", "Lernfortschritt regelmäßig beobachten."], merksatz: "Nicht alle lernen auf demselben Weg.", kategorie: "Differenzierung", quelle: "Wygotski – Zone der nächsten Entwicklung" },
  { id: 75, titel: "Gib Hilfen gestuft", warum: "Hilfen müssen nicht sofort die Lösung liefern. Gestufte Hilfen fördern eigenständiges Denken und geben nur so viel Unterstützung wie nötig.", umsetzung: ["Erst einen kleinen Hinweis geben.", "Danach Leitfragen stellen.", "Beispiele anbieten.", "Hilfekarten frei zugänglich machen.", "Die Lösung erst als letzte Hilfe zeigen."], merksatz: "So viel Hilfe wie nötig – so wenig wie möglich.", kategorie: "Differenzierung" },
  { id: 78, titel: "Nutze Lernpartnerschaften", warum: "Feste Lernpartner erleichtern Zusammenarbeit, gegenseitige Unterstützung und Feedback.", umsetzung: ["Lernpaare bewusst zusammenstellen.", "Rollen vereinbaren.", "Regelmäßig wechseln.", "Zusammenarbeit reflektieren."], merksatz: "Gemeinsam lernt es sich leichter.", kategorie: "Kooperatives Lernen" },
  { id: 79, titel: "Plane Zeit für Fragen ein", warum: "Fragen zeigen Interesse und helfen, Missverständnisse frühzeitig zu erkennen.", umsetzung: ["Feste Fragerunden einbauen.", "Anonyme Fragen ermöglichen.", "Verständnisfragen zulassen.", "Offen auf Fragen reagieren."], merksatz: "Fragen sind ein Zeichen von Lernen.", kategorie: "Unterrichtsgespräch" },
  { id: 80, titel: "Gib Musterlösungen zur Selbstkontrolle heraus", warum: "Wer die eigene Lösung mit einer Musterlösung vergleicht, entdeckt Fehler selbst – und lernt dabei mehr als durch eine angestrichene Korrektur. Voraussetzung ist, dass anschließend wirklich Zeit zum Überarbeiten bleibt.", umsetzung: ["Musterlösung erst nach der Bearbeitung ausgeben, nicht vorher.", "Lernende die Abweichung markieren lassen, nicht nur abhaken.", "Feste Zeit zur Überarbeitung einplanen.", "Typische Abweichungen anschließend gemeinsam ansprechen."], merksatz: "Selbst gefundene Fehler bleiben besser hängen.", kategorie: "Lernstrategien" },
  { id: 82, titel: "Beobachte gezielt während der Arbeitsphase", warum: "Die Arbeitsphase ist die beste Diagnosezeit – dort zeigt sich, wer wirklich versteht. Wer dabei gezielt schaut statt nur zu betreuen, erkennt Lücken, bevor sie sich verfestigen.", umsetzung: ["Vor der Stunde festlegen, worauf du achtest (z. B. Rechenweg, Satzbau).", "Drei bis vier Kinder pro Stunde bewusst beobachten.", "Kurze Notizen direkt machen, nicht erst abends.", "Beobachtungen in die Planung der nächsten Stunde einbauen."], merksatz: "Diagnostik passiert im Rundgang, nicht erst in der Arbeit.", kategorie: "Diagnostik" },
  { id: 83, titel: "Nutze Fehler zur Unterrichtsplanung", warum: "Häufige Fehler zeigen, welche Inhalte noch nicht verstanden wurden und wo Wiederholungen nötig sind.", umsetzung: ["Typische Fehler sammeln.", "Gemeinsam analysieren.", "Missverständnisse gezielt aufgreifen.", "Übungen anpassen."], merksatz: "Fehler zeigen den nächsten Lernschritt.", kategorie: "Diagnostik" },
  { id: 85, titel: "Nutze Checklisten", warum: "Checklisten helfen Lernenden, strukturiert zu arbeiten und ihre Ergebnisse selbstständig zu überprüfen.", umsetzung: ["Klare Kriterien formulieren.", "Vor der Abgabe nutzen lassen.", "Gemeinsam besprechen.", "Regelmäßig einsetzen."], merksatz: "Checklisten schaffen Sicherheit.", kategorie: "Selbstständiges Lernen" },
  { id: 86, titel: "Lass unterschiedliche Lösungswege zu", warum: "Nicht alle Lernenden gelangen auf dieselbe Weise zum Ziel. Verschiedene Lösungswege fördern kreatives und flexibles Denken.", umsetzung: ["Mehrere Strategien zulassen.", "Lösungen vergleichen.", "Gemeinsam Vor- und Nachteile besprechen.", "Begründungen einfordern."], merksatz: "Viele Wege können richtig sein.", kategorie: "Unterrichtsmethoden" },
  { id: 87, titel: "Nutze Beispiele und Gegenbeispiele", warum: "Gegenbeispiele helfen, Begriffe und Regeln präziser zu verstehen und Missverständnisse zu vermeiden.", umsetzung: ["Passendes Beispiel zeigen.", "Gegenbeispiel ergänzen.", "Unterschiede besprechen.", "Merkmale gemeinsam herausarbeiten."], merksatz: "Gegenbeispiele schärfen das Verständnis.", kategorie: "Didaktik" },
  { id: 88, titel: "Lass Lernende ihre Lösungen begründen", warum: "Begründungen machen Denkprozesse sichtbar und fördern ein tieferes Verständnis.", umsetzung: ["Nach dem „Warum?\" fragen.", "Begründungen vergleichen.", "Alternative Argumente zulassen.", "Rückfragen stellen."], merksatz: "Begründen vertieft Verstehen.", kategorie: "Unterrichtsgespräch" },
  { id: 89, titel: "Führe ein Lernjournal über längere Zeit", warum: "Einzelne Reflexionsfragen verpuffen. Werden Antworten über Wochen an derselben Stelle gesammelt, sehen Lernende ihre eigene Entwicklung – das stärkt die Einschätzung der eigenen Fähigkeiten.", umsetzung: ["Feste Seite oder Heft pro Kind anlegen.", "Immer dieselben zwei bis drei Fragen nutzen.", "Einmal pro Woche fünf Minuten Zeit geben.", "Alle paar Wochen ältere Einträge gemeinsam durchsehen."], merksatz: "Entwicklung sieht man erst über mehrere Einträge.", kategorie: "Lernstrategien" },
  { id: 90, titel: "Passe dein Tempo an die Lerngruppe an", warum: "Ein angemessenes Unterrichtstempo verhindert Überforderung und Langeweile. Die Lerngruppe bestimmt das Lerntempo – nicht der Stundenplan allein.", umsetzung: ["Verständnis regelmäßig überprüfen.", "Bei Bedarf verlangsamen.", "Zusätzliche Herausforderungen anbieten.", "Zeitreserven einplanen."], merksatz: "Guter Unterricht richtet sich nach den Lernenden.", kategorie: "Unterrichtsplanung" },
  { id: 91, titel: "Beginne jedes Elterngespräch mit etwas Positivem", warum: "Ein wertschätzender Einstieg schafft Vertrauen und erleichtert es, auch schwierige Themen anzusprechen. Eltern erleben, dass ihr Kind ganzheitlich wahrgenommen wird.", umsetzung: ["Nenne eine konkrete Stärke des Kindes.", "Bleibe ehrlich und authentisch.", "Gehe anschließend zum Gesprächsanlass über.", "Verbinde Stärken mit Entwicklungsmöglichkeiten."], merksatz: "Wertschätzung öffnet Türen.", kategorie: "Elternarbeit" },
  { id: 92, titel: "Bereite Elterngespräche gut vor", warum: "Eine gute Vorbereitung sorgt für Struktur, Sicherheit und Sachlichkeit – besonders bei schwierigen Gesprächen.", umsetzung: ["Ziele des Gesprächs notieren.", "Beobachtungen dokumentieren.", "Beispiele bereithalten.", "Mögliche Lösungen überlegen."], merksatz: "Vorbereitung schafft Sicherheit.", kategorie: "Elternarbeit" },
  { id: 93, titel: "Beschreibe Beobachtungen statt Vermutungen", warum: "Konkrete Beobachtungen sind nachvollziehbar und vermeiden Missverständnisse. Vermutungen oder Verallgemeinerungen führen dagegen häufig zu Abwehr.", umsetzung: ["Beschreibe konkrete Situationen.", "Nutze Beispiele.", "Vermeide Begriffe wie „immer\" oder „nie\".", "Trenne Beobachtung und Interpretation."], merksatz: "Beobachtungen überzeugen mehr als Vermutungen.", kategorie: "Gesprächsführung" },
  { id: 94, titel: "Suche gemeinsam nach Lösungen", warum: "Nachhaltige Veränderungen entstehen eher, wenn Lehrkräfte, Eltern und Kinder gemeinsam an Lösungen arbeiten.", umsetzung: ["Frage nach Ideen der Eltern.", "Entwickle gemeinsame Ziele.", "Vereinbare konkrete Schritte.", "Halte Ergebnisse fest."], merksatz: "Gemeinsame Lösungen halten länger.", kategorie: "Elternarbeit" },
  { id: 95, titel: "Dokumentiere wichtige Gespräche", warum: "Kurze Gesprächsnotizen helfen dabei, Vereinbarungen nachzuvollziehen und Missverständnisse zu vermeiden.", umsetzung: ["Datum notieren.", "Gesprächsanlass festhalten.", "Vereinbarungen dokumentieren.", "Datenschutz beachten."], merksatz: "Was dokumentiert ist, bleibt nachvollziehbar.", kategorie: "Organisation" },
  { id: 96, titel: "Bleibe auch in schwierigen Gesprächen sachlich", warum: "Emotionen sind verständlich, doch sachliche Kommunikation erhöht die Chance auf konstruktive Lösungen.", umsetzung: ["Ruhig sprechen.", "Aktiv zuhören.", "Nachfragen stellen.", "Nicht persönlich werden."], merksatz: "Sachlichkeit schafft Klarheit.", kategorie: "Konfliktmanagement" },
  { id: 97, titel: "Setze einen festen Rückmeldetermin", warum: "Vereinbarungen aus Elterngesprächen versanden, wenn niemand einen Zeitpunkt festlegt, an dem geschaut wird. Ein konkreter Termin macht aus einem guten Vorsatz eine überprüfbare Absprache.", umsetzung: ["Beim Gespräch direkt einen Termin in zwei bis vier Wochen setzen.", "Festlegen, woran ihr die Veränderung erkennen wollt.", "Den Termin im Kalender eintragen, bevor die Eltern gehen.", "Auch dann melden, wenn es gut läuft – nicht nur bei Problemen."], merksatz: "Ohne Termin wird aus einer Absprache ein Vorsatz.", kategorie: "Elternarbeit" },
  { id: 98, titel: "Kommuniziere regelmäßig – nicht nur bei Problemen", warum: "Wenn Eltern nur bei Schwierigkeiten kontaktiert werden, entstehen leichter Unsicherheiten. Regelmäßige positive Rückmeldungen stärken die Zusammenarbeit.", umsetzung: ["Positive Entwicklungen mitteilen.", "Erfolge würdigen.", "Kurz und konkret formulieren.", "Kommunikation planbar gestalten."], merksatz: "Beziehung entsteht durch regelmäßigen Kontakt.", kategorie: "Elternarbeit" },
  { id: 99, titel: "Grenzen gehören zu professioneller Kommunikation", warum: "Klare Grenzen schützen die eigene Arbeitszeit und schaffen transparente Erwartungen für alle Beteiligten.", umsetzung: ["Erreichbarkeit kommunizieren.", "Antwortzeiten realistisch halten.", "Schulische Kommunikationswege nutzen.", "Freundlich, aber bestimmt bleiben."], merksatz: "Klare Grenzen schaffen Respekt.", kategorie: "Professionelles Handeln" },
  { id: 100, titel: "Beende jedes Gespräch mit einer Zusammenfassung", warum: "Eine kurze Zusammenfassung stellt sicher, dass alle Beteiligten dieselben Vereinbarungen verstanden haben.", umsetzung: ["Wichtigste Punkte wiederholen.", "Vereinbarungen benennen.", "Verantwortlichkeiten klären.", "Positiv verabschieden."], merksatz: "Eine gute Zusammenfassung verhindert Missverständnisse.", kategorie: "Gesprächsführung" },
  { id: 101, titel: "Der Praxisschock ist normal – nicht dein Versagen", warum: "Die erste eigene Verantwortung im Klassenraum wird in der Berufseinstiegsforschung als „Praxisschock\" beschrieben – ein typisches Phänomen, kein persönliches Scheitern. Wer das weiß, kann Belastung einordnen, statt sie sich selbst anzulasten.", umsetzung: ["Rechne bewusst mit einer holprigen Anfangsphase.", "Vergleiche dich nicht mit erfahrenen Kolleg:innen.", "Sprich früh mit anderen Referendar:innen – gleiche Phase, gleiche Themen.", "Definiere für dich, was in diesem Halbjahr „gut genug\" heißt."], merksatz: "Der Anfang fühlt sich chaotisch an. Das ist Beruf, nicht Scheitern.", kategorie: "Berufseinstieg", quelle: "Hascher – Berufseinstiegsforschung / Terhart – Lehrerprofessionalität" },
  { id: 102, titel: "Nutze deine Mentor:in als Sparringspartner:in, nicht als Richter:in", warum: "Die Beziehung zur Mentor:in prägt das Referendariat stärker als jedes Seminar. Wer früh Fragen stellt und um Rückmeldung bittet, bekommt Feedback im Prozess – nicht erst in der Bewertung.", umsetzung: ["Vereinbare feste kurze Austauschzeiten, nicht nur Anlassgespräche.", "Bringe konkrete Fragen mit – nicht „Wie war das?\".", "Frage nach Beispielen aus ihrer eigenen Praxis.", "Notiere Rückmeldungen und komm bei der nächsten Stunde darauf zurück."], merksatz: "Frage, bevor bewertet wird.", kategorie: "Mentoring", quelle: "Hascher – Berufseinstiegsforschung" },
  { id: 103, titel: "Fokussiere dich im Unterrichtsbesuch auf zwei bis drei Schwerpunkte", warum: "Wer alle Kriterien guten Unterrichts gleichzeitig bedienen will, verliert Kohärenz. Ein UB wirkt stärker, wenn zwei bis drei Aspekte (z. B. Aktivierung, klare Struktur) durchgängig sichtbar sind.", umsetzung: ["Wähle vorab zwei bis drei Merkmale, an denen du dich messen lässt.", "Nenne sie in der schriftlichen Planung explizit.", "Baue Methoden so, dass sie diese Merkmale tragen.", "Reflektiere im Nachgespräch entlang genau dieser Punkte."], merksatz: "Wenige Baustellen richtig statt alle halb.", kategorie: "Unterrichtsbesuch", quelle: "Meyer – Was ist guter Unterricht?" },
  { id: 104, titel: "Übernimm im Einstieg fremde Rituale, bevor du eigene erfindest", warum: "Kinder brauchen im Übergang Kontinuität. Rituale der Klassenlehrer:in oder Mentor:in in den ersten Wochen weiterzuführen entlastet dich und schont die Klasse – dein eigenes System kommt später.", umsetzung: ["Frage nach bestehenden Ritualen (Begrüßung, Ruhezeichen, Übergänge).", "Führe sie in den ersten Wochen möglichst identisch weiter.", "Beobachte, was funktioniert und warum.", "Verändere erst gezielt, wenn du die Klasse kennst."], merksatz: "Erst die Wiese pflegen, dann umgraben.", kategorie: "Referendariat", quelle: "Kounin – Withitness / Meyer – Was ist guter Unterricht?" },
  { id: 105, titel: "Höre im UB-Nachgespräch erst zu Ende, bevor du antwortest", warum: "Wer sich in Feedbackgesprächen sofort rechtfertigt, verliert wertvolle Beobachtungen und wirkt defensiv. Aktives Zuhören mit Notizen zeigt Professionalität und macht Rückmeldung nutzbar.", umsetzung: ["Nimm Stift und Papier mit ins Nachgespräch.", "Höre erst komplett zu, ohne zu unterbrechen.", "Fasse in eigenen Worten zusammen, was du verstanden hast.", "Erklärungen oder Nachfragen erst danach."], merksatz: "Erst hören, dann sortieren, dann reden.", kategorie: "Unterrichtsbesuch", quelle: "Wahl – Handeln unter Druck / Reflektierte Praxis" },
  { id: 106, titel: "Reflektiere nach der Lehrprobe schriftlich – nicht im Kopf", warum: "Nach Prüfungssituationen kreisen Gedanken oft unproduktiv um einzelne Momente. Schriftliche Reflexion strukturiert die Erfahrung und wandelt sie in konkrete nächste Schritte um.", umsetzung: ["Notiere direkt danach: Was ist gelungen? Was hat gestört? Warum?", "Trenne Beobachtung und Bewertung.", "Formuliere höchstens zwei konkrete Vorhaben für die nächste Stunde.", "Leg das Blatt weg – morgen liest du es noch einmal."], merksatz: "Papier ordnet, was der Kopf dreht.", kategorie: "Unterrichtsbesuch", quelle: "Schön – The Reflective Practitioner" },
  { id: 107, titel: "Trenne Seminar- und Schulzeit räumlich und zeitlich", warum: "Im Referendariat laufen zwei Berufe parallel. Ohne bewusste Grenzen dehnt sich Arbeit über den ganzen Tag – die Erholungsforschung zeigt: gerade in der Ausbildungsphase ist Distanz zum Beruf zentral für Belastbarkeit.", umsetzung: ["Lege feste Zeitfenster für Seminararbeit und Unterrichtsvorbereitung fest.", "Trenne Arbeitsplatz und Erholungsort räumlich, wenn möglich.", "Plane pro Woche mindestens einen ganzen Tag ohne Schulthema.", "Nutze eine feste Grenzzeit am Abend, ab der der Laptop zubleibt."], merksatz: "Zwei Berufe – aber ein Feierabend.", kategorie: "Referendariat", quelle: "Rothland – Belastung und Beanspruchung im Lehrberuf" },
  { id: 108, titel: "Investiere die erste Pause in Kontakt zum Kollegium", warum: "Soziale Unterstützung im Kollegium ist der empirisch stärkste Puffer gegen Belastung im Berufseinstieg. Wer im Lehrerzimmer sichtbar ist, bekommt schneller Hilfe – bei Elternfragen, Schulordnung, kleinen Kniffen.", umsetzung: ["Verbringe Pausen bewusst im Lehrerzimmer, nicht am eigenen Pult.", "Stelle dich in den ersten Wochen aktiv vor, auch außerhalb der eigenen Fachschaft.", "Frage konkret, statt zu warten, bis Hilfe angeboten wird.", "Biete kleine Gegenleistungen an – Aufsicht tauschen, Material teilen."], merksatz: "Das Kollegium ist dein bester Puffer.", kategorie: "Berufseinstieg", quelle: "Rothland – soziale Unterstützung im Lehrberuf" },
  { id: 109, titel: "Selbstzweifel gehören dazu – aber prüfe sie an Fakten", warum: "Nach schwierigen Stunden neigt man dazu, sich pauschal in Frage zu stellen („Ich kann das nicht\"). Die Unterscheidung zwischen einer schwierigen Situation und der eigenen Eignung ist ein Kernbaustein professioneller Selbstwirksamkeit.", umsetzung: ["Formuliere den Zweifel konkret: Was genau lief nicht?", "Suche Belege dafür – und dagegen.", "Frage: Was würde ich einer Kollegin in dieser Situation raten?", "Übersetze den Zweifel in eine kleine, machbare Änderung."], merksatz: "Zweifel darf da sein. Er hat aber keine Belege.", kategorie: "Berufseinstieg", quelle: "Dweck – Growth Mindset / Bandura – Selbstwirksamkeit" },
  { id: 110, titel: "Lehreridentität entsteht in Jahren, nicht in Wochen", warum: "Professionalisierungsforschung beschreibt die Entwicklung der Lehrerrolle als längeren Prozess – nicht als Zustand, den man nach dem Ref erreicht hat. Wer sich diese Zeit zugesteht, bleibt handlungsfähig und lernbereit.", umsetzung: ["Beobachte Kolleg:innen, die dich beeindrucken – was genau tun sie?", "Übernimm bewusst einzelne Bausteine, nicht ganze Personen.", "Reflektiere in Abständen: Was ist inzwischen „typisch ich\"?", "Erlaube dir, Positionen im Lauf der Jahre zu ändern."], merksatz: "Werde nicht die perfekte Lehrkraft. Werde deine.", kategorie: "Referendariat", quelle: "Terhart – Lehrerprofessionalität / Neuweg – Lehrerbildung" },
  { id: 111, titel: "Etabliere ein Feierabend-Ritual", warum: "Ohne bewussten Übergang läuft der Arbeitskopf zu Hause weiter. Ein festes, kurzes Ritual signalisiert Körper und Kopf, dass die Rolle als Lehrkraft vorerst endet – das schützt Erholung und Familie.", umsetzung: ["Wähle einen fixen Endpunkt (z. B. Schulschlüssel in die Schublade, Rechner zu).", "Verknüpfe ihn mit einer immer gleichen Handlung (Umziehen, Spaziergang um den Block, Musikstück).", "Notiere offene Punkte fürs nächste Mal – dann darf der Kopf loslassen.", "Halte das Ritual auch an Tagen ein, an denen wenig los war – Rituale wirken durch Wiederholung."], merksatz: "Ohne Ritual gibt es keinen Feierabend – nur eine Pause.", kategorie: "Selbstfürsorge", quelle: "Kaluza – Stressbewältigung" },
  { id: 112, titel: "Schone deine Stimme wie ein Instrument", warum: "Berufsbedingte Stimmstörungen gehören zu den häufigsten Krankheitsursachen im Lehrberuf. Wer laut und angespannt spricht, riskiert Heiserkeit bis hin zu chronischen Schäden – kleine Gewohnheiten beugen wirksam vor.", umsetzung: ["Trinke regelmäßig warmes oder zimmerwarmes Wasser – keine eiskalten Getränke.", "Ersetze Anschreien durch Signale (Klangstab, Handzeichen, Blickkontakt).", "Sprich aus dem Bauch, nicht aus dem Hals – aufrechte Haltung, entspannte Schultern.", "Räusper dich nicht ständig – lieber schlucken oder einen Schluck Wasser.", "Nach lauten Stunden 10 Minuten Stimmruhe einlegen."], merksatz: "Die Stimme ist dein wichtigstes Werkzeug – behandle sie wie eins.", kategorie: "Gesundheit", quelle: "Nienkerke-Springer / DGPP-Empfehlungen zur Berufsdysphonie" },
  { id: 113, titel: "Nutze kollegiale Fallberatung", warum: "Schwierige Kinder, Elternkonflikte oder festgefahrene Klassen belasten weniger, wenn sie strukturiert mit Kolleg:innen besprochen werden. Kollegiale Beratung ist ein etabliertes, ritualisiertes Format – kein Kaffeeklatsch, sondern eine Methode mit Rollen und Ablauf.", umsetzung: ["Finde 3–5 Kolleg:innen, die sich regelmäßig treffen wollen (z. B. alle 4 Wochen, 60 Minuten).", "Eine Person schildert den Fall (5 Min.), die Gruppe fragt nach (10 Min.), sammelt Hypothesen und Ideen (20 Min.).", "Die einbringende Person entscheidet allein, was sie mitnimmt – keine Ratschläge von oben.", "Vertraulichkeit ist Pflicht – ohne sie funktioniert das Format nicht."], merksatz: "Ein schwieriger Fall wird kleiner, wenn andere mitdenken.", kategorie: "Kollegiale Zusammenarbeit", quelle: "Tietze / Mutzeck – Kollegiale Beratung" },
  { id: 114, titel: "Nimm Warnzeichen früh ernst", warum: "Erschöpfung entsteht nicht plötzlich, sondern schleichend. Die AVEM-Forschung zeigt: Wer über Monate übermäßig verausgabt ist, ohne Distanzierungsfähigkeit, hat ein erhöhtes Burnout-Risiko. Frühe Zeichen zu kennen ist der beste Schutz.", umsetzung: ["Achte auf typische Signale: Schlafstörungen, Zynismus gegenüber Schüler:innen, Sonntagabend-Grausen, chronische Erschöpfung trotz Ferien.", "Sprich mit einer vertrauten Person – nicht erst, wenn es kritisch ist.", "Bei mehreren Zeichen über Wochen: Haus- oder Betriebsärzt:in ansprechen, Angebote der Lehrergesundheit nutzen.", "Fällt dir Distanzierung schwer, teste konkrete Regeln: kein Schulhandy im Schlafzimmer, ein arbeitsfreier Tag pro Woche."], merksatz: "Erschöpfung schleicht sich an – Warnzeichen sprechen zuerst.", kategorie: "Selbstfürsorge", quelle: "Schaarschmidt & Fischer – AVEM" },
  { id: 115, titel: "Pause heißt Pause", warum: "Studien zur Lehrerbelastung zeigen, dass echte Regenerationsphasen im Schultag oft fehlen – Aufsicht, Kopierer, Elterngespräche zwischen Tür und Angel füllen die Pause. Ohne echte Erholung sinkt die Konzentration in der nächsten Stunde messbar.", umsetzung: ["Plane mindestens eine Pause pro Tag ohne Bildschirm und ohne Gespräch.", "Verlasse den Klassenraum – räumlicher Wechsel wirkt stärker als sitzen bleiben.", "Tausche Aufsichten fair im Kollegium, damit nicht immer dieselben Stunden auffangen.", "Iss und trink bewusst – nicht nebenher zwischen zwei Aufgaben."], merksatz: "Wer nur Aufsicht macht, hat keine Pause gemacht.", kategorie: "Selbstfürsorge", quelle: "Rothland – Belastung und Beanspruchung im Lehrberuf" },
  { id: 116, titel: "Setze dir eine 80-Prozent-Grenze", warum: "Perfektionismus zählt in der Belastungsforschung zu den stärksten Risikofaktoren für Erschöpfung im Lehrberuf. Nicht jede Stunde muss ausgefeilt, nicht jedes Arbeitsblatt gestylt sein – die Frage ist, was „gut genug\" für das Lernziel ist.", umsetzung: ["Frag dich vor jeder Vorbereitung: Was ist der Kern, ohne den es nicht geht?", "Setze ein Zeitlimit pro Aufgabe – und halte es ein, auch wenn „noch etwas ginge\".", "Recycle bewährtes Material, statt jedes Mal neu zu bauen.", "Bei Korrekturen: eine feste Zeit pro Arbeit, keine Endlos-Feinjustierung der Punkte."], merksatz: "Perfekt ist Feind von fertig.", kategorie: "Zeitmanagement", quelle: "Bauer – Kränkung im Lehrberuf; Schaarschmidt – AVEM-Muster A" },
  { id: 117, titel: "Räum den Kopf vor dem Schlaf", warum: "Das nächtliche Gedankenkarussell entsteht, weil das Gehirn offene Punkte im Wachzustand halten will. Ein einfaches Aufschreib-Ritual verlagert diese Last aufs Papier – ein Baustein aus der kognitiven Verhaltenstherapie bei Schlafstörungen.", umsetzung: ["Lege einen Notizblock neben das Bett.", "10 Minuten vor dem Schlafen: alles aufschreiben, was noch im Kopf ist – Aufgaben, Sorgen, Ideen.", "Bei bekannten Grübel-Themen zusätzlich eine kleine „Sorgenzeit\" tagsüber (15 Min., fester Zeitpunkt) einplanen.", "Kein Bildschirm in den letzten 30 Minuten vor dem Einschlafen.", "Wenn du länger als 20 Minuten wach liegst: aufstehen, ruhige Tätigkeit, dann neu versuchen."], merksatz: "Was auf dem Zettel steht, muss nicht im Kopf kreisen.", kategorie: "Gesundheit", quelle: "Kognitive Verhaltenstherapie bei Insomnie (KVT-I)" },
  { id: 118, titel: "Nach schwierigen Situationen kurz debriefen", warum: "Ein Elternstreit, ein Wutausbruch eines Kindes, eine verunglückte Stunde – solche Momente wirken lange nach, wenn sie nicht ausgesprochen werden. Ein kurzes strukturiertes Nachbesprechen mit einer Vertrauensperson entlastet nachweislich und beugt Rumination vor.", umsetzung: ["Such dir 1–2 Kolleg:innen für gegenseitige Kurz-Nachbesprechungen (5–10 Min. reichen).", "Erzähle in dieser Reihenfolge: was passiert ist, was du gefühlt hast, was du daraus mitnimmst.", "Achte darauf, dass die andere Person zuhört – nicht sofort Ratschläge gibt.", "Bei wiederkehrender starker Belastung: Supervision oder Angebote der Lehrergesundheit nutzen – das ist keine Schwäche, sondern Standard in helfenden Berufen."], merksatz: "Belastung, die benannt wird, bleibt nicht im Körper hängen.", kategorie: "Kollegiale Zusammenarbeit", quelle: "Cierpka – kollegiale Nachbesprechung" },
  { id: 119, titel: "Bewege dich regelmäßig – auch wenn du müde bist", warum: "Körperliche Aktivität ist einer der bestbelegten Puffer gegen Stressfolgen und depressive Verstimmung. Gerade an Tagen mit hoher mentaler Belastung wirkt Bewegung stärker als Ausruhen. Welche Sportart passt, ist zweitrangig – Regelmäßigkeit zählt.", umsetzung: ["Plane 2–3 feste Termine pro Woche à mindestens 30 Minuten – wie einen Zahnarzttermin.", "Wähle etwas, das du auch bei schlechtem Wetter durchziehst (nicht nur Fahrradfahren).", "An besonders anstrengenden Tagen reicht ein 20-Minuten-Spaziergang – lieber kurz als gar nicht.", "Verknüpfe Bewegung mit dem Feierabend-Ritual – dann wird sie zur Gewohnheit statt zur Willensfrage."], merksatz: "Wer sitzt, wird nicht ausgeruht – sondern steif.", kategorie: "Gesundheit", quelle: "WHO-Empfehlungen körperliche Aktivität; Kaluza – Ressourcenmodell" },
];

const HELP_DATA = [
  {
    category: "Erste Schritte",
    items: [
      { q: "Wie lege ich eine neue Klasse an?", a: `Tippe auf „Klassen" in der Navigation, dann oben rechts auf „+". Gib den Klassennamen ein und bestätige mit „Anlegen".` },
      { q: "Wie füge ich Schüler:innen hinzu?", a: `Öffne eine Klasse und tippe auf „+ Schüler:in". Namen können einzeln oder als Liste eingegeben werden.` },
      { q: "Wie stelle ich mein Bundesland ein?", a: `Beim ersten Start fragt Saidy automatisch nach deinem Bundesland und trägt die Schulferien ein. Nachträglich: „Mehr" → „Einstellungen" → Bundesland wählen → „Schulferien eintragen".` },
      { q: "Was passiert beim ersten Start?", a: `Saidy führt dich in zwei Schritten durch die Einrichtung: zuerst Bundesland und Schulferien, dann kannst du direkt deine erste Klasse anlegen. Beides lässt sich auch später in den Einstellungen anpassen.` },
      { q: "Wie schalte ich den Farb-Modus ein?", a: `Tippe auf der Startseite oben rechts auf das Sternchen-Symbol (✦). Im Standard-Modus ist die App schlicht und einfarbig – ein Tipp bringt Farbe in alle Ansichten: bunte Aufgaben-Kreise, farbige Fach-Markierungen, farbige Noten-Trends. Erneutes Tippen schaltet zurück zum ruhigen Mono-Modus.` },
      { q: "Was zeigt das Morgen-Briefing auf der Startseite?", a: `Beim Öffnen der App erscheint oben die Karte „Heute im Blick". Sie fasst den Tag in ganzen Sätzen zusammen – zum Beispiel: „Guten Morgen! Heute stehen 4 Stunden an – die erste um 8:00 Uhr in der 4a." Berücksichtigt werden die Stunden des Tages, knapp bevorstehende Klassenarbeiten, Termine, Geburtstage, Kinder die an mehreren der letzten Tage gefehlt haben, und noch nicht erfasste Stunden. Dringendes steht rot und zuerst; angezeigt werden drei Sätze, der Rest über „+ weitere". Alles wird auf deinem Gerät berechnet, es werden keine Daten übertragen. Mit dem × blendest du die Karte für heute aus.` },
      { q: "Wie ist die Übersichtsseite aufgebaut?", a: `Von oben nach unten: (1) Drei kompakte Kennzahl-Kacheln nebeneinander – „Erfassen" (noch nicht erfasste Stunden), „Entschuldigungen" (offen) und „Förderziele" (aktiv). Jede Kachel ist antippbar und springt in den passenden Bereich; Kacheln mit offenen Punkten färben sich amber. (2) Das Morgen-Briefing „Heute im Blick". (3) Die Wochenleiste zum Wechseln des Tages. (4) „Dein Unterricht heute" – jede Stunde als eigene Karte, daneben der Knopf „Stundenplan". (5) Termine, Geburtstage und To-dos als vollbreite Karten untereinander. (6) Klassenradar, falls Signale vorliegen. (7) Dienste und Entschuldigungen als vollbreite Karten; nur deren Reihenfolge lässt sich in den Einstellungen unter „Übersicht (Startseite)" ändern – alles darüber hat einen festen Platz. (8) Ganz unten der „Unterrichtstipp des Tages", falls in den Einstellungen aktiv.` },
      { q: "Was zeigt eine Stundenkarte auf der Startseite?", a: `Links Anfangs- und Endzeit, daneben das Klassenkürzel (z. B. „4a") und das Fach; darunter steht der Titel der nächsten Klassenarbeit, falls einer hinterlegt ist. Eine Doppelstunde – also zwei aufeinanderfolgende Blöcke desselben Fachs – erscheint als eine Karte mit durchgehender Zeitspanne (07:55 – 09:30) und dem Vermerk „Doppel". Sind zwischen den Blöcken andere Stunden, bleiben sie getrennt. Rechts das Stundenthema und – sobald ein Klassenarbeitstermin existiert – ein Fortschrittsbalken. Er füllt sich, je weiter ihr im Thema seid: „3 / 6 Stunden" heißt, drei Stunden habt ihr für dieses Thema schon gehalten, sechs sind es bis zur Arbeit insgesamt. Eine Doppelstunde zählt dabei als eine Stunde – so wie sie auch nur einmal erfasst wird. Daneben steht, in wie vielen Stunden geschrieben wird. Die Farbe wechselt von oliv über amber zu rot, je knapper es wird. Die zuletzt gehaltene und noch nicht erfasste Stunden bekommen einen farbigen Rand links. Ein Tipp auf Klasse und Fach öffnet die Notenübersicht des Fachs, ein Tipp auf den Balken die Details zur Arbeit. Ganz rechts das Klemmbrett für die Schnellerfassung – es leuchtet amber, solange die Stunde nicht erfasst ist. Ab fünf Stunden zeigt Saidy zunächst vier und blendet den Rest über „Alle N Stunden ansehen" ein.` },
      { q: "Was ist der Unterrichtstipp des Tages?", a: `Ganz unten auf der Übersicht liegt eine kompakte Zeile mit einem Tipp aus dem Wissenspool – Titel plus Merksatz. Der Tipp wechselt automatisch mit jedem Tag (er ist an das Datum gekoppelt, bleibt also bei mehrmaligem Öffnen am selben Tag gleich). Tippe drauf, dann öffnet sich die volle Karte: „Warum?" mit Kurzbegründung, „So setzt du es um" als praktische Punkte, und der Merksatz zum Mitnehmen. Ein „Nächster Tipp"-Knopf springt zufällig zu einer anderen Karte, so kannst du zwischendurch etwas schmökern. In den Einstellungen unter „Übersicht (Startseite)" lässt sich die Kachel abschalten.` },
      { q: "Was ist der Wochenrückblick auf der Übersicht?", a: `Eine Karte, die von Freitag 12 Uhr bis Sonntag Nacht ganz oben auf der Übersicht erscheint (ab Montag ist sie automatisch weg). Sie zeigt drei Dinge: die Zahlen der Woche (gehaltene Stunden, vergebene Noten, geführte Gespräche, neue Notizen), was aufgefallen ist (Klassen mit Signalen aus dem Klassenradar, Kinder ohne Eintrag in dieser Woche) und einen Ausblick auf die nächste Woche (Klassenarbeiten, Termine). Ein × blendet die Karte für den Rest dieser Woche aus – am nächsten Freitag kommt sie wieder.` },
      { q: "Was macht der grüne Plus-Knopf in der Mitte?", a: `Er ist der Schnellzugriff zum Erfassen und funktioniert aus jedem Bereich heraus. Ein Tipp öffnet fünf Einträge: „Stunde erfassen" springt direkt in die Schnellerfassung – Saidy wählt dabei selbst die passende Stunde, zuerst eine noch nicht erfasste, sonst die zuletzt gehaltene von heute. „Gespräch notieren" und „Notiz zu einem Kind" fragen zuerst nach dem Kind (einfach den Namen tippen) und dann nach dem Text; beim Gespräch kommen Art (Schüler, Eltern, Förder) und Stimmung dazu. „Aufgabe" und „Termin" legen einen To-do beziehungsweise einen Kalendereintrag an. Bist du gerade in einem Bereich mit eigener Aktion – etwa im Klassen-Tab – steht diese zusätzlich ganz oben in der Liste. Auf Tablet und Desktop heißt der Knopf „Schnell erfassen" und sitzt in der linken Seitenleiste, ganz oben; das aufklappende Menü enthält dieselben Aktionen.` },
      { q: "Wo finde ich die Aufgaben in der unteren Leiste?", a: `Die Leiste zeigt Übersicht, Klassen, den Plus-Knopf, Noten und „Mehr". Die Aufgaben sind unter „Mehr" zu finden – zusammen mit Stundenplan, Kalender, Suche, Einstellungen und Hilfe. Eine neue Aufgabe legst du schneller über den grünen Plus-Knopf an.` },
      { q: "Warum verschwindet die Navigationsleiste beim Scrollen?", a: `Damit mehr Platz für den Inhalt bleibt. Scrollst du auf einer Seite nach unten, gleitet die untere Leiste weg und stattdessen erscheint unten links ein olivfarbener Kreis mit einem Pfeil nach oben. Ein Tipp darauf holt die vollständige Leiste zurück. Scrollst du wieder nach oben, erscheint sie ohnehin von selbst. Auf dem Desktop bleibt die Seitenleiste immer sichtbar.` }
    ],
  },
  {
    category: "Klassen & Schüler:innen",
    items: [
      { q: "Wie finde ich schnell ein bestimmtes Kind?", a: `Tippe auf „Suchen" – in der Seitenleiste (Desktop) oder im „Mehr"-Menü (Mobil). Du kannst nach Namen oder Notiztext suchen. Ein Tipp auf ein Ergebnis öffnet direkt das Schülerprofil.` },
      { q: "Wie bearbeite ich eine:n Schüler:in?", a: `Tippe in der Klassenliste auf den Namen. Im Profil kannst du Name, Foto und weitere Angaben bearbeiten.` },
      { q: "Wie lösche ich eine Klasse?", a: `Öffne die Klasse, tippe auf das Bearbeiten-Symbol und wähle „Klasse löschen". Achtung: alle Daten dieser Klasse werden unwiderruflich entfernt.` },
      { q: "Was sind Dienste?", a: `Dienste sind Aufgaben, die Saidy Schüler:innen der Reihe nach zuweist (z. B. Tafeldienst). Anlegen unter Klasse → „Dienste", mit einem Tippen weiter zum nächsten Kind.` },
      { q: "Wie erfasse ich Fehlzeiten?", a: `Gehe zu Klasse → „Fehlzeiten" → „+ Fehlzeit". Wähle Schüler:in, Datum und ob die Fehlzeit entschuldigt oder unentschuldigt ist.` },
      { q: "Wie lege ich einen Sitzplan an?", a: `Öffne eine Klasse im Klassen-Tab und tippe auf „Sitzplan". Tippe auf eine freie Stelle in der Fläche – es erscheint eine Auswahlliste zum Auswählen des Kindes. Alternativ auf „Kind hinzufügen" tippen. Platzierte Kinder lassen sich frei auf der Fläche verschieben. Die Tafel oben lässt sich an jeden Rand ziehen (oben, unten, links, rechts). Einmal antippen (ohne zu schieben) markiert den Sitzplatz farbig: grün = klappt gut, amber = beobachten, rot = klappt nicht. Ein Kind entfernen: Token nach unten über den Rand der Fläche in die rote Toolbar ziehen und loslassen. „Aufräumen" richtet alle Kinder gleichzeitig in einem sauberen Raster aus. „Löschen" entfernt den gesamten Sitzplan. Am Ende „Speichern" tippen.` },
      { q: "Was zeigt die Zusammenfassung im Schülerprofil?", a: `Im Profil-Tab „Übersicht" erscheint eine automatisch generierte Zusammenfassung – erkennbar am Sparkles-Symbol. Sie fasst Stimmung, Notendurchschnitt, Tendenz, Aktivität der letzten 30 Tage, Förderbedarfe und aktive Ziele in einem Satz zusammen. Die Zusammenfassung wird lokal aus den gespeicherten Daten berechnet und nur angezeigt, wenn genügend Informationen vorliegen.` },
      { q: "Wie funktionieren Sprachnotizen?", a: `Im Schülerprofil (Tab „Übersicht" oder „Notizen") gibt es neben dem Notiz-Eingabefeld ein Mikrofon-Symbol. Antippen startet die Aufnahme – beim ersten Mal erscheint ein kurzer Hinweis zur Datenverarbeitung. Während der Aufnahme erscheint eine Live-Vorschau des erkannten Textes. Nach der Aufnahme wird der Text automatisch ins Eingabefeld übernommen, wo er noch bearbeitet werden kann. Unterstützte Browser: Safari (iOS/macOS), Chrome und Edge. Firefox unterstützt diese Funktion nicht. Das Mikrofon-Symbol erscheint nur, wenn dein Browser Spracherkennung unterstützt.` },
      { q: "Was ist der Klassenradar auf der Übersicht?", a: `Eine kompakte Kachel, die anzeigt, welche Klassen gerade Aufmerksamkeit brauchen. Sie erscheint nur, wenn mindestens eine Klasse auffällt – ist alles ruhig, verschwindet die Karte. Drei Signale werden über die letzten 14 Tage berechnet: (1) häufige Klassenbucheinträge – ab 3 in 14 Tagen Warnung, ab 5 kritisch; (2) Klassenschnitt in einem Fach schlechter als 3,5 – ab 3,5 Warnung, ab 4,0 kritisch (nur ab 3 Noten im Fach, sonst Rauschen); (3) mindestens 4 Kinder mit „nicht so gut" oder „schlecht" in Gesprächen – ab 4 Warnung, ab 6 kritisch. Pro Klasse steht das dringendste Signal, mit „+N", wenn mehr da ist. Ein Tipp öffnet direkt das Klassen-Dashboard mit allen Details.` },
      { q: "Was zeigt das Klassen-Dashboard?", a: `Im Klassen-Tab eine Klasse aufklappen → „Klassen-Dashboard" antippen. Es zeigt: Anzahl Schüler:innen, Klassen-Ø und Förderbedarf als Kacheln; eine Notenverteilungs-Leiste; eine Anwesenheits-Übersicht der letzten 12 Wochen als Farbfeld (je dunkler, desto mehr Kinder fehlten an dem Tag, rot heißt unentschuldigt dabei) mit Hinweis, auf welchen Wochentag die meisten Fehltage fallen; eine Liste „Lange kein Eintrag" mit den Kindern die am längsten keine Note oder Notiz bekommen haben – mit Name und Anzahl Tage, direkt antippbar; eine „Aufmerksamkeit"-Liste; Geburtstage der nächsten 21 Tage sowie die letzten Notizen und Gespräche. Tippen auf ein Kind oder einen Punkt öffnet das Schülerprofil.` },
      { q: "Was sind die farbigen Signale im Schülerprofil?", a: `Direkt unter der Profilkarte erscheinen farbige Signale: Rot (kritisch), Gelb (beobachten), Grün (positiv) und Blau (Info). Sie werden automatisch aus den Daten berechnet – z. B. kritischer Notenschnitt, kein Eintrag seit mehr als 14 Tagen, negative Stimmung in Folge, Förderbedarf ohne aktives Ziel, oder Geburtstag in den nächsten 7 Tagen. Tippe auf ein Signal, um direkt zum betreffenden Tab zu springen.` },
    ],
  },
  {
    category: "Noten & Berichte",
    items: [
      { q: "Wie trage ich eine Note ein?", a: `Gehe zu „Noten & Berichte", wähle Klasse und Fach. Tippe auf eine:n Schüler:in – in der Karte „Neue Note" Kategorie und Note wählen und auf „+" tippen. Oder tippe direkt in der Notenübersicht auf die Mündl.-Spalte eines Kindes – ein Popover öffnet sich mit den fünf Schnellbewertungen ++, +, o, –, – –. Ein Tipp, fertig.` },
      { q: "Wie berechnet sich die Zeugnisnote?", a: `Saidy bildet den gewichteten Durchschnitt aus mündlichen und schriftlichen Noten. Voreingestellt ist 50 zu 50 Prozent – änderbar unter „Klassen & Schüler" → Reiter „Fächer" → Zahnrad beim Fach → „Gewichtung der Noten". Einzelne Noten lassen sich zusätzlich stärker gewichten (Faktor beim Bearbeiten der Note). Die berechnete Note erscheint in der Notenübersicht.` },
      { q: "Wie sehe ich alle Noten eines Kindes auf einen Blick?", a: `In der Klassen-Ansicht auf ein Kind tippen, dann „Notenübersicht" antippen. Dort siehst du den aktuellen Schnitt in jedem Fach sowie die Zeugnisnote, falls schon eingetragen.` },
      { q: "Was ist der Schnellerfassungs-Modus?", a: `Das Klemmbrett-Symbol neben einer Stunde auf der Startseite öffnet einen Modus, in dem du für alle Schüler:innen einer Klasse auf einem Bildschirm Noten, Notizen und Gespräche eintragen kannst. Eine Doppelstunde wird dabei einmal erfasst, nicht zweimal – sie gilt als eine Unterrichtseinheit und erscheint in der Liste der offenen Stunden als ein Eintrag mit der Zahl der Blöcke. Die Notenbuttons sind immer direkt sichtbar. Weitere Aktionen (Notiz, Gespräch, Vergessen) erscheinen nach Antippen des ···-Symbols neben dem Namen. Hat ein Kind bereits eine Notiz oder einen Auffälligkeits-Eintrag, leuchtet das ···-Symbol grün.` },
      { q: "Was ist der Stunden-Timer bis zur Klassenarbeit?", a: `Ist für ein Fach ein Termin für die nächste Klassenarbeit hinterlegt, zeigt Saidy an, wie viele Unterrichtsstunden bis dahin noch bleiben. Gezählt wird in Unterrichtseinheiten: ein Tag mit diesem Fach ist eine Einheit – eine Doppelstunde aus zwei 45-Minuten-Blöcken zählt also einmal, genau wie eine einzelne Stunde. Ferien und schulfreie Tage werden abgezogen, der Prüfungstag selbst zählt nicht als Übungsstunde. Angezeigt wird der Hinweis erst, wenn es eng wird: amber ab drei verbleibenden Stunden, rot ab einer. Den Termin eintragen: „Klassen & Schüler" → Reiter „Fächer" → Zahnrad-Symbol beim Fach → „Nächste Klassenarbeit / Test". Wichtig: Das Fach muss im Stundenplan stehen, sonst kann Saidy die Stunden nicht zählen und zeigt stattdessen nur das Datum.` },
      { q: "Wo sehe ich auf der Startseite, wie viel Zeit bis zur Klassenarbeit bleibt?", a: `Direkt bei der Stunde – es gibt dafür keine eigene Karte mehr. Ist für ein Fach ein Test-Termin hinterlegt, erscheint in der Unterricht-Übersicht unter der Stunde ein feiner Strich: voll bedeutet viel Vorbereitungszeit, kurz bedeutet es wird eng. Die Farbe wechselt von oliv über amber zu rot, je näher der Termin rückt. Rechts neben der Stunde steht zusätzlich die Zahl der verbleibenden Unterrichtsstunden (z. B. „5×"), am Prüfungstag selbst „Heute!". Ein Tipp auf den Strich klappt die Details auf: Titel der Arbeit, Datum und die verbleibenden Übungsstunden im Klartext. Angezeigt wird das nur bei Fächern, für die du einen Termin eingetragen hast.` },
      { q: "Wie finde ich heraus, bei welchem Thema die Klasse Lücken hat?", a: `Beim Eintragen einer schriftlichen Note kannst du ein Thema angeben, z. B. „Bruchrechnung". Bereits verwendete Themen werden beim Tippen vorgeschlagen – nimm die Vorschläge, dann bleibt die Auswertung sauber. Auch die Schnellerfassung übernimmt das oben eingetragene Stundenthema automatisch, wenn du dort schriftliche Noten vergibst. Umgekehrt schlägt das Stundenthema-Feld bereits bekannte Themen desselben Fachs vor – so bleibt „Bruchrechnung" über Wochen dasselbe Wort und der Fortschrittsbalken zählt sauber weiter, statt bei jeder Tippvariante von vorn. In der Fachansicht („Noten & Berichte" → Klasse → Fach) erscheint dann die Karte „Wissensgebiete": Alle Themen mit dem Klassenschnitt, das schwächste zuerst. Ein langer Balken bedeutet gut beherrscht. Tippst du ein Thema an, siehst du, welche Kinder dort Lücken haben – daraus wird direkt eine Fördergruppe.` },
      { q: "Wie sehe ich, wie weit ich mit den Zeugnisnoten bin?", a: `In der Zeugnisphase (Januar, Februar, Juni, Juli) zeigt jede Klassenkarte unter „Noten & Berichte" einen Fortschrittsbalken: wie viele Zeugnisnoten von wie vielen bereits gesetzt sind und wie viele noch offen sind. Über mehrere Klassen hinweg siehst du so auf einen Blick, wo noch Arbeit liegt. Ist alles vollständig, wird der Balken grün.` },
      { q: "Wie aktiviere ich die Zeugnisnoten-Spalte?", a: `In der Notenübersicht gibt es oben den Button „Zeugnisnote". Antippen blendet die Zeugnisnoten-Spalte ein oder aus. In der Zeugnisphase (Januar, Februar, Juni, Juli) ist sie automatisch sichtbar.` },
      { q: "Wo kann ich Gespräche mit Schüler:innen erfassen?", a: `An drei Stellen: (1) In der Klassenliste neben jedem Kind das 💬-Symbol antippen. (2) Im Schnellerfassungs-Modus nach dem Unterricht. (3) Direkt in der Notenansicht: Kind antippen – die Detailansicht zeigt oben eine Karte „Gespräch & Stimmung" mit Typ-Wahl (Schüler / Eltern / Förder), Stimmungsskala (😄😊😐😕😟) und Notizfeld. Alle erfassten Gespräche erscheinen auch bei Elternsprechtag-Vorbereitung.` },
    ],
  },
  {
    category: "Kalender & Termine",
    items: [
      { q: "Wie lege ich einen Termin an?", a: `Tippe auf „Mehr" in der Navigation und dann auf „Kalender". Tippe dort auf „+ Neuen Termin anlegen" und gib Titel, Datum, Uhrzeit und Art ein.` },
      { q: "Wie lege ich einen wiederkehrenden Termin an?", a: `Beim Anlegen eines Termins gibt es das Feld „Wiederholung" – dort kannst du Wöchentlich, Alle 2 Wochen oder Monatlich wählen. Der Termin erscheint dann automatisch an allen folgenden Termintagen im Kalender.` },
      { q: "Wie trage ich Schulferien ein?", a: `Stelle zuerst dein Bundesland in den Einstellungen ein. Dann erscheint dort „Schulferien eintragen" – Saidy übernimmt alle Ferien automatisch.` },
      { q: "Wie erledige ich einen Termin?", a: `Tippe auf den Kreis links neben dem Termin. Er wandert in den „Erledigt"-Bereich ganz unten.` },
    ],
  },
  {
    category: "Aufgaben",
    items: [
      { q: "Wie lege ich eine Aufgabe an?", a: `Tippe auf „Aufgaben" in der unteren Navigation. Wähle eine Liste und tippe auf „Aufgabe hinzufügen". Du kannst Titel, Farbe und ein Fälligkeitsdatum vergeben.` },
      { q: "Wie erstelle ich eine neue Aufgabenliste?", a: `Im Aufgaben-Tab tippe auf „Aufgabe hinzufügen". Im Dialog findest du unten ein Dropdown für die Liste – dort gibt es den Eintrag „+ Neue Liste erstellen", mit dem du eine neue Liste anlegen und ihr ein Icon geben kannst.` },
    ],
  },
  {
    category: "Backup & Daten",
    items: [
      { q: "Wie erstelle ich ein Backup?", a: `Gehe zu „Mehr" → „Einstellungen" → „Datensicherung". Dort erscheint zuerst ein kurzer Datenschutz-Hinweis, den du bestätigst. Danach: „Sichern" legt die Datei im Download-Ordner ab, „Teilen" öffnet die Teilen-Ansicht (z. B. für „In Dateien sichern" oder AirDrop). Wichtig: abgelegte Dokumente sind darin nicht enthalten – die brauchen eine eigene Sicherung, direkt darunter unter „Dokumente sichern".` },
      { q: "Wie lege ich ein Dokument bei einem Kind ab?", a: `Öffne die Klasse, tippe das Kind an und wechsle auf den Reiter „Mehr". Ganz unten steht „Dokumente" mit zwei Knöpfen: „Foto" öffnet direkt die Kamera – ideal, um eine Entschuldigung abzufotografieren. „Datei" öffnet die Dateien-App, dort wählst du ein PDF oder ein vorhandenes Bild. Fotos werden automatisch verkleinert, damit sie wenig Platz brauchen. Ein Tipp auf einen Eintrag öffnet ihn, das Papierkorb-Symbol löscht ihn.` },
      { q: "Wo werden meine Dokumente gespeichert?", a: `Auf deinem Gerät, genau wie alles andere in Saidy – nichts wird ins Internet übertragen. Dokumente liegen allerdings in einem eigenen Speicherbereich, weil sie für die normale Ablage zu groß wären. Deshalb sind sie auch nicht in der normalen Datensicherung enthalten, sondern brauchen unter „Einstellungen" → „Datensicherung" den eigenen Knopf „Dokumente sichern".` },
      { q: "Warum sind meine Dokumente nach dem Wiederherstellen weg?", a: `Die normale Datensicherung enthält nur die Liste der Dokumente (Name, Datum, zu welchem Kind), nicht die Dateien selbst. Nach dem Wiederherstellen siehst du deshalb die Einträge, aber beim Öffnen kommt der Hinweis, dass die Datei fehlt. Spiel dann zusätzlich deine Dokument-Sicherung ein: „Einstellungen" → „Datensicherung" → „Einspielen" im Abschnitt „Dokumente sichern".` },
      { q: "Kann ich mir Dokumente direkt an Saidy schicken lassen?", a: `Nein. Saidy hat bewusst keinen Server und kann deshalb weder E-Mails abrufen noch Nachrichten empfangen. Auf dem iPhone lässt Apple Web-Apps auch nicht als Ziel im Teilen-Menü zu. Der Weg ist deshalb: Datei zuerst in „Dateien" sichern (bei einer E-Mail: Anhang antippen → Teilen → „In Dateien sichern"), danach in Saidy beim Kind auf „Datei" tippen und sie dort auswählen. Für Papier-Entschuldigungen ist „Foto" der schnellere Weg.` },
      { q: "Wie sichere ich am einfachsten auf dem iPhone oder iPad?", a: `Einstellungen → „Datensicherung" → „Teilen" antippen. In der Teilen-Ansicht dann „In Dateien sichern" wählen und „Auf meinem iPhone" (oder iPad) als Ort. Ein Schritt, kein Tippen – und die Daten verlassen dein Gerät nicht. Verschicke Backups nicht per E-Mail oder Messenger: Die Datei enthält alle Schülerdaten im Klartext, und der Versand über einen privaten Mailanbieter ist für Schülerdaten in der Regel nicht zulässig.` },
      { q: "Wie aktiviere ich die Freitags-Erinnerung?", a: `In den Einstellungen unter „Datensicherung" → „Freitags-Erinnerung" den Schalter aktivieren. Beim ersten Mal fragt der Browser nach der Erlaubnis für Benachrichtigungen. Wichtig zu wissen: Die Erinnerung erscheint, wenn du Saidy an einem Freitag öffnest und dein letztes Backup mindestens 3 Tage her ist. Saidy läuft nicht im Hintergrund – öffnest du die App freitags nicht, kommt auch keine Erinnerung. Verlass dich also nicht allein darauf.` },
      { q: "Wie stelle ich ein Backup wieder her?", a: `Gehe zu „Mehr" → „Einstellungen" → „Datensicherung" → „Gesichertes wiederherstellen" und wähle deine Backup-Datei. Achtung: Die aktuell gespeicherten Daten werden dabei ersetzt – am besten vorher einmal „Sichern". Sollten sich die Daten beim Start einmal nicht lesen lassen, zeigt Saidy direkt einen Wiederherstellen-Knopf und überschreibt nichts.` },
      { q: "Wo werden meine Daten gespeichert?", a: `Alle Daten bleiben ausschließlich auf deinem Gerät (lokaler Browser-Speicher). Es werden keine Daten an Server übertragen.` },
      { q: "Warum bekomme ich eine Backup-Erinnerung?", a: `Saidy erinnert automatisch wenn seit 7 Tagen kein Backup erstellt wurde oder wenn seit dem letzten Backup 10 oder mehr neue Einträge (Noten, Notizen, Fehlzeiten) hinzugekommen sind. Das Morgen-Briefing zeigt ebenfalls einen Hinweis, wenn Backup fällig ist.` },
    ],
  },
  {
    category: "Import",
    items: [
      { q: "Wie importiere ich Fehlzeiten aus WebUntis?", a: `Öffne den „Klassen"-Tab und tippe oben rechts auf „Fehlzeiten". Alternativ: „Mehr" → „Einstellungen" → „WebUntis-Import". Exportiere in WebUntis die Fehlzeiten als CSV und lade sie hier hoch. Saidy übernimmt sie automatisch in die passenden Klassen.` },
    ],
  },
  {
    category: "Datenschutz & Rechtliches",
    items: [
      { q: "Wer ist verantwortlich für die Schülerdaten?", a: `Du als Lehrkraft bist gemäß Art. 4 Nr. 7 DSGVO selbst datenschutzrechtlich Verantwortliche:r für die eingegebenen Daten. Der Entwickler von Saidy hat keinen Zugriff auf deine Daten.` },
      { q: "Wo finde ich das Impressum und die Datenschutzerklärung?", a: `Tippe auf „Mehr" → „Einstellungen" und scrolle ganz nach unten. Dort findest du den Link „Impressum & Datenschutz".` },
      { q: "Werden meine Daten irgendwohin übertragen?", a: `Nein. Alle Daten bleiben ausschließlich auf deinem Gerät (Browser-localStorage). Es werden keine Daten an den Entwickler oder Dritte übermittelt. Beim Aufrufen der App werden lediglich technische Zugriffsdaten (IP-Adresse, Zeitstempel) durch den Hosting-Anbieter GitHub Pages verarbeitet.` },
    ],
  },
];

/* Detail-Sheet fuer eine Unterrichtstipp-Karte. Zeigt Titel, Kategorie, Merksatz,
   Warum-Absatz und die Umsetzungspunkte als Liste. Der Naechster-Knopf waehlt eine
   zufaellige andere Karte, damit man ohne Zurueckgehen weiterschmoekern kann. */
function TippKartenSheet({ karte, alleKarten, onNaechste, onClose }) {
  if (!karte) return null;
  const kapitel = KATEGORIE_ZU_KAPITEL[karte.kategorie] || "Unterrichtsmethoden";
  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-[60]" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <Lightbulb size={16} className="akzent-text shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 leading-none">Unterrichtstipp</div>
              <div className="text-[11px] text-stone-500 truncate">{kapitel} · {karte.kategorie}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-11 h-11 -mr-3 rounded-full text-stone-400 hover:text-stone-600 flex items-center justify-center shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
          <div>
            <h2 className="text-lg font-bold text-stone-900 leading-snug">{karte.titel}</h2>
            <p className="text-sm akzent-text font-medium mt-1.5 italic">„{karte.merksatz}"</p>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Warum?</div>
            <p className="text-sm text-stone-700 leading-relaxed">{karte.warum}</p>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 mb-1.5">So setzt du es um</div>
            <ul className="space-y-1.5">
              {karte.umsetzung.map((punkt, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                  <span className="w-1.5 h-1.5 rounded-full akzent-flaeche shrink-0 mt-1.5" />
                  <span className="flex-1">{punkt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Schließen</Button>
            {alleKarten.length > 1 && (
              <Button onClick={onNaechste} className="flex-1 justify-center">
                Nächster Tipp
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HilfeSheet({ onClose }) {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase().trim();
  const results = q
    ? HELP_DATA.flatMap((cat) =>
        cat.items
          .filter((it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q))
          .map((it) => ({ ...it, category: cat.category }))
      )
    : null;
  const [open, setOpen] = useState(null);

  return (
    <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl w-full p-4 pb-[max(2rem,env(safe-area-inset-bottom))] max-h-[88vh] flex flex-col sheet anim-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4 shrink-0" />
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="font-semibold text-stone-800">Hilfe</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>
        <div className="relative mb-4 shrink-0">
          <input
            className="w-full bg-stone-100 rounded-xl px-3 py-2.5 text-sm placeholder-stone-400 outline-none"
            placeholder='Suche, z. B. „Backup" oder „Note eintragen"'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpen(null); }}
            autoFocus
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="overflow-y-auto flex-1 space-y-1">
          {results !== null ? (
            results.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-8">Keine Treffer für „{search}"</p>
            ) : (
              results.map((it, i) => (
                <HilfeItem key={i} item={it} open={open === `s${i}`} toggle={() => setOpen(open === `s${i}` ? null : `s${i}`)} showCategory />
              ))
            )
          ) : (
            HELP_DATA.map((cat) => (
              <div key={cat.category} className="mb-3">
                <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide px-1 mb-1">{cat.category}</div>
                {cat.items.map((it, i) => {
                  const key = `${cat.category}${i}`;
                  return <HilfeItem key={key} item={it} open={open === key} toggle={() => setOpen(open === key ? null : key)} />;
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function HilfeItem({ item, open, toggle, showCategory }) {
  return (
    <button
      onClick={toggle}
      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {showCategory && <div className="text-[10px] text-stone-400 mb-0.5">{item.category}</div>}
          <div className="text-sm font-medium text-stone-800 leading-snug">{item.q}</div>
          {open && <div className="text-sm text-stone-600 mt-1.5 leading-relaxed">{item.a}</div>}
        </div>
        <ChevronDown size={15} className={`text-stone-400 shrink-0 mt-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
    </button>
  );
}

/* Schnellerfassung vom Plus-Knopf aus: erst das Kind wählen, dann Notiz oder Gespräch
   eintragen. Beides landet in `notes` – ein Gespräch zusätzlich mit Typ und Stimmung,
   genau wie im Schülerprofil. So muss man sich nicht erst durch Klasse und Profil klicken. */
function QuickAddNoteModal({ data, modus, onSave, onClose }) {
  const istGespraech = modus === "gespraech";
  const [studentId, setStudentId] = useState(null);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [typ, setTyp] = useState("schueler");
  const [mood, setMood] = useState("ok");
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, [studentId]);

  const student = data.students.find((s) => s.id === studentId) || null;
  const q = query.trim().toLowerCase();
  const treffer = (q
    ? data.students.filter((s) => s.name.toLowerCase().includes(q))
    : data.students
  )
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "de"))
    .slice(0, 40);

  function speichern() {
    if (!student || !text.trim()) return;
    onSave({ studentId: student.id, text: text.trim(), istGespraech, typ, mood });
  }

  /* Backdrop-Klick und X-Knopf wirken versehentlich - besonders wenn das Sheet auf dem
     iPad viel Rand um sich herum hat. Steht Text im Feld und ist ein Kind gewaehlt,
     wird der Draft mit gespeichert statt kommentarlos verworfen. Wer bewusst abbrechen
     will, druckt "Abbrechen" - der Knopf bleibt unveraendert. */
  function schliessenMitRettung() {
    if (student && text.trim()) speichern();
    else onClose();
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-[70]" onClick={schliessenMitRettung}>
      <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="font-semibold text-stone-800">
            {istGespraech ? "Gespräch notieren" : "Notiz zu einem Kind"}
          </div>
          <button onClick={schliessenMitRettung} className="w-11 h-11 -mr-3 rounded-full text-stone-400 hover:text-stone-600 flex items-center justify-center">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {!student ? (
            <>
              <input
                ref={inputRef}
                className={inputCls}
                placeholder="Kind suchen …"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {!data.students.length ? (
                <p className="text-sm text-stone-500 mt-4">Noch keine Schüler:innen angelegt.</p>
              ) : (
                <ul className="mt-3 divide-y divide-stone-100 max-h-[45vh] overflow-y-auto">
                  {treffer.map((s) => {
                    const cls = data.classes.find((c) => c.id === s.classId);
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => { setStudentId(s.id); setQuery(""); }}
                          className="w-full flex items-center gap-2.5 py-2.5 text-left"
                        >
                          <StudentAvatar student={s} size={28} />
                          <span className="flex-1 text-sm text-stone-800 truncate">{s.name}</span>
                          {cls && <span className="text-xs text-stone-400 shrink-0">{cls.name}</span>}
                        </button>
                      </li>
                    );
                  })}
                  {!treffer.length && <li className="py-3 text-sm text-stone-500">Kein Kind gefunden.</li>}
                </ul>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5 mb-4">
                <StudentAvatar student={student} size={32} />
                <span className="flex-1 text-sm font-medium text-stone-800 truncate">{student.name}</span>
                <button onClick={() => setStudentId(null)} className="text-xs akzent-text hover:underline shrink-0">
                  Anderes Kind
                </button>
              </div>

              {istGespraech && (
                <>
                  <Field label="Art des Gesprächs">
                    <div className="flex gap-1.5">
                      {GESPRAECH_TYPEN.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setTyp(t.key)}
                          className={`flex-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                            typ === t.key ? "akzent-rand akzent-ton akzent-text" : "border-stone-200 bg-white text-stone-500"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Stimmung">
                    <div className="flex gap-1.5">
                      {MOOD_OPTIONS.map((m) => (
                        <button
                          key={m.key}
                          onClick={() => setMood(m.key)}
                          title={m.label}
                          aria-label={m.label}
                          className={`flex-1 py-2 rounded-xl border text-base transition-colors ${
                            mood === m.key ? "akzent-rand akzent-ton" : "border-stone-200 bg-white"
                          }`}
                        >
                          {m.emoji}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              <Field label={istGespraech ? "Notiz zum Gespräch" : "Notiz"}>
                <textarea
                  ref={inputRef}
                  className={`${inputCls} min-h-[6rem] resize-none`}
                  placeholder={istGespraech ? "Worum ging es?" : "Was ist dir aufgefallen?"}
                  value={text}
                  maxLength={1000}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>

              <div className="flex gap-2 mt-5">
                <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
                <Button onClick={speichern} disabled={!text.trim()} className="flex-1 justify-center">Speichern</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GlobalSearchModal({ data, onSelectStudent, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const q = query.trim().toLowerCase();

  const activeStudents = data.students.filter((s) => !s.deletedAt);
  const classMap = Object.fromEntries(data.classes.map((c) => [c.id, c.name]));

  const studentResults = q.length < 2 ? [] : activeStudents
    .filter((s) => s.name.toLowerCase().includes(q))
    .slice(0, 8);

  const noteResults = q.length < 2 ? [] : data.notes
    .filter((n) => n.text && n.text.toLowerCase().includes(q) && n.type !== "gespraech")
    .slice(0, 5)
    .map((n) => {
      const student = activeStudents.find((s) => s.id === n.studentId);
      return student ? { note: n, student } : null;
    })
    .filter(Boolean);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-[75] flex flex-col items-center pt-[max(env(safe-area-inset-top),2rem)] px-4 pb-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-stone-100">
          <Search size={16} className="text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none bg-transparent"
            placeholder="Schüler:in oder Notiz suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 shrink-0"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
          {q.length < 2 && (
            <div className="px-4 py-10 text-sm text-stone-400 text-center">Mindestens 2 Zeichen eingeben …</div>
          )}

          {q.length >= 2 && studentResults.length === 0 && noteResults.length === 0 && (
            <div className="px-4 py-10 text-sm text-stone-400 text-center">Keine Ergebnisse für „{query}"</div>
          )}

          {studentResults.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Schüler:innen</div>
              <ul>
                {studentResults.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => onSelectStudent(s.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 text-left"
                    >
                      <StudentAvatar student={s} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-stone-800 truncate">{s.name}</div>
                        <div className="text-xs text-stone-400 truncate">{classMap[s.classId] ?? "Unbekannte Klasse"}</div>
                      </div>
                      <ChevronRight size={14} className="text-stone-300 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {noteResults.length > 0 && (
            <div>
              <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Notizen</div>
              <ul>
                {noteResults.map(({ note, student }) => (
                  <li key={note.id}>
                    <button
                      onClick={() => onSelectStudent(student.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-stone-50 text-left"
                    >
                      <StudentAvatar student={student} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-stone-500 truncate">{student.name} · {classMap[student.classId] ?? ""}</div>
                        <div className="text-sm text-stone-700 leading-snug line-clamp-2">{note.text}</div>
                      </div>
                      <ChevronRight size={14} className="text-stone-300 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false); // gespeicherte Daten unlesbar – Autosave blockieren
  const recoveryInputRef = useRef(null);
  const [tab, setTab] = useState("dashboard");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [halbjahr, setHalbjahr] = useState(currentHalbjahr());
  const [showSettings, setShowSettings] = useState(false);
  const [showUntisImport, setShowUntisImport] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [quickAdd, setQuickAdd] = useState(null);       // "notiz" | "gespraech" | "aufgabe"
  const [kalenderAutoForm, setKalenderAutoForm] = useState(false); // Kalender mit offenem Formular öffnen
  const [navCollapsed, setNavCollapsed] = useState(false);
  const mainRef = useRef(null);
  const [showHelp, setShowHelp] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [fabActions, setFabActions] = useState([]); // [{label, icon, onClick}]
  const [showSearch, setShowSearch] = useState(false);
  const [focusStudentId, setFocusStudentId] = useState(null);
  const [focusKlassenDashboardId, setFocusKlassenDashboardId] = useState(null);
  const [klassenSubTab, setKlassenSubTab] = useState("klassen");
  const [backupReminderDays, setBackupReminderDays] = useState(null); // null=kein Banner, 0=nie gesichert, >0=Tage seit letztem Backup
  const [changesSinceBackup, setChangesSinceBackup] = useState({ grades: 0, notes: 0, absences: 0 });
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [notenFachId, setNotenFachId] = useState(null); // Vorauswahl für den Noten-Tab

  // Scroll-Listener: Nav-Leiste einblenden/ausblenden
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    let prevY = 0;
    function handleScroll() {
      const y = el.scrollTop;
      if (y > 60 && y > prevY) setNavCollapsed(true);
      else if (y < prevY - 8 || y < 20) setNavCollapsed(false);
      prevY = y;
    }
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
    /* `loaded` muss in die Abhängigkeiten: solange die Daten laden, gibt App einen
       Ladebildschirm zurück und <main> existiert noch gar nicht. Ohne diesen Eintrag
       liefe der Effekt genau einmal ins Leere und der Listener hinge nie am Element. */
  }, [loaded]);
  // Tab-Wechsel: immer nach oben scrollen + Nav aufklappen
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setNavCollapsed(false);
  }, [tab]);

  // Wechselt den Bereich und optional den Unterreiter (z. B. direkt zu den Diensten)
  const goTo = useCallback((ziel, unterreiter) => {
    setTab(ziel);
    setNavCollapsed(false);
    if (unterreiter) setKlassenSubTab(unterreiter);
  }, []);
  // Direkt in die Notenübersicht eines bestimmten Fachs springen
  const goToFach = useCallback((fachId) => {
    setNotenFachId(fachId);
    setTab("noten");
    setNavCollapsed(false);
  }, []);
  const navigateToStudent = useCallback((studentId) => {
    setShowSearch(false);
    setFocusStudentId(studentId);
    setTab("klassen");
  }, []);
  useEffect(() => { setFabOpen(false); }, [tab]);
  const [captureLesson, setCaptureLesson] = useState(null); // { fach, cls }
  const [now, setNow] = useState(() => new Date());
  const saveTimer = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("app_data");
        if (res && res.value) {
          const parsed = { ...EMPTY_DATA, ...JSON.parse(res.value) };
          // Migration: frühere dritte Kategorie "Klassenarbeit" in "schriftlich" überführen
          parsed.grades = (parsed.grades || []).map((g) =>
            g.category === "klassenarbeit" ? { ...g, category: "schriftlich" } : g
          );
          const migratedWeights = {};
          Object.entries(parsed.weights || {}).forEach(([classId, w]) => {
            if (w && "klassenarbeit" in w) {
              migratedWeights[classId] = {
                muendlich: w.muendlich ?? DEFAULT_WEIGHTS.muendlich,
                schriftlich: (w.schriftlich ?? 0) + (w.klassenarbeit ?? 0),
              };
            } else {
              migratedWeights[classId] = w;
            }
          });
          parsed.weights = migratedWeights;
          // Migration: Klasse hat jetzt mehrere Fächer (subjects[]) statt einem einzelnen subject
          parsed.classes = (parsed.classes || []).map((c) =>
            c.subjects ? c : { ...c, subjects: c.subject ? [c.subject] : [] }
          );
          parsed.timetable = (parsed.timetable || []).map((t) => {
            if (t.subject !== undefined) return t;
            const c = parsed.classes.find((cl) => cl.id === t.classId);
            return { ...t, subject: c?.subjects?.[0] || "" };
          });
          // Migration: Fächer werden jetzt als eigenständige Objekte (Klasse+Fach+Farbe+Raum+Gewichtung) geführt
          if (!parsed.faecher) {
            const faecher = [];
            (parsed.classes || []).forEach((c) => {
              (c.subjects || []).forEach((subj) => {
                const roomMatch = (parsed.timetable || []).find((t) => t.classId === c.id && t.subject === subj && t.room);
                faecher.push({
                  id: uid(),
                  classId: c.id,
                  subject: subj,
                  color: (parsed.subjectColors || {})[subj] || nextPaletteColor(parsed.subjectColors),
                  room: roomMatch?.room || "",
                  weights: (parsed.weights || {})[c.id] || DEFAULT_WEIGHTS,
                });
              });
            });
            parsed.faecher = faecher;
            parsed.timetable = (parsed.timetable || []).map((t) => {
              const fach = faecher.find((f) => f.classId === t.classId && f.subject === t.subject);
              return { id: t.id, day: t.day, period: t.period, fachId: fach ? fach.id : null };
            }).filter((t) => t.fachId);
            // Noten der passenden Klasse zuordnen (bei mehreren Fächern je Klasse: erstes Fach als bestmögliche Zuordnung)
            parsed.grades = (parsed.grades || []).map((g) => {
              if (g.fachId) return g;
              const fach = faecher.find((f) => f.classId === g.classId);
              return { ...g, fachId: fach ? fach.id : null, factor: g.factor || 1 };
            });
            parsed.classes = (parsed.classes || []).map((c) => {
              const { subjects, ...rest } = c;
              return rest;
            });
            delete parsed.weights;
          }
          // Migration: Fächer ohne Gewichtungsfeld (z. B. neuer angelegt vor diesem Update)
          parsed.faecher = (parsed.faecher || []).map((f) => (f.weights ? f : { ...f, weights: DEFAULT_WEIGHTS }));
          // Migration: frühere "todo"-Kalendereinträge werden zu eigenständigen Aufgaben
          if (!parsed.tasks) {
            const oldTodos = (parsed.events || []).filter((e) => e.type === "todo");
            parsed.tasks = oldTodos.map((e) => ({
              id: e.id,
              title: e.title,
              color: TASK_COLORS[0],
              listId: null,
              dueDate: e.date ? `${e.date}T${e.time || "00:00"}` : null,
              done: !!e.done,
            }));
            parsed.events = (parsed.events || []).filter((e) => e.type !== "todo");
            parsed.taskLists = parsed.taskLists || [];
          }
          setData(parsed);
          /* Alte pauschale Art-9-Bestaetigung auf die betroffenen Kinder uebertragen,
             damit sie nach dem Update nicht erneut fuer jedes Kind abgefragt wird. */
          migriereMedicalConsent(parsed.students);
          if (!parsed.settings?.bundesland) setShowOnboarding(true);
          /* Eigener try-Block: ein Fehler in der Backup-Erinnerung darf nicht dazu führen,
             dass der äußere catch greift und die echten Daten durch Demodaten ersetzt. */
          try {
            if ((parsed.classes || []).length > 0) {
              const lastBackup = localStorage.getItem("last_backup_at");
              const lastCounts = (() => { try { return JSON.parse(localStorage.getItem("saidy_backup_counts") || "null"); } catch { return null; } })();
              const zahl = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
              const changes = lastCounts && typeof lastCounts === "object" ? {
                grades: Math.max(0, (parsed.grades || []).length - zahl(lastCounts.grades)),
                notes: Math.max(0, (parsed.notes || []).length - zahl(lastCounts.notes)),
                absences: Math.max(0, (parsed.absences || []).length - zahl(lastCounts.absences)),
              } : { grades: 0, notes: 0, absences: 0 };
              const totalChanges = changes.grades + changes.notes + changes.absences;
              setChangesSinceBackup(changes);
              const daysSince = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / 86400000) : null;
              if (daysSince === null || !isFinite(daysSince)) {
                setBackupReminderDays(0);
              } else if (daysSince >= 7 || totalChanges >= 10) {
                setBackupReminderDays(daysSince);
              }
              // Freitags-Erinnerung – greift nur, wenn Saidy an dem Tag geöffnet wird
              if (parsed.settings?.backupNotifications && new Date().getDay() === 5 && (daysSince === null || daysSince >= 3)) {
                setTimeout(() => {
                  notify(
                    "Saidy – Backup nicht vergessen",
                    daysSince === null ? "Du hast noch nie ein Backup gemacht. Jetzt nachholen?" : `Letztes Backup vor ${daysSince} Tagen. Jetzt kurz sichern?`
                  );
                }, 1500);
              }
            }
          } catch { /* Erinnerung ist unkritisch – Daten sind bereits geladen */ }
        } else {
          setData(demoData());
          setShowOnboarding(true);
        }
      } catch (e) {
        /* Gespeicherte Daten sind unlesbar. Auf keinen Fall Demodaten setzen – der
           Autosave würde sie 500 ms später über den Originalbestand schreiben. */
        console.warn("[Saidy] Laden fehlgeschlagen:", e);
        setLoadFailed(true);
        setToast("⚠ Gespeicherte Daten konnten nicht gelesen werden. Bitte ein Backup einspielen – es wurde nichts überschrieben.");
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || loadFailed) return; // nie über einen unlesbaren Bestand schreiben
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set("app_data", JSON.stringify(data));
        setSaveState("saved");
      } catch (e) {
        /* Meist voller Speicher oder privater Modus. Der Grund steht sonst
           nirgends – ueber Web Inspector am Geraet ist er so auffindbar. */
        console.warn("[Saidy] Speichern fehlgeschlagen:", e);
        setSaveState("error");
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  const update = useCallback((fn) => setData((prev) => fn(structuredClone(prev))), []);

  // Gefilterte Sicht: gelöschte Elemente ausblenden (noch innerhalb der 30-Tage-Frist)
  const activeData = useMemo(() => ({
    ...data,
    classes: data.classes.filter((c) => !c.deletedAt),
    students: data.students.filter((s) => !s.deletedAt),
    notes: data.notes.filter((n) => !n.deletedAt),
  }), [data]);

  // Beim Start: Elemente endgültig entfernen, die älter als 30 Tage im Papierkorb sind
  useEffect(() => {
    if (!loaded) return;
    const DAYS = 30;
    const cutoff = Date.now() - DAYS * 86400000;
    const snapshotExpired = data.deletedSnapshot && new Date(data.deletedSnapshot.deletedAt).getTime() < cutoff;
    const hasStaleDeletions =
      snapshotExpired ||
      data.students.some((s) => s.deletedAt && new Date(s.deletedAt).getTime() < cutoff) ||
      data.classes.some((c) => c.deletedAt && new Date(c.deletedAt).getTime() < cutoff) ||
      data.notes.some((n) => n.deletedAt && new Date(n.deletedAt).getTime() < cutoff);
    if (!hasStaleDeletions) return;
    update((d) => {
      if (d.deletedSnapshot && new Date(d.deletedSnapshot.deletedAt).getTime() < cutoff) {
        d.deletedSnapshot = null;
      }
      const expiredStudentIds = d.students.filter((s) => s.deletedAt && new Date(s.deletedAt).getTime() < cutoff).map((s) => s.id);
      const expiredClassIds = d.classes.filter((c) => c.deletedAt && new Date(c.deletedAt).getTime() < cutoff).map((c) => c.id);
      d.students = d.students.filter((s) => !s.deletedAt || new Date(s.deletedAt).getTime() >= cutoff);
      d.classes = d.classes.filter((c) => !c.deletedAt || new Date(c.deletedAt).getTime() >= cutoff);
      d.notes = d.notes.filter((n) => {
        if (expiredStudentIds.includes(n.studentId)) return false;
        return !n.deletedAt || new Date(n.deletedAt).getTime() >= cutoff;
      });
      d.grades = d.grades.filter((g) => !expiredStudentIds.includes(g.studentId) && !expiredClassIds.includes(g.classId));
      d.incidents = (d.incidents || []).filter((i) => !expiredStudentIds.includes(i.studentId));
      d.absences = (d.absences || []).filter((a) => !expiredStudentIds.includes(a.studentId));
      d.finalGrades = (d.finalGrades || []).filter((fg) => !expiredStudentIds.includes(fg.studentId));
      return d;
    });
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyBundesland(code, addFerien) {
    update((d) => {
      d.settings = { ...(d.settings || {}), bundesland: code };
      if (addFerien) {
        d.events = [...(d.events || []), ...buildFerienEvents(code, d.events)];
        d.settings.ferienAdded = true;
      }
      return d;
    });
  }

  function handleOnboardingDone(className) {
    if (className) {
      update((d) => { d.classes.push({ id: uid(), name: className }); return d; });
      setTab("klassen");
    }
    setShowOnboarding(false);
  }

  function showToast(msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  /* Backup vermerken. localStorage kann werfen (Safari-Privatmodus, volles Kontingent) –
     die Oberfläche muss trotzdem zurückgesetzt werden, sonst mahnt Saidy weiter,
     obwohl gerade gesichert wurde. */
  function recordBackup() {
    try {
      localStorage.setItem("last_backup_at", new Date().toISOString());
      localStorage.setItem("saidy_backup_counts", JSON.stringify({
        grades: data.grades.length,
        notes: data.notes.length,
        absences: (data.absences || []).length,
      }));
    } catch { /* ignoriert – Erinnerung erscheint dann beim nächsten Start erneut */ }
    setBackupReminderDays(null);
    setChangesSinceBackup({ grades: 0, notes: 0, absences: 0 });
  }

  function exportBackup() {
    const payload = { app: "saidy", version: 1, exportedAt: new Date().toISOString(), data: { ...data, deletedSnapshot: null } };
    const json = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const fileName = `Saidy-Backup-${stamp}.json`;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    recordBackup();
  }

  /* Getrennte Sicherung der Dokumente. Bewusst ein eigener Vorgang: die Datei
     wird deutlich groesser als die normale Sicherung und enthaelt Atteste und
     Gutachten im Klartext - das soll eine bewusste Entscheidung bleiben.
     Format ist wie beim uebrigen Backup JSON mit base64, damit kein weiteres
     Paket noetig wird; der Aufschlag von rund einem Drittel ist der Preis. */
  async function exportDocuments(onResult) {
    try {
      const eintraege = data.documents || [];
      if (!eintraege.length) return onResult?.({ ok: false, msg: "Es sind keine Dokumente abgelegt." });
      const dateien = [];
      let fehlend = 0;
      for (const doc of eintraege) {
        const blob = await docLaden(doc.id);
        if (!blob) { fehlend++; continue; }
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1] || "");
          r.onerror = () => rej(r.error);
          r.readAsDataURL(blob);
        });
        dateien.push({ id: doc.id, mime: doc.mime, data: b64 });
      }
      const payload = { app: "saidy-dokumente", version: 1, exportedAt: new Date().toISOString(), eintraege, dateien };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Saidy-Dokumente-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      onResult?.({
        ok: true,
        msg: fehlend
          ? `${dateien.length} Dokumente gesichert. ${fehlend} Datei(en) fehlten auf diesem Gerät.`
          : `${dateien.length} Dokumente gesichert (${byteText(blob.size)}).`,
      });
    } catch (e) {
      console.warn("[Saidy] Dokument-Export fehlgeschlagen:", e);
      onResult?.({ ok: false, msg: "Dokumente konnten nicht gesichert werden." });
    }
  }

  /* Gegenstueck zum Export. Die Eintraege werden mit dem Bestand zusammen-
     gefuehrt statt ersetzt - so laesst sich eine Dokument-Sicherung auch
     nachtraeglich zu bestehenden Daten einspielen. */
  async function importDocuments(file, onResult) {
    try {
      const text = await file.text();
      const p = JSON.parse(text);
      if (p?.app !== "saidy-dokumente" || !Array.isArray(p.dateien)) {
        return onResult?.({ ok: false, msg: "Das ist keine Saidy-Dokument-Sicherung." });
      }
      await dauerhaftenSpeicherAnfordern();
      let anzahl = 0;
      for (const f of p.dateien) {
        if (typeof f?.id !== "string" || typeof f?.data !== "string") continue;
        const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
        /* Nur Bild und PDF zulassen - dieselbe Grenze wie beim Hinzufuegen. */
        const mime = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.mime) ? f.mime : "application/octet-stream";
        await docSpeichern(f.id, new Blob([bin], { type: mime }));
        anzahl++;
      }
      const { daten } = sanitizeImport({ documents: p.eintraege });
      update((d) => {
        const vorhanden = new Set((d.documents || []).map((x) => x.id));
        d.documents = [...(d.documents || []), ...daten.documents.filter((x) => x.id && !vorhanden.has(x.id))];
        return d;
      });
      onResult?.({ ok: true, msg: `${anzahl} Dokumente wiederhergestellt.` });
    } catch (e) {
      console.warn("[Saidy] Dokument-Import fehlgeschlagen:", e);
      onResult?.({ ok: false, msg: "Die Dokument-Sicherung konnte nicht gelesen werden." });
    }
  }

  async function shareBackup() {
    const payload = { app: "saidy", version: 1, exportedAt: new Date().toISOString(), data: { ...data, deletedSnapshot: null } };
    const json = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    const fileName = `Saidy-Backup-${stamp}.json`;
    try {
      const file = new File([json], fileName, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Saidy-Backup" });
        recordBackup();
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
    exportBackup();
  }

  function resetAllData() {
    try {
      [MEDICAL_CONSENT_KEY, MEDICAL_CONSENT_ALT, "last_backup_at", "saidy_voice_consent", "saidy_backup_counts", "saidy_briefing_dismissed"]
        .forEach((k) => localStorage.removeItem(k));
      // Altlasten aus der früheren Variante mit einem Schlüssel pro Tag
      Object.keys(localStorage)
        .filter((k) => k.startsWith("saidy_briefing_"))
        .forEach((k) => localStorage.removeItem(k));
    } catch { /* ignoriert */ }
    /* Die Dateien liegen in IndexedDB und wuerden sonst zurueckbleiben - bei
       Attesten und Gutachten waere das der schwerste Teil eines vergessenen
       Loeschvorgangs. Sie kommen bewusst nicht in den 30-Tage-Papierkorb:
       dessen Momentaufnahme liegt in localStorage und wuerde daran zerbrechen. */
    docAllesLoeschen().catch((e) => console.warn("[Saidy] Dokumente löschen fehlgeschlagen:", e));
    update((d) => {
      const snapshot = { deletedAt: new Date().toISOString(), data: { ...d, deletedSnapshot: null, documents: [] } };
      return { ...EMPTY_DATA, deletedSnapshot: snapshot };
    });
    // Sichtbare Bestaetigung - der Rueckgang auf leere Uebersicht wirkt sonst
    // wie ein Fehler; der Toast verweist auch auf die 30-Tage-Wiederherstellung.
    showToast("Alle Daten gelöscht. Wiederherstellung 30 Tage möglich in Einstellungen.");
  }

  function importBackup(file, onResult) {
    if (file.size > 50 * 1024 * 1024) {
      onResult?.({ ok: false, msg: "Datei zu groß (max. 50 MB). Ist das die richtige Datei?" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const imported = parsed?.data && (parsed?.app === "saidy" || parsed?.app === "lehrertool") ? parsed.data : parsed;
        if (!imported || !Array.isArray(imported.classes)) {
          onResult?.({ ok: false, msg: "Diese Datei konnte nicht eingelesen werden. Bitte stelle sicher, dass du die Datei direkt aus Saidy gesichert hast (Einstellungen → Sichern)." });
          return;
        }
        const merged = { ...EMPTY_DATA, ...imported };
        /* Alle uebrigen Sammlungen pruefen (Notizen, Vorfaelle, Fehlzeiten,
           Termine, Stundenplan, Klassen, Aufgaben, Dienste, Themen). Vorher
           liefen die ungeprueft durch. */
        const { daten: geprueft, gekuerzt } = sanitizeImport(imported);
        Object.assign(merged, geprueft);
        // Sanitize: photo URLs must be data URIs; reject http/blob/other schemes; cap string field lengths
        if (Array.isArray(merged.students)) {
          merged.students = merged.students
            .filter((s) => s && typeof s === "object")
            .map((s) => ({
              ...S_SAUBER(s),
              /* Nur Rasterformate zulassen. „data:image/" allein liesse auch
                 data:image/svg+xml durch - und SVG kann Skripte enthalten.
                 Eigene Fotos kommen aus resizeImageFile immer als JPEG. */
              photo: typeof s.photo === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(s.photo) ? s.photo : "",
              name: typeof s.name === "string" ? s.name.slice(0, 200) : s.name,
              medicalInfo: typeof s.medicalInfo === "string" ? s.medicalInfo.slice(0, 2000) : s.medicalInfo,
              foerderStatus: typeof s.foerderStatus === "string" ? s.foerderStatus.slice(0, 500) : s.foerderStatus,
              parentPhone: typeof s.parentPhone === "string" ? s.parentPhone.slice(0, 100) : s.parentPhone,
              birthday: S_DATUM(s.birthday),
              deletedAt: S_DATUM(s.deletedAt),
            }));
        }
        /* Einstellungen aus einer fremden Datei nicht blind übernehmen: `merged` ist ein
           flacher Spread, `settings` würde also komplett ersetzt. Nur bekannte Felder
           durchlassen, alles andere auf die Vorgaben zurückfallen. */
        const impSettings = (typeof imported.settings === "object" && imported.settings) || {};
        merged.settings = {
          ...(EMPTY_DATA.settings || {}),
          ...impSettings,
          backupNotifications: impSettings.backupNotifications === true,
          dashboardOrder: Array.isArray(impSettings.dashboardOrder)
            ? impSettings.dashboardOrder.filter((k) => typeof k === "string")
            : (EMPTY_DATA.settings || {}).dashboardOrder,
        };
        const kurz = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);
        merged.grades = (Array.isArray(merged.grades) ? merged.grades : []).map((g) => ({
          ...g, topic: kurz(g.topic, 100), title: kurz(g.title, 200),
        }));
        merged.faecher = (Array.isArray(merged.faecher) ? merged.faecher : [])
          .filter((f) => f && typeof f === "object")
          .map((f) => ({
            ...S_SAUBER(f),
            subject: kurz(f.subject, 80),
            room: kurz(f.room, 40),
            color: S_FARBE(f.color),
            nextTestTitle: kurz(f.nextTestTitle, 100),
            /* S_DATUM statt Mustervergleich: ein Jahr wie 9999 hat frueher die
               App eingefroren und wuerde die reine Formpruefung passieren. */
            nextTestDate: S_DATUM(f.nextTestDate),
          }));
        setData(merged);
        recordBackup();
        /* Gekuerzte Sammlungen nicht verschweigen - sonst fehlen nach dem
           Wiederherstellen still Eintraege. */
        onResult?.({
          ok: true,
          msg: gekuerzt.length
            ? `Backup geladen. Sehr grosse Bereiche wurden gekürzt: ${gekuerzt.join(", ")}.`
            : "Backup erfolgreich geladen.",
        });
      } catch (e) {
        console.warn("[Saidy] Backup-Import fehlgeschlagen:", e);
        onResult?.({ ok: false, msg: "Die Datei konnte nicht gelesen werden." });
      }
    };
    reader.onerror = () => onResult?.({ ok: false, msg: "Die Datei konnte nicht gelesen werden." });
    reader.readAsText(file);
  }

  const pendingLessons = useMemo(
    () => computePendingLessons(data, now),
    [data, now]
  );

  const tabs = [
    { key: "dashboard", label: "Übersicht", icon: LayoutGrid },
    { key: "klassen", label: "Klassen & Schüler", icon: Users },
    { key: "stundenplan", label: "Stundenplan", icon: Clock },
    { key: "kalender", label: "Kalender", icon: CalendarDays },
    { key: "aufgaben", label: "Aufgaben", icon: ListChecks },
    { key: "noten", label: "Noten & Berichte", icon: GraduationCap },
  ];

  /* Notiz oder Gespräch aus der Schnellerfassung ablegen – dasselbe Format wie im Profil */
  function saveQuickNote({ studentId, text, istGespraech, typ, mood }) {
    update((d) => {
      d.notes = d.notes || [];
      d.notes.push(
        istGespraech
          ? { id: uid(), studentId, date: isoDate(new Date()), text, type: "gespraech", mood, gesprTyp: typ || "schueler" }
          : { id: uid(), studentId, date: isoDate(new Date()), text }
      );
      return d;
    });
    setQuickAdd(null);
    showToast(istGespraech ? "Gespräch gespeichert." : "Notiz gespeichert.");
  }

  function saveQuickTask(payload) {
    update((d) => {
      d.taskLists = d.taskLists || [];
      d.tasks = d.tasks || [];
      let listId = payload.listId;
      if (payload.newList) {
        const id = uid();
        d.taskLists.push({ id, name: payload.newList.name, icon: payload.newList.icon || "" });
        listId = id;
      }
      d.tasks.push({ id: uid(), title: payload.title, color: payload.color, listId, dueDate: payload.dueDate, done: false });
      return d;
    });
    setQuickAdd(null);
    showToast("Aufgabe angelegt.");
  }

  /* Für „Stunde erfassen" die naheliegendste Stunde wählen: zuerst eine noch offene,
     sonst die zuletzt gehaltene von heute. Gibt es beides nicht, führt der Weg
     zur Übersicht – dort steht der ganze Tag. */
  function startQuickCapture() {
    const offen = (pendingLessons || [])[0];
    if (offen) {
      setCaptureLesson({ fach: offen.fach, cls: offen.cls, date: isoDate(new Date()) });
      return;
    }
    const heuteKey = DAYS[(new Date().getDay() + 6) % 7];
    const heuteStunden = (data.timetable || [])
      .filter((t) => t.day === heuteKey)
      .sort((a, b) => a.period - b.period);
    const nowHM = formatHM(now || new Date());
    const kandidat =
      heuteStunden.filter((l) => (data.periodTimes?.[l.period]?.start || "") <= nowHM).pop() || heuteStunden[0];
    const fach = kandidat && data.faecher.find((f) => f.id === kandidat.fachId);
    const cls = fach && data.classes.find((c) => c.id === fach.classId);
    if (fach && cls) {
      setCaptureLesson({ fach, cls, date: isoDate(new Date()) });
    } else {
      goTo("dashboard");
      showToast("Heute steht keine Stunde im Plan.");
    }
  }

  /* Aktionen des Plus-Knopfs. Bereichsspezifische Aktionen (z. B. „Neue Klasse")
     hängen sich über onRegisterFab vorne an. */
  const globalFabActions = [
    { label: "Stunde erfassen", icon: ClipboardCheck, onClick: startQuickCapture },
    { label: "Gespräch notieren", icon: MessageSquare, onClick: () => setQuickAdd("gespraech") },
    { label: "Notiz zu einem Kind", icon: StickyNote, onClick: () => setQuickAdd("notiz") },
    { label: "Aufgabe", icon: ListChecks, onClick: () => setQuickAdd("aufgabe") },
    { label: "Termin", icon: CalendarDays, onClick: () => { setKalenderAutoForm(true); goTo("kalender"); } },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center app-bg gap-4">
        <SaidyLogoMark size={72} />
        <div className="text-stone-400 text-sm">Lade Daten …</div>
      </div>
    );
  }

  /* Gespeicherte Daten unlesbar: nichts überschreiben, sondern den Weg zurück anbieten.
     Der Originalbestand bleibt unangetastet im Browser-Speicher liegen. */
  if (loadFailed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center app-bg p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm p-6 text-center">
          <AlertTriangle size={32} className="text-amber-500 mx-auto mb-3" />
          <div className="font-semibold text-stone-800 mb-2">Daten konnten nicht gelesen werden</div>
          <p className="text-sm text-stone-600 leading-relaxed mb-1">
            Deine gespeicherten Daten sind beschädigt oder stammen aus einer neueren Version.
          </p>
          <p className="text-sm text-stone-600 leading-relaxed mb-5">
            <strong>Es wurde nichts überschrieben.</strong> Spiel eine Datensicherung ein – oder schließe die Seite
            und versuche es auf einem anderen Gerät.
          </p>
          <Button onClick={() => recoveryInputRef.current?.click()} className="w-full justify-center">
            <Upload size={15} /> Gesichertes wiederherstellen
          </Button>
          <input
            ref={recoveryInputRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importBackup(f, (res) => { if (res.ok) setLoadFailed(false); else setToast(res.msg); });
              e.target.value = "";
            }}
          />
          {toast && <p className="text-xs text-red-600 mt-3">{toast}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden app-bg text-[color:var(--ink)] font-sans">
      <style>{`
        /* ═══════════════════════════════════════════════════
           TP-01 · Design-Fundament
           ─────────────────────────────────────────────────
           Tokens, Semantik, Typographie, Karten, Chips
           ═══════════════════════════════════════════════════ */
        :root {
          /* Marke */
          --oliv: #4F5844;
          --oliv-dunkel: #3E4636;
          --oliv-hell: #ECEEE2;
          --creme: #F4F1E8;
          --karte: #FFFDF8;
          --linie: #E4DFD2;
          --ink: #2E3328;

          /* Semantische Status-Farben
             Grün = gut · Amber = Aufmerksamkeit · Rot = dringend · Blau = Info
             Grau = neutral/Standard — nur diese 5 Farben für Status */
          --s-gut:  #166534; --s-gut-bg:  #DCFCE7; --s-gut-rand:  #86EFAC;
          --s-warn: #92400E; --s-warn-bg: #FEF3C7; --s-warn-rand: #FCD34D;
          --s-krit: #991B1B; --s-krit-bg: #FEE2E2; --s-krit-rand: #FCA5A5;
          --s-info: #1E40AF; --s-info-bg: #DBEAFE; --s-info-rand: #93C5FD;
          --s-neu:  #4F5844; --s-neu-bg:  #ECEEE2; --s-neu-rand:  #C5CDB8;

          /* Abstände — 24 außen / 16 zwischen Karten / 12 innen */
          --sp-out:  1.5rem;
          --sp-card: 1rem;
          --sp-in:   0.75rem;

          /* Schatten */
          --shadow-card: 0 1px 3px rgba(46,51,40,0.07), 0 1px 2px rgba(46,51,40,0.04);
          --shadow-md:   0 4px 16px rgba(46,51,40,0.10), 0 1px 4px rgba(46,51,40,0.06);
          --shadow-xl:   0 8px 32px rgba(46,51,40,0.14), 0 2px 8px rgba(46,51,40,0.08);
        }

        /* ── Hintergrund ── */
        .app-bg  { background: var(--creme); }
        .bg-karte { background: var(--karte); }

        /* ── Karten (shadow-first, kein schwerer Rahmen) ──
           .card        weißer Grund, weiches Shadow
           .card-warm   creme-weißer Grund (wie bisher --karte)
           .karte       Rückwärtskompatibel: bleibt mit Rand */
        .card      { background: #fff;            border-radius: 1rem; box-shadow: var(--shadow-card); }
        .card-warm { background: var(--karte);    border-radius: 1rem; box-shadow: var(--shadow-card); }
        .card-p    { padding: var(--sp-in); }
        .karte     { background: var(--karte); border: 1px solid var(--linie); }

        /* ── Akzent (unverändert, Rückwärtskompatibilität) ── */
        .akzent-flaeche { background: var(--oliv); color: #fff; }
        .akzent-flaeche:hover { background: var(--oliv-dunkel); }
        .akzent-text { color: var(--oliv); }
        .akzent-ton  { background: var(--oliv-hell); color: var(--oliv); }
        .akzent-rand { border-color: var(--oliv); }
        .hover\\:akzent-rand:hover { border-color: var(--oliv); }
        .hover\\:akzent-text:hover { color: var(--oliv); }
        .hover\\:akzent-ton:hover  { background: var(--oliv-hell); color: var(--oliv); }

        /* ── Semantische Status-Klassen ── */
        .s-gut  { background: var(--s-gut-bg);  color: var(--s-gut);  border-color: var(--s-gut-rand); }
        .s-warn { background: var(--s-warn-bg); color: var(--s-warn); border-color: var(--s-warn-rand); }
        .s-krit { background: var(--s-krit-bg); color: var(--s-krit); border-color: var(--s-krit-rand); }
        .s-info { background: var(--s-info-bg); color: var(--s-info); border-color: var(--s-info-rand); }
        .s-neu  { background: var(--s-neu-bg);  color: var(--s-neu);  border-color: var(--s-neu-rand); }

        /* ── Chips (Status-Badges) ── */
        .chip        { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.6875rem; font-weight: 500; padding: 0.2rem 0.625rem; border-radius: 9999px; border: 1px solid transparent; line-height: 1.4; white-space: nowrap; }
        .chip-gut    { background: var(--s-gut-bg);  color: var(--s-gut);  border-color: var(--s-gut-rand); }
        .chip-warn   { background: var(--s-warn-bg); color: var(--s-warn); border-color: var(--s-warn-rand); }
        .chip-krit   { background: var(--s-krit-bg); color: var(--s-krit); border-color: var(--s-krit-rand); }
        .chip-info   { background: var(--s-info-bg); color: var(--s-info); border-color: var(--s-info-rand); }
        .chip-akzent { background: var(--s-neu-bg);  color: var(--s-neu);  border-color: var(--s-neu-rand); }
        .chip-neutral{ background: #f5f5f4; color: #57534e; border-color: #e7e5e4; }

        /* ── Status-Punkte (●) ── */
        .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
        .dot-gut  { background: var(--s-gut); }
        .dot-warn { background: var(--s-warn); }
        .dot-krit { background: var(--s-krit); }
        .dot-info { background: var(--s-info); }
        .dot-neutral { background: #a8a29e; }

        /* ── Typographie-Hierarchie ──
           Nur Labels, Captions, Section-Header — Lauftext via Tailwind */
        .t-section { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #a8a29e; }
        .t-label   { font-size: 0.75rem;   font-weight: 500; color: #78716c; line-height: 1.4; }
        .t-value   { font-size: 0.875rem;  font-weight: 500; color: #1c1917; }
        .t-caption { font-size: 0.6875rem; color: #a8a29e; line-height: 1.4; }
        .t-mono    { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

        /* ── Eingabefelder (nur diese bekommen Rahmen) ── */
        .input-base {
          background: #fff;
          border: 1.5px solid var(--linie);
          border-radius: 0.625rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          width: 100%;
          color: var(--ink);
          transition: border-color 0.15s;
          -webkit-appearance: none;
        }
        .input-base:focus { outline: none; border-color: var(--oliv); }
        .input-base::placeholder { color: #a8a29e; }

        /* ── Timeline (TP-05) ── */
        .tl-wrap { position: relative; }
        .tl-rail { position: absolute; left: 19px; top: 0; bottom: 0; width: 2px; border-radius: 1px; background: var(--linie); pointer-events: none; }
        .tl-entry { display: flex; align-items: flex-start; gap: 12px; position: relative; padding-bottom: 12px; }
        .tl-entry:last-child { padding-bottom: 0; }
        .tl-icon { width: 40px; height: 40px; border-radius: 14px; background: #fff; border: 1px solid var(--linie); display: flex; align-items: center; justify-content: center; flex-shrink: 0; z-index: 1; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
        .tl-body { flex: 1; min-width: 0; background: #fff; border-radius: 14px; padding: 10px 12px; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
        .tl-group-label { font-size: 0.625rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #a8a29e; padding: 10px 0 6px 52px; }
        .tl-line { width: 2px; border-radius: 1px; background: var(--linie); flex-shrink: 0; }
        .tl-dot  { width: 10px; height: 10px; border-radius: 50%; border: 2px solid var(--linie); background: #fff; flex-shrink: 0; }
        .tl-dot-filled { border-color: var(--oliv); background: var(--oliv); }

        /* ── Hilfsprogramme ── */
        .chip-scroll { scrollbar-width: none; }
        .chip-scroll::-webkit-scrollbar { display: none; }
        .tnum { font-variant-numeric: tabular-nums; }

        /* ── Sheets & Dialoge ── */
        .sheet {
          max-height: calc(100dvh - env(safe-area-inset-top) - 64px);
          margin-top: max(env(safe-area-inset-top), 12px);
          overscroll-behavior: contain;
        }
        .dialog {
          max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px);
          overscroll-behavior: contain;
        }

        /* ── Micro-Interactions ── */
        .press-scale { transition: transform 0.12s ease, opacity 0.12s ease; }
        .press-scale:active { transform: scale(0.97); opacity: 0.85; }

        /* ── Eingangs-Animationen ── */
        @keyframes slide-up-sheet {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes slide-from-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes item-pop {
          from { transform: scale(0.88) translateY(6px); opacity: 0; }
          to   { transform: scale(1)    translateY(0);   opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fade-in-tab {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .anim-sheet       { animation: slide-up-sheet  0.28s cubic-bezier(0.32, 0.72, 0, 1) both; }
        .anim-slide-right { animation: slide-from-right 0.26s cubic-bezier(0.32, 0.72, 0, 1) both; }
        .anim-item        { animation: item-pop 0.20s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        .anim-bg          { animation: fade-in 0.22s ease both; }
        .anim-tab         { animation: fade-in-tab 0.18s ease both; }

        @media (prefers-reduced-motion: reduce) {
          * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
      `}</style>
      {showOnboarding && (
        <OnboardingModal onSave={applyBundesland} onDone={handleOnboardingDone} onSkip={() => setShowOnboarding(false)} />
      )}
      <div className="flex flex-1 min-h-0">
        {/* Seitenleiste (Desktop) */}
        <aside className="hidden md:w-56 md:fixed md:inset-y-0 md:flex md:flex-col border-r border-stone-200 bg-white">
          {/* App-Kopf */}
          <div className="px-4 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <SaidyLogoMark size={34} className="shrink-0" />
              <div>
                <div className="text-sm font-semibold text-stone-800 leading-tight tracking-wide">Saidy</div>
                <div className="text-[10px] text-stone-400 leading-none mt-0.5">
                  {saveState === "saving" ? "Speichert …" : saveState === "error" ? "⚠ Kein Speicherplatz" : "Gespeichert"}
                </div>
              </div>
            </div>
          </div>

          {/* Schnell-erfassen-Knopf mit ausklappbarem Menue - fuer iPad/Desktop, wo die
              untere Leiste fehlt. Nutzt dieselben Aktionen wie der grosse Plus-Knopf
              auf dem Handy, damit der Erfassungs-Weg auf allen Geraeten gleich ist. */}
          <div className="relative px-3 pt-3">
            <button
              onClick={() => setFabOpen((o) => !o)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl akzent-flaeche text-white text-sm font-semibold press-scale"
              aria-expanded={fabOpen}
            >
              <Plus size={16} className="text-white" strokeWidth={2.4} />
              Schnell erfassen
            </button>
            {fabOpen && (
              <>
                {/* Klick ausserhalb schliesst das Dropdown */}
                <div className="fixed inset-0 z-40" onClick={() => setFabOpen(false)} />
                <div className="absolute left-3 right-3 mt-1.5 z-50 bg-white border border-stone-200 rounded-xl shadow-lg overflow-hidden">
                  {[...fabActions, ...globalFabActions].map(({ label, icon: Icon, onClick }) => (
                    <button
                      key={label}
                      onClick={() => { setFabOpen(false); onClick(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 text-left"
                    >
                      <span className="w-6 h-6 rounded-full akzent-flaeche flex items-center justify-center flex-shrink-0">
                        <Icon size={12} className="text-white" />
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
            {/* Gruppe: Unterricht */}
            <div>
              <div className="px-3 mb-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Unterricht</div>
              {[tabs[0], tabs[1], tabs[5]].map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                      active ? "akzent-ton akzent-text" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Gruppe: Organisation */}
            <div>
              <div className="px-3 mb-1.5 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Organisation</div>
              {[tabs[2], tabs[3], tabs[4]].map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                      active ? "akzent-ton akzent-text" : "text-stone-500 hover:bg-stone-50 hover:text-stone-800"
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Suche + Einstellungen unten */}
          <div className="px-2 py-3 border-t border-stone-100 space-y-0.5">
            <button
              onClick={() => setShowSearch(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
            >
              <Search size={17} strokeWidth={2} /> Suchen
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
            >
              <Settings2 size={17} strokeWidth={2} /> Einstellungen
            </button>
          </div>
        </aside>

        {/* Inhalt */}
        <main ref={mainRef} className="flex-1 md:ml-56 overflow-y-auto px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-[calc(env(safe-area-inset-bottom)+80px)] md:pb-8 md:px-8 md:pt-8 max-w-5xl">
          {saveState === "error" && (
            <div className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
              <span className="text-red-600 shrink-0">⚠</span>
              <span className="flex-1 text-red-800">Kein Speicherplatz mehr – Daten konnten nicht gespeichert werden. Bitte ein Backup erstellen und Browser-Speicher freigeben.</span>
              <button onClick={() => setShowSettings(true)} className="text-xs font-medium text-red-700 hover:text-red-900 underline underline-offset-2 shrink-0">Backup erstellen</button>
            </div>
          )}
          {backupReminderDays !== null && (
            <div className="mb-5 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <Download size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-stone-700">
                  {backupReminderDays === 0
                    ? "Noch kein Backup gespeichert – sichere deine Daten kurz."
                    : `Letztes Backup vor ${backupReminderDays} Tagen.`}
                </p>
                {(() => {
                  const parts = [];
                  if (changesSinceBackup.grades > 0) parts.push(`${changesSinceBackup.grades} neue Note${changesSinceBackup.grades !== 1 ? "n" : ""}`);
                  if (changesSinceBackup.notes > 0) parts.push(`${changesSinceBackup.notes} neue Notiz${changesSinceBackup.notes !== 1 ? "en" : ""}`);
                  if (changesSinceBackup.absences > 0) parts.push(`${changesSinceBackup.absences} neue Fehlzeit${changesSinceBackup.absences !== 1 ? "en" : ""}`);
                  return parts.length > 0 ? (
                    <p className="text-xs text-amber-700 mt-0.5">{parts.join(", ")} seitdem eingetragen.</p>
                  ) : null;
                })()}
              </div>
              <button
                onClick={() => { setShowSettings(true); setBackupReminderDays(null); }}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0 mt-0.5"
              >
                Jetzt sichern
              </button>
              <button onClick={() => setBackupReminderDays(null)} className="text-stone-400 hover:text-stone-600 shrink-0 mt-0.5">
                <X size={15} />
              </button>
            </div>
          )}
          {tab === "dashboard" && <Dashboard data={activeData} update={update} onNavigate={goTo} onOpenFach={goToFach} onOpenKlassenDashboard={(classId) => { setFocusKlassenDashboardId(classId); goTo("klassen"); }} onOpenUntisImport={() => setShowUntisImport(true)} onOpenSettings={() => setShowSettings(true)} halbjahr={halbjahr} setCaptureLesson={setCaptureLesson} pendingLessons={pendingLessons} now={now} />}
          {tab === "klassen" && <KlassenTab data={activeData} update={update} halbjahr={halbjahr} subTab={klassenSubTab} setSubTab={setKlassenSubTab} onOpenFach={goToFach} onOpenUntisImport={() => setShowUntisImport(true)} focusStudentId={focusStudentId} onFocusConsumed={() => setFocusStudentId(null)} focusKlassenDashboardId={focusKlassenDashboardId} onFocusKlassenDashboardConsumed={() => setFocusKlassenDashboardId(null)} onRegisterFab={setFabActions} showToast={showToast} />}
          {tab === "stundenplan" && <StundenplanTab data={activeData} update={update} />}
          {tab === "kalender" && <KalenderTab data={activeData} update={update} autoOpenForm={kalenderAutoForm} onAutoFormConsumed={() => setKalenderAutoForm(false)} />}
          {tab === "aufgaben" && <AufgabenTab data={activeData} update={update} />}
          {tab === "noten" && <NotenTab data={activeData} update={update} halbjahr={halbjahr} initialFachId={notenFachId} onConsumeInitial={() => setNotenFachId(null)} />}

          {showSettings && (
            <SettingsModal
              data={data}
              update={update}
              halbjahr={halbjahr}
              setHalbjahr={setHalbjahr}
              onExport={exportBackup}
              onShare={shareBackup}
              onImport={importBackup}
              onExportDocuments={exportDocuments}
              onImportDocuments={importDocuments}
              onReset={resetAllData}
              onClose={() => setShowSettings(false)}
              onOpenUntisImport={() => { setShowSettings(false); setShowUntisImport(true); }}
            />
          )}

          {showUntisImport && (
            <WebUntisImportModal
              students={activeData.students}
              existingAbsences={data.absences || []}
              onImport={(newAbsences) => {
                if (newAbsences.length > 0) {
                  update((d) => {
                    if (!d.absences) d.absences = [];
                    d.absences.push(...newAbsences);
                    d.settings = { ...(d.settings || {}), fehlzeitenLastImport: isoDate(new Date()) };
                    return d;
                  });
                  showToast(`${newAbsences.length} Fehlzeit${newAbsences.length === 1 ? "" : "en"} importiert.`);
                } else {
                  showToast("Keine neuen Fehlzeiten gefunden.");
                }
                setShowUntisImport(false);
              }}
              onClose={() => setShowUntisImport(false)}
            />
          )}

          {captureLesson && (
            <QuickCaptureModal
              data={data}
              update={update}
              fach={captureLesson.fach}
              cls={captureLesson.cls}
              students={data.students.filter((s) => s.classId === captureLesson.cls.id).sort((a, b) => a.name.localeCompare(b.name, "de"))}
              date={captureLesson.date}
              halbjahr={halbjahr}
              onClose={() => setCaptureLesson(null)}
              onSwitch={(neu) => setCaptureLesson(neu)}
            />
          )}
        </main>
      </div>

      {/* Feste untere Navigation (nur mobil) – scrollt weg wenn tief gescrollt */}
      <nav className={`md:hidden fixed inset-x-0 bottom-0 bg-white/95 backdrop-blur-lg border-t border-stone-200/80 ${fabOpen ? "z-[46]" : "z-40"} pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)] transition-transform duration-200 ${navCollapsed ? "translate-y-[calc(100%+1.5rem)]" : "translate-y-0"}`}>
        {/* Übersicht · Klassen · [+] · Noten · Mehr – „Aufgaben" liegt im Mehr-Menü
            und ist zusätzlich über den Plus-Knopf erreichbar. */}
        <div className="flex items-stretch justify-around px-2 pt-2 pb-1">
          {[tabs[0], tabs[1]].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setNavCollapsed(false); setShowMore(false); }}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${active ? "akzent-ton" : ""}`}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} className={active ? "akzent-text" : "text-stone-400"} />
                </span>
                <span className={`text-[10px] leading-none ${active ? "akzent-text font-semibold" : "text-stone-400"}`}>
                  {t.key === "klassen" ? "Klassen" : t.label}
                </span>
              </button>
            );
          })}

          {/* Plus in der Mitte – hebt sich über die Leiste hinaus */}
          <div className="flex-1 flex justify-center">
            <button
              onClick={() => { setFabOpen((o) => !o); setShowMore(false); }}
              className="w-14 h-14 -mt-5 rounded-full akzent-flaeche text-white flex items-center justify-center press-scale shrink-0"
              style={{ boxShadow: "0 6px 20px rgba(79,88,68,0.45)" }}
              aria-label="Neu erfassen"
              aria-expanded={fabOpen}
            >
              <Plus
                size={26}
                className="text-white"
                style={{ transform: fabOpen ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
              />
            </button>
          </div>

          {[tabs[5]].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setNavCollapsed(false); setShowMore(false); }}
                className="flex-1 flex flex-col items-center gap-1"
              >
                <span className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${active ? "akzent-ton" : ""}`}>
                  <Icon size={20} strokeWidth={active ? 2.4 : 2} className={active ? "akzent-text" : "text-stone-400"} />
                </span>
                <span className={`text-[10px] leading-none ${active ? "akzent-text font-semibold" : "text-stone-400"}`}>Noten</span>
              </button>
            );
          })}

          <button
            onClick={() => { setShowMore(true); setNavCollapsed(false); setFabOpen(false); }}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <span className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${["stundenplan", "kalender", "aufgaben"].includes(tab) ? "akzent-ton" : ""}`}>
              <MoreHorizontal size={20} strokeWidth={2.2} className={["stundenplan", "kalender", "aufgaben"].includes(tab) ? "akzent-text" : "text-stone-400"} />
            </span>
            <span className={`text-[10px] leading-none ${["stundenplan", "kalender", "aufgaben"].includes(tab) ? "akzent-text font-semibold" : "text-stone-400"}`}>Mehr</span>
          </button>
        </div>
      </nav>

      {/* Ersatz-Knopf unten links, wenn die Nav weggescrollt ist. Zeigt bewusst NICHT
          das Symbol des aktuellen Bereichs - das las sich wie eine Zustandsanzeige
          ("du bist in Klassen") und niemand kam auf die Idee, dass es ein Knopf ist.
          Ein Pfeil nach oben zeigt, was passiert: die Leiste kommt zurueck. */}
      <button
        onClick={() => setNavCollapsed(false)}
        aria-label="Navigation einblenden"
        className={`md:hidden fixed left-4 z-40 w-12 h-12 rounded-full akzent-flaeche shadow-lg flex items-center justify-center transition-all duration-200 ${
          navCollapsed
            ? "bottom-[calc(env(safe-area-inset-bottom)+16px)] opacity-100 scale-100"
            : "bottom-0 opacity-0 scale-75 pointer-events-none"
        }`}
      >
        <ChevronDown size={22} strokeWidth={2.4} className="text-white rotate-180" />
      </button>

      {/* Mehr-Menü (mobil) */}
      {showMore && (
        <div className="md:hidden fixed inset-0 bg-stone-900/40 z-50 flex items-end" onClick={() => setShowMore(false)}>
          <div className="bg-white rounded-t-3xl w-full p-4 pb-[max(2rem,env(safe-area-inset-bottom))] anim-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-2 gap-3">
              {[tabs[2], tabs[3], tabs[4]].map((t) => {
                const Icon = t.icon;
                const active = tab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => { setTab(t.key); setShowMore(false); }}
                    className={`flex flex-col items-center gap-2 py-4 rounded-2xl border ${active ? "akzent-rand akzent-ton" : "border-stone-200"}`}
                  >
                    <Icon size={22} className={active ? "akzent-text" : "text-stone-500"} />
                    <span className={`text-xs ${active ? "akzent-text font-medium" : "text-stone-600"}`}>{t.label}</span>
                  </button>
                );
              })}
              <button
                onClick={() => { setShowSearch(true); setShowMore(false); }}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-stone-200"
              >
                <Search size={22} className="text-stone-500" />
                <span className="text-xs text-stone-600">Suchen</span>
              </button>
              <button
                onClick={() => { setShowSettings(true); setShowMore(false); }}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-stone-200"
              >
                <Settings2 size={22} className="text-stone-500" />
                <span className="text-xs text-stone-600">Einstellungen</span>
              </button>
              <button
                onClick={() => { setShowHelp(true); setShowMore(false); }}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl border border-stone-200"
              >
                <MessageSquare size={22} className="text-stone-500" />
                <span className="text-xs text-stone-600">Hilfe</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showHelp && <HilfeSheet onClose={() => setShowHelp(false)} />}

      {showSearch && (
        <GlobalSearchModal
          data={activeData}
          onSelectStudent={navigateToStudent}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Floating Action Button (nur mobil, nur wenn Aktionen registriert) */}
      {/* Aktionsliste über dem Plus-Knopf. Bereichsspezifische Einträge (z. B. „Neue Klasse")
          stehen vorn, danach die überall verfügbaren Schnellerfassungen. */}
      {fabOpen && !showMore && (
        <>
          <div className="md:hidden fixed inset-0 bg-stone-900/20 z-[44]" onClick={() => setFabOpen(false)} />
          <div
            className="md:hidden fixed z-[45] left-0 right-0 px-4 flex flex-col items-center gap-2"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 90px)" }}
          >
            {[...fabActions, ...globalFabActions].map(({ label, icon: Icon, onClick }, i) => (
              <button
                key={label}
                onClick={() => { setFabOpen(false); onClick(); }}
                className="w-full max-w-xs flex items-center gap-2.5 bg-white border border-stone-100 shadow-lg px-4 py-2.5 rounded-full text-sm font-medium text-stone-800 press-scale anim-item"
                style={{ animationDelay: `${i * 35}ms`, animationFillMode: "both" }}
              >
                <span className="w-7 h-7 rounded-full akzent-flaeche flex items-center justify-center flex-shrink-0">
                  <Icon size={13} className="text-white" />
                </span>
                {label}
              </button>
            ))}
          </div>
        </>
      )}

      {quickAdd === "aufgabe" && (
        <TaskModal data={data} initial={null} defaultListId="" onSave={saveQuickTask} onClose={() => setQuickAdd(null)} />
      )}
      {(quickAdd === "notiz" || quickAdd === "gespraech") && (
        <QuickAddNoteModal data={activeData} modus={quickAdd} onSave={saveQuickNote} onClose={() => setQuickAdd(null)} />
      )}

      {/* Toast-Meldung */}
      {toast && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] md:bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-stone-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg pointer-events-none">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- Dashboard ---------- */

function startOfWeek(d) {
  const day = (d.getDay() + 6) % 7; // Montag = 0
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}
function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
/* Datum als YYYY-MM-DD in LOKALER Zeit.
   Wichtig: toISOString() würde in UTC umrechnen – in Deutschland (UTC+1/+2) ergäbe
   Mitternacht dadurch den Vortag und alle Tagesvergleiche wären um einen Tag verschoben. */
function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// Parst reine YYYY-MM-DD-Strings als lokale Mitternacht statt UTC, verhindert Vortagsanzeige in UTC+1/+2
function localDate(str) {
  if (!str) return new Date(NaN);
  if (str instanceof Date) return str;
  if (typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + "T00:00:00");
  return new Date(str);
}

/* Aktuelle Schulwoche: Kalenderwoche (ISO 8601) und Datumsbereich Mo–Fr. */
function currentSchoolWeek(ref = new Date()) {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Montag
  const monday = addDays(d, -dow);
  const friday = addDays(monday, 4);
  // ISO-Kalenderwoche berechnen
  const t = new Date(monday);
  t.setDate(t.getDate() + 3); // Donnerstag der Woche bestimmt die KW
  const week1 = new Date(t.getFullYear(), 0, 4);
  const kw = 1 + Math.round(((t - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  const fmt = (x) => x.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  return { kw, monday, friday, range: `${fmt(monday)}–${fmt(friday)}`, label: `KW ${kw} · ${fmt(monday)}–${fmt(friday)}` };
}

/* Nächste Ferien ab heute + Tage bis dahin.
   Während laufender Ferien wird kein Countdown angezeigt, und Ferientage zählen
   nicht als Schultage mit (sonst wäre die Zahl zu hoch). */
function nextFerienCountdown(events, schooldaysOnly) {
  const todayStr = isoDate(new Date());
  const ferien = (events || []).filter((e) => e.type === "ferien");

  // Läuft gerade eine Ferienzeit? Dann kein Countdown.
  const laufend = ferien.find((e) => e.date <= todayStr && todayStr <= (e.endDate || e.date));
  if (laufend) return { inFerien: true, title: laufend.title };

  const upcoming = ferien
    .filter((e) => e.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;
  const next = upcoming[0];

  const istFerientag = (iso) => ferien.some((e) => e.date <= iso && iso <= (e.endDate || e.date));

  const today = new Date(todayStr + "T00:00:00");
  const start = new Date(next.date + "T00:00:00");
  let days = 0;
  const cursor = new Date(today);
  while (cursor < start) {
    const dow = cursor.getDay(); // 0 So .. 6 Sa
    const iso = isoDate(cursor);
    const zaehlt = schooldaysOnly ? dow !== 0 && dow !== 6 && !istFerientag(iso) : true;
    if (zaehlt) days++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { inFerien: false, title: next.title, date: next.date, days };
}

/* Schnellerfassung nach der Stunde: Note, Notiz und Auffälligkeit pro Schüler:in in einer kompakten Liste */
function QuickCaptureModal({ data, update, fach, cls, students, date: initialDate, halbjahr, onClose, onSwitch }) {
  const isColor = data.settings?.colorMode === true;
  const istSport = /sport/i.test(fach?.subject || "");
  const [date, setDate] = useState(initialDate || isoDate(new Date()));
  const [category, setCategory] = useState("muendlich");
  const [incidentLabel, setIncidentLabel] = useState("Sportzeug");
  const [autoGrade, setAutoGrade] = useState(true);
  const [expanded, setExpanded] = useState(null); // studentId, dessen Notizfeld offen ist
  const [noteDrafts, setNoteDrafts] = useState({});
  const [gesprExpanded, setGesprExpanded] = useState(null);
  const [gesprMood, setGesprMood] = useState("ok");
  const [gesprTyp, setGesprTyp] = useState("schueler");
  const [gesprTexts, setGesprTexts] = useState({});
  const [actionsId, setActionsId] = useState(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  /* Andere Stunden desselben Tages zum Wechseln - pro Fach genau eine Zeile.
     Eine Doppelstunde erscheint einmal, weil sie ohnehin als eine Einheit erfasst wird. */
  const tagFaecher = (() => {
    const tagKey = DAYS[(localDate(date).getDay() + 6) % 7];
    if (!tagKey) return [];
    const seen = new Set();
    const zeilen = [];
    data.timetable
      .filter((t) => t.day === tagKey)
      .sort((a, b) => a.period - b.period)
      .forEach((t) => {
        if (seen.has(t.fachId)) return;
        seen.add(t.fachId);
        const f = data.faecher.find((x) => x.id === t.fachId);
        if (!f) return;
        const c = data.classes.find((x) => x.id === f.classId);
        if (!c) return;
        zeilen.push({ fach: f, cls: c, start: data.periodTimes?.[t.period]?.start || "" });
      });
    return zeilen;
  })();

  // Optionales Stundenthema für genau diese Stunde (Fach + Datum)
  const topicId = `${fach.id}-${date}`;
  const savedTopic = (data.lessonTopics || []).find((t) => t.fachId === fach.id && t.date === date);
  const [topic, setTopic] = useState(savedTopic?.text || "");
  function saveTopic(text) {
    setTopic(text);
    update((d) => {
      d.lessonTopics = d.lessonTopics || [];
      const existing = d.lessonTopics.find((t) => t.fachId === fach.id && t.date === date);
      if (text.trim()) {
        if (existing) existing.text = text.trim();
        else d.lessonTopics.push({ id: uid(), fachId: fach.id, date, text: text.trim() });
      } else if (existing) {
        d.lessonTopics = d.lessonTopics.filter((t) => t !== existing);
      }
      return d;
    });
  }

  function gradeFor(studentId) {
    const g = data.grades.find((g) => g.quick && g.fachId === fach.id && g.studentId === studentId && g.date === date && g.category === category);
    return g ? g.value : "";
  }

  function noteFor(studentId) {
    if (noteDrafts[studentId] !== undefined) return noteDrafts[studentId];
    const n = data.notes.find((n) => n.quick && n.studentId === studentId && n.date === date);
    return n?.text || "";
  }

  function incidentActive(studentId) {
    return data.incidents.some((i) => i.fachId === fach.id && i.studentId === studentId && i.date === date && i.label === incidentLabel);
  }

  function setGrade(studentId, raw) {
    const value = raw === "" ? null : Number(raw);
    /* Bei schriftlichen Noten wandert das Stundenthema als Themen-Tag mit an die Note –
       sonst bliebe die Wissensgebiete-Auswertung leer, obwohl oben ein Thema gepflegt wurde. */
    const themaTag = category === "schriftlich" && topic.trim() ? topic.trim().slice(0, 100) : null;
    update((d) => {
      d.grades = d.grades.filter((g) => !(g.quick && g.fachId === fach.id && g.studentId === studentId && g.date === date && g.category === category));
      if (value != null) {
        d.grades.push({ id: uid(), studentId, classId: fach.classId, fachId: fach.id, category, value, factor: 1, title: "Schnellerfassung", date, halbjahr, quick: true, ...(themaTag ? { topic: themaTag } : {}) });
      }
      return d;
    });
  }

  function saveNote(studentId) {
    const text = (noteDrafts[studentId] ?? noteFor(studentId)).trim();
    update((d) => {
      d.notes = d.notes.filter((n) => !(n.quick && n.studentId === studentId && n.date === date));
      if (text) d.notes.push({ id: uid(), studentId, date, text, quick: true });
      return d;
    });
  }

  function toggleIncident(studentId) {
    const active = incidentActive(studentId);
    update((d) => {
      if (active) {
        d.incidents = d.incidents.filter((i) => !(i.fachId === fach.id && i.studentId === studentId && i.date === date && i.label === incidentLabel));
        d.grades = d.grades.filter((g) => !(g.auto && g.fachId === fach.id && g.studentId === studentId && g.date === date && g.reason === incidentLabel));
      } else {
        d.incidents.push({ id: uid(), studentId, fachId: fach.id, label: incidentLabel, date });
        if (autoGrade) {
          d.grades.push({ id: uid(), studentId, classId: fach.classId, fachId: fach.id, category: "muendlich", value: 5, factor: 1, title: `${incidentLabel} vergessen`, date, halbjahr, auto: true, reason: incidentLabel });
        }
      }
      return d;
    });
  }

  function incidentNoteFor(studentId) {
    const i = data.incidents.find((i) => i.fachId === fach.id && i.studentId === studentId && i.date === date && i.label === incidentLabel);
    return i?.note || "";
  }

  function setIncidentNote(studentId, text) {
    update((d) => {
      const i = d.incidents.find((i) => i.fachId === fach.id && i.studentId === studentId && i.date === date && i.label === incidentLabel);
      if (i) i.note = text;
      return d;
    });
  }

  function saveGespraech(studentId) {
    const text = (gesprTexts[studentId] || "").trim();
    if (!text) return;
    update((d) => {
      d.notes.push({ id: uid(), studentId, date, text, type: "gespraech", mood: gesprMood, gesprTyp });
      return d;
    });
    setGesprTexts((d) => ({ ...d, [studentId]: "" }));
    setGesprExpanded(null);
  }

  /* Beim Schliessen alle offenen Gespraechs-Drafts mitspeichern, statt sie
     stillschweigend zu verwerfen. Wer den Text getippt hat, will ihn nicht durch
     einen Fehltipp neben das Sheet oder ein zu frueh gedruecktes „Fertig" verlieren.
     Notizen speichern schon per onBlur - hier fehlte der Auto-Save nur bei Gespraechen. */
  function schliessenMitRettung() {
    const offene = Object.entries(gesprTexts).filter(([, t]) => (t || "").trim());
    if (offene.length) {
      update((d) => {
        offene.forEach(([studentId, t]) => {
          d.notes.push({ id: uid(), studentId, date, text: t.trim(), type: "gespraech", mood: gesprMood, gesprTyp });
        });
        return d;
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={schliessenMitRettung}>
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet overflow-x-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Kopf bleibt beim Scrollen sichtbar - Klasse und Fach gross und klar,
            damit auffaellt wenn Saidy die falsche Stunde vorgewaehlt hat. Ein Tipp
            auf die Zeile oeffnet die Liste der anderen Stunden des Tages. */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-200 z-10 shadow-[0_4px_10px_-6px_rgba(0,0,0,0.15)]">
          <div className="px-4 py-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => tagFaecher.length > 1 && setSwitcherOpen((v) => !v)}
              disabled={tagFaecher.length <= 1}
              className="min-w-0 flex-1 text-left flex items-center gap-2 -mx-1 px-1 py-0.5 rounded-lg disabled:cursor-default"
              aria-expanded={switcherOpen}
              aria-label={tagFaecher.length > 1 ? "Andere Stunde waehlen" : undefined}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 leading-none mb-1">Schnellerfassung</div>
                <div className="flex items-center gap-1.5 min-w-0">
                  {cls && (
                    <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded akzent-ton akzent-text leading-none">{cls.name}</span>
                  )}
                  <span className="font-semibold text-stone-800 truncate">{fach.subject}</span>
                  {tagFaecher.length > 1 && (
                    <ChevronDown size={14} className={`text-stone-400 shrink-0 transition-transform ${switcherOpen ? "rotate-180" : ""}`} />
                  )}
                </div>
              </div>
            </button>
            <button onClick={schliessenMitRettung} className="w-11 h-11 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0">
              <X size={16} />
            </button>
          </div>
          {switcherOpen && tagFaecher.length > 1 && (
            <div className="border-t border-stone-100 max-h-64 overflow-y-auto">
              <ul className="py-1">
                {tagFaecher.map(({ fach: f, cls: c, start }) => {
                  const aktiv = f.id === fach.id;
                  return (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSwitcherOpen(false);
                          if (aktiv) return;
                          /* Draft-Rettung des laufenden Sheets, dann Wechsel zur neuen Stunde */
                          const offene = Object.entries(gesprTexts).filter(([, t]) => (t || "").trim());
                          if (offene.length) {
                            update((d) => {
                              offene.forEach(([sid, t]) => {
                                d.notes.push({ id: uid(), studentId: sid, date, text: t.trim(), type: "gespraech", mood: gesprMood, gesprTyp });
                              });
                              return d;
                            });
                          }
                          onSwitch?.({ fach: f, cls: c, date });
                        }}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm ${aktiv ? "akzent-ton akzent-text font-medium" : "text-stone-700 hover:bg-stone-50"}`}
                      >
                        <span className="w-11 text-xs text-stone-400 tabular-nums shrink-0">{start || "–"}</span>
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 leading-none">{c.name}</span>
                        <span className="flex-1 truncate">{f.subject}</span>
                        {aktiv && <Check size={14} className="akzent-text shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="p-4 pb-[max(2rem,env(safe-area-inset-bottom))]">

          {/* Stunden-Timer: nur zeigen, wenn es zeitlich eng wird */}
          {(() => {
            const cd = testCountdown(fach, data.timetable, data.events);
            if (!cd || cd.level === "neutral") return null;
            const krit = cd.level === "krit";
            const warn = cd.level === "warn";
            return (
              <div className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 mb-3 text-xs ${krit ? "bg-red-50 border-red-200" : warn ? "bg-amber-50 border-amber-200" : "bg-stone-50 border-stone-200"}`}>
                <Clock size={14} className={`shrink-0 ${krit ? "text-red-500" : warn ? "text-amber-500" : "text-stone-400"}`} />
                <span className={`flex-1 font-medium truncate ${krit ? "text-red-700" : warn ? "text-amber-700" : "text-stone-600"}`}>{cd.label}</span>
                <span className={`shrink-0 font-bold ${krit ? "text-red-700" : warn ? "text-amber-700" : "text-stone-500"}`}>
                  {cd.istHeute ? "heute" : cd.rem === null ? cd.datum : `noch ${cd.rem} Std.`}
                </span>
              </div>
            );
          })()}

          {/* Datum und Kategorie */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <input
              type="date"
              className="text-sm rounded-lg border border-stone-300 px-2 py-1"
              value={date}
              onChange={(e) => { const nd = e.target.value; setDate(nd); setNoteDrafts({}); setExpanded(null); setTopic((data.lessonTopics || []).find((t) => t.fachId === fach.id && t.date === nd)?.text || ""); }}
            />
            {date !== isoDate(new Date()) && (
              <button onClick={() => { const nd = isoDate(new Date()); setDate(nd); setNoteDrafts({}); setExpanded(null); setTopic((data.lessonTopics || []).find((t) => t.fachId === fach.id && t.date === nd)?.text || ""); }} className="text-xs akzent-text hover:underline">
                Heute
              </button>
            )}
            <div className="inline-flex bg-stone-100 rounded-lg p-0.5 ml-auto">
              {CATS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium ${category === c.key ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Optionales Stundenthema. Datalist schlaegt bereits bekannte Themen desselben
              Fachs vor - so bleibt "Bruchrechnung" ueber Wochen dasselbe Wort und der
              Fortschrittsbalken zaehlt sauber weiter statt bei jeder Tippvariante von
              vorn. */}
          <div className="mb-4">
            <input
              className={inputCls}
              placeholder="Thema der Stunde (optional) – z. B. Bruchrechnung einführen"
              maxLength={200}
              value={topic}
              onChange={(e) => saveTopic(e.target.value)}
              list={`stundenthemen-${fach.id}`}
              autoComplete="off"
            />
            <datalist id={`stundenthemen-${fach.id}`}>
              {bekannteStundenthemen(data.lessonTopics, data.grades, fach.id).map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {/* Frage zum Mitbringen – nur bei Sport-Fächern sichtbar */}
          {istSport && (() => {
            const anyFehlt = students.some((s) => incidentActive(s.id));
            return (
              <div className={`mb-4 rounded-xl px-3 py-2.5 border ${anyFehlt ? "bg-amber-50 border-amber-200" : "bg-stone-50 border-stone-200"}`}>
                <div className={`flex items-center gap-2 flex-wrap text-sm ${anyFehlt ? "text-amber-900" : "text-stone-700"}`}>
                  <span>Haben alle ihr</span>
                  <input
                    className={`text-sm rounded-lg px-2 py-1 w-32 ${anyFehlt ? "border border-amber-300 bg-white" : "border border-stone-300 bg-white"}`}
                    value={incidentLabel}
                    onChange={(e) => setIncidentLabel(e.target.value)}
                    placeholder="Sportzeug"
                    maxLength={50}
                  />
                  <span>dabei?</span>
                </div>
                <p className={`text-xs mt-1.5 ${anyFehlt ? "text-amber-700" : "text-stone-500"}`}>
                  Fehlt es, beim Kind auf <MoreHorizontal size={11} className="inline -mt-0.5" /> tippen, dann „Vergessen"
                  {autoGrade ? " – trägt automatisch eine mündliche 5 ein." : "."}
                </p>
              </div>
            );
          })()}

          <ul className="divide-y divide-stone-100">
            {students.map((s) => {
              const fehlt = incidentActive(s.id);
              const hatNotiz = !!noteFor(s.id);
              const hasActivity = hatNotiz || fehlt;
              return (
                <li key={s.id} className="py-2.5">
                  {/* Name + MoreHorizontal toggle */}
                  <div className="flex items-center gap-2 mb-2">
                    <StudentAvatar student={s} size={26} />
                    <span className="flex-1 text-sm text-stone-800 truncate min-w-0">{s.name}</span>
                    {fehlt && autoGrade && <span className="text-[11px] leading-none text-red-600 font-medium shrink-0">Note 5</span>}
                    <button
                      onClick={() => setActionsId((cur) => (cur === s.id ? null : s.id))}
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
                        hasActivity ? "akzent-ton akzent-rand akzent-text" : actionsId === s.id ? "bg-stone-100 border-stone-300 text-stone-600" : "border-stone-200 text-stone-400"
                      }`}
                      aria-label="Weitere Aktionen"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>

                  {/* Incident note – before grades so it's prominent */}
                  {fehlt && (
                    <input
                      className="w-full text-xs rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-2 mb-2"
                      placeholder="Vermerk, z. B. nur Schuhe vergessen"
                      maxLength={200}
                      value={incidentNoteFor(s.id)}
                      onChange={(e) => setIncidentNote(s.id, e.target.value)}
                    />
                  )}

                  {/* Grade buttons – always visible */}
                  {category === "muendlich" ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {QUICK_SYMBOLS.map((qs) => {
                        const active = gradeFor(s.id) === qs.value;
                        return (
                          <button
                            key={qs.symbol}
                            onClick={() => setGrade(s.id, active ? "" : String(qs.value))}
                            className="h-9 rounded-lg text-sm font-semibold border"
                            style={active ? { backgroundColor: isColor ? qs.color : "var(--oliv)", borderColor: isColor ? qs.color : "var(--oliv)", color: "white" } : { borderColor: "#E7E5E4", color: "#78716C" }}
                          >
                            {qs.symbol}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <select
                      className="text-sm rounded-lg border border-stone-300 px-2 py-1.5 w-24"
                      value={gradeFor(s.id)}
                      onChange={(e) => setGrade(s.id, e.target.value)}
                    >
                      <option value="">—</option>
                      {GRADE_OPTIONS.map((g) => <option key={g.label} value={g.value}>{g.label}</option>)}
                    </select>
                  )}

                  {/* Action buttons – revealed by MoreHorizontal */}
                  {actionsId === s.id && (
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() => setExpanded((cur) => (cur === s.id ? null : s.id))}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                          hatNotiz ? "akzent-ton akzent-rand akzent-text" : "border-stone-200 text-stone-500 bg-stone-50"
                        }`}
                      >
                        <StickyNote size={13} /> Notiz
                      </button>
                      <button
                        onClick={() => { setGesprExpanded((cur) => (cur === s.id ? null : s.id)); setGesprMood("ok"); }}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                          gesprExpanded === s.id ? "akzent-ton akzent-rand akzent-text" : "border-stone-200 text-stone-500 bg-stone-50"
                        }`}
                      >
                        <MessageSquare size={13} /> Gespräch
                      </button>
                      <button
                        onClick={() => toggleIncident(s.id)}
                        className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl border text-xs font-medium transition-colors ${
                          fehlt ? "bg-red-500 border-red-500 text-white" : "border-stone-200 text-stone-500 bg-stone-50"
                        }`}
                      >
                        <AlertTriangle size={13} /> Vergessen
                      </button>
                    </div>
                  )}

                  {expanded === s.id && (
                    <input
                      autoFocus
                      className="w-full mt-2 text-sm rounded-lg border border-stone-300 px-2.5 py-2"
                      placeholder="Beobachtung notieren …"
                      maxLength={500}
                      value={noteFor(s.id)}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { saveNote(s.id); setExpanded(null); } }}
                      onBlur={() => saveNote(s.id)}
                    />
                  )}

                  {gesprExpanded === s.id && (
                    <div className="mt-2 bg-stone-50 border border-stone-200 rounded-xl p-2.5">
                      <div className="flex gap-1 mb-1.5">
                        {GESPRAECH_TYPEN.map((t) => (
                          <button key={t.key} type="button" onClick={() => setGesprTyp(t.key)}
                            className={`flex-1 py-1 rounded-lg border text-xs font-medium transition-colors ${gesprTyp === t.key ? "akzent-rand akzent-ton akzent-text" : "border-stone-200 bg-white text-stone-500"}`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1 mb-1.5">
                        {MOOD_OPTIONS.map((m) => (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setGesprMood(m.key)}
                            className={`flex-1 py-1 rounded-lg border text-base transition-colors ${gesprMood === m.key ? "akzent-rand akzent-ton" : "border-stone-200 bg-white"}`}
                            title={m.label}
                          >
                            {m.emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          className="flex-1 text-sm rounded-lg border border-stone-300 px-2.5 py-1.5"
                          placeholder="Was bewegt das Kind …"
                          maxLength={500}
                          value={gesprTexts[s.id] || ""}
                          onChange={(e) => setGesprTexts((d) => ({ ...d, [s.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveGespraech(s.id); }}
                        />
                        <button
                          type="button"
                          onClick={() => saveGespraech(s.id)}
                          disabled={!(gesprTexts[s.id] || "").trim()}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium akzent-flaeche text-white disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
            {!students.length && <li className="py-3 text-sm text-stone-400">Keine Schüler:innen in dieser Klasse.</li>}
          </ul>

          <Button onClick={schliessenMitRettung} className="w-full justify-center mt-4">Fertig</Button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, update, onNavigate, onOpenFach, onOpenKlassenDashboard, onOpenUntisImport, onOpenSettings, halbjahr, setCaptureLesson, pendingLessons, now }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showPending, setShowPending] = useState(false);
  const [openTestDetail, setOpenTestDetail] = useState(null);
  const [showAllLessons, setShowAllLessons] = useState(false);
  const todayStr = isoDate(new Date());
  const selStr = isoDate(selectedDate);
  const isToday = selStr === todayStr;

  const weekStart = startOfWeek(selectedDate);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  const dayKey = DAYS[(selectedDate.getDay() + 6) % 7]; // undefined am Wochenende
  const dayLessons = data.timetable
    .filter((t) => t.day === dayKey)
    .sort((a, b) => a.period - b.period);

  /* Aufeinanderfolgende Bloecke desselben Fachs bilden eine Unterrichtseinheit
     (Doppelstunde 07:55 - 09:30). Der Tagesplan wird darueber angezeigt, weil
     eine Doppelstunde vor der Klasse auch als ein Vorgang erlebt und erfasst wird.
     Mathe in Stunde 1 und 4 bleibt getrennt - dazwischen ist eine andere Stunde. */
  const dayUnits = (() => {
    const units = [];
    dayLessons.forEach((slot) => {
      const letzte = units[units.length - 1];
      if (letzte && letzte.fachId === slot.fachId && slot.period === letzte.lastPeriod + 1) {
        letzte.slots.push(slot);
        letzte.lastPeriod = slot.period;
      } else {
        units.push({
          id: `u-${slot.fachId}-${slot.period}`,
          fachId: slot.fachId,
          slots: [slot],
          firstPeriod: slot.period,
          lastPeriod: slot.period,
        });
      }
    });
    return units;
  })();

  // Zuletzt gehaltene Stunde: die letzte, deren Endzeit schon vorbei ist
  const letzteStunde = (() => {
    if (!isToday || !now) return null;
    const nowHM = formatHM(now);
    const vergangene = dayLessons.filter((l) => {
      const pt = data.periodTimes?.[l.period];
      return pt?.end && nowHM >= pt.end;
    });
    return vergangene.length ? vergangene[vergangene.length - 1] : null;
  })();


  const dayEvents = data.events
    .filter((e) => (e.endDate ? e.date <= selStr && selStr <= e.endDate : e.date === selStr))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  /* Für die Termine-Karte ohne Ferien und schulfreie Tage – sonst füllt sich die Karte
     in den Ferien mit „Sommerferien" an jedem einzelnen Tag. Das Briefing filtert genauso. */
  const terminEvents = dayEvents.filter((e) => e.type !== "ferien" && e.type !== "frei");

  /* Vollstaendige Liste behalten - die Karten schneiden selbst zu, sonst zeigt
     der Zaehler in der Dreierreihe hoechstens 6 statt der echten Zahl. */
  const alleOffenenTasks = (data.tasks || []).filter((t) => !t.done);
  const openTasks = alleOffenenTasks.slice(0, 6);

  const birthdays = data.students.filter((s) => s.birthday && s.birthday.slice(5) === selStr.slice(5));

  // Nächster Geburtstag ab dem gewählten Tag: Datum, Tage bis dahin und das erreichte Alter
  function birthdayInfo(s, ab) {
    if (!s.birthday) return null;
    const [by, bm, bd] = s.birthday.split("-").map(Number);
    if (!bm || !bd) return null;
    const ref = new Date(ab.getFullYear(), ab.getMonth(), ab.getDate());
    let next = new Date(ref.getFullYear(), bm - 1, bd);
    if (next < ref) next = new Date(ref.getFullYear() + 1, bm - 1, bd);
    const tage = Math.round((next - ref) / 86400000);
    return { next, tage, alter: by ? next.getFullYear() - by : null };
  }

  const kommendeGeburtstage = data.students
    .map((s) => ({ s, info: birthdayInfo(s, selectedDate) }))
    .filter((x) => x.info && x.info.tage > 0 && x.info.tage <= 21)
    .sort((a, b) => a.info.tage - b.info.tage)
    .slice(0, 4);

  const lastImport = data.settings?.fehlzeitenLastImport;
  const importInterval = data.settings?.fehlzeitenImportInterval ?? 7;
  const daysSinceLast = lastImport
    ? Math.floor((Date.now() - new Date(lastImport).getTime()) / 86400000)
    : null;
  const showImportReminder = daysSinceLast === null || daysSinceLast >= importInterval;
  const isColor = data.settings?.colorMode === true;

  /* Ein einziger Schlüssel mit dem Datum als Wert – nicht ein Schlüssel pro Tag,
     der sich über die Schuljahre im selben Speicher wie die Schülerfotos ansammelt. */
  const [briefingDismissed, setBriefingDismissed] = useState(() => {
    try { return localStorage.getItem("saidy_briefing_dismissed") === todayStr; } catch { return false; }
  });
  const [showAllBriefing, setShowAllBriefing] = useState(false);
  // Bleibt die PWA über Nacht offen (Tablet im Klassenraum), erscheint das Briefing am neuen Tag wieder
  useEffect(() => {
    let gesehen = null;
    try { gesehen = localStorage.getItem("saidy_briefing_dismissed"); } catch {}
    setBriefingDismissed(gesehen === todayStr);
    setShowAllBriefing(false);
  }, [todayStr]);
  function dismissBriefing() {
    try { localStorage.setItem("saidy_briefing_dismissed", todayStr); } catch {}
    setBriefingDismissed(true);
  }

  /* Wochenrueckblick - sichtbar Freitag ab 12:00 bis Sonntag Nacht.
     Pro Woche einmal ausblendbar; Schluessel enthaelt Jahr + KW, damit der Ausblendzustand
     naechste Woche automatisch zurueckgesetzt ist. */
  const woche = currentSchoolWeek(now || new Date());
  const wocheKey = `${woche.monday.getFullYear()}-W${String(woche.kw).padStart(2, "0")}`;
  const jetzt = now || new Date();
  const dow = jetzt.getDay(); // 0 So, 5 Fr, 6 Sa
  const stunde = jetzt.getHours();
  const istRueckblickZeit = (dow === 5 && stunde >= 12) || dow === 6 || dow === 0;
  const [rueckblickDismissed, setRueckblickDismissed] = useState(() => {
    try { return localStorage.getItem("saidy_weekReview_dismissed") === wocheKey; } catch { return false; }
  });
  useEffect(() => {
    let gesehen = null;
    try { gesehen = localStorage.getItem("saidy_weekReview_dismissed"); } catch {}
    setRueckblickDismissed(gesehen === wocheKey);
  }, [wocheKey]);
  function dismissRueckblick() {
    try { localStorage.setItem("saidy_weekReview_dismissed", wocheKey); } catch {}
    setRueckblickDismissed(true);
  }

  /* Wochenzahlen - alles zwischen Montag 00:00 und Sonntag 23:59 der aktuellen Woche.
     Genutzte Datumsvergleiche sind ISO-Strings (YYYY-MM-DD), also lexikografisch korrekt. */
  const wochenBericht = (() => {
    if (!istRueckblickZeit || rueckblickDismissed) return null;
    const mo = isoDate(woche.monday);
    const so = isoDate(addDays(woche.monday, 6));

    // Stundenzahl der Woche: gehaltene Unterrichtseinheiten (dayLessons-Aequivalent x 5 Tage).
    // Vereinfacht: pro Werktag mit Faechern zaehlen wir die Einheiten (nicht Bloecke).
    let stundenWoche = 0;
    for (let i = 0; i < 5; i++) {
      const tag = addDays(woche.monday, i);
      const key = DAYS[i];
      const slots = (data.timetable || []).filter((t) => t.day === key).sort((a, b) => a.period - b.period);
      // Bloecke desselben Fachs, die aufeinanderfolgen, zaehlen als eine Einheit
      let letzte = null, einheiten = 0;
      slots.forEach((s) => {
        if (letzte && letzte.fachId === s.fachId && s.period === letzte.period + 1) {
          // gleiche Doppelstunde, nicht zaehlen
        } else {
          einheiten++;
        }
        letzte = s;
      });
      // Ferien/frei abziehen
      const iso = isoDate(tag);
      const istFrei = (data.events || []).some((e) => (e.type === "ferien" || e.type === "frei") && e.date <= iso && iso <= (e.endDate || e.date));
      if (!istFrei) stundenWoche += einheiten;
    }

    const notenWoche = (data.grades || []).filter((g) => (g.date || "") >= mo && (g.date || "") <= so).length;
    const gespraecheWoche = (data.notes || []).filter((n) => n.type === "gespraech" && (n.date || "") >= mo && (n.date || "") <= so).length;
    const notizenWoche = (data.notes || []).filter((n) => n.type !== "gespraech" && (n.date || "") >= mo && (n.date || "") <= so).length;

    // Auffaellige Klassen: die drei mit den meisten Radar-Signalen (Kombinierte Werte)
    const klassenSignale = (data.classes || [])
      .map((c) => ({ klasse: c, sig: computeKlassenradar(data, c, isoDate(jetzt)) }))
      .filter((x) => x.sig.length)
      .sort((a, b) => b.sig.length - a.sig.length)
      .slice(0, 3);

    // Drei Kinder mit laengster Eintragsluecke (nur mit vorhandenen Kindern und Historie)
    const alleAktivitaeten = (id) => {
      const dates = [
        ...(data.notes || []).filter((n) => n.studentId === id).map((n) => n.date),
        ...(data.grades || []).filter((g) => g.studentId === id).map((g) => g.date),
      ].filter(Boolean).sort();
      return dates[dates.length - 1] || null;
    };
    const kinderLuecke = (data.students || [])
      .filter((s) => !s.deletedAt)
      .map((s) => ({ s, letzte: alleAktivitaeten(s.id) }))
      .filter((x) => x.letzte && x.letzte < mo)
      .map((x) => ({ ...x, tage: Math.floor((localDate(mo) - localDate(x.letzte)) / 86400000) }))
      .sort((a, b) => b.tage - a.tage)
      .slice(0, 3);

    // Ausblick naechste Woche: KAs + Termine (Mo bis So der Folgewoche)
    const nMo = isoDate(addDays(woche.monday, 7));
    const nSo = isoDate(addDays(woche.monday, 13));
    const kasNext = (data.faecher || [])
      .filter((f) => f.nextTestDate && f.nextTestDate >= nMo && f.nextTestDate <= nSo)
      .map((f) => ({ fach: f, cls: (data.classes || []).find((c) => c.id === f.classId) }))
      .filter((x) => x.cls);
    const termineNext = (data.events || [])
      .filter((e) => e.type !== "ferien" && e.type !== "frei" && e.date >= nMo && e.date <= nSo)
      .sort((a, b) => a.date.localeCompare(b.date));

    return { stundenWoche, notenWoche, gespraecheWoche, notizenWoche, klassenSignale, kinderLuecke, kasNext, termineNext, kw: woche.kw };
  })();

  /* Unterrichtstipp des Tages: waehlt deterministisch eine Karte pro Datum aus dem Pool
     (fester Grundstock + eigene aus data.settings.tippKartenEigene). Damit sich derselbe
     Tipp nach Reload nicht aendert, wird der Index aus dem ISO-Datum abgeleitet. */
  const eigeneKarten = data.settings?.tippKartenEigene || [];
  const alleTippKarten = [...TIPP_KARTEN, ...eigeneKarten];
  const tippsAn = data.settings?.tippsAn !== false;
  const tippDesTages = (() => {
    if (!tippsAn || !alleTippKarten.length) return null;
    const seed = todayStr.split("-").reduce((a, s) => a * 31 + parseInt(s, 10), 7);
    return alleTippKarten[Math.abs(seed) % alleTippKarten.length];
  })();
  const [tippSheetKarte, setTippSheetKarte] = useState(null);

  /* Zusammenhängender Briefing-Text: aus den Tagesdaten zu ganzen Sätzen zusammengesetzt.
     Läuft vollständig lokal – keine externe Verarbeitung. */
  const briefingSentences = (() => {
    if (!isToday) return [];
    const satz = [];
    const und = (arr) => (arr.length === 1 ? arr[0] : `${arr.slice(0, -1).join(", ")} und ${arr[arr.length - 1]}`);

    // 1. Begrüßung + Unterrichtstag
    const stunde = (now || new Date()).getHours();
    const gruss = stunde < 11 ? "Guten Morgen!" : stunde < 17 ? "Hallo!" : "Guten Abend!";
    if (!dayKey) {
      satz.push({ text: `${gruss} Heute ist Wochenende – kein Unterricht im Plan.` });
    } else if (!dayLessons.length) {
      satz.push({ text: `${gruss} Heute stehen keine Stunden im Plan.` });
    } else {
      const erste = dayLessons[0];
      const ersteFach = data.faecher.find((f) => f.id === erste.fachId);
      const ersteCls = ersteFach ? data.classes.find((c) => c.id === ersteFach.classId) : null;
      const start = data.periodTimes?.[erste.period]?.start;
      const wo = ersteCls ? ` in der ${ersteCls.name}` : "";
      const wann = start ? ` um ${start} Uhr${wo}` : wo;
      satz.push({
        text: dayLessons.length === 1
          ? `${gruss} Heute hast du eine Stunde${wann}.`
          : `${gruss} Heute stehen ${dayLessons.length} Stunden an – die erste${wann}.`,
      });
    }

    // 2. Anstehende Klassenarbeiten – nur wenn es zeitlich eng wird
    data.faecher
      .map((f) => ({ fach: f, cls: data.classes.find((c) => c.id === f.classId), cd: testCountdown(f, data.timetable, data.events) }))
      .filter((x) => x.cd && (x.cd.level === "krit" || x.cd.level === "warn"))
      .sort((a, b) => (a.cd.istHeute ? -1 : b.cd.istHeute ? 1 : a.cd.rem - b.cd.rem))
      .slice(0, 2)
      .forEach(({ fach, cls, cd }) => {
        const wo = `${fach.subject}${cls ? ` (${cls.name})` : ""}`;
        satz.push({
          text: cd.istHeute
            ? `Heute schreibt ${cls ? cls.name : "die Klasse"} „${cd.label}" in ${fach.subject}.`
            : `In ${wo} steht „${cd.label}" an – ${cd.lang}.`,
          urgent: cd.level === "krit",
        });
      });

    // 3. Termine des Tages
    const termine = dayEvents.filter((e) => e.type !== "ferien" && e.type !== "frei");
    if (termine.length) {
      satz.push({
        text: `Im Kalender: ${und(termine.map((e) => (e.time ? `${e.title} um ${e.time} Uhr` : e.title)))}.`,
      });
    }

    // 4. Geburtstage
    if (birthdays.length) {
      satz.push({
        text: birthdays.length === 1
          ? `${birthdays[0].name} hat heute Geburtstag 🎂`
          : `${und(birthdays.map((s) => s.name))} haben heute Geburtstag 🎂`,
      });
    }

    /* 5. Länger fehlende Kinder.
       Gezählt werden verschiedene Kalendertage, nicht Fehlzeit-Einträge – der WebUntis-Import
       legt pro Unterrichtsstunde einen Datensatz an, ein Krankheitstag ergäbe sonst „6 Tage".
       Der Entschuldigungsstatus steht bewusst NICHT hier: er ist sensibel und der
       Startbildschirm liegt im Klassenraum offen. Details per Tipp in der Klassenansicht. */
    const fensterStart = isoDate(addDays(localDate(todayStr), -4));
    const langFehlend = (() => {
      const byStudent = {};
      (data.absences || []).forEach((a) => {
        if (a.date < fensterStart || a.date > todayStr) return;
        if (!byStudent[a.studentId]) byStudent[a.studentId] = new Set();
        byStudent[a.studentId].add(a.date);
      });
      return Object.entries(byStudent)
        .map(([sid, dates]) => ({ student: data.students.find((s) => s.id === sid), tage: dates.size }))
        .filter((x) => x.student && x.tage >= 3)
        .sort((a, b) => b.tage - a.tage);
    })();
    if (langFehlend.length === 1) {
      const { student, tage } = langFehlend[0];
      satz.push({
        text: `${student.name} hat an ${tage} der letzten 5 Tage gefehlt.`,
        urgent: tage >= 4,
        action: () => onNavigate?.("klassen"),
      });
    } else if (langFehlend.length > 1) {
      satz.push({
        text: `${langFehlend.length} Kinder haben an mehreren der letzten Tage gefehlt.`,
        urgent: langFehlend.some((x) => x.tage >= 4),
        action: () => onNavigate?.("klassen"),
      });
    }

    // 6. Noch nicht erfasste Stunden
    const offeneStunden = (pendingLessons || []).length;
    if (offeneStunden) {
      satz.push({
        text: offeneStunden === 1
          ? "Eine Stunde von heute ist noch nicht erfasst."
          : `${offeneStunden} Stunden von heute sind noch nicht erfasst.`,
      });
    }

    /* Backup-Status und Förderziele stehen bewusst nicht im Briefing:
       Der Backup-Hinweis hat bereits ein eigenes Band über dem Dashboard,
       offene Förderziele sind kein Tagesgeschehen. */

    return satz;
  })();

  /* Dringendes zuerst, Begrüßung bleibt vorn. Standardmäßig nur die ersten drei Sätze –
     alles auf einmal liest zwischen Tür und Angel niemand. */
  const briefingSorted = briefingSentences.length
    ? [briefingSentences[0], ...briefingSentences.slice(1).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0))]
    : [];
  const briefingVisible = showAllBriefing ? briefingSorted : briefingSorted.slice(0, 3);
  const briefingHidden = briefingSorted.length - briefingVisible.length;

  /* Kennzahlen der oberen Kachelreihe – alles aus vorhandenen Daten, keine Platzhalter.
     Bei den Zielen zählen nur Förderziele (nicht die kurzlebigen Wochenziele) und nur
     solche aus dem letzten halben Jahr – ein vergessenes Ziel aus dem Vorjahr soll die
     Zahl nicht dauerhaft aufblähen. */
  const zielFenster = isoDate(addDays(new Date(), -183));
  const offeneZiele = (data.foerderZiele || []).filter(
    (z) => !z.doneAt && z.typ !== "wochen" && (z.createdAt || "") >= zielFenster
  );
  const zielKinder = new Set(offeneZiele.map((z) => z.studentId)).size;
  const offeneEntschuldigungen = (data.absences || []).filter(
    (a) => a.excuseStatus === "ausstehend" || a.excuseStatus === "eingereicht"
  ).length;

  /* Die Klassenangabe gehört zur Zahl der offenen Stunden – also zu heute,
     nicht zum gerade angetippten Wochentag. */
  const offeneKlassen = new Set((pendingLessons || []).map((p) => p.cls?.id).filter(Boolean)).size;

  const kacheln = [
    {
      icon: ClipboardCheck,
      label: "Stunden nachtragen",
      value: (pendingLessons || []).length,
      sub: (pendingLessons || []).length ? (offeneKlassen ? `in ${offeneKlassen} ${offeneKlassen === 1 ? "Klasse" : "Klassen"}` : "heute offen") : "alles erledigt",
      warn: !!(pendingLessons || []).length,
      /* Die Liste darunter erscheint nur am heutigen Tag – sonst bliebe der Tipp wirkungslos */
      onClick: () => {
        if (!(pendingLessons || []).length) return onNavigate?.("stundenplan");
        if (!isToday) setSelectedDate(new Date());
        setShowPending((v) => !v);
      },
    },
    {
      icon: FileText,
      label: "Entschuldigungen",
      value: offeneEntschuldigungen,
      sub: offeneEntschuldigungen ? "offen" : "keine offen",
      warn: offeneEntschuldigungen > 0,
      onClick: () => onNavigate?.("klassen"),
    },
    {
      icon: Target,
      label: "Förderziele",
      value: offeneZiele.length,
      sub: offeneZiele.length ? (zielKinder ? `bei ${zielKinder} ${zielKinder === 1 ? "Kind" : "Kindern"}` : "aktiv") : "keine aktiv",
      warn: false,
      onClick: () => onNavigate?.("klassen"),
    },
  ];

  /* Eine Unterrichtseinheit fuer die Anzeige aufbereiten. „Einheit" heisst: eine 45-Minuten-
     Stunde oder eine Doppelstunde (zwei aufeinanderfolgende Bloecke desselben Fachs).
     `startZeit` kommt vom ersten Block, `endZeit` vom letzten. */
  function lessonInfo(unit) {
    const fach = data.faecher.find((f) => f.id === unit.fachId);
    const cls = fach ? data.classes.find((c) => c.id === fach.classId) : null;
    const startPt = data.periodTimes?.[unit.firstPeriod];
    const endPt = data.periodTimes?.[unit.lastPeriod];
    const startZeit = startPt?.start || null;
    const endZeit = endPt?.end || null;
    const periodLabel = unit.firstPeriod === unit.lastPeriod
      ? `${unit.firstPeriod}.`
      : `${unit.firstPeriod}.–${unit.lastPeriod}.`;
    const topic = fach ? (data.lessonTopics || []).find((x) => x.fachId === fach.id && x.date === selStr) : null;
    const cd = fach ? testCountdown(fach, data.timetable, data.events) : null;
    let gehalten = null, gesamt = null;
    if (cd && cd.rem !== null && topic?.text) {
      /* Beide Seiten zählen Unterrichtseinheiten: ein Tag mit diesem Fach ist eine
         Einheit, ob einzelne 45 Minuten oder Doppelstunde. Das Thema wird pro Fach
         und Tag genau einmal notiert, passt also unmittelbar dazu.
         Groß-/Kleinschreibung und Leerzeichen bleiben außen vor, damit „Bruchrechnung"
         und „bruchrechnung " nicht als zwei Themen gelten. */
      const gleich = (t) => (t || "").trim().toLowerCase();
      const thema = gleich(topic.text);
      gehalten = (data.lessonTopics || []).filter(
        (x) => x.fachId === fach.id && x.date <= selStr && gleich(x.text) === thema
      ).length;
      gesamt = gehalten + cd.rem;
    }
    const pct = gesamt ? Math.round((gehalten / gesamt) * 100) : cd && cd.rem !== null ? Math.max(0, 100 - Math.min(100, Math.round((cd.rem / 8) * 100))) : null;
    return {
      fach, cls, startZeit, endZeit, periodLabel, topic, cd, gehalten, gesamt, pct,
      offen: isToday && fach && (pendingLessons || []).some((p) => p.fach.id === fach.id),
      /* Faellt die zuletzt gehaltene 45-Minuten-Stunde in irgendeinen Block dieser
         Einheit, wird die ganze Einheit als „zuletzt" markiert - bei der Doppelstunde
         genauso wie bei einer einzelnen Stunde. */
      istLetzte: isToday && fach && !!letzteStunde && unit.slots.some((s) => s.id === letzteStunde.id),
    };
  }

  return (
    <div className="space-y-3">
      {/* Zeile 1: Wordmark + Icon-Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 select-none">
          <span className="w-7 h-7 rounded-lg akzent-ton flex items-center justify-center shrink-0" aria-hidden="true">
            <span className="text-sm font-bold akzent-text leading-none">S</span>
          </span>
          <span className="text-[11px] font-bold tracking-[0.22em] uppercase akzent-text">Saidy</span>
        </div>
        <div className="flex items-center gap-1.5">
          {showImportReminder && (
            <button
              onClick={() => onOpenUntisImport?.()}
              className="relative w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
              title={daysSinceLast === null ? "Fehlzeiten noch nie importiert" : `Fehlzeiten-Import fällig (vor ${daysSinceLast} Tagen)`}
            >
              <Upload size={15} />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 border-2 border-[#F4F1E8]" />
            </button>
          )}
          {isToday && !!(pendingLessons || []).length && (
            <button
              onClick={() => setShowPending((v) => !v)}
              className="relative w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
              title={`${pendingLessons.length} ${pendingLessons.length === 1 ? "Stunde" : "Stunden"} nachtragen`}
            >
              <ClipboardCheck size={15} />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 border-2 border-[#F4F1E8]" />
            </button>
          )}
          <button
            onClick={() => update((d) => { d.settings = { ...d.settings, colorMode: !isColor }; return d; })}
            title={isColor ? "Mono-Modus" : "Bring Farbe in mein Leben"}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors shrink-0 ${isColor ? "bg-stone-100 hover:bg-stone-200 text-stone-400" : "akzent-ton akzent-text"}`}
          >
            <Sparkles size={14} />
          </button>
        </div>
      </div>

      {/* Begrüßung: kleine Zeile über dem großen Wochentag – wie im Entwurf */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-stone-400 leading-none mb-1">
            {(() => {
              const h = (now || new Date()).getHours();
              return h < 11 ? "Guten Morgen," : h < 17 ? "Hallo," : "Guten Abend,";
            })()}
          </p>
          <h1 className="text-2xl font-bold tracking-tight leading-none" style={{ color: "var(--ink)" }}>
            {selectedDate.toLocaleDateString("de-DE", { weekday: "long" })}
            <span className="text-stone-300 font-semibold text-lg ml-2">
              {selectedDate.toLocaleDateString("de-DE", { day: "numeric", month: "long" })}
            </span>
          </h1>
        </div>
        {data.settings?.showFerienCountdown && (() => {
          const cd = nextFerienCountdown(data.events, data.settings?.countdownSchooldaysOnly);
          if (!cd) return null;
          if (cd.inFerien) {
            return <span className="text-xs text-stone-400 shrink-0 pb-0.5">🌴 {cd.title}</span>;
          }
          return (
            <span className="text-xs text-stone-400 shrink-0 pb-0.5">
              <span className="font-semibold text-stone-600">{cd.days}</span>{" "}
              {data.settings?.countdownSchooldaysOnly
                ? cd.days === 1 ? "Schultag" : "Schultage"
                : cd.days === 1 ? "Tag" : "Tage"}{" "}
              bis {cd.title}
            </span>
          );
        })()}
      </div>

      {/* Wochenrueckblick: nur zwischen Freitag 12 Uhr und Sonntag Nacht sichtbar,
          per X pro Woche ausblendbar. */}
      {wochenBericht && (
        <Card className="px-4 py-3.5 border-l-2 akzent-rand">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide akzent-text">Wochenrückblick · KW {wochenBericht.kw}</span>
            <button
              onClick={dismissRueckblick}
              className="w-11 h-11 -mr-3 -mt-3 flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0"
              aria-label="Wochenrückblick ausblenden"
            >
              <X size={16} />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-stone-700 mb-3">
            Diese Woche: <span className="font-semibold">{wochenBericht.stundenWoche}</span> {wochenBericht.stundenWoche === 1 ? "Stunde" : "Stunden"} gehalten,{" "}
            <span className="font-semibold">{wochenBericht.notenWoche}</span> {wochenBericht.notenWoche === 1 ? "Note" : "Noten"} vergeben,{" "}
            <span className="font-semibold">{wochenBericht.gespraecheWoche}</span> {wochenBericht.gespraecheWoche === 1 ? "Gespräch" : "Gespräche"} geführt und{" "}
            <span className="font-semibold">{wochenBericht.notizenWoche}</span> {wochenBericht.notizenWoche === 1 ? "Notiz" : "Notizen"} erfasst.
          </p>

          {(wochenBericht.klassenSignale.length > 0 || wochenBericht.kinderLuecke.length > 0) && (
            <div className="mb-3 pt-2 border-t border-stone-100">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 mb-1.5">Aufgefallen</div>
              {wochenBericht.klassenSignale.length > 0 && (
                <div className="text-xs text-stone-700 mb-1">
                  Klassen mit Signalen:{" "}
                  {wochenBericht.klassenSignale.map(({ klasse, sig }, i) => (
                    <React.Fragment key={klasse.id}>
                      {i > 0 && ", "}
                      <span className="font-semibold">{klasse.name}</span>
                      <span className="text-stone-400"> ({sig.length})</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              {wochenBericht.kinderLuecke.length > 0 && (() => {
                /* Bei zwei Kindern mit gleichem Vornamen den vollen Namen anzeigen -
                   sonst steht "Jenny (3 Tage), Jenny (3 Tage)" und man weiss nicht wer. */
                const vornamen = wochenBericht.kinderLuecke.map(({ s }) => s.name.split(" ")[0]);
                const label = (name) => vornamen.filter((v) => v === name.split(" ")[0]).length > 1 ? name : name.split(" ")[0];
                return (
                  <div className="text-xs text-stone-700">
                    Länger kein Eintrag:{" "}
                    {wochenBericht.kinderLuecke.map(({ s, tage }, i) => (
                      <React.Fragment key={s.id}>
                        {i > 0 && ", "}
                        <span className="font-semibold">{label(s.name)}</span>
                        <span className="text-stone-400"> ({tage} Tage)</span>
                      </React.Fragment>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {(wochenBericht.kasNext.length > 0 || wochenBericht.termineNext.length > 0) && (
            <div className="pt-2 border-t border-stone-100">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-500 mb-1.5">Nächste Woche</div>
              {wochenBericht.kasNext.length > 0 && (
                <div className="text-xs text-stone-700 mb-1">
                  Klassenarbeiten:{" "}
                  {wochenBericht.kasNext.map(({ fach, cls }, i) => (
                    <React.Fragment key={fach.id}>
                      {i > 0 && ", "}
                      <span className="font-semibold">{cls.name} {fach.subject}</span>
                      <span className="text-stone-400"> ({localDate(fach.nextTestDate).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })})</span>
                    </React.Fragment>
                  ))}
                </div>
              )}
              {wochenBericht.termineNext.length > 0 && (
                <div className="text-xs text-stone-700">
                  Termine:{" "}
                  {wochenBericht.termineNext.slice(0, 3).map((e, i) => (
                    <React.Fragment key={e.id}>
                      {i > 0 && ", "}
                      <span className="font-semibold">{e.title}</span>
                      <span className="text-stone-400"> ({localDate(e.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" })})</span>
                    </React.Fragment>
                  ))}
                  {wochenBericht.termineNext.length > 3 && <span className="text-stone-400"> · +{wochenBericht.termineNext.length - 3}</span>}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Kennzahl-Kacheln - drei kompakte Kacheln nebeneinander, Inhalt waagerecht
          und senkrecht zentriert. Der Nullfall (Haken) ist niedriger als der
          Zahlfall (Zahl + Unterzeile); ohne justify-center saesse der kuerzere
          Inhalt oben und liesse unten Luft, weil das Raster alle Kacheln auf die
          Hoehe der hoechsten zieht. Die Abstaende kommen aus gap statt aus
          Einzelmargins, damit der Rhythmus in beiden Faellen gleich bleibt. */}
      <div className="grid grid-cols-3 gap-2">
        {kacheln.map((k) => {
          const Icon = k.icon;
          const aktiv = k.warn && k.value > 0;
          return (
            <button
              key={k.label}
              onClick={k.onClick}
              className="w-full h-full text-center bg-white rounded-2xl border border-stone-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-stone-200 transition-colors flex flex-col items-center justify-center gap-1 px-2 py-3"
            >
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${aktiv && isColor ? "bg-amber-100" : "akzent-ton"}`}>
                <Icon size={13} className={aktiv && isColor ? "text-amber-700" : "akzent-text"} />
              </span>
              {/* Zwei Zeilen erlaubt: „Entschuldigungen" und „Stunden nachtragen"
                  wuerden auf Handybreite sonst abgeschnitten. */}
              <div className="text-[10px] text-stone-500 leading-tight line-clamp-2">{k.label}</div>
              {/* Kacheln mit Wert 0 zeigen einen kleinen Haken statt einer riesigen 0 –
                  eine 0 wirkte sonst wie ein Fehler- oder Leerzustand. */}
              {k.value === 0 ? (
                <div className="flex items-center justify-center gap-1 text-stone-400">
                  <Check size={14} strokeWidth={2.5} />
                  <span className="text-[11px]">nichts offen</span>
                </div>
              ) : (
                <>
                  <div className={`text-[22px] font-bold leading-none tabular-nums ${aktiv && isColor ? "text-amber-600" : "akzent-text"}`}>
                    {k.value}
                  </div>
                  <div className="text-[10px] text-stone-400 leading-tight line-clamp-1 w-full">{k.sub}</div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Morgen-Briefing – lokal erzeugte Tageszusammenfassung */}
      {isToday && !briefingDismissed && !!briefingSorted.length && (
        <Card className="px-4 py-3.5 border-l-2 akzent-rand">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide akzent-text">Heute im Blick</span>
            <button
              onClick={dismissBriefing}
              className="w-11 h-11 -mr-3 -mt-3 flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0"
              aria-label="Briefing für heute ausblenden"
            >
              <X size={16} />
            </button>
          </div>
          <p className="text-sm leading-relaxed text-stone-700">
            {briefingVisible.map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && " "}
                {s.action ? (
                  <button
                    onClick={s.action}
                    className={`text-left underline underline-offset-2 decoration-stone-400 hover:decoration-stone-600 ${s.urgent ? "text-red-700 font-medium" : "text-stone-700"}`}
                  >
                    {s.text}
                  </button>
                ) : (
                  <span className={s.urgent ? "text-red-700 font-medium" : ""}>{s.text}</span>
                )}
              </React.Fragment>
            ))}
          </p>
          {(briefingHidden > 0 || showAllBriefing) && (
            <button
              onClick={() => setShowAllBriefing((v) => !v)}
              className="mt-1.5 text-xs akzent-text hover:underline min-h-[44px] flex items-center"
            >
              {showAllBriefing ? "weniger anzeigen" : `+ ${briefingHidden} weitere`}
            </button>
          )}
        </Card>
      )}

      {/* Aufklappbare Liste der nachzutragenden Stunden */}
      {isToday && showPending && !!(pendingLessons || []).length && (
        <Card className="p-3">
          <div className="text-xs font-medium text-stone-500 mb-2">Noch nicht erfasst</div>
          <ul className="space-y-1.5">
            {pendingLessons.map((p) => (
              <li key={p.key} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-stone-400 w-11 shrink-0">{p.start}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isColor ? p.fach.color : "#C0BBA8" }} />
                <span className="flex-1 text-stone-700 truncate">
                  {p.cls?.name} – {p.fach.subject}
                  {p.anzahl > 1 && <span className="text-stone-400"> · {p.anzahl} Stunden</span>}
                </span>
                <button
                  onClick={() => { setCaptureLesson({ fach: p.fach, cls: p.cls, date: todayStr }); setShowPending(false); }}
                  className="shrink-0 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg"
                >
                  Erfassen
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Wochentagsleiste – schlank, kein Rahmen */}
      <div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setSelectedDate((d) => addDays(d, -7))} aria-label="Vorherige Woche" className="w-11 h-11 -my-3 text-stone-300 hover:text-stone-600 shrink-0 flex items-center justify-center">
            <ChevronLeft size={15} />
          </button>
          <div className="flex-1 grid grid-cols-7">
            {week.map((d, i) => {
              const active = isoDate(d) === selStr;
              const isTodayCol = isoDate(d) === todayStr;
              return (
                <button key={i} onClick={() => setSelectedDate(d)} className="flex flex-col items-center gap-0.5 py-0.5 rounded-lg">
                  <span className={`text-[10px] ${isTodayCol ? "text-red-400" : "text-stone-400"}`}>{WEEKDAY_LABELS[i]}</span>
                  <span
                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium ${
                      active ? "akzent-flaeche text-white" : isTodayCol ? "text-red-400" : "text-stone-600"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setSelectedDate((d) => addDays(d, 7))} aria-label="Naechste Woche" className="w-11 h-11 -my-3 text-stone-300 hover:text-stone-600 shrink-0 flex items-center justify-center">
            <ChevronRight size={15} />
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setSelectedDate(new Date())} className="text-[11px] akzent-text hover:underline ml-7 mt-0.5">
            ↩ Heute
          </button>
        )}
      </div>

      {/* Abschnittsüberschrift mit Akzentstrich + Sprung in den Stundenplan */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          <h2 className="text-base font-bold text-stone-800 leading-tight">
            {isToday ? "Dein Unterricht heute" : "Dein Unterricht"}
          </h2>
          <span className="block w-7 h-[3px] rounded-full akzent-flaeche mt-1" />
        </div>
        <button
          onClick={() => onNavigate?.("stundenplan")}
          className="shrink-0 flex items-center gap-1.5 bg-white border border-stone-200 rounded-full pl-2.5 pr-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-300 transition-colors"
        >
          <CalendarDays size={13} className="text-stone-400" />
          Stundenplan
        </button>
      </div>

      {/* Stunden – jede als eigene Karte */}
      {!dayKey && <Card className="px-3 py-3 text-xs text-stone-500">Wochenende – kein regulärer Unterricht</Card>}
      {dayKey && !dayUnits.length && <Card className="px-3 py-3 text-xs text-stone-500">Keine Stunden im Plan</Card>}
      <div className="space-y-2">
        {(showAllLessons ? dayUnits : dayUnits.slice(0, 4)).map((unit) => {
          const { fach, cls, startZeit, endZeit, periodLabel, topic, cd, gehalten, gesamt, pct, offen, istLetzte } = lessonInfo(unit);
          const detailOpen = openTestDetail === unit.id;
          const barCol = !cd || !isColor ? "var(--oliv)" : cd.level === "krit" ? "#ef4444" : cd.level === "warn" ? "#f59e0b" : "var(--oliv)";
          const istDoppel = unit.slots.length > 1;
          /* Zwei getrennte visuelle Rollen, damit man auf einen Blick erkennt, was
             Aufgabe (Amber-Rand links) und was reine Orientierung ist (dezenter
             Akzentton als Hintergrund). Ist die gerade eben gehaltene Stunde auch
             noch offen, gewinnt Amber. */
          const zeigeLetzte = istLetzte && !offen;
          return (
            <Card key={unit.id} className={`overflow-hidden p-0 ${zeigeLetzte ? "akzent-ton" : ""}`}>
              <div
                className={`flex items-stretch border-l-[3px] ${offen ? (isColor ? "border-l-amber-500" : "border-l-[var(--oliv)]") : "border-l-transparent"}`}
              >
                {/* Zeitspalte – bei Doppelstunde durchgehend von 07:55 bis 09:30 */}
                <div className="shrink-0 w-[3.5rem] py-2.5 pl-2 pr-1">
                  <div className="text-[13px] font-semibold text-stone-800 tabular-nums leading-tight whitespace-nowrap">
                    {startZeit || periodLabel}
                  </div>
                  {endZeit && <div className="text-[11px] text-stone-400 tabular-nums leading-tight whitespace-nowrap">–{endZeit}</div>}
                  {istDoppel && <div className="text-[9px] uppercase tracking-wide text-stone-400 mt-0.5">Doppel</div>}
                </div>

                <div className="w-px bg-stone-100 my-2.5 shrink-0" />

                {/* Klasse, Fach, Einheit – öffnet das Fach */}
                <button
                  onClick={() => fach && onOpenFach?.(fach.id)}
                  disabled={!fach}
                  className="shrink-0 w-[6.8rem] text-left py-2.5 px-1.5 disabled:cursor-default"
                  aria-label={fach && cls ? `${cls.name} – ${fach.subject} öffnen` : undefined}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {cls && (
                      <span className="shrink-0 text-[10px] font-bold px-1 py-0.5 rounded bg-stone-100 text-stone-600 leading-none">
                        {cls.name}
                      </span>
                    )}
                    <span className="font-bold text-stone-800 text-[12px] truncate">{fach?.subject || "—"}</span>
                  </div>
                  {/* Der KA-Titel steht nur da, wenn rechts kein Thema konkurriert -
                      sonst kaempfen zwei Textzeilen um dieselbe Kartenbreite. Beim
                      Aufklappen des Balkens ist er ohnehin wieder zu sehen. */}
                  {cd?.label && !topic && <div className="text-[10px] text-stone-400 mt-1 leading-tight line-clamp-2 break-words">{cd.label}</div>}
                </button>

                {/* Thema + Lernfortschritt */}
                <div className="flex-1 min-w-0 py-2.5 pr-1">
                  {topic ? (
                    <div className="text-[11px] text-stone-500 truncate mb-1.5">Thema: {topic.text}</div>
                  ) : (
                    <div className="text-[11px] text-stone-300 truncate mb-1.5">Kein Thema notiert</div>
                  )}
                  {cd && pct !== null && (
                    <button
                      onClick={() => setOpenTestDetail(detailOpen ? null : unit.id)}
                      className="w-full text-left"
                      aria-label={`${cd.label} – Details ${detailOpen ? "ausblenden" : "anzeigen"}`}
                    >
                      {/* Fortschrittsbalken - schmale Schiene mit farbiger Fuellung.
                          Kein Slider-Knubbel: der Balken ist nicht ziehbar, ein Knubbel
                          weckt falsche Erwartungen und sitzt bei pct=0 halb links neben
                          der leeren Schiene, was nach Renderfehler aussieht. */}
                      <div className="relative h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--linie)" }}>
                        <div className="absolute inset-y-0 left-0 rounded-full transition-[width]" style={{ width: `${pct}%`, backgroundColor: barCol }} />
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-1.5">
                        <span className="text-[10px] text-stone-400 shrink-0 tabular-nums">
                          {gesamt !== null ? (
                            <><span className="font-bold" style={{ color: barCol }}>{gehalten}</span> / {gesamt} Stunden</>
                          ) : (
                            <span className="font-bold" style={{ color: barCol }}>{cd.rem === 0 ? "letzte Stunde" : `noch ${cd.rem}`}</span>
                          )}
                        </span>
                        <span className="text-[10px] truncate text-right leading-tight" style={{ color: barCol }}>
                          {/* Links steht schon die Restzahl - hier reicht Termin oder „heute". */}
                          {cd.istHeute ? "Arbeit heute" : `Arbeit am ${cd.datum}`}
                        </span>
                      </div>
                      {detailOpen && (
                        <div className="mt-1.5 text-[10px] text-stone-500">
                          {cd.label} · {cd.istHeute ? "heute" : cd.datum}
                          {cd.rem !== null && ` · ${cd.rem === 0 ? "keine Übungsstunde mehr" : `${cd.rem} ${cd.rem === 1 ? "Übungsstunde" : "Übungsstunden"} übrig`}`}
                        </div>
                      )}
                    </button>
                  )}
                </div>

                {/* Schnellerfassung */}
                {fach && cls && (
                  <button
                    onClick={() => setCaptureLesson({ fach, cls, date: selStr })}
                    className={`shrink-0 w-9 flex items-center justify-center transition-colors ${
                      offen ? (isColor ? "text-amber-600" : "text-stone-700 font-semibold") : "text-stone-300 hover:text-stone-500"
                    }`}
                    aria-label="Stunde erfassen"
                    title="Stunde erfassen"
                  >
                    {offen ? <ClipboardCheck size={16} /> : <ChevronRight size={16} />}
                  </button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {dayUnits.length > 4 && (
        <button
          onClick={() => setShowAllLessons((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-stone-500 hover:akzent-text transition-colors"
        >
          {showAllLessons ? "Weniger anzeigen" : `Alle ${dayUnits.length} Stunden ansehen`}
          <ChevronDown size={14} className={showAllLessons ? "rotate-180 transition-transform" : "transition-transform"} />
        </button>
      )}

      {/* Termine, Geburtstage, Aufgaben - auf Handy vollbreit untereinander,
          auf Desktop in einer Dreierreihe. */}
      <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:items-stretch">
        {/* Termine */}
        <Card className="px-3 py-3 flex flex-col">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-5 h-5 rounded bg-stone-100 flex items-center justify-center shrink-0">
              <CalendarDays size={12} className="text-stone-500" />
            </span>
            <span className="text-xs font-semibold text-stone-700">Termine</span>
          </div>
          {terminEvents.length ? (
            <ul className="space-y-1.5">
              {terminEvents.slice(0, 3).map((e) => (
                <li key={e.id} className="min-w-0 flex items-center gap-2">
                  <div className="text-xs text-stone-700 truncate leading-tight flex-1">{e.title}</div>
                  {e.time && <div className="text-[11px] text-stone-400 tabular-nums shrink-0">{e.time}</div>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-400">Nichts geplant</p>
          )}
          <button onClick={() => onNavigate?.("kalender")} className="mt-2 py-1.5 -mx-1 px-1 text-xs text-stone-500 hover:text-stone-700 text-left">
            Alle Termine →
          </button>
        </Card>

        {/* Geburtstage */}
        <Card className="px-3 py-3 flex flex-col">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-5 h-5 rounded bg-stone-100 flex items-center justify-center shrink-0">
              <PartyPopper size={12} className="text-stone-500" />
            </span>
            <span className="text-xs font-semibold text-stone-700">Geburtstage</span>
          </div>
          {birthdays.length || kommendeGeburtstage.length ? (
            <ul className="space-y-1.5">
              {birthdays.slice(0, 2).map((s) => {
                const info = birthdayInfo(s, selectedDate);
                return (
                  <li key={s.id} className="flex items-center gap-2 min-w-0">
                    <StudentAvatar student={s} size={20} />
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="text-xs font-medium text-stone-800 truncate leading-tight flex-1">{s.name.split(" ")[0]}</span>
                      {info?.alter != null && <span className="text-[11px] text-stone-400 shrink-0">{info.alter} J.</span>}
                    </div>
                  </li>
                );
              })}
              {kommendeGeburtstage.slice(0, birthdays.length ? 1 : 3).map(({ s, info }) => (
                <li key={s.id} className="flex items-center gap-2 min-w-0">
                  <StudentAvatar student={s} size={20} />
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="text-xs text-stone-600 truncate leading-tight flex-1">{s.name.split(" ")[0]}</span>
                    <span className="text-[11px] text-stone-400 tabular-nums shrink-0">
                      {info.next.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-400">Keine in 3 Wochen</p>
          )}
          <button onClick={() => onNavigate?.("klassen")} className="mt-2 py-1.5 -mx-1 px-1 text-xs text-stone-500 hover:text-stone-700 text-left">
            Alle Geburtstage →
          </button>
        </Card>

        {/* Aufgaben */}
        <Card className="px-3 py-3 flex flex-col">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-5 h-5 rounded bg-stone-100 flex items-center justify-center shrink-0">
              <ListChecks size={12} className="text-stone-500" />
            </span>
            <span className="text-xs font-semibold text-stone-700">To-dos</span>
            {!!alleOffenenTasks.length && <span className="ml-auto text-[11px] text-stone-400 shrink-0">{alleOffenenTasks.length}</span>}
          </div>
          {openTasks.length ? (
            <ul className="space-y-1.5">
              {openTasks.slice(0, 3).map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <button
                    onClick={() => update((d) => { const task = d.tasks.find((x) => x.id === t.id); if (task) task.done = !task.done; return d; })}
                    className="w-9 h-9 -m-2 shrink-0 flex items-center justify-center"
                    aria-label={`"${t.title}" als erledigt markieren`}
                  >
                    <span className="w-4 h-4 rounded-full border-2 block" style={{ borderColor: isColor ? t.color : "#A8A29E" }} />
                  </button>
                  <span className="text-xs text-stone-700 leading-tight line-clamp-2 pt-0.5">{t.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-400">Nichts offen</p>
          )}
          <button onClick={() => onNavigate?.("aufgaben")} className="mt-2 py-1.5 -mx-1 px-1 text-xs text-stone-500 hover:text-stone-700 text-left">
            Alle Aufgaben →
          </button>
        </Card>
      </div>

      {/* Klassenradar - listet Klassen mit Auffaelligkeitssignalen. Zeigt sich nur,
          wenn mindestens eine Klasse ein Signal hat; sonst verschwindet die ganze Karte. */}
      {(() => {
        const radar = (data.classes || [])
          .map((c) => ({ klasse: c, signale: computeKlassenradar(data, c, todayStr) }))
          .filter((x) => x.signale.length)
          .sort((a, b) => {
            const rang = { krit: 0, warn: 1 };
            const ra = rang[a.signale[0].level] ?? 9;
            const rb = rang[b.signale[0].level] ?? 9;
            return ra - rb;
          });
        if (!radar.length) return null;
        return (
          <Card className="px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">Klassenradar</span>
            </div>
            <ul className="divide-y divide-stone-100">
              {radar.map(({ klasse, signale }) => {
                const erst = signale[0];
                const rest = signale.length - 1;
                const dotCls = erst.level === "krit"
                  ? (isColor ? "bg-red-500" : "bg-stone-600")
                  : (isColor ? "bg-amber-500" : "bg-stone-400");
                return (
                  <li key={klasse.id}>
                    <button
                      onClick={() => onOpenKlassenDashboard?.(klasse.id)}
                      className="w-full flex items-center gap-2 py-2 text-left"
                      aria-label={`${klasse.name}: ${erst.kurz}${rest ? ` und ${rest} weitere` : ""}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />
                      <span className="shrink-0 text-[11px] font-bold text-stone-700 w-8">{klasse.name}</span>
                      <span className="flex-1 text-xs text-stone-700 truncate">{erst.kurz}</span>
                      {rest > 0 && <span className="text-[10px] text-stone-400 shrink-0">+{rest}</span>}
                      <ChevronRight size={12} className="text-stone-300 shrink-0" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })()}

      {/* Weitere Karten – Reihenfolge aus den Einstellungen */}
      {(() => {
        const sections = {
          dienste: (
            <Card className="px-3 py-2.5 h-full">
              <div className="flex items-center justify-between mb-1.5">
                <button onClick={() => onNavigate?.("klassen", "dienste")} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  Dienste <ChevronRight size={10} />
                </button>
                <span className="text-[10px] text-stone-400">{currentSchoolWeek().label}</span>
              </div>
              {(() => {
                const alleDienste = data.duties || [];
                if (!alleDienste.length) {
                  return <p className="text-xs text-stone-500">Keine Dienste angelegt</p>;
                }
                return (
                  <div className="space-y-2">
                    {data.classes.map((c) => {
                      const cDuties = alleDienste.filter((d) => d.classId === c.id);
                      if (!cDuties.length) return null;
                      const cStudents = data.students.filter((s) => s.classId === c.id);
                      const { map } = computeDutyAssignments(cDuties, cStudents);
                      return (
                        <div key={c.id}>
                          <div className="text-[10px] font-medium text-stone-400 mb-0.5">{c.name}</div>
                          <ul className="space-y-1">
                            {cDuties.map((duty) => {
                              const kinder = (map[duty.id] || [])
                                .map((id) => data.students.find((s) => s.id === id))
                                .filter(Boolean);
                              return (
                                <li key={duty.id} className="flex items-start gap-1.5 text-xs">
                                  <span className="w-1 h-3.5 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: isColor ? duty.color : "#4F5844" }} />
                                  <span className="text-stone-700 shrink-0">{duty.name}</span>
                                  <span className="flex-1 text-right text-stone-400 truncate">
                                    {kinder.length ? kinder.map((s) => s.name.split(" ")[0]).join(", ") : "—"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </Card>
          ),
          fehlzeiten: (() => {
            const absences = (data.absences || []);
            const ausstehend = absences.filter((a) => a.excuseStatus === "ausstehend" || a.excuseStatus === "eingereicht");
            if (!absences.length) return null;
            const byStudent = {};
            ausstehend.forEach((a) => {
              if (!byStudent[a.studentId]) byStudent[a.studentId] = [];
              byStudent[a.studentId].push(a);
            });
            const studentEntries = Object.entries(byStudent).map(([sid, as]) => ({
              student: data.students.find((s) => s.id === sid),
              absences: as.sort((a, b) => b.date.localeCompare(a.date)),
            })).filter((e) => e.student).sort((a, b) => a.student.name.localeCompare(b.student.name, "de"));
            return (
              <Card className="px-3 py-2.5 h-full">
                <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500 mb-1.5">
                  Entschuldigungen
                  {ausstehend.length > 0 && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{ausstehend.length}</span>}
                </div>
                {!studentEntries.length
                  ? <p className="text-xs text-stone-500">Alle erledigt 👍</p>
                  : (
                    <ul className="divide-y divide-stone-100">
                      {studentEntries.slice(0, 4).map(({ student, absences: sa }) => (
                        <li key={student.id} className="py-1.5 flex items-center gap-1.5 text-xs">
                          <StudentAvatar student={student} size={18} />
                          <span className="flex-1 text-stone-700 truncate">{student.name.split(" ")[0]}</span>
                          <span className="text-amber-700 font-medium shrink-0">{sa.length}×</span>
                        </li>
                      ))}
                      {studentEntries.length > 4 && <li className="pt-1 text-[10px] text-stone-400">+{studentEntries.length - 4} weitere</li>}
                    </ul>
                  )}
              </Card>
            );
          })(),
        };

        const gespeichert = data.settings?.dashboardOrder || Object.keys(DASHBOARD_SECTIONS);
        const order = [
          ...gespeichert.filter((k) => sections[k]),
          ...Object.keys(sections).filter((k) => !gespeichert.includes(k) && sections[k]),
        ];
        if (!order.length) return null;

        return (
          <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:items-start">
            {order.map((key) => (sections[key] ? <div key={key}>{sections[key]}</div> : null))}
          </div>
        );
      })()}

      {/* Unterrichtstipp des Tages - dezent am Ende der Uebersicht. Klick oeffnet
          das Detail-Sheet mit Warum, Umsetzung und einem "Naechster Tipp"-Knopf. */}
      {tippDesTages && (
        <button
          onClick={() => setTippSheetKarte(tippDesTages)}
          className="w-full text-left flex items-center gap-3 bg-white rounded-2xl border border-stone-100 px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-stone-200 transition-colors"
        >
          <span className="w-9 h-9 rounded-lg akzent-ton flex items-center justify-center shrink-0">
            <Lightbulb size={16} className="akzent-text" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 leading-none">Unterrichtstipp des Tages</div>
            <div className="text-sm font-medium text-stone-800 mt-1 leading-snug line-clamp-1">{tippDesTages.titel}</div>
            <div className="text-[11px] text-stone-500 italic mt-0.5 line-clamp-1">„{tippDesTages.merksatz}"</div>
          </div>
          <ChevronRight size={14} className="text-stone-300 shrink-0" />
        </button>
      )}

      {tippSheetKarte && (
        <TippKartenSheet
          karte={tippSheetKarte}
          alleKarten={alleTippKarten}
          onNaechste={() => {
            const andere = alleTippKarten.filter((k) => k.id !== tippSheetKarte.id);
            if (!andere.length) return;
            setTippSheetKarte(andere[Math.floor(Math.random() * andere.length)]);
          }}
          onClose={() => setTippSheetKarte(null)}
        />
      )}

    </div>
  );
}

/* ---------- Klassen & Schüler ---------- */

function NewClassModal({ onSave, onClose }) {
  const [name, setName] = useState("");

  function save() {
    if (!name.trim()) return;
    onSave(name.trim());
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-stone-800">Neue Klasse</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>
        <Field label="Klasse">
          <input
            className={inputCls} placeholder="z. B. 7c" value={name} autoFocus maxLength={30}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
          />
        </Field>
        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={save} className="flex-1 justify-center">Klasse anlegen</Button>
        </div>
      </div>
    </div>
  );
}

/* Fach hinzufügen/bearbeiten – Klasse + Fachbezeichnung + Farbe + Raum, wie bei elly */
function FachModal({ data, initial, onSave, onClose }) {
  const [classId, setClassId] = useState(initial?.classId || "");
  const [newClassName, setNewClassName] = useState("");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [customSubject, setCustomSubject] = useState(!initial);
  const [color, setColor] = useState(initial?.color || nextPaletteColor(data.subjectColors));
  const [room, setRoom] = useState(initial?.room || "");
  const [weights, setWeights] = useState(initial?.weights || DEFAULT_WEIGHTS);
  const [nextTestDate, setNextTestDate] = useState(initial?.nextTestDate || "");
  const [nextTestTitle, setNextTestTitle] = useState(initial?.nextTestTitle || "");

  const existingSubjects = Array.from(new Set(data.faecher.map((f) => f.subject))).filter(Boolean).sort((a, b) => a.localeCompare(b, "de"));

  function pickSubject(s) {
    setSubject(s);
    setCustomSubject(false);
    if (data.subjectColors?.[s] && !initial) setColor(data.subjectColors[s]);
  }

  function save() {
    const finalClassName = classId === "__new__" ? newClassName.trim() : null;
    if (classId !== "__new__" && !classId) return;
    if (classId === "__new__" && !finalClassName) return;
    if (!subject.trim()) return;
    onSave({ classId: classId === "__new__" ? null : classId, newClassName: finalClassName, subject: subject.trim(), color, room: room.trim(), weights, nextTestDate: nextTestDate || null, nextTestTitle: nextTestTitle.trim() || null });
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-stone-800">{initial ? "Fach bearbeiten" : "Fach hinzufügen"}</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <Field label="Klasse">
            <select className={inputCls} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Klasse auswählen …</option>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value="__new__">+ Neue Klasse …</option>
            </select>
            {classId === "__new__" && (
              <input
                className={`${inputCls} mt-2`} placeholder="Neuen Klassennamen eingeben" value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)} autoFocus maxLength={50}
              />
            )}
          </Field>

          <Field label="Fachbezeichnung">
            {!!existingSubjects.length && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {existingSubjects.map((s) => (
                  <button
                    key={s}
                    onClick={() => pickSubject(s)}
                    className={`px-2.5 py-1 rounded-full text-xs border ${subject === s && !customSubject ? "akzent-ton akzent-rand akzent-text" : "bg-white border-stone-200 text-stone-600"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <input
              className={inputCls} placeholder="Neue Fachbezeichnung eingeben" value={customSubject ? subject : ""}
              onFocus={() => setCustomSubject(true)} maxLength={80}
              onChange={(e) => { setCustomSubject(true); setSubject(e.target.value); }}
            />
          </Field>

          <Field label="Farbe">
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full"
                  style={{ backgroundColor: c, boxShadow: c === color ? "0 0 0 2px white, 0 0 0 3.5px #292524" : "0 0 0 2px white" }}
                />
              ))}
            </div>
          </Field>

          <Field label="Raum (optional)">
            <input className={inputCls} placeholder="z. B. 0.107" maxLength={20} value={room} onChange={(e) => setRoom(e.target.value)} />
          </Field>

          <Field label="Gewichtung der Noten">
            <div className="grid grid-cols-2 gap-3">
              {CATS.map((c) => (
                <div key={c.key}>
                  <span className="block text-xs text-stone-400 mb-1">{c.label} (%)</span>
                  <input
                    type="number" min={0} max={100} className={inputCls}
                    value={weights[c.key]}
                    onChange={(e) => setWeights((w) => ({ ...w, [c.key]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-400 mt-1.5">Wird automatisch auf 100 % normiert, auch wenn noch nicht in jeder Kategorie Noten vorliegen.</p>
          </Field>

          <Field label="Nächste Klassenarbeit / Test (optional)">
            <div className="flex gap-2 items-center">
              <input
                className={`${inputCls} flex-1`}
                type="date"
                value={nextTestDate}
                min={isoDate(new Date())}
                max={isoDate(addDays(new Date(), 365))}
                onChange={(e) => setNextTestDate(e.target.value)}
              />
              {nextTestDate && (
                <button
                  onClick={() => { setNextTestDate(""); setNextTestTitle(""); }}
                  className="w-11 h-11 flex items-center justify-center text-stone-400 hover:text-red-500 shrink-0"
                  aria-label="Termin entfernen"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {nextTestDate && (
              <input
                className={`${inputCls} mt-2`}
                placeholder="Titel, z. B. Klassenarbeit Nr. 3"
                value={nextTestTitle}
                onChange={(e) => setNextTestTitle(e.target.value)}
                maxLength={100}
              />
            )}
            {/* Abgelaufener Termin bleibt sonst unbemerkt am Fach hängen */}
            {initial?.nextTestDate && initial.nextTestDate < isoDate(new Date()) && (
              <p className="text-xs text-amber-700 mt-1.5">
                Der Termin vom {localDate(initial.nextTestDate).toLocaleDateString("de-DE")} ist vorbei – trag den nächsten ein.
              </p>
            )}
            <p className="text-xs text-stone-500 mt-1.5">
              Zeigt auf der Übersicht und in der Schnellerfassung, wie viele Unterrichtsstunden bis dahin bleiben.
              Ferien werden abgezogen. Klappt nur, wenn das Fach im Stundenplan steht.
            </p>
          </Field>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={save} className="flex-1 justify-center">{initial ? "Speichern" : "Hinzufügen"}</Button>
        </div>
      </div>
    </div>
  );
}

/* Schüler:in hinzufügen – Name eingeben oder CSV importieren, in einem Einstieg */
function AddStudentModal({ className, onAddOne, onOpenCsv, onClose }) {
  const [name, setName] = useState("");
  const [added, setAdded] = useState([]);

  function submit() {
    const v = name.trim();
    if (!v) return;
    onAddOne(v);
    setAdded((prev) => [...prev, v]);
    setName("");
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-stone-800">Schüler:in hinzufügen{className ? ` – ${className}` : ""}</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <Field label="Name">
          <div className="flex gap-2">
            <input
              className={inputCls} placeholder="Name eingeben" value={name} autoFocus maxLength={100}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <Button onClick={submit}><Plus size={15} /></Button>
          </div>
        </Field>

        {!!added.length && (
          <ul className="mt-2 space-y-1">
            {added.map((n, i) => (
              <li key={i} className="text-xs text-stone-500 flex items-center gap-1.5">
                <Check size={12} className="akzent-text" /> {n}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 my-4">
          <div className="h-px bg-stone-100 flex-1" />
          <span className="text-xs text-stone-400">oder</span>
          <div className="h-px bg-stone-100 flex-1" />
        </div>

        <Button variant="subtle" onClick={onOpenCsv} className="w-full justify-center">Klassenliste importieren</Button>

        <div className="mt-5">
          <Button variant="ghost" onClick={onClose} className="w-full justify-center">Fertig</Button>
        </div>
      </div>
    </div>
  );
}

/* CSV-Import für Schüler:innen einer Klasse */
function ImportCsvModal({ className, onImport, onClose }) {
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [nameMode, setNameMode] = useState("single"); // "single" | "combo"
  const [nameCol, setNameCol] = useState("");
  const [firstCol, setFirstCol] = useState("");
  const [lastCol, setLastCol] = useState("");
  const [birthdayCol, setBirthdayCol] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function guessColumn(cols, patterns) {
    return cols.find((c) => patterns.some((p) => p.test(c))) || "";
  }

  function handleFile(file) {
    setError("");
    if (file.size > 5 * 1024 * 1024) { setError("Diese Datei ist zu groß (max. 5 MB). Bitte wähle eine CSV-Exportdatei."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const result = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!result.data.length) { setError("Konnte keine Zeilen in dieser Datei finden."); return; }
      const cols = result.meta.fields || [];
      setHeaders(cols);
      setRows(result.data);
      const guessFirst = guessColumn(cols, [/vorname/i, /^first/i]);
      const guessLast = guessColumn(cols, [/nachname/i, /^last/i, /^surname/i]);
      const guessName = guessColumn(cols, [/^name$/i, /vollständig/i, /full.?name/i]);
      const guessBday = guessColumn(cols, [/geburt/i, /birthday/i, /geb\./i]);
      if (guessFirst && guessLast) {
        setNameMode("combo"); setFirstCol(guessFirst); setLastCol(guessLast);
      } else if (guessName) {
        setNameMode("single"); setNameCol(guessName);
      } else {
        setNameMode("single"); setNameCol(cols[0] || "");
      }
      setBirthdayCol(guessBday);
    };
    reader.onerror = () => setError("Datei konnte nicht gelesen werden.");
    reader.readAsText(file, "utf-8");
  }

  const preview = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((r) => {
        const name = nameMode === "single"
          ? (r[nameCol] || "").trim()
          : [r[lastCol]?.trim(), r[firstCol]?.trim()].filter(Boolean).join(", ");
        const birthday = birthdayCol ? parseFlexibleDate(r[birthdayCol]) : null;
        return { name, birthday };
      })
      .filter((r) => r.name);
  }, [rows, nameMode, nameCol, firstCol, lastCol, birthdayCol]);

  function confirm() {
    if (!preview.length) { setError("Keine gültigen Namen gefunden – bitte Spaltenzuordnung prüfen."); return; }
    onImport(preview);
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-stone-800">Schüler:innen importieren{className ? ` – ${className}` : ""}</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        {!rows && (
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-stone-300 rounded-xl py-8 text-center text-sm text-stone-500 hover:akzent-rand hover:akzent-text"
            >
              Klassenliste hochladen
            </button>
            <input
              ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <p className="text-xs text-stone-400 mt-3">
              Erwartet eine Kopfzeile, z. B. „Name" oder getrennt „Vorname"/„Nachname". Eine optionale Spalte „Geburtsdatum" (TT.MM.JJJJ) wird automatisch erkannt.
            </p>
          </div>
        )}

        {rows && (
          <div className="space-y-4">
            <Field label="Namensspalte(n)">
              <div className="flex gap-2 mb-2">
                <button onClick={() => setNameMode("single")} className={`flex-1 text-xs py-1.5 rounded-lg border ${nameMode === "single" ? "akzent-ton akzent-rand akzent-text" : "border-stone-200 text-stone-500"}`}>Eine Spalte</button>
                <button onClick={() => setNameMode("combo")} className={`flex-1 text-xs py-1.5 rounded-lg border ${nameMode === "combo" ? "akzent-ton akzent-rand akzent-text" : "border-stone-200 text-stone-500"}`}>Vor-/Nachname getrennt</button>
              </div>
              {nameMode === "single" ? (
                <select className={inputCls} value={nameCol} onChange={(e) => setNameCol(e.target.value)}>
                  <option value="">Spalte wählen …</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <select className={inputCls} value={lastCol} onChange={(e) => setLastCol(e.target.value)}>
                    <option value="">Nachname …</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <select className={inputCls} value={firstCol} onChange={(e) => setFirstCol(e.target.value)}>
                    <option value="">Vorname …</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </Field>

            <Field label="Geburtstag (optional)">
              <select className={inputCls} value={birthdayCol} onChange={(e) => setBirthdayCol(e.target.value)}>
                <option value="">Keine Spalte</option>
                {headers.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </Field>

            <div>
              <div className="text-xs font-medium text-stone-500 mb-1.5">Vorschau ({preview.length} Schüler:innen)</div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-200">
                <ul className="divide-y divide-stone-100">
                  {preview.slice(0, 30).map((r, i) => (
                    <li key={i} className="px-3 py-1.5 text-sm text-stone-700 flex justify-between">
                      <span>{r.name}</span>
                      {r.birthday && <span className="text-xs text-stone-400">{localDate(r.birthday).toLocaleDateString("de-DE")}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <button onClick={() => setRows(null)} className="text-xs text-stone-400 hover:text-stone-600">Andere Datei wählen</button>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={confirm} disabled={!rows} className="flex-1 justify-center">{preview.length ? `${preview.length} importieren` : "Importieren"}</Button>
        </div>
      </div>
    </div>
  );
}

const MOOD_OPTIONS = [
  { key: "sehr_gut", emoji: "😄", label: "Sehr gut" },
  { key: "gut", emoji: "😊", label: "Gut" },
  { key: "ok", emoji: "😐", label: "Ok" },
  { key: "nicht_so_gut", emoji: "😕", label: "Nicht so gut" },
  { key: "schlecht", emoji: "😟", label: "Schlecht" },
];

const GESPRAECH_TYPEN = [
  { key: "schueler", label: "Schüler" },
  { key: "eltern", label: "Eltern" },
  { key: "foerder", label: "Förder" },
];

/* Notenübersicht eines Schülers / einer Schülerin über alle Fächer */
function StudentOverviewModal({ student, faecher, grades, finalGrades, halbjahr, onClose }) {
  const facherWithGrades = faecher
    .filter((f) => grades.some((g) => g.studentId === student.id && g.fachId === f.id))
    .sort((a, b) => a.subject.localeCompare(b.subject, "de"));

  return (
    <div className="fixed inset-0 bg-stone-900/40 z-[65] flex items-end md:items-center md:justify-center" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-xl overflow-y-auto dialog pb-[max(2rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-5 border-b border-stone-100">
          <StudentAvatar student={student} size={40} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-stone-800 truncate">{student.name}</div>
            <div className="text-xs text-stone-400">Notenübersicht · {halbjahr}. Halbjahr</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 shrink-0"><X size={18} /></button>
        </div>

        <div className="p-5">
          {facherWithGrades.length === 0 ? (
            <div className="text-sm text-stone-400 text-center py-8">Noch keine Noten für {student.name} erfasst.</div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {facherWithGrades.map((fach) => {
                const fachGrades = grades.filter((g) => g.studentId === student.id && g.fachId === fach.id);
                const { overall: avg } = calcOverall(fachGrades, fach.weights || DEFAULT_WEIGHTS);
                const finalGrade = finalGrades?.find((fg) => fg.studentId === student.id && fg.fachId === fach.id && fg.halbjahr === halbjahr);
                const gradeCount = fachGrades.length;
                return (
                  <li key={fach.id} className="py-3 flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: fach.color ?? "#8E8E93" }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-stone-800 truncate">{fach.subject}</div>
                      <div className="text-xs text-stone-400">{gradeCount} {gradeCount === 1 ? "Note" : "Noten"}</div>
                    </div>
                    <div className="text-right shrink-0">
                      {avg != null ? (
                        <>
                          <div className={`font-semibold text-sm ${gradeColor(avg)}`}>{gradeLabel(avg)}</div>
                          {finalGrade && (
                            <div className="text-[11px] text-stone-400">Zeugnis: {gradeLabel(finalGrade.value)}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-stone-400 text-sm">—</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* Canvas-Chart: Notenverlauf eines Schülers */
const VOICE_CONSENT_KEY = "saidy_voice_consent";
/* Die Spracherkennung laeuft ueber Apple bzw. Google, das Audio verlaesst also
   das Geraet. Eine einmal erteilte Zustimmung soll deshalb nicht ewig gelten -
   nach einem Jahr wird erneut gefragt. Der Wert ist ein ISO-Datum; der alte
   Wert "1" aus frueheren Versionen zaehlt als abgelaufen. */
const VOICE_CONSENT_MAX_TAGE = 365;

function voiceConsentGueltig() {
  try {
    const wert = localStorage.getItem(VOICE_CONSENT_KEY);
    if (!wert || !/^\d{4}-\d{2}-\d{2}$/.test(wert)) return false;
    const alter = (Date.now() - localDate(wert).getTime()) / 86400000;
    return alter >= 0 && alter < VOICE_CONSENT_MAX_TAGE;
  } catch {
    return false;
  }
}

function VoiceNoteButton({ onTranscript }) {
  const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [micError, setMicError] = useState("");
  const srRef = useRef(null);

  if (!SR) return null;

  function startRecording() {
    setMicError("");
    const sr = new SR();
    sr.lang = "de-DE";
    sr.continuous = false;
    sr.interimResults = true;
    sr.onresult = (e) => {
      const full = Array.from(e.results).map((r) => r[0].transcript).join("");
      if (e.results[e.results.length - 1].isFinal) {
        onTranscript(full.trim());
        setInterim("");
      } else {
        setInterim(full);
      }
    };
    sr.onend = () => { setListening(false); setInterim(""); };
    sr.onerror = (e) => {
      setListening(false);
      setInterim("");
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setMicError("Mikrofon-Zugriff verweigert. Bitte in den Geräte-Einstellungen erlauben.");
      } else if (e.error === "no-speech") {
        setMicError("Kein Ton erkannt – bitte nochmal versuchen.");
      } else if (e.error !== "aborted") {
        setMicError("Spracherkennung nicht verfügbar.");
      }
    };
    srRef.current = sr;
    try {
      sr.start();
      setListening(true);
    } catch {
      setMicError("Mikrofon konnte nicht gestartet werden.");
    }
  }

  function handleClick() {
    if (listening) { srRef.current?.stop(); return; }
    setMicError("");
    if (!voiceConsentGueltig()) { setShowConsent(true); return; }
    startRecording();
  }

  return (
    <>
      <div className="relative shrink-0">
        {(interim || micError) && (
          <div className={`absolute bottom-full right-0 mb-2 z-10 text-xs rounded-xl px-3 py-2 max-w-[220px] text-right shadow-lg leading-snug ${micError ? "bg-red-600 text-white" : "bg-stone-800 text-white"}`}>
            {micError || interim}
          </div>
        )}
        <button
          type="button"
          onClick={handleClick}
          title={listening ? "Aufnahme beenden" : "Sprachnotiz"}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${listening ? "bg-red-500 text-white" : micError ? "bg-red-100 text-red-500" : "bg-stone-100 text-stone-400 hover:text-stone-600"}`}
        >
          <Mic size={15} className={listening ? "animate-pulse" : ""} />
        </button>
      </div>

      {showConsent && (
        <div className="fixed inset-0 z-[80] bg-stone-900/50 flex items-end" onClick={() => setShowConsent(false)}>
          <div className="bg-white rounded-t-3xl w-full p-5 pb-[max(2rem,env(safe-area-inset-bottom))] anim-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-3">
              <Mic size={18} className="akzent-text shrink-0" />
              <div className="font-semibold text-stone-800">Sprachnotizen</div>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed mb-4">
              Saidy nutzt die Sprach-zu-Text-Funktion deines Geräts. Die Audioaufnahme wird dabei <strong>kurzzeitig an Apple (Safari) bzw. Google (Chrome/Edge) in die USA übertragen</strong> und danach nicht gespeichert. Nur der fertige Text bleibt lokal auf deinem Gerät. Nenne in Aufnahmen keine Schülernamen.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setShowConsent(false)} className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-600 font-medium">Abbrechen</button>
              <button
                onClick={() => { try { localStorage.setItem(VOICE_CONSENT_KEY, isoDate(new Date())); } catch { /* privater Modus */ } setShowConsent(false); startRecording(); }}
                className="flex-1 py-2.5 rounded-xl akzent-flaeche text-white text-sm font-semibold"
              >
                Verstanden &amp; nutzen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GradeChart({ grades, faecher }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grades.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = 140;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const PAD = { top: 10, right: 14, bottom: 22, left: 26 };
    const cW = W - PAD.left - PAD.right;
    const cH = H - PAD.top - PAD.bottom;

    const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date));
    const dates = sorted.map((g) => new Date(g.date).getTime());
    const minDate = dates[0], maxDate = dates[dates.length - 1];
    const dateRange = maxDate - minDate || 1;
    const MIN_V = 0.75, MAX_V = 6;

    function xOf(ms) { return PAD.left + ((ms - minDate) / dateRange) * cW; }
    function yOf(v) { return PAD.top + ((v - MIN_V) / (MAX_V - MIN_V)) * cH; }

    // Grade zone backgrounds
    ctx.fillStyle = "rgba(88,132,88,0.05)";
    ctx.fillRect(PAD.left, PAD.top, cW, yOf(2.5) - PAD.top);
    ctx.fillStyle = "rgba(200,80,60,0.05)";
    ctx.fillRect(PAD.left, yOf(3.5), cW, PAD.top + cH - yOf(3.5));

    // Grid lines
    ctx.lineWidth = 1;
    for (const v of [2, 3, 4, 5]) {
      const y = yOf(v);
      ctx.strokeStyle = "#e7e5e4";
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(W - PAD.right, y); ctx.stroke();
      ctx.fillStyle = "#c4c0bb"; ctx.font = `${9}px system-ui`; ctx.textAlign = "right";
      ctx.fillText(String(v), PAD.left - 4, y + 3.5);
    }

    // Per-subject lines + area fills
    const fachMap = new Map();
    sorted.forEach((g) => { if (!fachMap.has(g.fachId)) fachMap.set(g.fachId, []); fachMap.get(g.fachId).push(g); });
    fachMap.forEach((fg, fachId) => {
      const fach = faecher.find((f) => f.id === fachId);
      const color = fach?.color ?? "#4F5844";
      const pts = [...fg].sort((a, b) => a.date.localeCompare(b.date));
      if (pts.length >= 2) {
        // Area
        ctx.beginPath();
        ctx.moveTo(xOf(new Date(pts[0].date).getTime()), yOf(MAX_V));
        pts.forEach((g) => ctx.lineTo(xOf(new Date(g.date).getTime()), yOf(g.value)));
        ctx.lineTo(xOf(new Date(pts[pts.length - 1].date).getTime()), yOf(MAX_V));
        ctx.closePath();
        ctx.fillStyle = color + "1a"; ctx.fill();
        // Line
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineJoin = "round";
        pts.forEach((g, i) => { const x = xOf(new Date(g.date).getTime()), y = yOf(g.value); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); });
        ctx.stroke();
      }
      // Dots
      pts.forEach((g) => {
        const x = xOf(new Date(g.date).getTime()), y = yOf(g.value);
        ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      });
    });

    // Trend line (linear regression across all grades)
    if (sorted.length >= 3) {
      const pts = sorted.map((g) => ({ x: new Date(g.date).getTime(), y: g.value }));
      const n = pts.length;
      const sx = pts.reduce((s, p) => s + p.x, 0), sy = pts.reduce((s, p) => s + p.y, 0);
      const sxy = pts.reduce((s, p) => s + p.x * p.y, 0), sx2 = pts.reduce((s, p) => s + p.x * p.x, 0);
      const slope = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
      const intercept = (sy - slope * sx) / n;
      ctx.beginPath(); ctx.setLineDash([4, 4]); ctx.strokeStyle = "#c4c0bb"; ctx.lineWidth = 1.5;
      ctx.moveTo(xOf(minDate), yOf(slope * minDate + intercept));
      ctx.lineTo(xOf(maxDate), yOf(slope * maxDate + intercept));
      ctx.stroke(); ctx.setLineDash([]);
    }

    // X-axis date labels (up to 3)
    ctx.fillStyle = "#c4c0bb"; ctx.font = `${9}px system-ui`; ctx.textAlign = "center";
    const labelPts = sorted.length <= 4 ? sorted : [sorted[0], sorted[Math.floor(sorted.length / 2)], sorted[sorted.length - 1]];
    const seen = new Set();
    labelPts.forEach((g) => {
      const ms = new Date(g.date).getTime();
      if (seen.has(ms)) return; seen.add(ms);
      ctx.fillText(new Date(g.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), xOf(ms), H - 4);
    });
  }, [grades, faecher]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "140px", display: "block" }} />;
}

/* Dokumentenliste fuer einen Bereich (Kind, Klasse, Fach, allgemein).
   Bewusst als eigene Komponente, damit die spaeteren Bereiche dieselbe
   Oberflaeche und dieselbe Logik nutzen und nichts doppelt gepflegt wird. */
function DokumenteBlock({ scope, scopeId, documents, update, hinweis }) {
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [loeschId, setLoeschId] = useState(null);
  const kameraRef = useRef(null);
  const dateiRef = useRef(null);

  const eigene = (documents || [])
    .filter((d) => d.scope === scope && (scopeId ? d.scopeId === scopeId : true))
    .sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));

  async function hinzufuegen(file) {
    if (!file) return;
    setFehler("");
    setLaedt(true);
    try {
      const fertig = await dateiVorbereiten(file);
      if (fertig.size > DOC_MAX_BYTES) {
        setFehler(`Datei zu groß (${byteText(fertig.size)}). Höchstens ${byteText(DOC_MAX_BYTES)} pro Dokument.`);
        return;
      }
      await dauerhaftenSpeicherAnfordern();
      const id = uid();
      await docSpeichern(id, fertig);
      update((d) => {
        d.documents = d.documents || [];
        d.documents.push({
          id, name: (file.name || "Dokument").slice(0, 200), mime: fertig.type || "application/octet-stream",
          size: fertig.size, addedAt: isoDate(new Date()), scope, scopeId: scopeId || null, note: "",
        });
        return d;
      });
    } catch (e) {
      console.warn("[Saidy] Dokument speichern fehlgeschlagen:", e);
      /* Der haeufigste echte Grund ist ein volles Speicherkontingent - das
         soll die Lehrkraft erfahren, nicht nur „hat nicht geklappt". */
      setFehler(e?.name === "QuotaExceededError"
        ? "Der Speicher ist voll. Lösche nicht mehr benötigte Dokumente oder sichere sie vorher."
        : "Dokument konnte nicht gespeichert werden.");
    } finally {
      setLaedt(false);
    }
  }

  async function oeffnen(doc) {
    setFehler("");
    try {
      const blob = await docLaden(doc.id);
      if (!blob) {
        setFehler("Die Datei fehlt auf diesem Gerät – spiel die Dokument-Sicherung ein.");
        return;
      }
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      /* Der Browser braucht die Adresse noch einen Moment, danach freigeben. */
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setFehler("Dokument konnte nicht geöffnet werden.");
    }
  }

  async function entfernen(id) {
    try { await docLoeschen(id); } catch { /* Eintrag trotzdem entfernen */ }
    update((d) => { d.documents = (d.documents || []).filter((x) => x.id !== id); return d; });
    setLoeschId(null);
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Paperclip size={13} className="text-stone-400 shrink-0" />
        <span className="t-caption">Dokumente</span>
        {!!eigene.length && <span className="text-[10px] text-stone-400">{eigene.length}</span>}
      </div>

      {hinweis && (
        <p className="text-[11px] text-amber-600 mb-2 flex items-start gap-1">
          <ShieldCheck size={11} className="shrink-0 mt-0.5" />
          {hinweis}
        </p>
      )}

      {eigene.length ? (
        <ul className="space-y-1.5 mb-2">
          {eigene.map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-xl border border-stone-100 px-2.5 py-2">
              <span className="w-7 h-7 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                {doc.mime?.startsWith("image/")
                  ? <ImageIcon size={13} className="text-stone-500" />
                  : <FileText size={13} className="text-stone-500" />}
              </span>
              <button onClick={() => oeffnen(doc)} className="flex-1 min-w-0 text-left">
                <div className="text-xs text-stone-800 truncate">{doc.name}</div>
                <div className="text-[10px] text-stone-400 tabular-nums">
                  {doc.addedAt ? localDate(doc.addedAt).toLocaleDateString("de-DE") : "—"} · {byteText(doc.size)}
                </div>
              </button>
              <button
                onClick={() => setLoeschId(doc.id)}
                className="w-9 h-9 -mr-1.5 flex items-center justify-center text-stone-300 hover:text-red-500 shrink-0"
                aria-label={`${doc.name} löschen`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-stone-400 mb-2">Noch keine Dokumente abgelegt.</p>
      )}

      {fehler && <p className="text-[11px] text-red-600 mb-2">{fehler}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => kameraRef.current?.click()}
          disabled={laedt}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 py-2 text-xs text-stone-600 disabled:opacity-50"
        >
          <Camera size={14} /> Foto
        </button>
        <button
          onClick={() => dateiRef.current?.click()}
          disabled={laedt}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 py-2 text-xs text-stone-600 disabled:opacity-50"
        >
          <FolderOpen size={14} /> Datei
        </button>
      </div>
      {laedt && <p className="text-[11px] text-stone-400 mt-1.5">Wird gespeichert …</p>}

      {/* capture oeffnet auf dem Handy direkt die Kamera statt der Galerie */}
      <input
        ref={kameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; hinzufuegen(f); }}
      />
      <input
        ref={dateiRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; hinzufuegen(f); }}
      />

      <ConfirmDialog
        open={!!loeschId}
        title="Dokument löschen?"
        message="Die Datei wird sofort und endgültig von diesem Gerät entfernt – anders als bei Kindern oder Klassen gibt es hier keinen Papierkorb."
        confirmLabel="Löschen"
        onConfirm={() => entfernen(loeschId)}
        onCancel={() => setLoeschId(null)}
      />
    </div>
  );
}

/* Eigenständiges Fenster für die Schülerliste einer Klasse – bewusst getrennt von der Klassenübersicht */
function StudentsModal({ cls, students, notes, grades, faecher, foerderZiele, absences, incidents, documents, update, settings, notenfarben, selectedStudent, setSelectedStudent, onDeleteStudent, onUpdateField, onAddNote, newNote, setNewNote, gespraechDraft, setGespraechDraft, onAddGespraech, onDeleteNote, onAddFoerderZiel, onToggleFoerderZiel, onDeleteFoerderZiel, onOpenAdd, onOpenOverview, onClose }) {
  const [photoError, setPhotoError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  /* Haelt die studentId, fuer die gerade die Einwilligung erfragt wird - die
     Bestaetigung gilt nur fuer dieses eine Kind. */
  const [showMedicalConsent, setShowMedicalConsent] = useState(null);
  const [quickGesprId, setQuickGesprId] = useState(null);
  const [zielDraft, setZielDraft] = useState({ text: "", typ: "foerder" });
  const [profileTab, setProfileTab] = useState("übersicht");
  /* Referenzzeitpunkt des vorletzten Besuchs bei diesem Kind. Beim Wechsel auf ein
     Kind wird der bisher gespeicherte Wert gelesen (das ist der Zeitpunkt der Anzeige)
     und ein neuer Zeitpunkt gespeichert (das ist der aktuelle Besuch, wird beim naechsten
     Oeffnen zur Referenz). Beim allerersten Besuch bleibt die Referenz null, dann wird
     die "Was ist neu"-Karte gar nicht gerendert. */
  const [besuchRef, setBesuchRef] = useState(null);
  useEffect(() => {
    if (!selectedStudent) { setBesuchRef(null); return; }
    const key = `saidy_lastVisit_${selectedStudent}`;
    let alter = null;
    try { alter = localStorage.getItem(key); } catch {}
    setBesuchRef(alter || null);
    try { localStorage.setItem(key, isoDate(new Date())); } catch {}
  }, [selectedStudent]);
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [listSort, setListSort] = useState("name");

  function studentAvg(studentId) {
    const sg = (grades || []).filter((g) => g.studentId === studentId);
    if (!sg.length) return null;
    const total = sg.reduce((s, g) => s + g.value * (g.factor || 1), 0);
    const factors = sg.reduce((s, g) => s + (g.factor || 1), 0);
    return total / factors;
  }

  function gradeColor(avg) {
    if (avg == null) return "text-stone-300";
    if (notenfarben === false) return "text-stone-700";
    if (avg <= 2.5) return "text-[var(--s-gut)]";
    if (avg <= 3.5) return "text-[var(--s-warn)]";
    return "text-[var(--s-krit)]";
  }

  function moodFromGrades(avg) {
    if (avg == null) return null;
    if (avg <= 2.0) return { emoji: "😄", label: "Sehr gut" };
    if (avg <= 2.7) return { emoji: "😊", label: "Gut" };
    if (avg <= 3.4) return { emoji: "😐", label: "Neutral" };
    if (avg <= 4.5) return { emoji: "😕", label: "Schwierig" };
    return { emoji: "😟", label: "Kritisch" };
  }

  function relativeTime(dateStr) {
    if (!dateStr) return null;
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return "heute";
    if (days === 1) return "gestern";
    if (days < 7) return `vor ${days} Tagen`;
    if (days < 30) return `vor ${Math.floor(days / 7)} Wo.`;
    return `vor ${Math.floor(days / 30)} Mon.`;
  }

  function ageFromBirthday(bday) {
    if (!bday) return null;
    const b = new Date(bday);
    const today = new Date();
    let age = today.getFullYear() - b.getFullYear();
    if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) age--;
    return age;
  }

  function dateGroupLabel(dateStr) {
    if (!dateStr) return "Unbekannt";
    const d = localDate(dateStr);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const target = new Date(d); target.setHours(0, 0, 0, 0);
    const diff = Math.round((today - target) / 86400000);
    if (diff === 0) return "Heute";
    if (diff === 1) return "Gestern";
    if (diff < 7) return "Diese Woche";
    if (diff < 14) return "Letzte Woche";
    return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  }

  function groupByDateLabel(items) {
    const groups = [];
    let lastLabel = null;
    for (const item of items) {
      const label = dateGroupLabel(item.date);
      if (label !== lastLabel) { groups.push({ label, items: [] }); lastLabel = label; }
      groups[groups.length - 1].items.push(item);
    }
    return groups;
  }

  async function handlePhoto(studentId, file) {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      onUpdateField(studentId, "photo", dataUrl);
      setPhotoError("");
    } catch {
      setPhotoError("Foto konnte nicht verarbeitet werden.");
    }
  }

  return (
    <>
    {showMedicalConsent && (() => {
      const kind = students.find((s) => s.id === showMedicalConsent);
      const vorname = kind?.name?.split(" ")[0] || "dieses Kind";
      return (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setShowMedicalConsent(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={20} className="text-amber-600 shrink-0" />
              <div className="font-semibold text-stone-800">Gesundheitsdaten (Art. 9 DSGVO)</div>
            </div>
            <p className="text-sm text-stone-600 mb-2">
              Gesundheitsinformationen sind besonders geschützte Daten. Sie dürfen nur mit <strong>schriftlicher Einwilligung</strong> der Erziehungsberechtigten gespeichert werden.
            </p>
            <p className="text-sm text-stone-600 mb-4">
              Liegt dir die Einwilligung für <strong>{vorname}</strong> vor? Die Bestätigung gilt nur für dieses Kind – bei jedem weiteren wird erneut gefragt.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setShowMedicalConsent(null); document.activeElement?.blur(); }} className="flex-1 justify-center">Abbrechen</Button>
              <Button onClick={() => { setMedicalConsent(showMedicalConsent); setShowMedicalConsent(null); }} className="flex-1 justify-center">Ja, liegt vor</Button>
            </div>
          </div>
        </div>
      );
    })()}
    {/* TP-02 · Schülerliste als Bottom-Sheet mit Preview-Karten */}
    <div className="fixed inset-0 bg-stone-900/50 z-50 flex flex-col justify-end" onClick={onClose}>
      <div
        className="bg-stone-100 rounded-t-3xl w-full flex flex-col anim-sheet"
        style={{ maxHeight: "90dvh", boxShadow: "var(--shadow-xl)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pull-Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-stone-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4 shrink-0">
          <div>
            <div className="text-xl font-bold text-stone-900 leading-tight">{cls.name}</div>
            <div className="t-caption mt-0.5">{students.length} Schüler:innen</div>
          </div>
          <div className="flex items-center gap-2 pt-0.5">
            <button
              onClick={onOpenAdd}
              className="flex items-center gap-1 text-sm font-semibold akzent-text akzent-ton rounded-full px-3 py-1.5 press-scale"
            >
              <Plus size={14} /> Hinzufügen
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center press-scale"
            >
              <X size={16} className="text-stone-500" />
            </button>
          </div>
        </div>

        {photoError && <p className="text-xs text-red-600 px-5 mb-2 shrink-0">{photoError}</p>}

        {/* Schülerkarten */}
        <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-2">
          {[...students].sort((a, b) => a.name.localeCompare(b.name, "de")).map((s) => {
            const sAllNotes = notes.filter((n) => n.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date));
            const lastNote = sAllNotes.find((n) => n.type !== "gespraech") ?? null;
            const lastGesprMood = sAllNotes.find((n) => n.type === "gespraech")?.mood ?? null;
            const sZieleCount = (foerderZiele || []).filter((z) => z.studentId === s.id && !z.doneAt).length;
            const foerderTagList = (s.foerderStatus || "").split(",").map((t) => t.trim()).filter(Boolean);
            const avg = studentAvg(s.id);
            const mood = lastGesprMood ? MOOD_OPTIONS.find((m) => m.key === lastGesprMood) : moodFromGrades(avg);
            const lastNoteRel = lastNote ? relativeTime(lastNote.date) : null;

            return (
              <div key={s.id} className="space-y-1">
                {/* Schülerkarte */}
                <div className="card overflow-hidden">
                  <button
                    onClick={() => { setSelectedStudent(s.id); setProfileTab("übersicht"); }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left press-scale"
                  >
                    <StudentAvatar student={s} size={44} />
                    <div className="flex-1 min-w-0">
                      {/* Name + Mood-Emoji */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-semibold text-stone-900 truncate">{s.name}</span>
                        {mood && <span className="text-base leading-none shrink-0" title={mood.label}>{mood.emoji}</span>}
                      </div>
                      {/* Förderstatus-Chips */}
                      {foerderTagList.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {foerderTagList.map((tag) => (
                            <span key={tag} className="chip chip-warn">{tag}</span>
                          ))}
                        </div>
                      )}
                      {/* Letzte Notiz */}
                      <span className="t-caption">
                        {lastNoteRel ? `Letzte Notiz: ${lastNoteRel}` : "Noch keine Notizen"}
                      </span>
                    </div>
                    {/* Ø-Note + Pfeil */}
                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                      {avg != null ? (
                        <span className={`text-base font-bold tnum ${gradeColor(avg)}`}>
                          Ø {avg.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-sm text-stone-300">–</span>
                      )}
                      <ChevronRight size={14} className="text-stone-300" />
                    </div>
                  </button>

                  {/* Gespräch-Schnelleingabe */}
                  {quickGesprId === s.id && (
                    <div className="border-t border-stone-100 px-4 py-3 bg-stone-50">
                      <div className="flex gap-1.5 mb-2">
                        {GESPRAECH_TYPEN.map((t) => (
                          <button key={t.key} type="button" onClick={() => setGespraechDraft((d) => ({ ...d, typ: t.key }))}
                            className={`flex-1 py-1.5 rounded-xl border text-xs font-medium transition-colors ${gespraechDraft.typ === t.key ? "akzent-rand akzent-ton akzent-text" : "border-stone-200 bg-white text-stone-500"}`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mb-2">
                        {MOOD_OPTIONS.map((m) => (
                          <button key={m.key} type="button" onClick={() => setGespraechDraft((d) => ({ ...d, mood: m.key }))}
                            className={`flex-1 py-1.5 rounded-xl border text-base transition-colors ${gespraechDraft.mood === m.key ? "akzent-rand akzent-ton" : "border-stone-200 bg-white"}`}
                            title={m.label}>
                            {m.emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          className="input-base flex-1"
                          placeholder="Was bewegt das Kind …"
                          maxLength={500}
                          value={gespraechDraft.text}
                          onChange={(e) => setGespraechDraft((d) => ({ ...d, text: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter" && gespraechDraft.text.trim()) { onAddGespraech(s.id); setQuickGesprId(null); } }}
                        />
                        <button type="button"
                          onClick={() => { onAddGespraech(s.id); setQuickGesprId(null); }}
                          disabled={!gespraechDraft.text.trim()}
                          className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold akzent-flaeche disabled:opacity-40">
                          ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sekundäre Aktionen unter der Karte */}
                <div className="flex items-center justify-end gap-2 px-2">
                  <button
                    onClick={() => { setQuickGesprId(quickGesprId === s.id ? null : s.id); setGespraechDraft({ text: "", mood: "ok", typ: "schueler" }); }}
                    className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${quickGesprId === s.id ? "akzent-text akzent-ton font-medium" : "text-stone-400 hover:text-stone-600"}`}
                  >
                    💬 Gespräch
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    className="text-stone-300 hover:text-red-400 p-1 rounded-full"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {!students.length && (
            <div className="card card-p text-center text-sm text-stone-400 py-8">
              Noch keine Schüler:innen in dieser Klasse.
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Schülerprofil – Vollbild-Overlay */}
    {selectedStudent && (() => {
      const s = students.find((st) => st.id === selectedStudent);
      if (!s) return null;
      const sNotes = notes.filter((n) => n.studentId === s.id && n.type !== "gespraech").sort((a, b) => b.date.localeCompare(a.date));
      const sGespraeche = notes.filter((n) => n.studentId === s.id && n.type === "gespraech").sort((a, b) => b.date.localeCompare(a.date));
      const sZiele = (foerderZiele || []).filter((z) => z.studentId === s.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const foerderTags = (s.foerderStatus || "").split(",").map((t) => t.trim()).filter(Boolean);

      function removeFoerderTag(tag) {
        const next = foerderTags.filter((t) => t !== tag).join(", ");
        onUpdateField(s.id, "foerderStatus", next);
      }
      function addFoerderTag(tag) {
        const next = [...foerderTags, tag.trim()].join(", ");
        onUpdateField(s.id, "foerderStatus", next);
        setNewTag("");
        setAddingTag(false);
      }

      const profileAvg = studentAvg(s.id);
      const profileMood = (() => {
        const lastGesprWithMood = sGespraeche.find((g) => g.mood);
        return lastGesprWithMood ? MOOD_OPTIONS.find((m) => m.key === lastGesprWithMood.mood) : moodFromGrades(profileAvg);
      })();
      const age = ageFromBirthday(s.birthday);
      const nextGoal = sZiele.find((z) => !z.doneAt) ?? null;
      const lastN = sNotes[0] ?? null;

      const sGradesAll = (grades || []).filter((g) => g.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date));

      function buildAiSummary() {
        if (!profileAvg && !sNotes.length && !sGespraeche.length && !foerderTags.length && !nextGoal) return "";
        const vorname = s.name.split(" ")[0];
        const parts = [];

        if (profileMood) {
          const st = { sehr_gut: "einen sehr positiven Eindruck", gut: "einen guten Eindruck", ok: "einen zufriedenstellenden Eindruck", nicht_so_gut: "etwas belastet", schlecht: "deutlich belastet" }[profileMood.key] ?? "einen neutralen Eindruck";
          const verb = ["nicht_so_gut", "schlecht"].includes(profileMood.key) ? "wirkt" : "macht derzeit";
          parts.push(`${vorname} ${verb} ${st}.`);
        }

        if (profileAvg != null) {
          const bereich = profileAvg <= 1.5 ? "sehr guten" : profileAvg <= 2.5 ? "guten" : profileAvg <= 3.5 ? "befriedigenden" : profileAvg <= 4.5 ? "ausreichenden" : "kritischen";
          let trendText = "";
          if (sGradesAll.length >= 4) {
            const mid = Math.floor(sGradesAll.length / 2);
            const fAvg = sGradesAll.slice(0, mid).reduce((a, g) => a + g.value, 0) / mid;
            const lAvg = sGradesAll.slice(mid).reduce((a, g) => a + g.value, 0) / (sGradesAll.length - mid);
            if (lAvg < fAvg - 0.25) trendText = ", Tendenz verbessert";
            else if (lAvg > fAvg + 0.25) trendText = ", Tendenz verschlechtert";
            else trendText = ", stabile Tendenz";
          }
          parts.push(`Noten: Ø ${profileAvg.toFixed(1)} (${bereich}${trendText}).`);
        }

        const cutoffStr = (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); })();
        const rN = sNotes.filter((n) => n.date >= cutoffStr).length;
        const rG = sGespraeche.filter((g) => g.date >= cutoffStr).length;
        if (rN + rG > 0) {
          const acts = [];
          if (rN > 0) acts.push(rN === 1 ? "1 Notiz" : `${rN} Notizen`);
          if (rG > 0) acts.push(rG === 1 ? "1 Gespräch" : `${rG} Gespräche`);
          parts.push(`Letzte 30 Tage: ${acts.join(", ")}.`);
        }

        if (foerderTags.length > 0) parts.push(`Förderbedarf: ${foerderTags.join(", ")}.`);

        if (nextGoal) {
          const label = nextGoal.typ === "wochen" ? "Wochenziel" : "Förderziel";
          const txt = nextGoal.text.length > 60 ? nextGoal.text.slice(0, 60) + "…" : nextGoal.text;
          parts.push(`Aktives ${label}: „${txt}"`);
        }

        return parts.join(" ");
      }
      const aiSummary = buildAiSummary();

      function computeSignals() {
        const result = [];
        const todayMs = (() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); })();

        // Kritischer Notenschnitt
        if (profileAvg != null && profileAvg >= 4.0) {
          result.push({ level: "krit", label: `Krit. Ø ${profileAvg.toFixed(1)}`, tab: "leistung" });
        }

        // Notentrend
        if (sGradesAll.length >= 4) {
          const mid = Math.floor(sGradesAll.length / 2);
          const fA = sGradesAll.slice(0, mid).reduce((a, g) => a + g.value, 0) / mid;
          const lA = sGradesAll.slice(mid).reduce((a, g) => a + g.value, 0) / (sGradesAll.length - mid);
          if (lA > fA + 0.5 && profileAvg < 4.0) {
            result.push({ level: "warn", label: `Notenabfall ↘`, tab: "leistung" });
          } else if (lA < fA - 0.5) {
            result.push({ level: "gut", label: `Notenverbesserung ↗`, tab: "leistung" });
          }
        }

        // Sehr guter Schnitt
        if (profileAvg != null && profileAvg <= 1.5 && sGradesAll.length >= 3 && profileAvg >= 4.0 === false) {
          result.push({ level: "gut", label: `Sehr gut (Ø ${profileAvg.toFixed(1)})`, tab: "leistung" });
        }

        // Keine Einträge seit N Tagen
        const allEntries = [...sNotes, ...sGespraeche];
        if (allEntries.length > 0) {
          const lastIso = allEntries.reduce((m, e) => e.date > m ? e.date : m, allEntries[0].date);
          const daysSince = Math.round((todayMs - localDate(lastIso).getTime()) / 86400000);
          if (daysSince >= 14) {
            result.push({ level: "warn", label: `${daysSince} Tage ohne Eintrag`, tab: "notizen" });
          }
        } else if (sGradesAll.length > 0) {
          result.push({ level: "info", label: "Noch keine Notiz", tab: "notizen" });
        }

        // Negative Stimmung in Folge
        const last3 = sGespraeche.slice(0, 3);
        if (last3.length >= 2 && last3.every((g) => ["nicht_so_gut", "schlecht"].includes(g.mood))) {
          result.push({ level: "warn", label: "Stimmung zuletzt negativ", tab: "gespräche" });
        }

        // Förderbedarf ohne aktives Ziel
        if (foerderTags.length > 0 && !sZiele.some((z) => !z.doneAt)) {
          result.push({ level: "warn", label: "Kein Förderziel gesetzt", tab: "mehr" });
        }

        // Geburtstag in ≤ 7 Tagen
        if (s.birthday) {
          const b = localDate(s.birthday);
          const yr = new Date().getFullYear();
          let next = new Date(yr, b.getMonth(), b.getDate());
          if (next.getTime() < todayMs) next = new Date(yr + 1, b.getMonth(), b.getDate());
          const days = Math.round((next.getTime() - todayMs) / 86400000);
          if (days === 0) result.push({ level: "info", label: "Heute Geburtstag 🎂", tab: null });
          else if (days <= 7) result.push({ level: "info", label: `Geburtstag in ${days} T. 🎂`, tab: null });
        }

        return result;
      }
      const signals = computeSignals();

      return (
      <div className="fixed inset-0 z-[55] bg-stone-100 flex flex-col anim-slide-right" style={{ maxHeight: "100dvh" }}>
          {/* Minimaler Kopf: Navigation + Tabs */}
          <div className="bg-white border-b border-stone-100 shrink-0">
            <div className="flex items-center gap-2 px-4 pb-2" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 press-scale"
              >
                <ChevronLeft size={18} className="text-stone-600" />
              </button>
              <div className="flex-1 min-w-0 text-center">
                <div className="text-xs font-medium text-stone-400 truncate">{cls.name}</div>
              </div>
              {onOpenOverview && (
                <button onClick={() => onOpenOverview(s.id)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 press-scale" title="Notenübersicht">
                  <BarChart2 size={15} className="text-stone-500" />
                </button>
              )}
              <button onClick={() => setConfirmDeleteId(s.id)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 press-scale" title="Löschen">
                <Trash2 size={15} className="text-stone-500" />
              </button>
            </div>
            {/* 5-Tab-Leiste */}
            <div className="flex border-t border-stone-100 overflow-x-auto chip-scroll">
              {[["übersicht", "Übersicht"], ["leistung", "Leistung"], ["notizen", "Notizen"], ["gespräche", "Gespräche"], ["mehr", "Mehr"]].map(([key, label]) => (
                <button key={key} onClick={() => setProfileTab(key)}
                  className={`flex-1 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors min-w-[64px] ${profileTab === key ? "border-[var(--oliv)] akzent-text" : "border-transparent text-stone-400"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab-Inhalt */}
          <div className="flex-1 overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]">

            {/* ── ÜBERSICHT ── */}
            {profileTab === "übersicht" && (
              <div className="p-4 space-y-3 anim-tab">

                {/* Profil-Karte */}
                <div className="card p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      <StudentAvatar student={s} size={64} />
                      <label htmlFor={`photo-profile-${s.id}`}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full border border-stone-200 flex items-center justify-center cursor-pointer shadow-sm">
                        <ImageIcon size={10} className="text-stone-400" />
                      </label>
                      <input type="file" accept="image/*" id={`photo-profile-${s.id}`} className="hidden"
                        onChange={(e) => handlePhoto(s.id, e.target.files?.[0])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-stone-900 truncate">{s.name}</span>
                        {profileMood && <span className="text-xl shrink-0" title={profileMood.label}>{profileMood.emoji}</span>}
                      </div>
                      <div className="t-label mt-0.5">
                        {cls.name}{age != null ? ` · ${age} Jahre` : ""}
                      </div>
                    </div>
                  </div>

                  {/* 3-Zellen Schnell-Info */}
                  {(s.birthday || s.parentPhone || s.parentName) && (
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-stone-100">
                      <div className="min-w-0">
                        <div className="t-caption mb-0.5">Geburtstag</div>
                        <div className="text-xs font-semibold text-stone-800">
                          {s.birthday ? localDate(s.birthday).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–"}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="t-caption mb-0.5">Telefon</div>
                        <div className="text-xs font-semibold text-stone-800 truncate">{s.parentPhone || "–"}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="t-caption mb-0.5">Erziehungsber.</div>
                        <div className="text-xs font-semibold text-stone-800 truncate">{s.parentName || "–"}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* "Was ist seit deinem letzten Besuch passiert" - erst ab dem zweiten
                    Besuch, dann alles was zeitlich nach dem letzten Besuch neu dazukam,
                    sortiert nach Datum neueste zuerst. In den Einstellungen kann jede
                    Kategorie einzeln ausgeblendet werden. */}
                {besuchRef && (() => {
                  const cats = settings?.neuSeitAnzeige || {};
                  const zeige = (name) => cats[name] !== false;
                  const items = [];
                  if (zeige("noten")) (grades || []).filter((g) => g.studentId === s.id && (g.date || "") > besuchRef).forEach((g) => {
                    const fach = (faecher || []).find((f) => f.id === g.fachId);
                    items.push({ typ: "Note", datum: g.date, text: `${g.value}${fach ? ` in ${fach.subject}` : ""}${g.title ? ` · ${g.title}` : ""}` });
                  });
                  (notes || []).filter((n) => n.studentId === s.id && (n.date || "") > besuchRef).forEach((n) => {
                    if (n.type === "gespraech") {
                      if (!zeige("gespraeche")) return;
                      const typLabel = n.gesprTyp === "eltern" ? "Elterngespräch" : n.gesprTyp === "foerder" ? "Fördergespräch" : "Schülergespräch";
                      items.push({ typ: typLabel, datum: n.date, text: n.text });
                    } else {
                      if (!zeige("notizen")) return;
                      items.push({ typ: "Notiz", datum: n.date, text: n.text });
                    }
                  });
                  if (zeige("fehlzeiten")) (absences || []).filter((a) => a.studentId === s.id && (a.date || "") > besuchRef).forEach((a) => {
                    const status = a.excuseStatus === "entschuldigt" ? "entschuldigt" : a.excuseStatus === "unentschuldigt" ? "unentschuldigt" : "offen";
                    items.push({ typ: "Fehlzeit", datum: a.date, text: `${a.reason || "Fehltag"} · ${status}` });
                  });
                  if (zeige("incidents")) (incidents || []).filter((i) => i.studentId === s.id && (i.date || "") > besuchRef).forEach((i) => {
                    items.push({ typ: "Klassenbuch", datum: i.date, text: i.label });
                  });
                  if (zeige("ziele")) (foerderZiele || []).filter((z) => z.studentId === s.id).forEach((z) => {
                    if (z.createdAt && z.createdAt > besuchRef) items.push({ typ: z.typ === "wochen" ? "Neues Wochenziel" : "Neues Förderziel", datum: z.createdAt, text: z.text });
                    if (z.doneAt && z.doneAt > besuchRef) items.push({ typ: "Ziel erledigt", datum: z.doneAt, text: z.text });
                  });
                  if (!items.length) return null;
                  items.sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
                  const sichtbar = items.slice(0, 8);
                  return (
                    <div className="card p-4 border-l-2 akzent-rand">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Sparkles size={12} className="akzent-text" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide akzent-text">Seit deinem letzten Besuch</span>
                      </div>
                      <ul className="space-y-2.5">
                        {sichtbar.map((it, i) => {
                          const d = localDate(it.datum);
                          const label = d ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "";
                          return (
                            <li key={i} className="flex items-start gap-2.5">
                              <span className="text-[10px] text-stone-400 shrink-0 pt-0.5 tabular-nums w-11">{label}</span>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-semibold uppercase text-stone-500 tracking-wide">{it.typ}</div>
                                <div className="text-sm text-stone-700 leading-snug line-clamp-3">{it.text}</div>
                              </div>
                            </li>
                          );
                        })}
                        {items.length > 8 && <li className="text-[11px] text-stone-400 pl-[3.4rem]">+{items.length - 8} weitere</li>}
                      </ul>
                    </div>
                  );
                })()}

                {/* Signale */}
                {signals.length > 0 && (
                  <div className="overflow-x-auto -mx-4 px-4 chip-scroll">
                    <div className="flex gap-2 pb-1">
                      {signals.map((sig, i) => (
                        <button
                          key={i}
                          onClick={() => sig.tab ? setProfileTab(sig.tab) : undefined}
                          className={`chip chip-${sig.level} shrink-0 font-semibold`}
                          style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", cursor: sig.tab ? "pointer" : "default" }}
                        >
                          {sig.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3-Spalten Statistik-Gitter */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Förderstatus */}
                  <div className="card p-3">
                    <div className="t-caption mb-2">Förderstatus</div>
                    {foerderTags.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {foerderTags.map((tag) => (
                          <span key={tag} className="chip chip-warn text-[10px] px-1.5 py-0.5">{tag}</span>
                        ))}
                        <button onClick={() => setProfileTab("mehr")} className="text-[10px] akzent-text mt-1">Bearbeiten</button>
                      </div>
                    ) : (
                      <button onClick={() => setProfileTab("mehr")} className="text-[10px] text-stone-400 hover:akzent-text">+ Hinzufügen</button>
                    )}
                  </div>
                  {/* Durchschnitt */}
                  <div className="card p-3">
                    <div className="t-caption mb-2">Durchschnitt</div>
                    {profileAvg != null ? (
                      <>
                        <div className={`text-lg font-bold tnum leading-none ${gradeColor(profileAvg)}`}>Ø {profileAvg.toFixed(1)}</div>
                      </>
                    ) : (
                      <div className="text-sm text-stone-300">–</div>
                    )}
                  </div>
                  {/* Stimmung */}
                  <div className="card p-3">
                    <div className="t-caption mb-2">Stimmung</div>
                    {profileMood ? (
                      <>
                        <div className="text-2xl leading-none mb-0.5">{profileMood.emoji}</div>
                        <div className="text-[10px] text-stone-500">{profileMood.label}</div>
                      </>
                    ) : (
                      <div className="text-sm text-stone-300">–</div>
                    )}
                  </div>
                </div>

                {/* KI-Zusammenfassung */}
                {aiSummary && (
                  <div className="rounded-2xl p-4 border border-stone-200/60" style={{ background: "var(--creme)" }}>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-6 h-6 rounded-lg akzent-flaeche flex items-center justify-center shrink-0">
                        <Sparkles size={12} className="text-white" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Zusammenfassung</span>
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed">{aiSummary}</p>
                  </div>
                )}

                {/* Nächste Aufgabe / Förderziel */}
                {nextGoal && (
                  <button onClick={() => setProfileTab("mehr")} className="card w-full p-4 text-left press-scale">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Target size={15} className="text-stone-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="t-label font-semibold text-stone-700 mb-0.5">
                          {nextGoal.typ === "wochen" ? "Wochenziel" : "Förderziel"}
                        </div>
                        <p className="text-sm text-stone-600 leading-snug">{nextGoal.text}</p>
                      </div>
                    </div>
                  </button>
                )}

                {/* Schnelleingabe: Notiz + Gespräch */}
                <div className="card p-4 space-y-3">
                  <div className="flex gap-2 items-center">
                    <input className="input-base flex-1" placeholder="Notiz hinzufügen …"
                      value={newNote} maxLength={1000}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onAddNote(s.id)} />
                    <VoiceNoteButton onTranscript={(t) => setNewNote((prev) => prev ? prev + " " + t : t)} />
                    <button onClick={() => onAddNote(s.id)} disabled={!newNote.trim()}
                      className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold akzent-flaeche disabled:opacity-40">✓</button>
                  </div>
                  <div className="border-t border-stone-100 pt-3">
                    <div className="flex gap-1.5 mb-2">
                      {GESPRAECH_TYPEN.map((t) => (
                        <button key={t.key} onClick={() => setGespraechDraft((d) => ({ ...d, typ: t.key }))}
                          className={`flex-1 py-1.5 rounded-xl border text-xs font-medium transition-colors ${gespraechDraft.typ === t.key ? "akzent-rand akzent-ton akzent-text" : "border-stone-200 text-stone-500"}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1.5 mb-2">
                      {MOOD_OPTIONS.map((m) => (
                        <button key={m.key} onClick={() => setGespraechDraft((d) => ({ ...d, mood: m.key }))}
                          title={m.label}
                          className={`flex-1 py-1.5 rounded-xl border text-base transition-colors ${gespraechDraft.mood === m.key ? "akzent-rand akzent-ton" : "border-stone-200"}`}>
                          {m.emoji}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input className="input-base flex-1" placeholder="Gespräch erfassen …"
                        value={gespraechDraft.text} maxLength={1000}
                        onChange={(e) => setGespraechDraft((d) => ({ ...d, text: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && onAddGespraech(s.id)} />
                      <button onClick={() => onAddGespraech(s.id)} disabled={!gespraechDraft.text.trim()}
                        className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold akzent-flaeche disabled:opacity-40">✓</button>
                    </div>
                  </div>
                </div>

                {/* Verlauf: Notizen + Gespräche kombiniert */}
                {(() => {
                  const combined = [
                    ...sNotes.map((n) => ({ ...n, _kind: "notiz" })),
                    ...sGespraeche.map((g) => ({ ...g, _kind: "gespraech" })),
                  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
                  if (!combined.length) return null;
                  const groups = groupByDateLabel(combined);
                  const total = sNotes.length + sGespraeche.length;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="t-section">Verlauf</span>
                        {total > 7 && (
                          <div className="flex gap-3">
                            <button onClick={() => setProfileTab("notizen")} className="t-caption akzent-text">Notizen →</button>
                            <button onClick={() => setProfileTab("gespräche")} className="t-caption akzent-text">Gespräche →</button>
                          </div>
                        )}
                      </div>
                      <div className="tl-wrap">
                        <div className="tl-rail" />
                        {groups.map(({ label, items }) => (
                          <div key={label}>
                            <div className="tl-group-label">{label}</div>
                            {items.map((item) => {
                              const isGespraeche = item._kind === "gespraech";
                              const mood = isGespraeche ? MOOD_OPTIONS.find((m) => m.key === item.mood) : null;
                              const typ = isGespraeche ? GESPRAECH_TYPEN.find((t) => t.key === item.gesprTyp) : null;
                              return (
                                <div key={item.id} className="tl-entry">
                                  <div className="tl-icon">
                                    {isGespraeche
                                      ? <span className="text-lg leading-none">{mood?.emoji ?? "💬"}</span>
                                      : <StickyNote size={15} className="text-stone-400" />}
                                  </div>
                                  <div className="tl-body">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      {isGespraeche && typ && (
                                        <span className="text-[10px] font-semibold akzent-text bg-[#ECEEE2] px-1.5 py-0.5 rounded-full">{typ.label}</span>
                                      )}
                                      {!isGespraeche && (
                                        <span className="text-[10px] font-semibold text-stone-400">Notiz</span>
                                      )}
                                      <span className="t-caption ml-auto">{relativeTime(item.date)}</span>
                                    </div>
                                    <p className="text-sm text-stone-700 leading-snug line-clamp-2">{item.text}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}

            {/* ── LEISTUNG ── */}
            {profileTab === "leistung" && (() => {
              const sGrades = (grades || []).filter((g) => g.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date));
              const { overall: overallAvg } = calcOverall(sGrades, null);
              const byFach = (faecher || [])
                .filter((f) => sGrades.some((g) => g.fachId === f.id))
                .map((f) => {
                  const fg = sGrades.filter((g) => g.fachId === f.id);
                  const { overall, byCat } = calcOverall(fg, f.weights || DEFAULT_WEIGHTS);
                  return { fach: f, fg, overall, byCat };
                })
                .sort((a, b) => (a.overall ?? 99) - (b.overall ?? 99));

              function gradeTrend() {
                if (sGrades.length < 4) return "stabil";
                const mid = Math.floor(sGrades.length / 2);
                const first = sGrades.slice(0, mid).reduce((s, g) => s + g.value, 0) / mid;
                const last = sGrades.slice(mid).reduce((s, g) => s + g.value, 0) / (sGrades.length - mid);
                return last < first - 0.25 ? "besser" : last > first + 0.25 ? "schlechter" : "stabil";
              }
              const trend = gradeTrend();

              return (
                <div className="p-4 space-y-3 anim-tab">
                  {/* Stats-Reihe */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="card p-3">
                      <div className="t-caption mb-1">Gesamt Ø</div>
                      {overallAvg != null
                        ? <div className={`text-xl font-bold tnum ${gradeColor(overallAvg)}`}>{overallAvg.toFixed(1)}</div>
                        : <div className="text-stone-300">–</div>}
                    </div>
                    <div className="card p-3">
                      <div className="t-caption mb-1">Noten</div>
                      <div className="text-xl font-bold tnum text-stone-800">{sGrades.length}</div>
                    </div>
                    <div className="card p-3">
                      <div className="t-caption mb-1">Tendenz</div>
                      <div className={`text-xl font-bold ${trend === "besser" ? "text-[var(--s-gut)]" : trend === "schlechter" ? "text-[var(--s-krit)]" : "text-stone-400"}`}>
                        {trend === "besser" ? "↗" : trend === "schlechter" ? "↘" : "→"}
                      </div>
                    </div>
                  </div>

                  {/* Canvas-Chart */}
                  {sGrades.length >= 2 && (
                    <div className="card p-3">
                      <div className="t-caption mb-2">Notenverlauf</div>
                      <GradeChart grades={sGrades} faecher={faecher || []} />
                      {(faecher || []).filter((f) => sGrades.some((g) => g.fachId === f.id)).length > 1 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(faecher || []).filter((f) => sGrades.some((g) => g.fachId === f.id)).map((f) => (
                            <div key={f.id} className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: f.color ?? "#4F5844" }} />
                              <span className="t-caption">{f.subject}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fächer-Breakdown */}
                  {byFach.length > 0 ? (
                    <div className="card overflow-hidden">
                      <div className="t-section px-4 pt-3 pb-1">Fächer</div>
                      <ul className="divide-y divide-stone-100">
                        {byFach.map(({ fach, fg, overall, byCat }) => (
                          <li key={fach.id} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: fach.color ?? "#8E8E93" }} />
                              <span className="text-sm font-semibold text-stone-800 flex-1 truncate">{fach.subject}</span>
                              {overall != null && (
                                <span className={`text-sm font-bold tnum ${gradeColor(overall)}`}>Ø {overall.toFixed(1)}</span>
                              )}
                            </div>
                            {overall != null && (
                              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden mb-2">
                                <div className="h-full rounded-full" style={{ width: `${Math.max(4, ((6 - overall) / 5) * 100)}%`, background: fach.color ?? "var(--oliv)" }} />
                              </div>
                            )}
                            <div className="flex gap-3 flex-wrap mb-2">
                              {CATS.map((cat) => byCat[cat.key] ? (
                                <div key={cat.key} className="flex items-center gap-1">
                                  <span className="t-caption">{cat.label}:</span>
                                  <span className={`text-xs font-semibold tnum ${gradeColor(byCat[cat.key].avg)}`}>{byCat[cat.key].avg.toFixed(1)}</span>
                                  <span className="t-caption">({byCat[cat.key].count}×)</span>
                                </div>
                              ) : null)}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[...fg].sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
                                <div key={g.id} className="flex flex-col items-center">
                                  <span className={`text-xs font-bold tnum ${gradeColor(g.value)}`}>
                                    {GRADE_OPTIONS.find((o) => o.value === g.value)?.label ?? g.value}
                                  </span>
                                  <span className="text-[9px] text-stone-300 tnum leading-none mt-0.5">
                                    {localDate(g.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="card p-6 text-center">
                      <div className="text-stone-300 text-3xl mb-2">📊</div>
                      <div className="text-sm text-stone-400 mb-3">Noch keine Noten für {s.name}.</div>
                      <button onClick={() => onOpenOverview && onOpenOverview(s.id)} className="text-sm akzent-text font-medium">
                        Noten erfassen →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── NOTIZEN ── */}
            {profileTab === "notizen" && (
              <div className="p-4 space-y-3 anim-tab">
                <div className="card p-4">
                  <div className="flex gap-2 items-center">
                    <input autoFocus className="input-base flex-1"
                      placeholder="Beobachtung, Info …"
                      value={newNote} maxLength={1000}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onAddNote(s.id)} />
                    <VoiceNoteButton onTranscript={(t) => setNewNote((prev) => prev ? prev + " " + t : t)} />
                    <button onClick={() => onAddNote(s.id)} disabled={!newNote.trim()}
                      className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold akzent-flaeche disabled:opacity-40">✓</button>
                  </div>
                </div>
                {sNotes.length > 0 ? (
                  <div className="tl-wrap">
                    <div className="tl-rail" />
                    {groupByDateLabel(sNotes).map(({ label, items }) => (
                      <div key={label}>
                        <div className="tl-group-label">{label}</div>
                        {items.map((n) => (
                          <div key={n.id} className="tl-entry">
                            <div className="tl-icon">
                              <StickyNote size={15} className="text-stone-400" />
                            </div>
                            <div className="tl-body">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-stone-700 leading-snug flex-1">{n.text}</p>
                                <button onClick={() => onDeleteNote(n.id)} className="shrink-0 text-stone-300 hover:text-red-500 mt-0.5">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <div className="t-caption mt-1.5">{localDate(n.date).toLocaleDateString("de-DE")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card card-p text-center text-sm text-stone-400 py-8">Noch keine Notizen.</div>
                )}
              </div>
            )}

            {/* ── GESPRÄCHE ── */}
            {profileTab === "gespräche" && (
              <div className="p-4 space-y-3 anim-tab">
                <div className="card p-4 space-y-2">
                  <div className="flex gap-1.5">
                    {GESPRAECH_TYPEN.map((t) => (
                      <button key={t.key} onClick={() => setGespraechDraft((d) => ({ ...d, typ: t.key }))}
                        className={`flex-1 py-1.5 rounded-xl border text-xs font-medium transition-colors ${gespraechDraft.typ === t.key ? "akzent-rand akzent-ton akzent-text" : "border-stone-200 text-stone-500"}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {MOOD_OPTIONS.map((m) => (
                      <button key={m.key} onClick={() => setGespraechDraft((d) => ({ ...d, mood: m.key }))}
                        title={m.label}
                        className={`flex-1 py-1.5 rounded-xl border text-base transition-colors ${gespraechDraft.mood === m.key ? "akzent-rand akzent-ton" : "border-stone-200"}`}>
                        {m.emoji}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input className="input-base flex-1"
                      placeholder="Was bewegt das Kind, wie geht es ihm/ihr …"
                      value={gespraechDraft.text} maxLength={1000}
                      onChange={(e) => setGespraechDraft((d) => ({ ...d, text: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && onAddGespraech(s.id)} />
                    <button onClick={() => onAddGespraech(s.id)} disabled={!gespraechDraft.text.trim()}
                      className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold akzent-flaeche disabled:opacity-40">✓</button>
                  </div>
                </div>
                {sGespraeche.length > 0 ? (
                  <div className="tl-wrap">
                    <div className="tl-rail" />
                    {groupByDateLabel(sGespraeche).map(({ label, items }) => (
                      <div key={label}>
                        <div className="tl-group-label">{label}</div>
                        {items.map((g) => {
                          const mood = MOOD_OPTIONS.find((m) => m.key === g.mood);
                          const typ = GESPRAECH_TYPEN.find((t) => t.key === g.gesprTyp);
                          return (
                            <div key={g.id} className="tl-entry">
                              <div className="tl-icon">
                                <span className="text-lg leading-none">{mood?.emoji ?? "💬"}</span>
                              </div>
                              <div className="tl-body">
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {typ && <span className="text-[10px] font-semibold akzent-text bg-[#ECEEE2] px-2 py-0.5 rounded-full">{typ.label}</span>}
                                    <span className="t-caption">{localDate(g.date).toLocaleDateString("de-DE")}</span>
                                  </div>
                                  <button onClick={() => onDeleteNote(g.id)} className="shrink-0 text-stone-300 hover:text-red-500">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                                <p className="text-sm text-stone-700 leading-snug">{g.text}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="card card-p text-center text-sm text-stone-400 py-8">Noch keine Gespräche erfasst.</div>
                )}
              </div>
            )}

            {/* ── MEHR: Förderstatus + Ziele + Stammdaten ── */}
            {profileTab === "mehr" && (
              <div className="p-4 space-y-4 anim-tab">

                {/* Förderstatus Tags */}
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="t-label font-semibold text-stone-700">Förderstatus</div>
                    {foerderTags.length > 0 && (
                      <button onClick={() => onUpdateField(s.id, "foerderStatus", "")}
                        className="text-[11px] text-stone-400 hover:text-red-500 transition-colors">
                        Tags leeren
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {foerderTags.map((tag) => (
                      <span key={tag} className="chip chip-warn flex items-center gap-1">
                        {tag}
                        <button onClick={() => removeFoerderTag(tag)} className="hover:text-red-600 leading-none">×</button>
                      </span>
                    ))}
                    {addingTag ? (
                      <input autoFocus className="input-base text-xs px-2 py-1 w-28"
                        value={newTag} maxLength={30} placeholder="Status …"
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && newTag.trim()) addFoerderTag(newTag); if (e.key === "Escape") { setAddingTag(false); setNewTag(""); } }}
                        onBlur={() => { if (newTag.trim()) addFoerderTag(newTag); else { setAddingTag(false); setNewTag(""); } }}
                      />
                    ) : (
                      <button onClick={() => setAddingTag(true)}
                        className="chip border border-dashed border-stone-300 text-stone-400 hover:border-stone-400">+ Tag</button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-600 mt-3 flex items-start gap-1">
                    <ShieldCheck size={11} className="shrink-0 mt-0.5" />
                    Lern- und Verhaltensauffälligkeiten können besonders geschützte Daten (Art. 9 DSGVO) darstellen — nur mit schriftlicher Einwilligung speichern.
                  </p>
                </div>

                {/* Förderziele */}
                <div className="card p-4">
                  <div className="t-label font-semibold text-stone-700 mb-3">Förderziele</div>
                  <div className="flex gap-1.5 mb-3">
                    <div className="flex shrink-0 rounded-xl overflow-hidden border border-stone-200">
                      {[{ key: "foerder", label: "Förderziel" }, { key: "wochen", label: "Wochenziel" }].map(({ key, label }) => (
                        <button key={key} onClick={() => setZielDraft((d) => ({ ...d, typ: key }))}
                          className={`px-3 py-1.5 text-xs font-semibold transition-colors ${zielDraft.typ === key ? "akzent-flaeche text-white" : "bg-white text-stone-400"}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <input className="input-base flex-1"
                      placeholder={zielDraft.typ === "wochen" ? "Wochenziel eintragen …" : "Förderziel eintragen …"}
                      value={zielDraft.text} maxLength={200}
                      onChange={(e) => setZielDraft((d) => ({ ...d, text: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter" && zielDraft.text.trim()) { onAddFoerderZiel(s.id, zielDraft.text, zielDraft.typ); setZielDraft((d) => ({ ...d, text: "" })); } }} />
                    <button onClick={() => { if (!zielDraft.text.trim()) return; onAddFoerderZiel(s.id, zielDraft.text, zielDraft.typ); setZielDraft((d) => ({ ...d, text: "" })); }}
                      className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold akzent-flaeche">+</button>
                  </div>
                  <ul className="space-y-0">
                    {sZiele.filter((z) => !z.doneAt).map((z) => (
                      <li key={z.id} className="flex items-center gap-3 py-2.5 border-t border-stone-100 first:border-0">
                        <button onClick={() => onToggleFoerderZiel(z.id)} className="shrink-0 w-5 h-5 rounded border-2 border-stone-300 hover:border-green-500 transition-colors" />
                        <div className="flex-1 min-w-0">
                          <span className={`text-[10px] font-semibold mr-1 ${z.typ === "wochen" ? "text-blue-500" : "text-amber-600"}`}>{z.typ === "wochen" ? "Wochenziel" : "Förderziel"}</span>
                          <span className="text-sm text-stone-700">{z.text}</span>
                        </div>
                        <button onClick={() => onDeleteFoerderZiel(z.id)} className="shrink-0 text-stone-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </li>
                    ))}
                    {sZiele.filter((z) => z.doneAt).map((z) => (
                      <li key={z.id} className="flex items-center gap-3 py-2.5 border-t border-stone-100 opacity-50">
                        <button onClick={() => onToggleFoerderZiel(z.id)} className="shrink-0 w-5 h-5 rounded bg-green-500 border-2 border-green-500 flex items-center justify-center">
                          <Check size={11} className="text-white" />
                        </button>
                        <span className="text-sm text-stone-400 line-through flex-1">{z.text}</span>
                        <button onClick={() => onDeleteFoerderZiel(z.id)} className="shrink-0 text-stone-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </li>
                    ))}
                    {!sZiele.length && <li className="text-sm text-stone-400 py-1">Noch keine Ziele eingetragen.</li>}
                  </ul>
                </div>

                {/* Stammdaten */}
                <div className="card p-4 space-y-3">
                  <div className="t-label font-semibold text-stone-700">Stammdaten</div>
                  <input type="file" accept="image/*" id={`photo-stamm-${s.id}`} className="hidden"
                    onChange={(e) => handlePhoto(s.id, e.target.files?.[0])} />
                  {s.photo && (
                    <div className="flex items-center gap-2">
                      <label htmlFor={`photo-stamm-${s.id}`} className="text-xs font-medium text-stone-500 hover:text-stone-800 underline underline-offset-2 cursor-pointer">Foto ändern</label>
                      <button onClick={() => onUpdateField(s.id, "photo", "")} className="text-xs text-stone-400 hover:text-red-500">Entfernen</button>
                    </div>
                  )}
                  <p className="text-[10px] text-stone-400 flex items-center gap-1">
                    <ShieldCheck size={10} className="shrink-0" />
                    Kontaktdaten nur auf diesem Gerät – nicht weitergeben (DSGVO).
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="t-caption mb-1">Geburtstag</div>
                      <input type="date" value={s.birthday || ""} onChange={(e) => onUpdateField(s.id, "birthday", e.target.value)} className="input-base w-full" />
                    </div>
                    <div>
                      <div className="t-caption mb-1">Telefon Eltern</div>
                      <div className="flex gap-1">
                        <input type="tel" placeholder="0176 …" value={s.parentPhone || ""} maxLength={30}
                          onChange={(e) => onUpdateField(s.id, "parentPhone", e.target.value)} className="input-base flex-1 min-w-0" />
                        {/* Nur Ziffern und Telefon-Sonderzeichen in die URL lassen -
                            eine importierte Nummer koennte sonst Fremdes einschleusen. */}
                        {s.parentPhone && telHref(s.parentPhone) && (
                          <a href={telHref(s.parentPhone)} className="shrink-0 w-9 h-9 rounded-lg akzent-ton flex items-center justify-center" title="Anrufen"><Phone size={15} /></a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="t-caption mb-1">Name Erziehungsberechtigte</div>
                    <input placeholder="z. B. Frau Mustermann" value={s.parentName || ""} maxLength={100}
                      onChange={(e) => onUpdateField(s.id, "parentName", e.target.value)} className="input-base w-full" />
                  </div>
                  <div>
                    <div className="t-caption mb-1 flex items-center gap-1.5">
                      Besonderheiten / Vorerkrankungen
                      <span className="text-[9px] text-amber-600 font-semibold">(nur mit Einwilligung)</span>
                    </div>
                    <textarea
                      placeholder="z. B. Nussallergie, Asthma-Spray in der Tasche …"
                      value={s.medicalInfo || ""}
                      onChange={(e) => onUpdateField(s.id, "medicalInfo", e.target.value)}
                      onFocus={() => { if (!hatMedicalConsent(s.id) && !s.medicalInfo) setShowMedicalConsent(s.id); }}
                      rows={3} maxLength={2000} className="input-base w-full resize-none"
                    />
                    <p className="text-[11px] text-amber-600 mt-1 flex items-start gap-1">
                      <ShieldCheck size={11} className="shrink-0 mt-0.5" />
                      Gesundheitsdaten (Art. 9 DSGVO) – nur mit schriftlicher Einwilligung speichern.
                    </p>
                  </div>
                  {s.medicalInfo && (
                    <button onClick={() => onUpdateField(s.id, "medicalInfo", "")} className="text-[11px] text-red-400 hover:text-red-600">
                      Gesundheitsdaten löschen
                    </button>
                  )}
                </div>

                {/* Unterlagen zum Kind - Entschuldigung, Attest, Gutachten, Foerderplan */}
                <div className="card card-p">
                  <DokumenteBlock
                    scope="student"
                    scopeId={s.id}
                    documents={documents}
                    update={update}
                    hinweis="Atteste und Gutachten sind Gesundheitsdaten (Art. 9 DSGVO) – nur mit Einwilligung ablegen. Dokumente liegen auf diesem Gerät und stecken nicht in der normalen Datensicherung."
                  />
                </div>

              </div>
            )}

            <div className="h-6" />
          </div>
        </div>
      );
    })()}

    <ConfirmDialog
      open={!!confirmDeleteId}
      title="Kind wirklich löschen?"
      message="Das Kind wird in den Papierkorb verschoben und kann dort 30 Tage wiederhergestellt werden (Einstellungen → Papierkorb). Alle zugehörigen Noten und Notizen kommen mit."
      confirmLabel="Löschen"
      onConfirm={() => { onDeleteStudent(confirmDeleteId); setConfirmDeleteId(null); }}
      onCancel={() => setConfirmDeleteId(null)}
    />
    </>
  );
}

/* Versetzung zum neuen Schuljahr: ausgewählte Klassen eine Stufe hochzählen (5c → 6c) */
function PromoteModal({ classes, promotedName, onPromote, onClose }) {
  const [selected, setSelected] = useState(() => new Set(classes.map((c) => c.id)));

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="font-semibold text-stone-800">Schuljahreswechsel: Klassen versetzen</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-stone-400 mb-4">Zum neuen Schuljahr: Die führende Zahl im Klassennamen wird um eins erhöht. Schüler:innen, Fächer und Noten bleiben erhalten.</p>

        <ul className="space-y-1.5 mb-4">
          {classes.map((c) => {
            const on = selected.has(c.id);
            const newName = promotedName(c.name);
            const unchanged = newName === c.name;
            return (
              <li key={c.id}>
                <button
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border text-left ${on ? "akzent-rand akzent-ton" : "border-stone-200"}`}
                >
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? "akzent-flaeche akzent-rand" : "border-stone-300"}`}>
                    {on && <Check size={13} />}
                  </span>
                  <span className="flex-1 text-sm text-stone-700">{c.name}</span>
                  {on && !unchanged && (
                    <span className="text-sm akzent-text font-medium flex items-center gap-1">
                      <ChevronRight size={13} /> {newName}
                    </span>
                  )}
                  {on && unchanged && <span className="text-xs text-stone-400">keine Zahl im Namen</span>}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={() => onPromote(Array.from(selected))} className="flex-1 justify-center">{selected.size} versetzen</Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Dienste (Klassendienste mit Rotation) ---------- */

const DUTY_PRESETS = ["Tafeldienst", "Ordnungsdienst", "Austeilen", "Fegen", "Blumendienst", "Papierdienst", "Milchdienst"];

/* Warteschlange auf gültige Kinder begrenzen und neu dazugekommene ergänzen */
function cleanDutyQueue(duty, students) {
  const ids = students.map((s) => s.id);
  const queue = (duty.queue || []).filter((id) => ids.includes(id));
  const done = (duty.done || []).filter((id) => ids.includes(id));
  const fehlend = ids.filter((id) => !queue.includes(id) && !done.includes(id));
  return { queue: [...queue, ...fehlend], done };
}

/* Zentrale Zuteilung: Ein Kind kann immer nur in EINEM Dienst gleichzeitig dran sein.
   Ist es bereits eingeteilt, wird es übersprungen und rückt später nach. */
function computeDutyAssignments(duties, students) {
  const belegt = new Set();
  const map = {};
  duties.forEach((duty) => {
    const { queue } = cleanDutyQueue(duty, students);
    const slots = duty.slots || 1;
    const gewaehlt = [];
    for (const id of queue) {
      if (gewaehlt.length >= slots) break;
      if (belegt.has(id)) continue;
      gewaehlt.push(id);
    }
    gewaehlt.forEach((id) => belegt.add(id));
    map[duty.id] = gewaehlt;
  });
  return { map, belegt };
}

function DiensteTab({ data, update }) {
  const [selectedClass, setSelectedClass] = useState(data.classes[0]?.id ?? null);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [confirmWeek, setConfirmWeek] = useState(false);

  const duties = (data.duties || []).filter((d) => d.classId === selectedClass);
  const classStudents = data.students.filter((s) => s.classId === selectedClass);

  function studentById(id) {
    return data.students.find((s) => s.id === id);
  }

  const cleanQueue = cleanDutyQueue;

  const assignments = useMemo(() => computeDutyAssignments(duties, classStudents), [duties, classStudents]);

  function addDuty({ name, color, slots }) {
    update((d) => {
      d.duties = d.duties || [];
      d.duties.push({
        id: uid(),
        classId: selectedClass,
        name,
        color,
        slots,
        queue: data.students.filter((s) => s.classId === selectedClass).map((s) => s.id),
        done: [],
        round: 1,
        log: [],
      });
      return d;
    });
    setShowNew(false);
  }

  function deleteDuty(id) {
    update((d) => {
      d.duties = (d.duties || []).filter((x) => x.id !== id);
      return d;
    });
  }

  // Dienst erledigt: Kinder wandern in "erledigt", nächste rücken nach
  function markDone(dutyId, ids = null) {
    update((d) => {
      const duty = d.duties.find((x) => x.id === dutyId);
      if (!duty) return d;
      const students = d.students.filter((s) => s.classId === duty.classId);
      const cleaned = cleanQueue(duty, students);
      duty.queue = cleaned.queue;
      duty.done = cleaned.done;
      duty.repeats = duty.repeats || {};
      const slots = duty.slots || 1;
      const aktuell = ids ? (Array.isArray(ids) ? ids : [ids]) : duty.queue.slice(0, slots);
      if (!aktuell.length) return d;
      const heute = isoDate(new Date());
      aktuell.forEach((id) => {
        if (!duty.done.includes(id)) duty.done.push(id);
        delete duty.repeats[id];
        duty.log = duty.log || [];
        duty.log.unshift({ studentId: id, date: heute, status: "erledigt" });
      });
      duty.queue = duty.queue.filter((id) => !aktuell.includes(id));
      // Runde vorbei: alle waren dran, neue Runde starten
      if (!duty.queue.length) {
        duty.round = (duty.round || 1) + 1;
        duty.queue = students.map((s) => s.id);
        duty.done = [];
        duty.repeats = {};
      }
      return d;
    });
  }

  // Dienst nicht ordentlich gemacht: Kind bleibt vorne und macht ihn erneut
  function repeatDuty(dutyId, studentId) {
    update((d) => {
      const duty = d.duties.find((x) => x.id === dutyId);
      if (!duty) return d;
      duty.repeats = duty.repeats || {};
      duty.repeats[studentId] = (duty.repeats[studentId] || 0) + 1;
      duty.queue = [studentId, ...(duty.queue || []).filter((id) => id !== studentId)];
      duty.log = duty.log || [];
      duty.log.unshift({ studentId, date: isoDate(new Date()), status: "wiederholen" });
      return d;
    });
  }

  // Kind krank: behält seinen Anspruch, rutscht ans Ende der Warteschlange
  function postpone(dutyId, studentId) {
    update((d) => {
      const duty = d.duties.find((x) => x.id === dutyId);
      if (!duty) return d;
      const students = d.students.filter((s) => s.classId === duty.classId);
      const cleaned = cleanQueue(duty, students);
      duty.queue = cleaned.queue;
      duty.done = cleaned.done;
      if (duty.queue.length < 2) return d; // niemand zum Tauschen da
      duty.queue = [...duty.queue.filter((id) => id !== studentId), studentId];
      duty.log = duty.log || [];
      duty.log.unshift({ studentId, date: isoDate(new Date()), status: "verschoben" });
      return d;
    });
  }

  // Einzelnes Kind vorziehen (z. B. weil es wieder gesund ist)
  function moveToFront(dutyId, studentId) {
    update((d) => {
      const duty = d.duties.find((x) => x.id === dutyId);
      if (!duty) return d;
      duty.queue = [studentId, ...(duty.queue || []).filter((id) => id !== studentId)];
      return d;
    });
  }

  // Ganze Woche abhaken: jeder aktuell eingeteilte Dienst gilt als erledigt
  function finishWeek() {
    const heute = isoDate(new Date());
    update((d) => {
      duties.forEach((duty0) => {
        const ids = assignments.map[duty0.id] || [];
        if (!ids.length) return;
        const duty = d.duties.find((x) => x.id === duty0.id);
        if (!duty) return;
        const students = d.students.filter((s) => s.classId === duty.classId);
        const cleaned = cleanQueue(duty, students);
        duty.queue = cleaned.queue;
        duty.done = cleaned.done;
        duty.repeats = duty.repeats || {};
        duty.log = duty.log || [];
        ids.forEach((id) => {
          if (!duty.done.includes(id)) duty.done.push(id);
          delete duty.repeats[id];
          duty.log.unshift({ studentId: id, date: heute, status: "erledigt" });
        });
        duty.queue = duty.queue.filter((id) => !ids.includes(id));
        if (!duty.queue.length) {
          duty.round = (duty.round || 1) + 1;
          duty.queue = students.map((s) => s.id);
          duty.done = [];
          duty.repeats = {};
        }
      });
      return d;
    });
    setConfirmWeek(false);
  }

  function resetRound(dutyId) {
    update((d) => {
      const duty = d.duties.find((x) => x.id === dutyId);
      if (!duty) return d;
      const students = d.students.filter((s) => s.classId === duty.classId);
      duty.queue = students.map((s) => s.id);
      duty.done = [];
      duty.round = 1;
      duty.log = [];
      duty.repeats = {};
      return d;
    });
  }

  return (
    <div className="space-y-4">
      {/* Klassenwahl */}
      <div className="flex flex-wrap gap-2">
        {data.classes.map((c) => (
          <button
            key={c.id}
            onClick={() => { setSelectedClass(c.id); setExpanded(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm ${selectedClass === c.id ? "akzent-flaeche text-white" : "bg-white border border-stone-200 text-stone-600"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {!data.classes.length && <p className="text-sm text-stone-400">Lege zunächst eine Klasse an.</p>}

      {!!selectedClass && (
        <>
          {!!duties.length && (
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-800">Dienste</span>
                    <span className="inline-flex flex-col items-center leading-tight akzent-text akzent-ton px-2.5 py-1 rounded-lg">
                      <span className="text-[11px] font-semibold"><Abbr short={`KW ${currentSchoolWeek().kw}`} long="Kalenderwoche" /></span>
                      <span className="text-[10px] opacity-80 tnum">{currentSchoolWeek().range}</span>
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mt-0.5">{duties.length} Dienste · {assignments.belegt.size} Kinder eingeteilt</div>
                </div>
                {!!assignments.belegt.size && (
                  <Button variant="subtle" onClick={() => setConfirmWeek(true)} className="shrink-0">
                    <Check size={15} /> Woche fertig
                  </Button>
                )}
              </div>

              <ul className="divide-y divide-stone-100">
                {duties.map((duty) => {
                  const { queue, done } = cleanQueue(duty, classStudents);
                  const aktuellIds = assignments.map[duty.id] || [];
                  const aktuell = aktuellIds.map(studentById).filter(Boolean);
                  const gesamt = classStudents.length;
                  const fertig = done.length;
                  const pct = gesamt ? Math.round((fertig / gesamt) * 100) : 0;
                  const open = expanded === duty.id;
                  const hatWiederholung = aktuellIds.some((id) => (duty.repeats || {})[id]);

                  return (
                    <li key={duty.id}>
                      {/* Kompakte Zeile */}
                      <button
                        onClick={() => setExpanded(open ? null : duty.id)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 ${open ? "bg-stone-50" : "hover:bg-stone-50"}`}
                      >
                        <span className="w-1.5 self-stretch min-h-[38px] rounded-full shrink-0" style={{ backgroundColor: duty.color }} />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-stone-800">{duty.name}</span>
                            <span className="text-xs text-stone-400">{fertig}/{gesamt} · <Abbr short={`Runde ${duty.round || 1}`} long="Wie oft alle Kinder schon an der Reihe waren" /></span>
                            {hatWiederholung && (
                              <span className="text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full"><Abbr short="Wdh." long="Wiederholung – Kind war schon einmal dran" /></span>
                            )}
                          </div>

                          {/* Wer ist dran – mit vollem Namen */}
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {aktuell.length ? (
                              aktuell.map((s) => (
                                <span key={s.id} className="inline-flex items-center gap-1.5 bg-stone-100 rounded-full pl-0.5 pr-2 py-0.5">
                                  <StudentAvatar student={s} size={20} />
                                  <span className="text-xs text-stone-700">{s.name}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-stone-300">niemand eingeteilt</span>
                            )}
                          </div>
                        </div>

                        <ChevronRight size={16} className={`text-stone-300 shrink-0 mt-1 transition-transform ${open ? "rotate-90" : ""}`} />
                      </button>

                      {/* Fortschritt */}
                      <div className="h-1 bg-stone-100">
                        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: duty.color }} />
                      </div>

                      {/* Aufgeklappt: Aktionen und Details */}
                      {open && (
                        <div className="px-4 py-4 bg-stone-50 space-y-4">
                          {aktuell.length ? (
                            <div className="space-y-3">
                              {aktuell.map((s) => {
                                const wiederholung = (duty.repeats || {})[s.id] || 0;
                                return (
                                  <div key={s.id}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <StudentAvatar student={s} size={28} />
                                      <span className="flex-1 text-sm font-medium text-stone-800 truncate">{s.name}</span>
                                      {wiederholung > 0 && (
                                        <span className="text-[10px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full shrink-0">
                                          Wiederholung{wiederholung > 1 ? ` ×${wiederholung}` : ""}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => markDone(duty.id, s.id)}
                                        className="flex-1 text-xs py-2 rounded-lg akzent-flaeche text-white font-medium"
                                      >
                                        Erledigt
                                      </button>
                                      <button
                                        onClick={() => repeatDuty(duty.id, s.id)}
                                        className="flex-1 text-xs py-2 rounded-lg bg-white border border-stone-200 text-stone-600"
                                        title="Nicht ordentlich gemacht – nächste Woche nochmal"
                                      >
                                        Nochmal
                                      </button>
                                      <button
                                        onClick={() => postpone(duty.id, s.id)}
                                        className="flex-1 text-xs py-2 rounded-lg bg-white border border-stone-200 text-stone-600"
                                        title="Kind fehlt – später nachholen"
                                      >
                                        Fehlt
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                              {aktuell.length > 1 && (
                                <Button onClick={() => markDone(duty.id, aktuellIds)} className="w-full justify-center">
                                  <Check size={15} /> Alle erledigt
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-stone-400">
                              {classStudents.length
                                ? "Alle Kinder sind gerade in anderen Diensten eingeteilt. Sobald dort abgehakt ist, rückt hier jemand nach."
                                : "Keine Schüler:innen in dieser Klasse."}
                            </p>
                          )}

                          <div>
                            <div className="text-xs font-medium text-stone-500 mb-2">Warteschlange</div>
                            <ol className="space-y-1">
                              {queue.filter((id) => !aktuellIds.includes(id)).map((id, i) => {
                                const s = studentById(id);
                                if (!s) return null;
                                const wiederholung = (duty.repeats || {})[id] || 0;
                                const letzterEintrag = (duty.log || []).find((l) => l.studentId === id);
                                const nachzuholen = !wiederholung && letzterEintrag?.status === "verschoben";
                                const anderweitig = assignments.belegt.has(id);
                                return (
                                  <li key={id} className="flex items-center gap-2 text-sm">
                                    <span className="w-5 text-xs text-stone-300 shrink-0">{i + 1}.</span>
                                    <StudentAvatar student={s} size={22} />
                                    <span className="flex-1 text-stone-700 truncate">{s.name}</span>
                                    {anderweitig && (
                                      <span className="text-[10px] text-stone-500 bg-stone-200/70 px-1.5 py-0.5 rounded-full shrink-0">anderer Dienst</span>
                                    )}
                                    {nachzuholen && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">nachzuholen</span>
                                    )}
                                    <button
                                      onClick={() => moveToFront(duty.id, id)}
                                      className="text-xs text-stone-400 hover:akzent-text shrink-0"
                                      title="Nach vorne holen"
                                    >
                                      ↑
                                    </button>
                                  </li>
                                );
                              })}
                              {queue.filter((id) => !aktuellIds.includes(id)).length === 0 && (
                                <li className="text-sm text-stone-400">Niemand mehr in der Warteschlange.</li>
                              )}
                            </ol>
                          </div>

                          {!!done.length && (
                            <div>
                              <div className="text-xs font-medium text-stone-500 mb-2">Erledigt ({done.length})</div>
                              <ul className="space-y-1">
                                {done.map((id) => {
                                  const s = studentById(id);
                                  if (!s) return null;
                                  const eintrag = (duty.log || []).find((l) => l.studentId === id && l.status === "erledigt");
                                  return (
                                    <li key={id} className="flex items-center gap-2 text-sm">
                                      <span className="w-5 flex justify-center shrink-0">
                                        <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                                          <Check size={11} strokeWidth={3} />
                                        </span>
                                      </span>
                                      <span className="opacity-50"><StudentAvatar student={s} size={22} /></span>
                                      <span className="flex-1 text-stone-400 line-through truncate">{s.name}</span>
                                      {eintrag && (
                                        <span className="text-[10px] text-stone-400 shrink-0">
                                          {localDate(eintrag.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                                        </span>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}

                          <div className="flex justify-between">
                            <Button variant="ghost" onClick={() => resetRound(duty.id)}>Zurücksetzen</Button>
                            <Button variant="danger" onClick={() => deleteDuty(duty.id)}><Trash2 size={15} /> Löschen</Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {!duties.length && (
            <Card className="p-5 text-sm text-stone-400">
              Noch keine Dienste angelegt. Lege z. B. einen Tafeldienst an – die App teilt ihn dann der Reihe nach allen Kindern zu.
            </Card>
          )}

          <Button onClick={() => setShowNew(true)} className="w-full justify-center">
            <Plus size={15} /> Neuer Dienst
          </Button>
        </>
      )}

      {showNew && <DutyModal onSave={addDuty} onClose={() => setShowNew(false)} />}

      {confirmWeek && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50" onClick={() => setConfirmWeek(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-stone-800 mb-2">Woche abschließen?</div>
            <p className="text-sm text-stone-600 mb-3">
              Alle aktuell eingeteilten Kinder werden als <strong>erledigt</strong> abgehakt und die nächsten rücken nach.
            </p>
            <ul className="text-xs text-stone-500 space-y-1 mb-4 max-h-40 overflow-y-auto">
              {duties.map((duty) => {
                const namen = (assignments.map[duty.id] || []).map((id) => studentById(id)?.name.split(" ")[0]).filter(Boolean);
                if (!namen.length) return null;
                return <li key={duty.id}>• {duty.name}: {namen.join(", ")}</li>;
              })}
            </ul>
            <p className="text-xs text-stone-400 mb-4">
              Kinder, die fehlten oder nachbessern müssen, hakst du besser einzeln ab.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmWeek(false)} className="flex-1 justify-center">Abbrechen</Button>
              <Button onClick={finishWeek} className="flex-1 justify-center">Abhaken</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DutyModal({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [slots, setSlots] = useState(1);

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={onClose}>
      <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-3.5 flex items-center justify-between">
          <div className="font-semibold text-stone-800">Neuer Dienst</div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-5 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
          <Field label="Bezeichnung">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Tafeldienst" autoFocus maxLength={50} />
          </Field>

          <div className="flex flex-wrap gap-1.5">
            {DUTY_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setName(p)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border ${name === p ? "akzent-rand akzent-ton" : "border-stone-200 text-stone-600"}`}
              >
                {p}
              </button>
            ))}
          </div>

          <Field label="Farbe">
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full"
                  style={{ backgroundColor: c, boxShadow: c === color ? "0 0 0 2px white, 0 0 0 3.5px #292524" : "0 0 0 2px white" }}
                />
              ))}
            </div>
          </Field>

          <Field label="Wie viele Kinder gleichzeitig?">
            <div className="flex gap-1.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setSlots(n)}
                  className={`flex-1 text-sm py-2 rounded-lg border ${slots === n ? "akzent-flaeche akzent-rand" : "border-stone-200 text-stone-500"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <Button
            onClick={() => name.trim() && onSave({ name: name.trim(), color, slots })}
            className="w-full justify-center"
          >
            Dienst anlegen
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Sitzplan ---------- */

const SITZPLAN_TOKEN_R = 18;  // visual radius px (token = 36px diameter)
const SITZPLAN_COLLISION_R = 23; // collision radius px (gives ~5px gap between tokens)
const SITZPLAN_GRID_PX = 50;  // grid cell size in px

// Snap to nearest free grid cell (BFS outward from target cell)
function snapToGrid(pos, canvasRect, existingPositions, excludeId = null) {
  if (!canvasRect || canvasRect.width === 0) return pos;
  const stepX = SITZPLAN_GRID_PX / canvasRect.width;
  const stepY = SITZPLAN_GRID_PX / canvasRect.height;
  const m = SITZPLAN_COLLISION_R;
  const minX = m / canvasRect.width;
  const maxX = 1 - m / canvasRect.width;
  const minY = m / canvasRect.height;
  const maxY = 1 - m / canvasRect.height;

  const occupied = new Set();
  for (const [id, p] of Object.entries(existingPositions)) {
    if (id === excludeId) continue;
    occupied.add(`${Math.round(p.x / stepX)},${Math.round(p.y / stepY)}`);
  }

  const tx = Math.round(pos.x / stepX);
  const ty = Math.round(pos.y / stepY);
  const queue = [[tx, ty]];
  const seen = new Set([`${tx},${ty}`]);

  for (let i = 0; i < queue.length && i < 200; i++) {
    const [cx, cy] = queue[i];
    const rx = cx * stepX;
    const ry = cy * stepY;
    if (rx >= minX && rx <= maxX && ry >= minY && ry <= maxY && !occupied.has(`${cx},${cy}`)) {
      return { x: rx, y: ry };
    }
    for (const [dx, dy] of [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const k = `${cx + dx},${cy + dy}`;
      if (!seen.has(k)) { seen.add(k); queue.push([cx + dx, cy + dy]); }
    }
  }
  return pos;
}

// Push overlapping tokens apart until none overlap or max iterations reached
function resolveCollisions(positions, canvasRect) {
  if (!canvasRect || canvasRect.width === 0) return positions;
  const ids = Object.keys(positions);
  if (ids.length < 2) return positions;
  const minDist = SITZPLAN_COLLISION_R * 2;
  // Convert to pixels for distance math
  const px = {};
  for (const id of ids) px[id] = { x: positions[id].x * canvasRect.width, y: positions[id].y * canvasRect.height };
  for (let iter = 0; iter < 20; iter++) {
    let any = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = px[ids[i]], b = px[ids[j]];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) / 2 + 1;
          const nx = dx / dist, ny = dy / dist;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          any = true;
        }
      }
    }
    if (!any) break;
  }
  const m = SITZPLAN_COLLISION_R;
  const result = {};
  for (const id of ids) {
    result[id] = {
      ...positions[id],
      x: Math.max(m / canvasRect.width,  Math.min(1 - m / canvasRect.width,  px[id].x / canvasRect.width)),
      y: Math.max(m / canvasRect.height, Math.min(1 - m / canvasRect.height, px[id].y / canvasRect.height)),
    };
  }
  return result;
}

const QUALITY_COLORS = { gut: "#16a34a", mittel: "#d97706", schlecht: "#dc2626" };

function SitzplanToken({ student, pos, quality, canvasRef, onDragEnd, onTap }) {
  const elRef = useRef(null);
  const circleRef = useRef(null);
  const dragRef = useRef(null);
  const currentPosRef = useRef(pos);

  useEffect(() => {
    currentPosRef.current = pos;
    if (elRef.current && !dragRef.current) {
      elRef.current.style.left = `${pos.x * 100}%`;
      elRef.current.style.top = `${pos.y * 100}%`;
    }
  }, [pos.x, pos.y]);

  useEffect(() => {
    if (circleRef.current && !dragRef.current) {
      circleRef.current.style.outline = quality ? `2px solid ${QUALITY_COLORS[quality]}` : "none";
    }
  }, [quality]);

  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? "")).toUpperCase();
  }

  function firstName(name) {
    return name.split(" ")[0].slice(0, 10);
  }

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      startPosX: currentPosRef.current.x,
      startPosY: currentPosRef.current.y,
      rect,
      moved: false,
    };
    elRef.current.style.zIndex = "20";
    elRef.current.style.cursor = "grabbing";
    if (circleRef.current) {
      circleRef.current.style.transform = "scale(1.1)";
      circleRef.current.style.background = "#3d4433";
    }
  }

  function onPointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    if (!dragRef.current.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragRef.current.moved = true;
    }
    if (!dragRef.current.moved) return;
    const { startPosX, startPosY, rect } = dragRef.current;
    const mx = SITZPLAN_COLLISION_R / rect.width;
    const my = SITZPLAN_COLLISION_R / rect.height;
    const newX = Math.max(mx, Math.min(1 - mx, startPosX + dx / rect.width));
    const newY = Math.max(my, Math.min(1 - my, startPosY + dy / rect.height));
    currentPosRef.current = { x: newX, y: newY };
    elRef.current.style.left = `${newX * 100}%`;
    elRef.current.style.top = `${newY * 100}%`;
  }

  function onPointerUp(e) {
    if (!dragRef.current) return;
    const moved = dragRef.current.moved;
    dragRef.current = null;
    elRef.current.style.zIndex = "5";
    elRef.current.style.cursor = "grab";
    if (circleRef.current) {
      circleRef.current.style.transform = "";
      circleRef.current.style.background = "#4F5844";
    }
    if (!moved) {
      onTap(e.clientX, e.clientY);
    } else {
      onDragEnd(currentPosRef.current);
    }
  }

  return (
    <div
      ref={elRef}
      className="absolute select-none touch-none"
      style={{
        left: `${pos.x * 100}%`,
        top: `${pos.y * 100}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 5,
        cursor: "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Avatar circle — 36px */}
      <div
        ref={circleRef}
        className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shadow text-white"
        style={{
          background: "#4F5844",
          transition: "transform 0.1s",
          outline: quality ? `2px solid ${QUALITY_COLORS[quality]}` : "none",
          outlineOffset: "1px",
        }}
      >
        {initials(student.name)}
      </div>
      {/* Name */}
      <div className="text-center text-[9px] font-medium text-stone-600 mt-0.5 whitespace-nowrap leading-none">
        {firstName(student.name)}
      </div>
    </div>
  );
}

function SitzplanModal({ cls, students, sitzplan, onSave, onClose }) {
  // positions: { [studentId]: { x: number, y: number } }  — 0–1 relative to canvas
  const [positions, setPositions] = useState(() => sitzplan?.positions ? { ...sitzplan.positions } : {});
  const [tafelEdge, setTafelEdge] = useState(sitzplan?.tafelEdge ?? "top");
  const [showPicker, setShowPicker] = useState(false);
  const [pendingPos, setPendingPos] = useState(null); // where to place the next picked student
  const [pickerSearch, setPickerSearch] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [activePopup, setActivePopup] = useState(null); // { studentId, screenX, screenY }
  const canvasRef = useRef(null);
  const canvasTapStart = useRef(null);
  const tafelDragRef = useRef(null);

  const activeStudents = students.filter((s) => !s.deletedAt);
  const placed = new Set(Object.keys(positions));
  const unplaced = activeStudents.filter((s) => !placed.has(s.id));
  const placedCount = placed.size;

  function removeStudent(studentId) {
    setPositions((prev) => { const next = { ...prev }; delete next[studentId]; return next; });
  }

  function handleDragEnd(studentId, newPos) {
    setPositions((prev) => resolveCollisions(
      { ...prev, [studentId]: { ...prev[studentId], ...newPos } },
      canvasRef.current?.getBoundingClientRect()
    ));
  }

  function handleQualitySet(studentId, value) {
    setPositions((prev) => ({ ...prev, [studentId]: { ...prev[studentId], quality: value ?? undefined } }));
  }

  function handleTokenTap(studentId, screenX, screenY) {
    setActivePopup((prev) => prev?.studentId === studentId ? null : { studentId, screenX, screenY });
  }

  function handleCanvasPointerDown(e) {
    if (e.target !== canvasRef.current) return;
    canvasTapStart.current = { x: e.clientX, y: e.clientY };
  }

  function handleCanvasPointerUp(e) {
    if (!canvasTapStart.current || e.target !== canvasRef.current) { canvasTapStart.current = null; return; }
    const dx = Math.abs(e.clientX - canvasTapStart.current.x);
    const dy = Math.abs(e.clientY - canvasTapStart.current.y);
    canvasTapStart.current = null;
    if (dx > 8 || dy > 8 || unplaced.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0.06, Math.min(0.94, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height));
    setPendingPos({ x, y });
    setShowPicker(true);
  }

  function openPickerCenter() {
    const spread = () => 0.35 + Math.random() * 0.3;
    setPendingPos({ x: spread(), y: spread() });
    setShowPicker(true);
  }

  function pickStudent(studentId) {
    const pos = pendingPos ?? { x: 0.35 + Math.random() * 0.3, y: 0.35 + Math.random() * 0.3 };
    setPositions((prev) => resolveCollisions({ ...prev, [studentId]: pos }, canvasRef.current?.getBoundingClientRect()));
    setShowPicker(false);
    setPickerSearch("");
    setPendingPos(null);
  }

  function handleCleanup() {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const stepX = SITZPLAN_GRID_PX / rect.width;
    const stepY = SITZPLAN_GRID_PX / rect.height;
    // Sortiert nach aktuellem Raster-Reihe dann -Spalte → Reihenfolge bleibt erhalten
    const sorted = Object.keys(positions).sort((a, b) => {
      const ay = Math.round(positions[a].y / stepY), by = Math.round(positions[b].y / stepY);
      return ay !== by ? ay - by : Math.round(positions[a].x / stepX) - Math.round(positions[b].x / stepX);
    });
    const newPos = {};
    const occupied = {};
    for (const id of sorted) {
      const snapped = snapToGrid(positions[id], rect, occupied);
      newPos[id] = { ...positions[id], ...snapped };
      occupied[id] = snapped;
    }
    setPositions(newPos);
  }

  function clearPlan() {
    setPositions({});
    setShowConfirmClear(false);
  }

  function onTafelPointerDown(e) {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    tafelDragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
  }

  function onTafelPointerMove(e) {
    if (!tafelDragRef.current) return;
    const dx = Math.abs(e.clientX - tafelDragRef.current.startX);
    const dy = Math.abs(e.clientY - tafelDragRef.current.startY);
    if (dx > 6 || dy > 6) tafelDragRef.current.moved = true;
  }

  function onTafelPointerUp(e) {
    if (!tafelDragRef.current) return;
    const moved = tafelDragRef.current.moved;
    tafelDragRef.current = null;
    if (!moved) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const distTop = relY;
    const distBottom = 1 - relY;
    const distLeft = relX;
    const distRight = 1 - relX;
    const min = Math.min(distTop, distBottom, distLeft, distRight);
    if (min === distTop) setTafelEdge("top");
    else if (min === distBottom) setTafelEdge("bottom");
    else if (min === distLeft) setTafelEdge("left");
    else setTafelEdge("right");
  }

  function save() {
    onSave({ positions, tafelEdge });
    onClose();
  }

  function initials(name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? parts[0][1] ?? "")).toUpperCase();
  }

  const filteredUnplaced = unplaced.filter((s) =>
    s.name.toLowerCase().includes(pickerSearch.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 bg-stone-900/50 z-[60] flex items-end md:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-2xl rounded-t-3xl md:rounded-2xl shadow-xl flex flex-col"
        style={{ maxHeight: "98dvh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-100 shrink-0">
          <div>
            <div className="font-semibold text-stone-900">Sitzplan</div>
            <div className="text-xs text-stone-400">{cls.name} · {placedCount} von {activeStudents.length} platziert</div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={save}>Speichern</Button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200"><X size={16} /></button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 px-4 py-3 min-h-0">
          <div
            ref={canvasRef}
            className="relative w-full h-full rounded-2xl overflow-hidden"
            style={{ background: "#F4F1E8", minHeight: "380px", height: "100%" }}
            onPointerDown={handleCanvasPointerDown}
            onPointerUp={handleCanvasPointerUp}
          >
            {/* Tafel — draggable, snaps to nearest edge */}
            {(() => {
              const isH = tafelEdge === "top" || tafelEdge === "bottom";
              const baseStyle = {
                position: "absolute",
                zIndex: 3,
                cursor: "grab",
                userSelect: "none",
                touchAction: "none",
                ...(tafelEdge === "top"    ? { top: 0, left: 0, right: 0 } :
                    tafelEdge === "bottom" ? { bottom: 0, left: 0, right: 0 } :
                    tafelEdge === "left"   ? { left: 0, top: 0, bottom: 0 } :
                                             { right: 0, top: 0, bottom: 0 }),
              };
              return (
                <div
                  style={baseStyle}
                  className={`bg-[#4F5844] text-white flex items-center justify-center gap-1.5 select-none
                    ${isH ? "h-9" : "w-9"}
                    ${tafelEdge === "top" ? "rounded-b-lg" : tafelEdge === "bottom" ? "rounded-t-lg" : tafelEdge === "left" ? "rounded-r-lg" : "rounded-l-lg"}`}
                  onPointerDown={onTafelPointerDown}
                  onPointerMove={onTafelPointerMove}
                  onPointerUp={onTafelPointerUp}
                >
                  {isH ? (
                    <>
                      <GripVertical size={12} className="opacity-50 shrink-0" />
                      <span className="text-xs font-semibold tracking-wider">Tafel</span>
                      <GripVertical size={12} className="opacity-50 shrink-0" />
                    </>
                  ) : (
                    <span
                      className="text-xs font-semibold tracking-wider"
                      style={{ writingMode: "vertical-rl", transform: tafelEdge === "left" ? "rotate(180deg)" : "none" }}
                    >
                      Tafel
                    </span>
                  )}
                </div>
              );
            })()}

            {placedCount === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
                <p className="text-stone-400 text-sm text-center px-10">Auf die Fläche tippen, um ein Kind zu platzieren</p>
              </div>
            )}
            {activeStudents.filter((s) => positions[s.id]).map((s) => (
              <SitzplanToken
                key={s.id}
                student={s}
                pos={positions[s.id]}
                quality={positions[s.id]?.quality ?? null}
                canvasRef={canvasRef}
                onDragEnd={(newPos) => handleDragEnd(s.id, newPos)}
                onTap={(sx, sy) => handleTokenTap(s.id, sx, sy)}
              />
            ))}
          </div>
        </div>

        {/* Quality legend */}
        <div className="flex items-center gap-3 px-4 py-1.5 border-t border-stone-100 shrink-0 flex-wrap">
          <span className="text-[10px] text-stone-400 shrink-0">Tippen zum Markieren:</span>
          {[
            { key: "gut", color: "#16a34a", label: "Klappt gut" },
            { key: "mittel", color: "#d97706", label: "Beobachten" },
            { key: "schlecht", color: "#dc2626", label: "Klappt nicht" },
          ].map(({ key, color, label }) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-[10px] text-stone-500 whitespace-nowrap">{label}</span>
            </span>
          ))}
        </div>

        {/* Toolbar */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-t border-stone-100 shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={openPickerCenter}
            disabled={unplaced.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#4F5844] text-white text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            <Plus size={14} />
            Kind hinzufügen
            {unplaced.length > 0 && (
              <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[11px]">{unplaced.length}</span>
            )}
          </button>
          <button
            onClick={handleCleanup}
            disabled={placedCount < 2}
            className="px-3 py-2 rounded-xl text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30 transition-colors"
          >
            Aufräumen
          </button>
          <button
            onClick={() => setShowConfirmClear(true)}
            disabled={placedCount === 0}
            className="ml-auto px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
          >
            Löschen
          </button>
        </div>
      </div>

      {/* Token-Kontextmenü */}
      {activePopup && (() => {
        const curQuality = positions[activePopup.studentId]?.quality ?? null;
        const popupStudent = activeStudents.find((s) => s.id === activePopup.studentId);
        const popupY = activePopup.screenY > window.innerHeight * 0.55
          ? activePopup.screenY - 118
          : activePopup.screenY + 28;
        const popupX = Math.max(96, Math.min(window.innerWidth - 96, activePopup.screenX));
        return (
          <>
            <div className="fixed inset-0 z-[75]" onClick={(e) => { e.stopPropagation(); setActivePopup(null); }} />
            <div
              className="fixed z-[76] bg-white rounded-2xl shadow-xl p-3"
              style={{ left: popupX, top: popupY, transform: "translateX(-50%)", minWidth: 176 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-xs font-semibold text-stone-800 text-center mb-1 truncate px-1">
                {popupStudent?.name}
              </div>
              {popupStudent?.foerderStatus && (
                <div className="flex justify-center mb-2">
                  <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-0.5">
                    <AlertCircle size={10} />
                    {popupStudent.foerderStatus}
                  </span>
                </div>
              )}
              <div className="text-[10px] text-stone-400 text-center mb-2">Sitzplatz markieren</div>
              <div className="flex items-center justify-center gap-2 mb-3">
                {/* Keine Markierung */}
                <button
                  onClick={() => { handleQualitySet(activePopup.studentId, null); setActivePopup(null); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 text-base font-bold transition-colors"
                  style={{ background: curQuality === null ? "#e7e5e4" : "#f5f5f4", outline: curQuality === null ? "2px solid #a8a29e" : "none", outlineOffset: "2px" }}
                >
                  –
                </button>
                {[
                  { key: "gut", color: "#16a34a" },
                  { key: "mittel", color: "#d97706" },
                  { key: "schlecht", color: "#dc2626" },
                ].map(({ key, color }) => (
                  <button
                    key={key}
                    onClick={() => { handleQualitySet(activePopup.studentId, key); setActivePopup(null); }}
                    className="w-8 h-8 rounded-full transition-transform active:scale-95"
                    style={{
                      background: color,
                      outline: curQuality === key ? `2px solid ${color}` : "none",
                      outlineOffset: "2px",
                      boxShadow: curQuality === key ? "0 0 0 2px white inset" : "none",
                    }}
                  />
                ))}
              </div>
              <div className="border-t border-stone-100 mb-2" />
              <button
                onClick={() => { removeStudent(activePopup.studentId); setActivePopup(null); }}
                className="w-full py-1 text-sm text-red-500 font-medium hover:bg-red-50 rounded-lg transition-colors"
              >
                Entfernen
              </button>
            </div>
          </>
        );
      })()}

      {/* Student picker sheet */}
      {showPicker && (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center"
          onClick={() => { setShowPicker(false); setPendingPos(null); setPickerSearch(""); }}
        >
          <div
            className="bg-white w-full md:max-w-md rounded-t-3xl shadow-xl flex flex-col"
            style={{ maxHeight: "65dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-3 shrink-0">
              <div className="font-semibold text-stone-800 mb-3">Kind auswählen</div>
              <input
                autoFocus
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F5844]/30 focus:border-transparent"
                placeholder="Name suchen …"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
            </div>
            <div className="overflow-y-auto flex-1 px-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {filteredUnplaced.length === 0 && (
                <p className="text-center text-sm text-stone-400 py-8">
                  {pickerSearch ? "Kein Treffer" : "Alle Kinder sind bereits platziert"}
                </p>
              )}
              {filteredUnplaced.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickStudent(s.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 active:bg-stone-100 text-left transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-[#4F5844] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {initials(s.name)}
                  </div>
                  <span className="text-sm font-medium text-stone-800">{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm clear */}
      {showConfirmClear && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-stone-900/40"
          onClick={() => setShowConfirmClear(false)}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-stone-800 mb-2">Sitzplan löschen?</div>
            <p className="text-sm text-stone-500 mb-5">Alle {placedCount} platzierten Kinder werden entfernt. Das lässt sich nicht rückgängig machen.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowConfirmClear(false)} className="flex-1 justify-center">Abbrechen</Button>
              <button
                onClick={clearPlan}
                className="flex-1 py-2 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KlassenDashboard({ cls, students, notes, grades, faecher, foerderZiele, absences, onOpenStudent, onClose }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cutoff14Iso = (() => { const d = new Date(today); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();

  function relTime(iso) {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days === 0) return "heute";
    if (days === 1) return "gestern";
    if (days < 7) return `vor ${days} T.`;
    return `vor ${Math.floor(days / 7)} Wo.`;
  }

  function studentAvg(id) {
    const sg = grades.filter((g) => g.studentId === id);
    if (!sg.length) return null;
    return sg.reduce((s, g) => s + g.value * (g.factor || 1), 0) / sg.reduce((s, g) => s + (g.factor || 1), 0);
  }

  const withData = students.map((s) => {
    const avg = studentAvg(s.id);
    const sNotes = notes.filter((n) => n.studentId === s.id);
    const lastEntry = sNotes.length ? sNotes.reduce((m, n) => n.date > m ? n.date : m, sNotes[0].date) : null;
    const foerderTags = (s.foerderStatus || "").split(",").map((t) => t.trim()).filter(Boolean);
    return { ...s, avg, lastEntry, foerderTags };
  });

  const withAvg = withData.filter((s) => s.avg != null);
  const klassenschnitt = withAvg.length ? withAvg.reduce((a, s) => a + s.avg, 0) / withAvg.length : null;
  const foerderCount = withData.filter((s) => s.foerderTags.length > 0).length;

  const dist = [
    { label: "Sehr gut – Gut", max: 2.5, color: "var(--s-gut)", count: 0 },
    { label: "Befriedigend", max: 3.5, color: "var(--s-warn)", count: 0 },
    { label: "Ausreichend+", max: 99, color: "var(--s-krit)", count: 0 },
  ];
  withAvg.forEach((s) => { const d = dist.find((r, i) => s.avg < r.max || i === dist.length - 1); if (d) d.count++; });
  const maxDist = Math.max(...dist.map((d) => d.count), 1);

  const needAttention = withData.filter((s) => (s.avg != null && s.avg >= 4.0) || (s.lastEntry != null && s.lastEntry < cutoff14Iso) || (!s.lastEntry && grades.some((g) => g.studentId === s.id)));

  const birthdays = withData
    .filter((s) => s.birthday)
    .map((s) => {
      const b = localDate(s.birthday);
      const yr = today.getFullYear();
      let next = new Date(yr, b.getMonth(), b.getDate());
      if (next < today) next = new Date(yr + 1, b.getMonth(), b.getDate());
      return { ...s, daysLeft: Math.round((next - today) / 86400000) };
    })
    .filter((s) => s.daysLeft <= 21)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const recent = notes
    .filter((n) => students.some((s) => s.id === n.studentId))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)
    .map((n) => ({ ...n, student: students.find((s) => s.id === n.studentId) }));

  return (
    <div className="fixed inset-0 z-[56] bg-stone-100 flex flex-col anim-slide-right" style={{ maxHeight: "100dvh" }}>
      <div className="bg-white border-b border-stone-100 shrink-0">
        <div className="flex items-center gap-3 px-4 pb-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center shrink-0 press-scale">
            <ChevronLeft size={18} className="text-stone-600" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold text-stone-900">{cls.name}</div>
            <div className="t-caption">{students.length} Schüler:innen · Klassen-Dashboard</div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">

        {/* KPI-Kacheln */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card p-3">
            <div className="t-caption mb-1">Schüler:innen</div>
            <div className="text-2xl font-bold tnum text-stone-800">{students.length}</div>
          </div>
          <div className="card p-3">
            <div className="t-caption mb-1">Klassen-Ø</div>
            {klassenschnitt != null
              ? <div className={`text-2xl font-bold tnum ${klassenschnitt <= 2.5 ? "text-[var(--s-gut)]" : klassenschnitt <= 3.5 ? "text-[var(--s-warn)]" : "text-[var(--s-krit)]"}`}>{klassenschnitt.toFixed(1)}</div>
              : <div className="text-stone-300 text-xl">–</div>}
          </div>
          <div className="card p-3">
            <div className="t-caption mb-1">Förderbedarf</div>
            <div className={`text-2xl font-bold tnum ${foerderCount > 0 ? "text-[var(--s-warn)]" : "text-stone-300"}`}>{foerderCount}</div>
          </div>
        </div>

        {/* Notenverteilung */}
        {withAvg.length > 0 && (
          <div className="card p-4">
            <div className="t-section mb-3">Notenverteilung</div>
            <div className="space-y-2.5">
              {dist.map((d) => (
                <div key={d.label} className="flex items-center gap-3">
                  <div className="w-[88px] shrink-0 text-xs text-stone-500 text-right">{d.label}</div>
                  <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.count / maxDist) * 100}%`, background: d.color, opacity: d.count ? 1 : 0.15, transition: "width 0.5s ease" }} />
                  </div>
                  <div className="w-6 text-right text-sm font-bold tnum text-stone-600">{d.count}</div>
                </div>
              ))}
            </div>
            <div className="text-[11px] text-stone-500 mt-3">{withAvg.length} von {students.length} Schüler:innen mit Noten</div>
          </div>
        )}

        {/* Anwesenheit der letzten 12 Wochen.
            Eine Liste verbirgt Periodizität – als Fläche wird sichtbar, ob sich Fehltage
            auf bestimmte Wochentage häufen oder nach den Ferien einbrechen. */}
        {(() => {
          const eigene = (absences || []).filter((a) => students.some((s) => s.id === a.studentId));
          if (!eigene.length) return null;
          const proTag = Object.create(null);
          eigene.forEach((a) => {
            if (!proTag[a.date]) proTag[a.date] = { kinder: new Set(), unentschuldigt: false };
            proTag[a.date].kinder.add(a.studentId);
            if (a.excuseStatus === "unentschuldigt") proTag[a.date].unentschuldigt = true;
          });
          const wochenStart = startOfWeek(today);
          const wochen = Array.from({ length: 12 }, (_, i) => addDays(wochenStart, -7 * (11 - i)));
          const maxKinder = Math.max(1, ...Object.keys(proTag).map((d) => proTag[d].kinder.size));
          const proWochentag = [0, 1, 2, 3, 4].map((tag) =>
            wochen.reduce((summe, w) => summe + (proTag[isoDate(addDays(w, tag))]?.kinder.size || 0), 0)
          );
          const spitzenTag = proWochentag.indexOf(Math.max(...proWochentag));
          const gesamt = proWochentag.reduce((a, b) => a + b, 0);
          return (
            <div className="card p-4">
              <div className="t-section mb-1">Anwesenheit · letzte 12 Wochen</div>
              <p className="text-[11px] text-stone-500 mb-3">Je dunkler, desto mehr Kinder haben an diesem Tag gefehlt. Rot = unentschuldigt dabei.</p>
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex gap-1 min-w-max">
                  <div className="flex flex-col gap-1 pr-1 shrink-0">
                    {WEEKDAY_KURZ.map((d) => (
                      <div key={d} className="h-4 text-[10px] text-stone-500 leading-4 w-5 text-right">{d}</div>
                    ))}
                  </div>
                  {wochen.map((w, wi) => (
                    <div key={wi} className="flex flex-col gap-1">
                      {[0, 1, 2, 3, 4].map((tag) => {
                        const iso = isoDate(addDays(w, tag));
                        const eintrag = proTag[iso];
                        const anzahl = eintrag?.kinder.size || 0;
                        const staerke = anzahl ? 0.25 + 0.75 * (anzahl / maxKinder) : 0;
                        return (
                          <div
                            key={tag}
                            title={anzahl ? `${localDate(iso).toLocaleDateString("de-DE")}: ${anzahl} ${anzahl === 1 ? "Kind" : "Kinder"}${eintrag.unentschuldigt ? ", unentschuldigt dabei" : ""}` : localDate(iso).toLocaleDateString("de-DE")}
                            className="w-4 h-4 rounded-[3px]"
                            style={{
                              backgroundColor: anzahl
                                ? eintrag.unentschuldigt
                                  ? `rgba(185,28,28,${staerke})`
                                  : `rgba(79,88,68,${staerke})`
                                : "#F0EEE8",
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {gesamt > 0 && (
                <p className="text-[11px] text-stone-500 mt-3">
                  Die meisten Fehltage fallen auf {WEEKDAY_LANG[spitzenTag]} ({proWochentag[spitzenTag]} von {gesamt}).
                </p>
              )}
            </div>
          );
        })()}

        {/* Wen habe ich lange nicht dokumentiert?
            Sortierte Liste statt anonymer Punkte – direkt mit Namen, damit sofort klar
            ist welches Kind gemeint ist und das Profil einen Klick entfernt liegt. */}
        {students.length > 0 && (() => {
          const letzterEintrag = (id) => {
            const daten = [
              ...notes.filter((n) => n.studentId === id).map((n) => n.date),
              ...grades.filter((g) => g.studentId === id).map((g) => g.date),
            ].filter(Boolean);
            return daten.length ? daten.reduce((m, d) => (d > m ? d : m)) : null;
          };
          const liste = students
            .map((s) => {
              const letzte = letzterEintrag(s.id);
              const tage = letzte ? Math.floor((today - localDate(letzte)) / 86400000) : null;
              return { student: s, tage };
            })
            .sort((a, b) => {
              // kein Eintrag → ganz oben, sonst nach Tagen absteigend
              if (a.tage === null && b.tage === null) return 0;
              if (a.tage === null) return -1;
              if (b.tage === null) return 1;
              return b.tage - a.tage;
            });
          const ohneEintrag = liste.filter((p) => p.tage === null);
          const veraltet = liste.filter((p) => p.tage !== null && p.tage > 21);
          const sichtbar = [...ohneEintrag, ...veraltet].slice(0, 6);
          const alleOk = sichtbar.length === 0;
          return (
            <div className="card p-4">
              <div className="t-section mb-3">Lange kein Eintrag</div>
              {alleOk ? (
                <p className="text-[11px] text-stone-500">Alle Kinder wurden in den letzten drei Wochen dokumentiert.</p>
              ) : (
                <ul className="space-y-0 divide-y divide-stone-100">
                  {sichtbar.map(({ student: s, tage }) => {
                    const labelCls = tage === null ? "text-stone-400" : tage > 42 ? "text-red-600" : "text-amber-600";
                    const labelTxt = tage === null ? "noch kein Eintrag" : `seit ${tage} Tagen`;
                    return (
                      <li key={s.id}>
                        <button
                          onClick={() => onOpenStudent(s.id)}
                          className="w-full flex items-center justify-between gap-2 py-2 text-left min-h-[44px] press-scale"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <StudentAvatar student={s} size={24} />
                            <span className="text-sm text-stone-800 truncate">{s.name}</span>
                          </div>
                          <span className={`text-[11px] font-medium shrink-0 ${labelCls}`}>{labelTxt}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {sichtbar.length > 0 && (
                <p className="text-[11px] text-stone-400 mt-2">Antippen öffnet das Schülerprofil</p>
              )}
            </div>
          );
        })()}

        {/* Aufmerksamkeit */}
        {needAttention.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-1 mb-2">
              <span className="t-section">Aufmerksamkeit</span>
              <span className="chip chip-warn ml-1">{needAttention.length}</span>
            </div>
            <p className="text-xs text-stone-400 px-1 mb-2">Kein Eintrag in den letzten 14 Tagen oder Notendurchschnitt ≥ 4,0</p>
            <div className="space-y-2">
              {needAttention.map((s) => {
                const reasons = [];
                if (s.avg != null && s.avg >= 4.0) reasons.push(`Ø ${s.avg.toFixed(1)}`);
                if (s.lastEntry && s.lastEntry < cutoff14Iso) {
                  const d = Math.round((today - localDate(s.lastEntry)) / 86400000);
                  reasons.push(`${d} T. kein Eintrag`);
                } else if (!s.lastEntry) reasons.push("Noch kein Eintrag");
                return (
                  <button key={s.id} onClick={() => onOpenStudent(s.id)} className="card w-full p-3.5 flex items-center gap-3 text-left press-scale">
                    <StudentAvatar student={s} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-stone-800 truncate">{s.name}</div>
                      <div className="text-xs text-stone-400 mt-0.5">{reasons.join(" · ")}</div>
                    </div>
                    <ChevronRight size={15} className="text-stone-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Geburtstage */}
        {birthdays.length > 0 && (
          <div>
            <div className="t-section px-1 mb-2">Geburtstage · nächste 21 Tage</div>
            <div className="card divide-y divide-stone-100 overflow-hidden">
              {birthdays.map((s) => (
                <button key={s.id} onClick={() => onOpenStudent(s.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-stone-50 press-scale">
                  <span className="text-xl shrink-0">{s.daysLeft === 0 ? "🎂" : "🎁"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-800 truncate">{s.name}</div>
                    <div className="t-caption">{s.daysLeft === 0 ? "Heute!" : `in ${s.daysLeft} Tagen`}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Letzte Aktivität */}
        {recent.length > 0 && (
          <div>
            <div className="t-section px-1 mb-2">Letzte Aktivität</div>
            <div className="tl-wrap">
              <div className="tl-rail" />
              {recent.map((entry) => {
                const isG = entry.type === "gespraech";
                const mood = isG ? MOOD_OPTIONS.find((m) => m.key === entry.mood) : null;
                return (
                  <button key={entry.id} onClick={() => onOpenStudent(entry.studentId)} className="tl-entry w-full text-left press-scale">
                    <div className="tl-icon shrink-0">
                      {isG ? <span className="text-base leading-none">{mood?.emoji ?? "💬"}</span> : <StickyNote size={14} className="text-stone-400" />}
                    </div>
                    <div className="tl-body">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-semibold text-stone-700">{entry.student?.name}</span>
                        <span className="t-caption ml-auto">{relTime(entry.date)}</span>
                      </div>
                      <p className="text-xs text-stone-500 line-clamp-1">{entry.text}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!students.length && (
          <div className="card p-8 text-center text-stone-400 text-sm">Noch keine Schüler:innen in dieser Klasse.</div>
        )}
      </div>
    </div>
  );
}

function KlassenTab({ data, update, halbjahr, subTab, setSubTab, onOpenFach, onOpenUntisImport, focusStudentId, onFocusConsumed, focusKlassenDashboardId, onFocusKlassenDashboardConsumed, onRegisterFab, showToast }) {
  const [selectedClass, setSelectedClass] = useState(data.classes[0]?.id ?? null);
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [gespraechDraft, setGespraechDraft] = useState({ text: "", mood: "ok", typ: "schueler" });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [renamingClass, setRenamingClass] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { title, message, onConfirm }
  const [expandedClass, setExpandedClass] = useState(null); // aufgeklappte Klassenkarte
  const [renameValue, setRenameValue] = useState("");
  const [overviewStudentId, setOverviewStudentId] = useState(null);
  const [showSitzplan, setShowSitzplan] = useState(false);
  const [sitzplanClassId, setSitzplanClassId] = useState(null);
  const [klassenDashboardId, setKlassenDashboardId] = useState(null);

  useEffect(() => {
    if (!onRegisterFab) return;
    if (showStudentsModal) {
      onRegisterFab([]);
      return;
    }
    if (selectedClass) {
      onRegisterFab([{ label: "Schüler hinzufügen", icon: Plus, onClick: () => setShowAddModal(true) }]);
    } else {
      onRegisterFab([{ label: "Neue Klasse", icon: Plus, onClick: () => setShowNewClassModal(true) }]);
    }
    return () => onRegisterFab([]);
  }, [selectedClass, showStudentsModal]);

  useEffect(() => {
    if (!focusStudentId) return;
    const student = data.students.find((s) => s.id === focusStudentId && !s.deletedAt);
    if (!student) return;
    setSelectedClass(student.classId);
    setShowStudentsModal(true);
    setSelectedStudent(focusStudentId);
    onFocusConsumed?.();
  }, [focusStudentId]);

  /* Deep-Link vom Klassenradar auf der Uebersicht: oeffnet das KlassenDashboard
     der gewaehlten Klasse direkt, ohne Zwischenklick. */
  useEffect(() => {
    if (!focusKlassenDashboardId) return;
    const c = data.classes.find((x) => x.id === focusKlassenDashboardId);
    if (!c) return;
    setSubTab?.("klassen");
    setKlassenDashboardId(focusKlassenDashboardId);
    onFocusKlassenDashboardConsumed?.();
  }, [focusKlassenDashboardId]);

  const cls = data.classes.find((c) => c.id === selectedClass);
  const classFaecher = data.faecher.filter((f) => f.classId === selectedClass);
  const students = data.students.filter((s) => s.classId === selectedClass).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const student = data.students.find((s) => s.id === selectedStudent);
  const notes = data.notes.filter((n) => n.studentId === selectedStudent).sort((a, b) => b.date.localeCompare(a.date));

  function addClass(name) {
    const id = uid();
    update((d) => {
      d.classes.push({ id, name });
      return d;
    });
    setSelectedClass(id);
  }

  function renameClass(id, name) {
    update((d) => {
      const c = d.classes.find((c) => c.id === id);
      if (c) c.name = name;
      return d;
    });
  }

  function deleteClass(id) {
    const ts = isoDate(new Date());
    const cls = data.classes.find((c) => c.id === id);
    const name = cls?.name || "Klasse";
    update((d) => {
      const c = d.classes.find((x) => x.id === id);
      if (c) c.deletedAt = ts;
      d.students.filter((s) => s.classId === id).forEach((s) => { s.deletedAt = ts; });
      return d;
    });
    if (selectedClass === id) setSelectedClass(null);
    // Ohne Toast bleibt die Klasse einfach aus der Liste - das wirkt wie ein
    // Absturz oder ein versehentliches Wegtippen. Bewusst Bestaetigung geben.
    showToast?.(`Klasse ${name} gelöscht.`);
  }

  function addStudent(name) {
    if (!name.trim() || !selectedClass) return;
    update((d) => {
      d.students.push({ id: uid(), name: name.trim(), classId: selectedClass });
      return d;
    });
  }

  function deleteStudent(id) {
    update((d) => {
      const s = d.students.find((s) => s.id === id);
      if (s) s.deletedAt = isoDate(new Date());
      return d;
    });
    if (selectedStudent === id) setSelectedStudent(null);
  }

  function updateStudentField(id, field, value) {
    update((d) => {
      const s = d.students.find((s) => s.id === id);
      if (s) s[field] = value || null;
      return d;
    });
  }

  function importStudents(rows) {
    if (!selectedClass) return;
    const existingNames = new Set((data.students || []).filter((s) => s.classId === selectedClass).map((s) => s.name.toLowerCase()));
    const newRows = rows.filter((r) => !existingNames.has(r.name.toLowerCase()));
    update((d) => {
      newRows.forEach((r) => {
        d.students.push({ id: uid(), name: r.name, classId: selectedClass, birthday: r.birthday || null });
      });
      return d;
    });
    setShowImportModal(false);
    showToast(newRows.length > 0 ? `${newRows.length} Schüler:in${newRows.length === 1 ? "" : "nen"} importiert.` : "Alle Namen bereits vorhanden – nichts importiert.");
  }

  function addNote(studentId) {
    if (!newNote.trim() || !studentId) return;
    update((d) => {
      d.notes.push({ id: uid(), studentId, date: isoDate(new Date()), text: newNote.trim() });
      return d;
    });
    setNewNote("");
  }

  function addGespraech(studentId) {
    if (!gespraechDraft.text.trim() || !studentId) return;
    update((d) => {
      d.notes.push({ id: uid(), studentId, date: isoDate(new Date()), text: gespraechDraft.text.trim(), type: "gespraech", mood: gespraechDraft.mood, gesprTyp: gespraechDraft.typ || "schueler" });
      return d;
    });
    setGespraechDraft({ text: "", mood: "ok", typ: "schueler" });
  }

  function deleteNote(noteId) {
    update((d) => {
      const n = d.notes.find((n) => n.id === noteId);
      if (n) n.deletedAt = isoDate(new Date());
      return d;
    });
  }

  function addFoerderZiel(studentId, text, typ) {
    if (!text.trim() || !studentId) return;
    update((d) => {
      d.foerderZiele = d.foerderZiele || [];
      d.foerderZiele.push({ id: uid(), studentId, text: text.trim(), typ, createdAt: isoDate(new Date()), doneAt: null });
      return d;
    });
  }

  function toggleFoerderZiel(zielId) {
    update((d) => {
      const z = (d.foerderZiele || []).find((z) => z.id === zielId);
      if (z) z.doneAt = z.doneAt ? null : isoDate(new Date());
      return d;
    });
  }

  function deleteFoerderZiel(zielId) {
    update((d) => {
      d.foerderZiele = (d.foerderZiele || []).filter((z) => z.id !== zielId);
      return d;
    });
  }

  function saveSitzplan(classId, plan) {
    update((d) => {
      if (!d.sitzplaene) d.sitzplaene = {};
      d.sitzplaene[classId] = plan;
      return d;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Klassen & Schüler</h1>
        <div className="flex items-center gap-2">
          {!!data.classes.length && (
            <button
              onClick={() => onOpenUntisImport?.()}
              className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <Upload size={12} /> Fehlzeiten
            </button>
          )}
        <div className="inline-flex bg-stone-100 rounded-xl p-1">
          <button
            onClick={() => setSubTab("klassen")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${subTab === "klassen" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
          >
            Klassen
          </button>
          <button
            onClick={() => setSubTab("faecher")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${subTab === "faecher" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
          >
            Fächer
          </button>
          <button
            onClick={() => setSubTab("dienste")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${subTab === "dienste" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}
          >
            Dienste
          </button>
        </div>
        </div>
      </div>

      {subTab === "faecher" && <FaecherTab data={data} update={update} onOpenFach={onOpenFach} />}
      {subTab === "dienste" && <DiensteTab data={data} update={update} />}

      {subTab === "klassen" && (
      <div className="space-y-3">
        {data.classes.map((c) => {
          const cFaecher = data.faecher.filter((f) => f.classId === c.id);
          const cCount = data.students.filter((s) => s.classId === c.id).length;
          const offen = expandedClass === c.id;
          return (
            <Card key={c.id} className="overflow-hidden">
              {/* Kopf: ganze Zeile antippbar zum Auf-/Zuklappen */}
              <div className="flex items-center gap-2 p-4">
                <button
                  onClick={() => setExpandedClass(offen ? null : c.id)}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <span className="text-lg font-semibold text-stone-900 shrink-0">{c.name}</span>
                  <span className="flex items-center gap-2 flex-wrap min-w-0">
                    {cFaecher.map((f) => (
                      <span key={f.id} className="inline-flex items-center gap-1 text-sm text-stone-500">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                        {f.subject}
                      </span>
                    ))}
                    {!cFaecher.length && <span className="text-xs text-stone-300">noch keine Fächer</span>}
                  </span>
                  <ChevronRight size={16} className={`text-stone-300 shrink-0 ml-auto transition-transform ${offen ? "rotate-90" : ""}`} />
                </button>
                <button
                  onClick={() => { setRenameValue(c.name); setRenamingClass(c.id); }}
                  className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 flex items-center justify-center shrink-0"
                  title="Klasse verwalten"
                >
                  <Settings2 size={16} />
                </button>
              </div>

              {/* Aufgeklappt: Fächer einzeln (führen in die Notenübersicht) + Schülerliste */}
              {offen && (
                <div className="border-t border-stone-100 p-3 space-y-1.5 bg-stone-50/50">
                  <button
                    onClick={() => { setSelectedClass(c.id); setSelectedStudent(null); setShowStudentsModal(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white hover:bg-stone-50 text-sm text-stone-700"
                  >
                    <Users size={15} className="text-stone-400" /> Schüler:innen
                    <span className="ml-auto text-stone-400 tnum">{cCount}</span>
                  </button>

                  <button
                    onClick={() => { setSitzplanClassId(c.id); setShowSitzplan(true); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white hover:bg-stone-50 text-sm text-stone-700"
                  >
                    <LayoutGrid size={15} className="text-stone-400" /> Sitzplan
                    {data.sitzplaene?.[c.id] && (
                      <span className="ml-auto text-[11px] text-stone-400">bearbeiten</span>
                    )}
                  </button>

                  <button
                    onClick={() => setKlassenDashboardId(c.id)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white hover:bg-stone-50 text-sm text-stone-700"
                  >
                    <BarChart2 size={15} className="text-stone-400" /> Klassen-Dashboard
                    <ChevronRight size={15} className="text-stone-300 ml-auto" />
                  </button>

                  <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400 px-1 pt-2">Noten nach Fach</div>
                  {cFaecher.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => onOpenFach?.(f.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white hover:bg-stone-50 text-sm text-stone-700"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                      {f.subject}
                      <ChevronRight size={15} className="text-stone-300 ml-auto" />
                    </button>
                  ))}
                  {!cFaecher.length && (
                    <button onClick={() => setSubTab("faecher")} className="w-full text-left px-3 py-2.5 rounded-lg bg-white hover:bg-stone-50 text-sm akzent-text">
                      + Fach für diese Klasse anlegen
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {!data.classes.length && (
          <Card className="p-5 text-sm text-stone-400">Noch keine Klassen angelegt. Lege deine erste Klasse an.</Card>
        )}

        <Button onClick={() => setShowNewClassModal(true)} className="w-full justify-center"><Plus size={15} /> Neue Klasse</Button>
      </div>
      )}

      {showNewClassModal && (
        <NewClassModal
          onSave={(name) => { addClass(name); setShowNewClassModal(false); }}
          onClose={() => setShowNewClassModal(false)}
        />
      )}

      {renamingClass && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={() => setRenamingClass(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-semibold text-stone-800">Klasse umbenennen</div>
              <button onClick={() => setRenamingClass(null)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>
            <Field label="Klassenname">
              <input
                className={inputCls} value={renameValue} autoFocus maxLength={50}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && renameValue.trim()) { renameClass(renamingClass, renameValue.trim()); setRenamingClass(null); } }}
              />
            </Field>
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" onClick={() => setRenamingClass(null)} className="flex-1 justify-center">Abbrechen</Button>
              <Button onClick={() => { if (renameValue.trim()) { renameClass(renamingClass, renameValue.trim()); setRenamingClass(null); } }} className="flex-1 justify-center">Speichern</Button>
            </div>
            <button
              onClick={() => {
                const id = renamingClass;
                const name = data.classes.find((c) => c.id === id)?.name;
                setRenamingClass(null);
                setConfirmState({
                  title: `Klasse ${name} löschen?`,
                  message: "Die Klasse wird in den Papierkorb verschoben und kann dort 30 Tage wiederhergestellt werden (Einstellungen → Papierkorb). Alle Schüler:innen, Noten und Notizen kommen mit.",
                  onConfirm: () => { deleteClass(id); setConfirmState(null); },
                });
              }}
              className="w-full text-center text-xs text-red-600 hover:underline mt-4 pt-3 border-t border-stone-100"
            >
              Diese Klasse löschen
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />

      {showStudentsModal && cls && (
        <StudentsModal
          cls={cls}
          students={students}
          notes={data.notes}
          grades={data.grades || []}
          faecher={classFaecher}
          foerderZiele={data.foerderZiele || []}
          absences={data.absences || []}
          incidents={data.incidents || []}
          documents={data.documents || []}
          update={update}
          settings={data.settings || {}}
          notenfarben={data.settings?.notenfarben !== false}
          selectedStudent={selectedStudent}
          setSelectedStudent={setSelectedStudent}
          onDeleteStudent={deleteStudent}
          onUpdateField={updateStudentField}
          onAddNote={addNote}
          newNote={newNote}
          setNewNote={setNewNote}
          gespraechDraft={gespraechDraft}
          setGespraechDraft={setGespraechDraft}
          onAddGespraech={addGespraech}
          onDeleteNote={deleteNote}
          onAddFoerderZiel={addFoerderZiel}
          onToggleFoerderZiel={toggleFoerderZiel}
          onDeleteFoerderZiel={deleteFoerderZiel}
          onOpenAdd={() => setShowAddModal(true)}
          onOpenOverview={(sid) => setOverviewStudentId(sid)}
          onClose={() => { setShowStudentsModal(false); setSelectedStudent(null); }}
        />
      )}

      {overviewStudentId && (() => {
        const overviewStudent = data.students.find((s) => s.id === overviewStudentId);
        if (!overviewStudent) return null;
        return (
          <StudentOverviewModal
            student={overviewStudent}
            faecher={data.faecher.filter((f) => f.classId === overviewStudent.classId)}
            grades={data.grades}
            finalGrades={data.finalGrades}
            halbjahr={halbjahr}
            onClose={() => setOverviewStudentId(null)}
          />
        );
      })()}

      {showAddModal && (
        <AddStudentModal
          className={cls?.name}
          onAddOne={(name) => addStudent(name)}
          onOpenCsv={() => { setShowAddModal(false); setShowImportModal(true); }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showImportModal && (
        <ImportCsvModal
          className={cls?.name}
          onImport={importStudents}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {klassenDashboardId && (() => {
        const dashCls = data.classes.find((c) => c.id === klassenDashboardId);
        const dashStudents = data.students.filter((s) => s.classId === klassenDashboardId && !s.deletedAt).sort((a, b) => a.name.localeCompare(b.name, "de"));
        const dashNotes = data.notes.filter((n) => dashStudents.some((s) => s.id === n.studentId)).sort((a, b) => b.date.localeCompare(a.date));
        const dashGrades = data.grades.filter((g) => dashStudents.some((s) => s.id === g.studentId));
        const dashFaecher = data.faecher.filter((f) => f.classId === klassenDashboardId);
        if (!dashCls) return null;
        return (
          <KlassenDashboard
            cls={dashCls}
            students={dashStudents}
            notes={dashNotes}
            grades={dashGrades}
            faecher={dashFaecher}
            foerderZiele={data.foerderZiele || []}
            absences={(data.absences || []).filter((a) => dashStudents.some((s) => s.id === a.studentId))}
            onOpenStudent={(studentId) => {
              setKlassenDashboardId(null);
              setSelectedClass(klassenDashboardId);
              setShowStudentsModal(true);
              setSelectedStudent(studentId);
            }}
            onClose={() => setKlassenDashboardId(null)}
          />
        );
      })()}

      {showSitzplan && sitzplanClassId && (() => {
        const spCls = data.classes.find((c) => c.id === sitzplanClassId);
        const spStudents = data.students.filter((s) => s.classId === sitzplanClassId && !s.deletedAt);
        if (!spCls) return null;
        return (
          <SitzplanModal
            cls={spCls}
            students={spStudents}
            sitzplan={data.sitzplaene?.[sitzplanClassId] ?? null}
            onSave={(plan) => saveSitzplan(sitzplanClassId, plan)}
            onClose={() => { setShowSitzplan(false); setSitzplanClassId(null); }}
          />
        );
      })()}
    </div>
  );
}

/* ---------- Fächer (eigenständige Verwaltung, wie bei elly) ---------- */

function FaecherTab({ data, update, onOpenFach }) {
  const [showModal, setShowModal] = useState(false);
  const [editingFach, setEditingFach] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const rows = [...data.faecher].sort((a, b) => {
    const ca = data.classes.find((c) => c.id === a.classId)?.name || "";
    const cb = data.classes.find((c) => c.id === b.classId)?.name || "";
    // Jahrgang numerisch (5c vor 10a), dann Klassenzug, dann Fach
    const na = parseInt(ca, 10) || 0;
    const nb = parseInt(cb, 10) || 0;
    return na - nb || ca.localeCompare(cb, "de") || a.subject.localeCompare(b.subject, "de");
  });

  function saveFach({ classId, newClassName, subject, color, room, weights, nextTestDate, nextTestTitle }) {
    update((d) => {
      let finalClassId = classId;
      if (!finalClassId && newClassName) {
        finalClassId = uid();
        d.classes.push({ id: finalClassId, name: newClassName });
      }
      if (!d.subjectColors) d.subjectColors = {};
      d.subjectColors[subject] = color;

      if (editingFach) {
        const f = d.faecher.find((x) => x.id === editingFach.id);
        if (f) { f.classId = finalClassId; f.subject = subject; f.color = color; f.room = room; f.weights = weights || DEFAULT_WEIGHTS; f.nextTestDate = nextTestDate || null; f.nextTestTitle = nextTestTitle || null; }
      } else {
        d.faecher.push({ id: uid(), classId: finalClassId, subject, color, room, weights: weights || DEFAULT_WEIGHTS, nextTestDate: nextTestDate || null, nextTestTitle: nextTestTitle || null });
      }
      return d;
    });
    setShowModal(false);
    setEditingFach(null);
  }

  function deleteFach(id) {
    update((d) => {
      d.faecher = d.faecher.filter((f) => f.id !== id);
      d.timetable = d.timetable.filter((t) => t.fachId !== id);
      return d;
    });
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        {!rows.length && (
          <div className="text-center py-8">
            <p className="text-sm text-stone-400 mb-4">Noch keine Fächer angelegt.</p>
            <Button onClick={() => setShowModal(true)} className="mx-auto"><Plus size={15} /> Fach anlegen</Button>
          </div>
        )}
        {!!rows.length && (
          <ul className="divide-y divide-stone-100">
            {rows.map((f) => {
              const cls = data.classes.find((c) => c.id === f.classId);
              return (
                <li key={f.id} className="py-2.5 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
                  <button
                    onClick={() => onOpenFach?.(f.id)}
                    className="flex-1 text-left text-sm text-stone-700 hover:akzent-text flex items-center gap-1.5 min-w-0"
                  >
                    <span className="truncate"><span className="font-medium">{cls?.name || "—"}</span><span className="text-stone-400"> · {f.subject}</span></span>
                    <ChevronRight size={14} className="text-stone-300 shrink-0" />
                  </button>
                  {f.room && <span className="text-xs text-stone-400 shrink-0 hidden sm:inline">{f.room}</span>}
                  <button onClick={() => { setEditingFach(f); setShowModal(true); }} className="w-8 h-8 rounded-full hover:bg-stone-100 text-stone-400 flex items-center justify-center shrink-0" title="Einstellungen (Gewichtung, Farbe, Raum)"><Settings2 size={15} /></button>
                  <button onClick={() => setConfirmState({ id: f.id, name: f.subject })} className="w-8 h-8 rounded-full hover:bg-red-50 text-stone-300 hover:text-red-600 flex items-center justify-center shrink-0" title="Fach löschen"><Trash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {!!rows.length && (
        <Button onClick={() => setShowModal(true)}><Plus size={15} /> Fach anlegen</Button>
      )}

      {showModal && (
        <FachModal
          data={data}
          initial={editingFach}
          onSave={saveFach}
          onClose={() => { setShowModal(false); setEditingFach(null); }}
        />
      )}

      <ConfirmDialog
        open={!!confirmState}
        title={`Fach ${confirmState?.name} löschen?`}
        message="Alle Noten und Zeugnisnoten dieses Fachs werden mitgelöscht. Das lässt sich nicht rückgängig machen."
        onConfirm={() => { deleteFach(confirmState.id); setConfirmState(null); }}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}

/* ---------- Stundenplan ---------- */

function StundenplanTab({ data, update }) {
  const isColor = data.settings?.colorMode === true;
  const [editingCell, setEditingCell] = useState(null); // {day, period}
  const [editingTime, setEditingTime] = useState(null); // period

  function cellData(day, period) {
    return data.timetable.find((t) => t.day === day && t.period === period);
  }

  function setCell(day, period, fachId) {
    update((d) => {
      d.timetable = d.timetable.filter((t) => !(t.day === day && t.period === period));
      if (fachId) d.timetable.push({ id: uid(), day, period, fachId });
      return d;
    });
    setEditingCell(null);
  }

  function setPeriodTime(period, start, end) {
    update((d) => {
      d.periodTimes = { ...(d.periodTimes || {}), [period]: { start, end } };
      return d;
    });
    setEditingTime(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Stundenplan</h1>
      <Card className="p-2">
        <table className="w-full table-fixed border-separate border-spacing-1">
          <thead>
            <tr>
              <th className="w-8"></th>
              {DAYS.map((d) => (
                <th key={d} className="text-stone-500 font-medium text-[11px] pb-1">{DAY_LABELS[d].slice(0, 2)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => {
              const pt = data.periodTimes?.[p];
              return (
              <tr key={p}>
                <td className="align-middle">
                  {editingTime === p ? (
                    <PeriodTimeEditor initial={pt} onSave={(start, end) => setPeriodTime(p, start, end)} onCancel={() => setEditingTime(null)} />
                  ) : (
                    <button onClick={() => setEditingTime(p)} className="w-full text-center rounded-md hover:bg-stone-50 py-1">
                      <div className="text-stone-600 text-xs font-semibold tnum">{p}</div>
                      <div className="text-stone-400 text-[8px] leading-tight tnum">{pt ? pt.start : "+"}</div>
                    </button>
                  )}
                </td>
                {DAYS.map((day) => {
                  const cell = cellData(day, p);
                  const fach = cell ? data.faecher.find((f) => f.id === cell.fachId) : null;
                  const cls = fach ? data.classes.find((c) => c.id === fach.classId) : null;
                  const isEditing = editingCell?.day === day && editingCell?.period === p;
                  return (
                    <td key={day} className="align-top">
                      {isEditing ? (
                        <CellEditor
                          faecher={data.faecher}
                          classes={data.classes}
                          initial={cell}
                          onSave={(fachId) => setCell(day, p, fachId)}
                          onCancel={() => setEditingCell(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingCell({ day, period: p })}
                          className="w-full h-12 rounded-md text-[10px] px-1 py-1 text-center leading-tight flex flex-col items-center justify-center transition-colors border overflow-hidden"
                          style={
                            fach
                              ? isColor
                                ? { backgroundColor: fach.color + "1f", borderColor: fach.color + "40", color: fach.color }
                                : { backgroundColor: "var(--oliv-hell)", borderColor: "var(--linie)", color: "var(--oliv)" }
                              : { backgroundColor: "#FAFAF9", borderColor: "#F0EEE8", color: "#D6D3D1" }
                          }
                        >
                          {fach ? (
                            <>
                              <span className="font-semibold truncate w-full">{cls?.name}</span>
                              <span className="truncate w-full opacity-80">{fach.subject}</span>
                            </>
                          ) : "·"}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <p className="text-xs text-stone-400 px-1">Tippe auf eine Stunde, um Klasse und Fach einzutragen, oder auf die Stundennummer, um die Uhrzeit zu setzen.</p>
      {!data.classes.length && <p className="text-sm text-stone-400">Lege zunächst unter „Klassen & Schüler" mindestens eine Klasse an, um sie im Stundenplan einzutragen.</p>}
    </div>
  );
}

function PeriodTimeEditor({ initial, onSave, onCancel }) {
  const [start, setStart] = useState(initial?.start || "");
  const [end, setEnd] = useState(initial?.end || "");
  return (
    <div className="relative">
      <div className="h-8" />
      <div className="absolute top-0 left-0 z-50 bg-white border akzent-rand rounded-lg p-1.5 space-y-1 shadow-lg w-24">
        <input type="time" className="w-full text-xs rounded border border-stone-200 px-1 py-1" value={start} onChange={(e) => setStart(e.target.value)} />
      <input type="time" className="w-full text-xs rounded border border-stone-200 px-1 py-1" value={end} onChange={(e) => setEnd(e.target.value)} />
      <div className="flex gap-1">
        <button onClick={() => onSave(start, end)} className="flex-1 text-xs akzent-flaeche rounded py-1"><Check size={12} className="inline" /></button>
        <button onClick={onCancel} className="flex-1 text-xs bg-stone-100 text-stone-500 rounded py-1"><X size={12} className="inline" /></button>
      </div>
      </div>
    </div>
  );
}

function CellEditor({ faecher, classes, initial, onSave, onCancel }) {
  const [fachId, setFachId] = useState(initial?.fachId || "");

  return (
    <div className="relative">
      {/* Platzhalter in Zellengröße, Editor schwebt darüber */}
      <div className="h-12" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 bg-white border akzent-rand rounded-lg p-1.5 space-y-1 shadow-lg w-40">
        <select className="w-full text-xs rounded border border-stone-200 px-1 py-1" value={fachId} onChange={(e) => setFachId(e.target.value)} autoFocus>
          <option value="">frei</option>
          {faecher.map((f) => {
            const cls = classes.find((c) => c.id === f.classId);
            return <option key={f.id} value={f.id}>{cls?.name} · {f.subject}</option>;
          })}
        </select>
        {!faecher.length && <p className="text-[10px] text-stone-400 px-0.5">Erst unter „Fächer" anlegen.</p>}
        <div className="flex gap-1">
          <button onClick={() => onSave(fachId)} className="flex-1 text-xs akzent-flaeche rounded py-1"><Check size={12} className="inline" /></button>
          <button onClick={onCancel} className="flex-1 text-xs bg-stone-100 text-stone-500 rounded py-1"><X size={12} className="inline" /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Kalender ---------- */

function nextOccurrence(event) {
  if (!event.recurrence) return event.date;
  const today = isoDate(new Date());
  let d = new Date(event.date + "T00:00:00");
  while (isoDate(d) < today) {
    const prev = isoDate(d);
    if (event.recurrence === "weekly") d = addDays(d, 7);
    else if (event.recurrence === "biweekly") d = addDays(d, 14);
    else if (event.recurrence === "monthly") { d = new Date(d); d.setMonth(d.getMonth() + 1); }
    else break;
    if (isoDate(d) === prev) break;
  }
  return isoDate(d);
}

function isEventOnDate(event, ds) {
  if (!event.recurrence) {
    return event.endDate ? event.date <= ds && ds <= event.endDate : event.date === ds;
  }
  let d = new Date(event.date + "T00:00:00");
  const target = new Date(ds + "T00:00:00");
  if (d > target) return false;
  while (d <= target) {
    if (isoDate(d) === ds) return true;
    const prev = isoDate(d);
    if (event.recurrence === "weekly") d = addDays(d, 7);
    else if (event.recurrence === "biweekly") d = addDays(d, 14);
    else if (event.recurrence === "monthly") { d = new Date(d); d.setMonth(d.getMonth() + 1); }
    else break;
    if (isoDate(d) === prev) break;
  }
  return false;
}

function KalenderTab({ data, update, autoOpenForm, onAutoFormConsumed }) {
  const [view, setView] = useState("liste"); // "liste" | "monat"
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filterDate, setFilterDate] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState("");
  const [type, setType] = useState("termin");
  const [color, setColor] = useState(TASK_COLORS[0]);
  const [recurrence, setRecurrence] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showAllFerien, setShowAllFerien] = useState(false);

  // Über den Plus-Knopf aufgerufen: Eingabefeld direkt geöffnet zeigen
  useEffect(() => {
    if (!autoOpenForm) return;
    setShowForm(true);
    onAutoFormConsumed?.();
  }, [autoOpenForm, onAutoFormConsumed]);

  const isColor = data.settings?.colorMode === true;
  const typeLabels = { termin: "Termin", erinnerung: "Erinnerung", ferien: "Ferien" };
  const typeColors = isColor
    ? { termin: "bg-amber-100 text-amber-700", erinnerung: "bg-red-100 text-red-700", ferien: "bg-emerald-100 text-emerald-700" }
    : { termin: "bg-stone-100 text-stone-600", erinnerung: "bg-stone-100 text-stone-600", ferien: "bg-stone-100 text-stone-600" };

  function addEvent() {
    if (!title.trim()) return;
    update((d) => {
      d.events.push({ id: uid(), title: title.trim(), date, time, type, color, done: false, recurrence: recurrence || null });
      return d;
    });
    setTitle(""); setTime(""); setRecurrence("");
  }

  function toggleDone(id) {
    update((d) => {
      const e = d.events.find((e) => e.id === id);
      if (e) e.done = !e.done;
      return d;
    });
  }

  function remove(id) {
    update((d) => { d.events = d.events.filter((e) => e.id !== id); return d; });
  }

  const sorted = [...data.events]
    .map((e) => ({ ...e, _eff: e.recurrence ? nextOccurrence(e) : e.date }))
    .filter((e) => !filterDate || isEventOnDate(e, filterDate))
    .sort((a, b) => (a._eff + (a.time || "")).localeCompare(b._eff + (b.time || "")));
  const open = sorted.filter((e) => e.recurrence || !e.done);
  const done = sorted.filter((e) => !e.recurrence && e.done && e.type !== "ferien");

  const tasksDue = [...(data.tasks || [])]
    .filter((t) => t.dueDate && !t.done)
    .filter((t) => !filterDate || t.dueDate.slice(0, 10) === filterDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  // Monatsraster: 6 Wochen à 7 Tage (Mo–So), führt/schließt Nachbarmonate mit
  const monthWeeks = useMemo(() => {
    const first = new Date(monthCursor);
    const startOffset = (first.getDay() + 6) % 7; // Mo=0
    const gridStart = addDays(first, -startOffset);
    return Array.from({ length: 6 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)));
  }, [monthCursor]);

  const todayStr = isoDate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Kalender</h1>
        <div className="inline-flex bg-stone-100 rounded-xl p-1">
          <button onClick={() => setView("liste")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "liste" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}>Liste</button>
          <button onClick={() => setView("monat")} className={`px-3.5 py-1.5 rounded-lg text-sm font-medium ${view === "monat" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500"}`}>Monat</button>
        </div>
      </div>

      {view === "monat" && (
        <Card className="p-3">
          <div className="flex items-center justify-between mb-3 px-1">
            <button onClick={() => setMonthCursor((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })} className="p-1.5 text-stone-400 hover:text-stone-700">
              <ChevronLeft size={18} />
            </button>
            <div className="text-sm font-medium text-stone-800">{monthCursor.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</div>
            <button onClick={() => setMonthCursor((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="p-1.5 text-stone-400 hover:text-stone-700">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400 mb-1">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthWeeks.flat().map((d, i) => {
              const ds = isoDate(d);
              const inMonth = d.getMonth() === monthCursor.getMonth();
              const isToday = ds === todayStr;
              const dayHasEvents = data.events.filter((e) => isEventOnDate(e, ds));
              const dayHasTasks = (data.tasks || []).filter((t) => t.dueDate && t.dueDate.slice(0, 10) === ds && !t.done);
              const active = filterDate === ds;
              return (
                <button
                  key={i}
                  onClick={() => { setFilterDate(active ? null : ds); setDate(ds); }}
                  className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm ${
                    active ? "bg-stone-900 text-white" : inMonth ? "hover:bg-stone-50 text-stone-700" : "text-stone-300"
                  }`}
                >
                  <span className={isToday && !active ? "text-red-500 font-medium" : ""}>{d.getDate()}</span>
                  {!!(dayHasEvents.length + dayHasTasks.length) && (
                    <span className="flex gap-0.5">
                      {dayHasEvents.slice(0, 2).map((e) => (
                        <span
                          key={e.id}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: active ? "#ffffff" : e.type === "ferien" ? "#10b981" : (e.color || "#c9702f") }}
                        />
                      ))}
                      {dayHasTasks.slice(0, 1).map((t) => (
                        <span
                          key={t.id}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: active ? "#ffffff" : (t.color || "#4F5844") }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {filterDate && (
            <button onClick={() => setFilterDate(null)} className="text-xs akzent-text hover:underline mt-3">
              Filter für {localDate(filterDate).toLocaleDateString("de-DE")} zurücksetzen
            </button>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="font-medium text-stone-800 mb-3">Termine & Erinnerungen</div>
        <ul className="space-y-3">
          {open.filter((e) => e.type !== "ferien").map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 text-sm">
              {e.recurrence ? (
                <span className="w-5 h-5 shrink-0 mt-0.5 flex items-center justify-center text-stone-300">
                  <RefreshCw size={13} />
                </span>
              ) : (
                <button onClick={() => toggleDone(e.id)} className="w-5 h-5 rounded-full border-2 border-stone-300 hover:akzent-rand shrink-0 mt-0.5" />
              )}
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: isColor ? (e.color || "#c9702f") : "#A8A29E" }} />
              <div className="flex-1 min-w-0">
                <div className="text-stone-800 leading-snug">{e.title}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[e.type]}`}>{typeLabels[e.type]}</span>
                  {e.recurrence && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-stone-100 text-stone-500 flex items-center gap-0.5">
                      <RefreshCw size={9} />{RECURRENCE_LABELS[e.recurrence]}
                    </span>
                  )}
                  <span className="text-stone-400 text-xs">
                    {new Date(e._eff || e.date).toLocaleDateString("de-DE")}{e.time ? `, ${e.time}` : ""}
                  </span>
                </div>
              </div>
              <button onClick={() => remove(e.id)} className="text-stone-300 hover:text-red-500 shrink-0 mt-0.5"><Trash2 size={14} /></button>
            </li>
          ))}
          {!open.filter((e) => e.type !== "ferien").length && <li className="text-sm text-stone-400">Keine offenen Termine.</li>}
        </ul>
      </Card>

      {!!tasksDue.length && (
        <Card className="p-5">
          <div className="font-medium text-stone-800 mb-3">Fällige Aufgaben</div>
          <ul className="space-y-3">
            {tasksDue.map((t) => (
              <li key={t.id} className="flex items-start gap-2.5 text-sm">
                <button
                  onClick={() => update((d) => { const task = d.tasks.find((x) => x.id === t.id); if (task) task.done = !task.done; return d; })}
                  className="w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center"
                  style={{ borderColor: t.color }}
                  aria-label="Erledigt"
                />
                <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: t.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-stone-800 leading-snug">{t.title}</div>
                  <div className="mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${localDate(t.dueDate) < new Date() ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                      {localDate(t.dueDate).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                      {t.dueDate.length > 10 ? `, ${t.dueDate.slice(11, 16)}` : ""}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(() => {
        const ferienList = open.filter((e) => e.type === "ferien");
        if (!ferienList.length) return null;
        const visible = showAllFerien ? ferienList : ferienList.slice(0, 1);
        return (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="font-medium text-emerald-900 mb-3 flex items-center gap-2">
              <span className="text-base leading-none">🌴</span> Schulferien
            </div>
            <ul className="space-y-1.5">
              {visible.map((e) => {
                const von = localDate(e.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
                const bis = e.endDate ? localDate(e.endDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
                return (
                  <li key={e.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
                    <span className="text-emerald-900">{e.title}</span>
                    <span className="text-emerald-600 text-xs tnum whitespace-nowrap text-right">
                      {von}{bis ? <span className="text-emerald-300"> – </span> : ""}{bis}
                    </span>
                    <button onClick={() => remove(e.id)} className="text-emerald-300 hover:text-red-600 shrink-0 justify-self-end"><Trash2 size={14} /></button>
                  </li>
                );
              })}
            </ul>
            {ferienList.length > 1 && (
              <button
                onClick={() => setShowAllFerien(!showAllFerien)}
                className="mt-3 text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
              >
                <ChevronDown size={14} className={showAllFerien ? "rotate-180" : ""} />
                {showAllFerien ? "Weniger anzeigen" : `${ferienList.length - 1} weitere Ferien`}
              </button>
            )}
          </div>
        );
      })()}

      {!!done.length && (
        <Card className="p-5">
          <div className="font-medium text-stone-500 mb-3 text-sm">Erledigt</div>
          <ul className="space-y-2">
            {done.map((e) => (
              <li key={e.id} className="flex items-center gap-3 text-sm text-stone-400 line-through">
                <button onClick={() => toggleDone(e.id)} className="w-5 h-5 rounded-full akzent-flaeche flex items-center justify-center shrink-0">
                  <Check size={12} className="text-white" />
                </button>
                <span className="flex-1">{e.title}</span>
                <button onClick={() => remove(e.id)} className="text-stone-300 hover:text-red-500 no-underline"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-stone-400 hover:text-stone-600 border border-dashed border-stone-200 rounded-xl transition-colors"
        >
          <Plus size={15} /> Neuen Termin anlegen
        </button>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-medium text-stone-800">Neuer Termin</div>
            <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600"><X size={16} /></button>
          </div>
          <Field label="Titel">
            <input className={inputCls} placeholder="z. B. Elternabend" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEvent()} autoFocus maxLength={200} />
          </Field>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Field label="Datum">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Uhrzeit (optional)">
              <input className={inputCls} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Field label="Art">
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
                <option value="termin">Termin</option>
                <option value="erinnerung">Erinnerung</option>
              </select>
            </Field>
            <Field label="Wiederholung">
              <select className={inputCls} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
                {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Farbe" className="mt-3">
            <div className="flex gap-2 items-center h-full">
              {TASK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full shrink-0"
                  style={{ backgroundColor: c, boxShadow: c === color ? "0 0 0 2px white, 0 0 0 3.5px #292524" : "0 0 0 2px white" }}
                />
              ))}
            </div>
          </Field>
          <Button onClick={() => { addEvent(); setShowForm(false); }} className="w-full justify-center mt-3"><Plus size={15} /> Anlegen</Button>
        </Card>
      )}
    </div>
  );
}

/* ---------- Aufgaben ---------- */

function TaskModal({ data, initial, defaultListId, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [color, setColor] = useState(initial?.color || TASK_COLORS[0]);
  const [listId, setListId] = useState(initial?.listId ?? defaultListId ?? "");
  const [creatingList, setCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListIcon, setNewListIcon] = useState("");
  const [useDue, setUseDue] = useState(!!initial?.dueDate);
  const [dueDate, setDueDate] = useState(initial?.dueDate ? initial.dueDate.slice(0, 10) : isoDate(new Date()));
  const [dueTime, setDueTime] = useState(initial?.dueDate ? initial.dueDate.slice(11, 16) : "12:00");

  function save() {
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      color,
      listId: creatingList ? null : (listId || null),
      newList: creatingList && newListName.trim() ? { name: newListName.trim(), icon: newListIcon } : null,
      dueDate: useDue ? `${dueDate}T${dueTime}` : null,
    });
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-stone-800">{initial ? "Aufgabe bearbeiten" : "Aufgabe hinzufügen"}</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <Field label="Aufgabenname">
            <input className={inputCls} placeholder="Aufgabenname eingeben" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200} />
          </Field>

          <Field label="Farbe">
            <div className="flex gap-2">
              {TASK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full"
                  style={{ backgroundColor: c, boxShadow: c === color ? "0 0 0 2px white, 0 0 0 3.5px #292524" : "0 0 0 2px white" }}
                />
              ))}
            </div>
          </Field>

          <Field label="Liste">
            {!creatingList ? (
              <select
                className={inputCls}
                value={listId}
                onChange={(e) => { if (e.target.value === "__new__") { setCreatingList(true); } else setListId(e.target.value); }}
              >
                <option value="">Keine Liste</option>
                {data.taskLists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="__new__">+ Neue Liste erstellen</option>
              </select>
            ) : (
              <div className="space-y-2">
                <input className={inputCls} placeholder="Listenname eingeben" value={newListName} onChange={(e) => setNewListName(e.target.value)} autoFocus maxLength={100} />
                <button onClick={() => setCreatingList(false)} className="text-xs text-stone-400 hover:text-stone-600">Abbrechen</button>
              </div>
            )}
          </Field>

          {creatingList && (
            <Field label="Listensymbol (optional)">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setNewListIcon("")}
                  className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs ${!newListIcon ? "akzent-rand akzent-ton" : "border-stone-200 text-stone-400"}`}
                >
                  ø
                </button>
                {LIST_ICON_KEYS.map((k) => {
                  const Icon = LIST_ICON_MAP[k];
                  return (
                    <button
                      key={k}
                      onClick={() => setNewListIcon(k)}
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center ${newListIcon === k ? "akzent-rand akzent-ton" : "border-stone-200 text-stone-500"}`}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Fälligkeitsdatum (optional)">
            {!useDue ? (
              <Button variant="subtle" onClick={() => setUseDue(true)} className="w-full justify-center">Datum & Uhrzeit auswählen</Button>
            ) : (
              <div className="flex gap-2">
                <input type="date" className={inputCls} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <input type="time" className={inputCls} value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
                <button onClick={() => setUseDue(false)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 size={16} /></button>
              </div>
            )}
          </Field>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={save} className="flex-1 justify-center">{initial ? "Speichern" : "Hinzufügen"}</Button>
        </div>
      </div>
    </div>
  );
}

function AufgabenTab({ data, update }) {
  const isColor = data.settings?.colorMode === true;
  const [selected, setSelected] = useState("alle"); // "alle" | "erledigt" | listId
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const tasks = data.tasks || [];
  const lists = data.taskLists || [];

  const visibleTasks = useMemo(() => {
    if (selected === "erledigt") return tasks.filter((t) => t.done);
    if (selected === "alle") return tasks.filter((t) => !t.done);
    return tasks.filter((t) => !t.done && t.listId === selected);
  }, [tasks, selected]);

  function saveTask(payload) {
    update((d) => {
      d.taskLists = d.taskLists || [];
      d.tasks = d.tasks || [];
      let listId = payload.listId;
      if (payload.newList) {
        const id = uid();
        d.taskLists.push({ id, name: payload.newList.name, icon: payload.newList.icon || "" });
        listId = id;
      }
      if (editingTask) {
        const t = d.tasks.find((x) => x.id === editingTask.id);
        if (t) { t.title = payload.title; t.color = payload.color; t.listId = listId; t.dueDate = payload.dueDate; }
      } else {
        d.tasks.push({ id: uid(), title: payload.title, color: payload.color, listId, dueDate: payload.dueDate, done: false });
      }
      return d;
    });
    setShowModal(false);
    setEditingTask(null);
  }

  function toggleDone(id) {
    update((d) => {
      const t = d.tasks.find((x) => x.id === id);
      if (t) t.done = !t.done;
      return d;
    });
  }

  function removeTask(id) {
    update((d) => { d.tasks = d.tasks.filter((t) => t.id !== id); return d; });
  }

  function removeList(id) {
    update((d) => {
      d.taskLists = d.taskLists.filter((l) => l.id !== id);
      d.tasks = d.tasks.map((t) => (t.listId === id ? { ...t, listId: null } : t));
      return d;
    });
    if (selected === id) setSelected("alle");
  }

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Aufgaben</h1>

      {/* Horizontale Tab-Leiste für Listen */}
      <div className="chip-scroll flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5">
        <button
          onClick={() => setSelected("alle")}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${selected === "alle" ? "akzent-ton akzent-rand akzent-text font-medium" : "bg-white border-stone-200 text-stone-600"}`}
        >
          <Inbox size={13} /> Alle
          <span className="text-xs opacity-60">{tasks.filter((t) => !t.done).length}</span>
        </button>
        {lists.map((l) => {
          const Icon = LIST_ICON_MAP[l.icon] || ListChecks;
          const count = tasks.filter((t) => !t.done && t.listId === l.id).length;
          return (
            <div key={l.id} className="shrink-0 flex items-center gap-0.5">
              <button
                onClick={() => setSelected(l.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${selected === l.id ? "akzent-ton akzent-rand akzent-text font-medium" : "bg-white border-stone-200 text-stone-600"}`}
              >
                <Icon size={13} /> {l.name}
                <span className="text-xs opacity-60">{count}</span>
              </button>
              {selected === l.id && (
                <button onClick={() => removeList(l.id)} className="w-5 h-5 flex items-center justify-center text-stone-300 hover:text-red-500 rounded-full shrink-0"><Trash2 size={11} /></button>
              )}
            </div>
          );
        })}
        <button
          onClick={() => setSelected("erledigt")}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${selected === "erledigt" ? "akzent-ton akzent-rand akzent-text font-medium" : "bg-white border-stone-200 text-stone-500"}`}
        >
          <FolderCheck size={13} /> Erledigt
          <span className="text-xs opacity-60">{doneCount}</span>
        </button>
      </div>

      <Card className="p-4">
        <ul className="divide-y divide-stone-100">
          {visibleTasks.map((t) => {
            const list = lists.find((l) => l.id === t.listId);
            return (
              <li key={t.id} className="py-2.5 flex items-start gap-3">
                <button
                  onClick={() => toggleDone(t.id)}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                  style={{ borderColor: isColor ? t.color : "#A8A29E", backgroundColor: t.done ? (isColor ? t.color : "#A8A29E") : "transparent" }}
                >
                  {t.done && <Check size={12} className="text-white" />}
                </button>
                <button onClick={() => { setEditingTask(t); setShowModal(true); }} className="flex-1 text-left">
                  <div className={`text-sm ${t.done ? "text-stone-400 line-through" : "text-stone-800"}`}>{t.title}</div>
                  {list && <div className="text-xs text-stone-400">{list.name}</div>}
                </button>
                {t.dueDate && (
                  <span className={`text-xs rounded-full px-2.5 py-1 shrink-0 ${!t.done && localDate(t.dueDate) < new Date() ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-600"}`}>
                    {localDate(t.dueDate).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}{t.dueDate.length > 10 ? `, ${t.dueDate.slice(11, 16)}` : ""}
                  </span>
                )}
                <button onClick={() => removeTask(t.id)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
              </li>
            );
          })}
          {!visibleTasks.length && (
            <li className="py-8 flex flex-col items-center gap-3 text-center">
              <ListChecks size={28} className="text-stone-200" />
              <span className="text-sm text-stone-400">{selected === "erledigt" ? "Noch nichts erledigt." : "Keine offenen Aufgaben."}</span>
              {selected !== "erledigt" && (
                <button
                  onClick={() => { setEditingTask(null); setShowModal(true); }}
                  className="text-xs px-3 py-1.5 rounded-lg akzent-ton akzent-text font-medium"
                >
                  Erste Aufgabe anlegen
                </button>
              )}
            </li>
          )}
        </ul>

        {selected !== "erledigt" && (
          <button
            onClick={() => { setEditingTask(null); setShowModal(true); }}
            className="mt-3 w-full flex items-center gap-2 border border-dashed border-stone-300 rounded-xl px-3 py-2.5 text-sm text-stone-400 hover:akzent-rand hover:akzent-text"
          >
            <span className="w-4 h-4 rounded-full border border-dashed border-current" /> Aufgabe hinzufügen
          </button>
        )}
      </Card>

      {showModal && (
        <TaskModal
          data={data}
          initial={editingTask}
          defaultListId={selected !== "alle" && selected !== "erledigt" ? selected : ""}
          onSave={saveTask}
          onClose={() => { setShowModal(false); setEditingTask(null); }}
        />
      )}
    </div>
  );
}

/* ---------- Noten ---------- */

/* Verteilungsbalken: Anzahl Schüler:innen je Note 1–6, wie bei der Sammelbewertung gewohnt */
function GradeDistributionBar({ values, isColor = true }) {
  const counts = [1, 2, 3, 4, 5, 6].map((n) => values.filter((v) => Math.round(v) === n).length);
  const bg = isColor
    ? ["bg-emerald-700/40", "bg-emerald-600/40", "bg-lime-600/40", "bg-amber-600/40", "bg-orange-600/40", "bg-red-700/40"]
    : Array(6).fill("bg-stone-200");
  return (
    <div className="grid grid-cols-6 gap-1">
      {counts.map((c, i) => (
        <div key={i} className={`rounded-lg py-2 text-center text-sm font-semibold text-stone-800 ${bg[i]}`}>
          {c}
        </div>
      ))}
    </div>
  );
}

/* Sammelbewertung: eine Note (z. B. mündliche Mitarbeit) für die ganze Klasse auf einen Blick vergeben */
function BulkGradeModal({ fach, cls, students, halbjahr, isColor = true, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("muendlich");
  const [date, setDate] = useState(isoDate(new Date()));
  const [factor, setFactor] = useState(1);
  const [topic, setTopic] = useState("");
  const [gradeMap, setGradeMap] = useState({});

  const values = Object.values(gradeMap).filter((v) => v != null);

  function setGrade(studentId, val) {
    setGradeMap((m) => ({ ...m, [studentId]: val === "" ? null : Number(val) }));
  }

  function save() {
    const entries = Object.entries(gradeMap).filter(([, v]) => v != null).map(([studentId, value]) => ({ studentId, value }));
    if (!entries.length) return;
    const topicVal = category === "schriftlich" ? topic.trim() || null : null;
    onSave({ title: title.trim() || `Mitarbeit am ${new Date(date).toLocaleDateString("de-DE")}`, category, date, factor, entries, topic: topicVal });
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-stone-800">Sammelbewertung</div>
            <div className="text-xs text-stone-400">{cls?.name} · {fach.subject}</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <input className={`${inputCls} col-span-2`} placeholder={`Titel, z. B. Mitarbeit am ${new Date(date).toLocaleDateString("de-DE")}`} value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {category === "schriftlich" && (
            <>
              <input className={`${inputCls} col-span-2`} list="saidy-themen-noten" placeholder="Thema (optional), z. B. Bruchrechnung" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={100} />
            </>
          )}
          <Field label="Faktor (z. B. x2 für Klassenarbeiten)">
            <input className={inputCls} type="number" step="0.5" min="0.5" value={factor} onChange={(e) => setFactor(Number(e.target.value))} />
          </Field>
        </div>

        <div className="mb-4">
          <div className="text-xs text-stone-400 mb-1.5">Verteilung ({values.length} von {students.length} bewertet)</div>
          <GradeDistributionBar values={values} isColor={isColor} />
        </div>

        <ul className="divide-y divide-stone-100 -mx-1">
          {students.map((s) => (
            <li key={s.id} className="py-2 px-1 flex items-center gap-3">
              <StudentAvatar student={s} size={24} />
              <span className="flex-1 min-w-0 text-sm text-stone-700 truncate">{s.name}</span>
              {category === "muendlich" ? (
                <div className="flex gap-1 shrink-0">
                  {QUICK_SYMBOLS.map((qs) => {
                    const active = gradeMap[s.id] === qs.value;
                    return (
                      <button
                        key={qs.symbol}
                        onClick={() => setGrade(s.id, active ? "" : String(qs.value))}
                        className="w-9 h-8 rounded-lg text-sm font-semibold border"
                        style={active ? { backgroundColor: isColor ? qs.color : "var(--oliv)", borderColor: isColor ? qs.color : "var(--oliv)", color: "white" } : { borderColor: "#E7E5E4", color: "#78716C" }}
                      >
                        {qs.symbol}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <select
                  className="text-sm rounded-lg border border-stone-300 px-2 py-1.5 w-24"
                  value={gradeMap[s.id] ?? ""}
                  onChange={(e) => setGrade(s.id, e.target.value)}
                >
                  <option value="">—</option>
                  {GRADE_OPTIONS.map((g) => <option key={g.label} value={g.value}>{g.label}</option>)}
                </select>
              )}
            </li>
          ))}
          {!students.length && <li className="py-3 text-sm text-stone-400">Keine Schüler:innen in dieser Klasse.</li>}
        </ul>

        <div className="flex gap-2 mt-5">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={save} className="flex-1 justify-center">{values.length} Note{values.length === 1 ? "" : "n"} speichern</Button>
        </div>
      </div>
    </div>
  );
}

/* Vergessen-Tracking: z. B. Sportzeug, Hausaufgaben – schnelles Erfassen für die ganze Klasse */
function IncidentModal({ cls, students, defaultLabel, onSave, onClose }) {
  const [label, setLabel] = useState(defaultLabel || "Sportzeug");
  const [date, setDate] = useState(isoDate(new Date()));
  const [selected, setSelected] = useState(new Set());
  const [autoGrade, setAutoGrade] = useState(true);
  const [autoValue, setAutoValue] = useState(5);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function save() {
    if (!label.trim()) return;
    onSave({ label: label.trim(), date, studentIds: Array.from(selected), autoGrade, autoValue });
  }

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold text-stone-800">Vergessen erfassen</div>
            <div className="text-xs text-stone-400">{cls?.name}</div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <input className={inputCls} placeholder="z. B. Sportzeug" maxLength={50} value={label} onChange={(e) => setLabel(e.target.value)} />
          <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="text-xs text-stone-400 mb-1.5">Wer hat "{label || "…"}" vergessen?</div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`px-2.5 py-1.5 rounded-full text-sm border ${selected.has(s.id) ? "bg-red-600 border-red-600 text-white" : "bg-white border-stone-200 text-stone-600"}`}
            >
              {s.name}
            </button>
          ))}
          {!students.length && <p className="text-sm text-stone-400">Keine Schüler:innen in dieser Klasse.</p>}
        </div>

        <div className="rounded-xl border border-stone-200 p-3 mb-4">
          <label className="flex items-center gap-2 text-sm text-stone-700 py-2 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 shrink-0" style={{ accentColor: "#4F5844" }} checked={autoGrade} onChange={(e) => setAutoGrade(e.target.checked)} />
            Automatisch eine mündliche Note vergeben
          </label>
          {autoGrade && (
            <div className="flex items-center gap-2 pl-6">
              <span className="text-xs text-stone-400">Note:</span>
              <select className="text-sm rounded-lg border border-stone-300 px-2 py-1" value={autoValue} onChange={(e) => setAutoValue(Number(e.target.value))}>
                {GRADE_OPTIONS.map((g) => <option key={g.label} value={g.value}>{g.label}</option>)}
              </select>
              <span className="text-xs text-stone-400">wird als "{label || "…"} vergessen" markiert und farblich abgehoben.</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">Abbrechen</Button>
          <Button onClick={save} className="flex-1 justify-center">{selected.size} speichern</Button>
        </div>
      </div>
    </div>
  );
}

/* Übersicht wie im Klassenbuch: Schüler:innen × Termine, mit Serien-Warnung bei mehrfachem Vergessen in Folge */
function IncidentsOverview({ data, update, fach, cls, students, halbjahr }) {
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState(null);

  const fachIncidents = data.incidents.filter((i) => i.fachId === fach.id);
  const labels = Array.from(new Set(fachIncidents.map((i) => i.label)));
  const activeLabel = label && labels.includes(label) ? label : labels[0];

  const relevant = fachIncidents.filter((i) => i.label === activeLabel);
  const dates = Array.from(new Set(relevant.map((i) => i.date))).sort().slice(-8); // letzte 8 Termine

  function hasIncident(studentId, date) {
    return relevant.some((i) => i.studentId === studentId && i.date === date);
  }

  function streak(studentId) {
    let count = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      if (hasIncident(studentId, dates[i])) count++;
      else break;
    }
    return count;
  }

  function saveIncidents({ label: newLabel, date, studentIds, autoGrade, autoValue }) {
    update((d) => {
      d.incidents = d.incidents.filter((i) => !(i.fachId === fach.id && i.label === newLabel && i.date === date));
      // vorherige automatische Noten für diesen Termin/diese Bezeichnung entfernen, damit ein erneutes Speichern nichts verdoppelt
      d.grades = d.grades.filter((g) => !(g.fachId === fach.id && g.date === date && g.auto && g.reason === newLabel));
      studentIds.forEach((studentId) => {
        d.incidents.push({ id: uid(), studentId, fachId: fach.id, label: newLabel, date });
        if (autoGrade) {
          d.grades.push({
            id: uid(), studentId, classId: fach.classId, fachId: fach.id, category: "muendlich",
            value: autoValue, factor: 1, title: `${newLabel} vergessen`, date, halbjahr,
            auto: true, reason: newLabel,
          });
        }
      });
      return d;
    });
    setLabel(newLabel);
    setShowModal(false);
  }

  function removeEntry(studentId, date) {
    update((d) => {
      d.incidents = d.incidents.filter((i) => !(i.fachId === fach.id && i.label === activeLabel && i.date === date && i.studentId === studentId));
      d.grades = d.grades.filter((g) => !(g.fachId === fach.id && g.studentId === studentId && g.date === date && g.auto && g.reason === activeLabel));
      return d;
    });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 text-stone-800 font-medium">
          <AlertTriangle size={16} /> Vergessen
        </div>
        <Button variant="subtle" onClick={() => setShowModal(true)}><Plus size={15} /> Eintrag</Button>
      </div>

      {!!labels.length && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {labels.map((l) => (
            <button
              key={l}
              onClick={() => setLabel(l)}
              className={`px-2.5 py-1 rounded-full text-xs border ${l === activeLabel ? "akzent-ton akzent-rand akzent-text" : "bg-white border-stone-200 text-stone-500"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {!dates.length ? (
        <p className="text-sm text-stone-400">Noch keine Einträge. Mit "+ Eintrag" kannst du z. B. festhalten, wer das Sportzeug vergessen hat.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="text-sm border-separate border-spacing-1 min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs text-stone-400 font-medium px-1 sticky left-0 bg-white">Name</th>
                {dates.map((d) => (
                  <th key={d} className="text-xs text-stone-400 font-medium w-9">{new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</th>
                ))}
                <th className="text-xs text-stone-400 font-medium w-14">Serie</th>
              </tr>
            </thead>
            <tbody>
              {!students.length && <tr><td className="py-3 text-stone-400 text-sm">Keine Schüler:innen in dieser Klasse.</td></tr>}
              {students.map((s) => {
                const st = streak(s.id);
                return (
                  <tr key={s.id}>
                    <td className="text-stone-700 px-1 whitespace-nowrap sticky left-0 bg-white">{s.name}</td>
                    {dates.map((d) => {
                      const has = hasIncident(s.id, d);
                      return (
                        <td key={d} className="text-center">
                          <button
                            onClick={() => (has ? removeEntry(s.id, d) : null)}
                            className={`w-6 h-6 rounded-full mx-auto flex items-center justify-center ${has ? "bg-red-500" : "bg-stone-100"}`}
                            title={has ? "Klicken zum Entfernen" : ""}
                          >
                            {has && <X size={12} className="text-white" />}
                          </button>
                        </td>
                      );
                    })}
                    <td className="text-center">
                      {st >= 3 ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          <AlertTriangle size={11} /> {st}x
                        </span>
                      ) : st > 0 ? (
                        <span className="text-xs text-stone-400">{st}x</span>
                      ) : (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-stone-400 mt-2">Ab 3x in Folge wird die Serie rot markiert – ein guter Zeitpunkt für ein Gespräch.</p>
        </div>
      )}

      {showModal && (
        <IncidentModal
          cls={cls}
          students={students}
          defaultLabel={activeLabel}
          onSave={saveIncidents}
          onClose={() => setShowModal(false)}
        />
      )}
    </Card>
  );
}

/* Druck-/PDF-Ansicht: sauberes Schwarz-Weiß-Layout für Klassenübersicht oder Einzelschüler */
function PrintReport({ mode, fach, cls, students, data, halbjahr, onClose }) {
  const weights = fach?.weights || DEFAULT_WEIGHTS;
  const today = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const [confirmPdfShare, setConfirmPdfShare] = useState(false);
  const [confirmPdfDownload, setConfirmPdfDownload] = useState(false);

  function studentRow(s) {
    const grades = data.grades.filter((g) => g.studentId === s.id && g.fachId === fach.id && g.halbjahr === halbjahr);
    const { overall, byCat } = calcOverall(grades, weights);
    const tendency = tendencyInfo(overall);
    const forgotten = data.incidents.filter((i) => i.fachId === fach.id && i.studentId === s.id).length;
    return { s, grades, overall, byCat, tendency, forgotten };
  }

  const rows = (mode.type === "class" ? students : students.filter((s) => s.id === mode.studentId)).map(studentRow);

  const reportTitle = mode.type === "class"
    ? `Notenübersicht ${cls?.name} ${fach.subject}`
    : `Notenübersicht ${rows[0]?.s.name || ""}`;

  /* Echte PDF-Erzeugung ohne Druckdialog: minimaler PDF-Writer (Helvetica, A4, mehrseitig) */
  function pdfLatin1(s) {
    return String(s ?? "")
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[\u201E\u201C\u201D]/g, '"')
      .replace(/\u2019/g, "'")
      .replace(/[^\x00-\xFF]/g, "?");
  }
  function pdfEsc(s) {
    return pdfLatin1(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  function createPdfDoc() {
    const pageH = 842, margin = 40, bottom = 55;
    const pages = [];
    let ops = null, y = 0;
    function newPage() { ops = []; pages.push(ops); y = pageH - 60; }
    newPage();
    function need(h) { if (y - h < bottom) newPage(); }
    function txt(x, t, { size = 10, bold = false, gray = null } = {}) {
      if (gray != null) ops.push(`${gray} g`);
      ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfEsc(t)}) Tj ET`);
      if (gray != null) ops.push(`0 g`);
    }
    function rowDown(h) { y -= h; }
    function hline() { need(8); ops.push(`0.75 w ${margin} ${y} m ${595 - margin} ${y} l S`); y -= 10; }
    function wrap(t, maxChars) {
      const words = String(t).split(/\s+/);
      const out = []; let cur = "";
      words.forEach((w) => {
        if ((cur + " " + w).trim().length > maxChars) { if (cur.trim()) out.push(cur.trim()); cur = w; }
        else cur += " " + w;
      });
      if (cur.trim()) out.push(cur.trim());
      return out.length ? out : [""];
    }
    function para(t, { size = 10, bold = false, gray = null, maxChars = 100, x = margin } = {}) {
      wrap(t, maxChars).forEach((l) => { need(size + 4); txt(x, l, { size, bold, gray }); y -= size + 4; });
    }
    function finish() {
      const objBodies = [];
      objBodies.push(`<< /Type /Catalog /Pages 2 0 R >>`);
      objBodies.push(null); // Pages-Objekt wird unten gesetzt
      objBodies.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
      objBodies.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
      const kidRefs = [];
      pages.forEach((pOps) => {
        const stream = pOps.join("\n");
        objBodies.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
        const contentNum = objBodies.length;
        objBodies.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`);
        kidRefs.push(`${objBodies.length} 0 R`);
      });
      objBodies[1] = `<< /Type /Pages /Kids [${kidRefs.join(" ")}] /Count ${pages.length} >>`;
      let out = "%PDF-1.4\n";
      const offsets = [];
      objBodies.forEach((b, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${b}\nendobj\n`; });
      const xrefPos = out.length;
      out += `xref\n0 ${objBodies.length + 1}\n0000000000 65535 f \n`;
      offsets.forEach((o) => { out += String(o).padStart(10, "0") + " 00000 n \n"; });
      out += `trailer\n<< /Size ${objBodies.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
      const bytes = new Uint8Array(out.length);
      for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
      return bytes;
    }
    return { txt, rowDown, hline, para, need, finish };
  }

  function buildPdfBytes() {
    const doc = createPdfDoc();
    const title = mode.type === "class" ? `Notenübersicht ${cls?.name} · ${fach.subject}` : `Notenübersicht ${rows[0]?.s.name || ""}`;
    doc.para(title, { size: 16, bold: true, maxChars: 60 });
    doc.para(`${mode.type === "student" ? `${cls?.name} · ${fach.subject} · ` : ""}${halbjahr}. Halbjahr · Stand ${today}`, { size: 9, gray: 0.45, maxChars: 90 });
    doc.rowDown(8);

    if (mode.type === "class") {
      doc.need(16);
      doc.txt(40, "Name", { size: 10, bold: true });
      doc.txt(270, `Mündl. (${weights.muendlich}%)`, { size: 10, bold: true });
      doc.txt(360, `Schriftl. (${weights.schriftlich}%)`, { size: 10, bold: true });
      doc.txt(460, "Gesamt", { size: 10, bold: true });
      doc.rowDown(6);
      doc.hline();
      rows.forEach(({ s, overall, byCat, tendency, forgotten }) => {
        doc.need(14);
        doc.txt(40, pdfLatin1(s.name).slice(0, 40), { size: 10 });
        doc.txt(270, byCat.muendlich ? `${gradeLabel(byCat.muendlich.avg)} (${byCat.muendlich.count})` : "—", { size: 10 });
        doc.txt(360, byCat.schriftlich ? `${gradeLabel(byCat.schriftlich.avg)} (${byCat.schriftlich.count})` : "—", { size: 10 });
        doc.txt(460, overall != null ? gradeLabel(overall) : "—", { size: 10, bold: true });
        doc.rowDown(13);
        const hint = [tendency ? `Tendenz zur ${tendency.potential}` : "", forgotten ? `${forgotten}x vergessen` : ""].filter(Boolean).join(" · ");
        if (hint) { doc.txt(48, hint, { size: 8, gray: 0.45 }); doc.rowDown(11); }
        doc.rowDown(2);
      });
    } else if (rows[0]) {
      const { s, grades, overall, byCat, tendency } = rows[0];
      const notes = data.notes.filter((n) => n.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
      const autoGrades = grades.filter((g) => g.auto || g.reason);

      doc.need(30);
      doc.txt(40, overall != null ? gradeLabel(overall) : "—", { size: 24, bold: true });
      if (overall != null) doc.txt(95, gradeWord(overall), { size: 11, gray: 0.45 });
      doc.rowDown(30);

      if (tendency) {
        doc.para(`Hinweis: Rechnerisch eine ${tendency.currentLabel}, aber ${tendency.strength} an der Grenze zur ${tendency.direction} Note (${tendency.potentialLabel}).`, { size: 9, maxChars: 100 });
        doc.rowDown(4);
      }

      doc.para(`Mündlich (${weights.muendlich} %): ${byCat.muendlich ? `${gradeLabel(byCat.muendlich.avg)} aus ${byCat.muendlich.count} Note${byCat.muendlich.count === 1 ? "" : "n"}` : "keine Noten"}`, { size: 10 });
      doc.para(`Schriftlich (${weights.schriftlich} %): ${byCat.schriftlich ? `${gradeLabel(byCat.schriftlich.avg)} aus ${byCat.schriftlich.count} Note${byCat.schriftlich.count === 1 ? "" : "n"}` : "keine Noten"}`, { size: 10 });
      if (autoGrades.length) {
        doc.rowDown(2);
        doc.para(`Enthalten, aber nicht Ausdruck der fachlichen Mitarbeit: ${autoGrades.length}x Note wegen Vergessen (${Array.from(new Set(autoGrades.map((g) => g.reason))).join(", ")}).`, { size: 9, gray: 0.35, maxChars: 100 });
      }

      doc.rowDown(8);
      doc.need(16);
      doc.txt(40, "Einzelnoten", { size: 11, bold: true });
      doc.rowDown(6);
      doc.hline();
      [...grades].sort((a, b) => b.date.localeCompare(a.date)).forEach((g) => {
        doc.need(14);
        doc.txt(40, GRADE_OPTIONS.find((o) => o.value === g.value)?.label || "", { size: 10, bold: true });
        doc.txt(75, CATS.find((c) => c.key === g.category)?.label || "", { size: 9, gray: 0.45 });
        doc.txt(140, pdfLatin1(`${g.title || "—"}${g.auto ? " (automatisch)" : ""}`).slice(0, 55), { size: 10 });
        doc.txt(490, localDate(g.date).toLocaleDateString("de-DE"), { size: 9, gray: 0.45 });
        doc.rowDown(15);
      });
      if (!grades.length) { doc.para("Noch keine Noten.", { size: 10, gray: 0.45 }); }

      if (notes.length) {
        doc.rowDown(8);
        doc.need(16);
        doc.txt(40, "Beobachtungen", { size: 11, bold: true });
        doc.rowDown(6);
        doc.hline();
        notes.forEach((n) => {
          doc.para(`– ${n.text} (${localDate(n.date).toLocaleDateString("de-DE")})`, { size: 9, maxChars: 105 });
        });
      }

      doc.rowDown(10);
      doc.para("Diese Angaben sind eine rechnerische Grundlage und ersetzen nicht die pädagogische Gesamteinschätzung.", { size: 8, gray: 0.5, maxChars: 115 });
    }

    return doc.finish();
  }

  const pdfFileName = `${reportTitle.replace(/[^\wäöüÄÖÜß -]/g, "")}.pdf`;

  function downloadPdf() {
    const bytes = buildPdfBytes();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function sharePdf() {
    try {
      const bytes = buildPdfBytes();
      const file = new File([bytes], pdfFileName, { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: reportTitle });
        return;
      }
    } catch (e) {
      if (e?.name === "AbortError") return;
    }
    downloadPdf();
  }


  return (
    <div id="print-report" className="fixed inset-0 bg-white z-[100] overflow-y-auto">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-report, #print-report * { visibility: visible; }
          #print-report { position: absolute; inset: 0; overflow: visible; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="print-hide sticky top-0 bg-white border-b border-stone-200 px-5 py-3 flex items-center justify-between gap-2">
        <Button variant="ghost" onClick={onClose}><X size={15} /> Schließen</Button>
        <div className="flex gap-2">
          <Button variant="subtle" onClick={() => setConfirmPdfShare(true)}>Teilen</Button>
          <Button onClick={() => setConfirmPdfDownload(true)}><Printer size={15} /> Als PDF herunterladen</Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-8 text-stone-900">
        <h1 className="text-xl font-bold mb-0.5">
          {mode.type === "class" ? `Notenübersicht ${cls?.name} · ${fach.subject}` : `Notenübersicht ${rows[0]?.s.name}`}
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          {mode.type === "student" ? `${cls?.name} · ${fach.subject} · ` : ""}{halbjahr}. Halbjahr · Stand {today}
        </p>

        {mode.type === "class" && (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-800 text-left">
                <th className="py-1.5 pr-2 font-semibold">Name</th>
                <th className="py-1.5 px-2 font-semibold text-center">Mündlich ({weights.muendlich}%)</th>
                <th className="py-1.5 px-2 font-semibold text-center">Schriftlich ({weights.schriftlich}%)</th>
                <th className="py-1.5 px-2 font-semibold text-center">Gesamt</th>
                <th className="py-1.5 pl-2 font-semibold">Hinweis</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && <tr><td colSpan={5} className="py-3 text-stone-400 text-sm">Keine Schüler:innen in dieser Klasse.</td></tr>}
              {rows.map(({ s, overall, byCat, tendency, forgotten }) => (
                <tr key={s.id} className="border-b border-stone-200 align-top">
                  <td className="py-1.5 pr-2">{s.name}</td>
                  <td className="py-1.5 px-2 text-center">{byCat.muendlich ? `${gradeLabel(byCat.muendlich.avg)} (${byCat.muendlich.count})` : "—"}</td>
                  <td className="py-1.5 px-2 text-center">{byCat.schriftlich ? `${gradeLabel(byCat.schriftlich.avg)} (${byCat.schriftlich.count})` : "—"}</td>
                  <td className="py-1.5 px-2 text-center font-bold">{overall != null ? gradeLabel(overall) : "—"}</td>
                  <td className="py-1.5 pl-2 text-xs text-stone-600">
                    {tendency ? `Tendenz zur ${tendency.potential}` : ""}
                    {tendency && forgotten ? " · " : ""}
                    {forgotten ? `${forgotten}x vergessen` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {mode.type === "student" && rows[0] && (() => {
          const { s, grades, overall, byCat, tendency } = rows[0];
          const notes = data.notes.filter((n) => n.studentId === s.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
          const autoGrades = grades.filter((g) => g.auto || g.reason);
          return (
            <div className="space-y-5">
              <div className="flex items-baseline gap-3 border-b-2 border-stone-800 pb-3">
                <span className="text-3xl font-bold">{overall != null ? gradeLabel(overall) : "—"}</span>
                {overall != null && <span className="text-stone-500">{gradeWord(overall)}</span>}
              </div>

              {tendency && (
                <p className="text-sm border border-stone-300 rounded px-3 py-2">
                  Hinweis: Rechnerisch eine {tendency.currentLabel}, aber {tendency.strength} an der Grenze zur {tendency.direction} Note ({tendency.potentialLabel}).
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm">
                {CATS.map((c) => (
                  <div key={c.key}>
                    <div className="text-stone-500">{c.label} ({weights[c.key]}%)</div>
                    <div className="font-semibold">{byCat[c.key] ? `${gradeLabel(byCat[c.key].avg)} aus ${byCat[c.key].count} Note${byCat[c.key].count === 1 ? "" : "n"}` : "keine Noten"}</div>
                  </div>
                ))}
              </div>

              {!!autoGrades.length && (
                <p className="text-sm text-stone-600">
                  Enthalten, aber nicht Ausdruck der fachlichen Mitarbeit: {autoGrades.length}x Note wegen Vergessen ({Array.from(new Set(autoGrades.map((g) => g.reason))).join(", ")}).
                </p>
              )}

              <div>
                <div className="font-semibold text-sm border-b border-stone-300 pb-1 mb-2">Einzelnoten</div>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {[...grades].sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
                      <tr key={g.id} className="border-b border-stone-100">
                        <td className="py-1 pr-2 font-semibold w-10">{GRADE_OPTIONS.find((o) => o.value === g.value)?.label}</td>
                        <td className="py-1 px-2 text-stone-500 w-24">{CATS.find((c) => c.key === g.category)?.label}</td>
                        <td className="py-1 px-2">{g.title || "—"}{g.auto ? " (automatisch)" : ""}</td>
                        <td className="py-1 pl-2 text-stone-500 text-right whitespace-nowrap">{localDate(g.date).toLocaleDateString("de-DE")}</td>
                      </tr>
                    ))}
                    {!grades.length && <tr><td className="py-1 text-stone-400">Noch keine Noten.</td></tr>}
                  </tbody>
                </table>
              </div>

              {!!notes.length && (
                <div>
                  <div className="font-semibold text-sm border-b border-stone-300 pb-1 mb-2">Beobachtungen</div>
                  <ul className="text-sm space-y-1">
                    {notes.map((n) => (
                      <li key={n.id}>– {n.text} <span className="text-stone-400">({localDate(n.date).toLocaleDateString("de-DE")})</span></li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-stone-400 pt-3 border-t border-stone-200">
                Diese Angaben sind eine rechnerische Grundlage und ersetzen nicht die pädagogische Gesamteinschätzung.
              </p>
            </div>
          );
        })()}
      </div>

      {confirmPdfShare && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmPdfShare(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-stone-800 mb-2">PDF teilen</div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Datenschutzhinweis:</strong> Diese PDF enthält personenbezogene Schülerdaten. Teile sie nur über sichere, schulisch genehmigte Kanäle. Keine privaten Messenger oder Cloud-Dienste (iCloud, WhatsApp, Google Drive).
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmPdfShare(false)} className="flex-1 justify-center">Abbrechen</Button>
              <Button onClick={() => { setConfirmPdfShare(false); sharePdf(); }} className="flex-1 justify-center">Verstanden, teilen</Button>
            </div>
          </div>
        </div>
      )}
      {confirmPdfDownload && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmPdfDownload(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-stone-800 mb-2">PDF herunterladen</div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
              <p className="text-[11px] text-amber-800 leading-relaxed">
                <strong>Datenschutzhinweis:</strong> Diese PDF enthält personenbezogene Schülerdaten. Speichere sie nur auf schulisch genehmigten Geräten und lösche sie nach Verwendung.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setConfirmPdfDownload(false)} className="flex-1 justify-center">Abbrechen</Button>
              <Button onClick={() => { setConfirmPdfDownload(false); downloadPdf(); }} className="flex-1 justify-center">Verstanden, herunterladen</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Klassenübersicht: alle Kinder eines Fachs auf einen Blick, mit Foto und farbcodierten Noten */
function NotenUebersicht({ students, data, update, fach, halbjahr, selectedStudent, onSelect }) {
  const weights = fach?.weights || DEFAULT_WEIGHTS;
  const isColor = data.settings?.colorMode === true;
  const colored = isColor && data.settings?.notenfarben !== false;
  const [tendencyPopup, setTendencyPopup] = useState(null); // { name, tendency, overall }
  const [sortDir, setSortDir] = useState("az"); // "az" | "za"
  const [nameOrder, setNameOrder] = useState("vorname"); // "vorname" | "nachname"
  const [sportzeugDetail, setSportzeugDetail] = useState(null); // studentId für das Detailfenster
  const zeugnisphase = [1, 2, 6, 7].includes(new Date().getMonth() + 1);
  const [showZeugnis, setShowZeugnis] = useState(zeugnisphase);
  const [quickGradeId, setQuickGradeId] = useState(null); // studentId für Schnellbewertung-Popover

  // Nur im Fach Sport gibt es die Sportzeug-Spalte
  const istSport = /sport/i.test(fach?.subject || "");

  // Nachname = letztes Wort, Vorname(n) = Rest
  function splitName(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length < 2) return { vor: name, nach: "" };
    return { vor: parts.slice(0, -1).join(" "), nach: parts[parts.length - 1] };
  }
  const dupFirstNames = useMemo(() => {
    const cnt = {};
    students.forEach((s) => { const { vor } = splitName(s.name); cnt[vor] = (cnt[vor] || 0) + 1; });
    return new Set(Object.entries(cnt).filter(([, n]) => n > 1).map(([v]) => v));
  }, [students]);
  function displayName(name) {
    const { vor, nach } = splitName(name);
    if (!nach) return name;
    if (nameOrder === "nachname") return `${nach}, ${vor}`;
    if (dupFirstNames.has(vor)) return `${vor} ${nach.charAt(0)}.`;
    return name;
  }
  function sortKey(name) {
    const { vor, nach } = splitName(name);
    return (nameOrder === "nachname" ? `${nach} ${vor}` : name).toLowerCase();
  }

  function addQuickMuendlich(studentId, value) {
    update((d) => {
      d.grades.push({ id: uid(), studentId, classId: fach.classId, fachId: fach.id, category: "muendlich", value, factor: 1, title: "Mündlich", date: isoDate(new Date()), halbjahr, quick: true });
      return d;
    });
  }

  const rows = students.map((s) => {
    const grades = data.grades.filter((g) => g.studentId === s.id && g.fachId === fach.id && g.halbjahr === halbjahr);
    const { overall, byCat } = calcOverall(grades, weights);
    const finalGrade = (data.finalGrades || []).find((f) => f.studentId === s.id && f.fachId === fach.id && f.halbjahr === halbjahr);
    // Wie oft hat das Kind in diesem Fach Material vergessen? (Vergessen-Noten oder Vorfälle)
    const vergessen = grades.filter((g) => g.auto || g.reason).length
      + (data.incidents || []).filter((i) => i.studentId === s.id && i.fachId === fach.id).length;
    return { student: s, overall, byCat, tendency: tendencyInfo(overall), finalGrade, vergessen };
  }).sort((a, b) => {
    const cmp = sortKey(a.student.name).localeCompare(sortKey(b.student.name), "de");
    return sortDir === "az" ? cmp : -cmp;
  });

  return (
    <div className="space-y-2">
      {/* Sortier- und Anzeigeoptionen */}
      <div className="flex items-center gap-2 px-1 text-xs">
        <button
          onClick={() => setSortDir((d) => (d === "az" ? "za" : "az"))}
          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg bg-white border border-stone-200 text-stone-600 whitespace-nowrap shrink-0"
        >
          {sortDir === "az" ? "A → Z" : "Z → A"}
        </button>
        <button
          onClick={() => setNameOrder((o) => (o === "vorname" ? "nachname" : "vorname"))}
          className="inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg bg-white border border-stone-200 text-stone-600 whitespace-nowrap shrink-0"
        >
          {nameOrder === "vorname" ? "Vorname zuerst" : "Nachname zuerst"}
        </button>
        <button
          onClick={() => setShowZeugnis((v) => !v)}
          className={`inline-flex items-center justify-center gap-1 h-8 px-2.5 rounded-lg border text-xs transition-colors whitespace-nowrap shrink-0 ${showZeugnis ? "akzent-ton akzent-rand akzent-text" : "bg-white border-stone-200 text-stone-500"}`}
          title={showZeugnis ? "Zeugnisnoten-Spalte ausblenden" : "Zeugnisnoten-Spalte einblenden"}
        >
          <GraduationCap size={12} /> Zeugnisnote
        </button>
      </div>

    <Card className="p-2 overflow-x-auto" onClick={() => setQuickGradeId(null)}>
      <table className="w-full text-sm border-separate border-spacing-y-1 table-fixed">
        <colgroup>
          <col />
          <col className="w-12" />
          <col className={istSport ? "w-20" : "w-12"} />
          <col className="w-14" />
          {showZeugnis && <col className="w-14" />}
        </colgroup>
        <thead>
          <tr className="text-[10px] text-stone-400 uppercase tracking-wide">
            <th className="text-left font-semibold px-2 pb-1 sticky left-0 z-[2] bg-karte">Name</th>
            <th className="font-semibold pb-1" title={`Mündlicher Schnitt (${weights.muendlich ?? 50} %)`}>Mündl.</th>
            <th className="font-semibold pb-1" title={istSport ? "Sportzeug vergessen (Anzahl)" : `Schriftlicher Schnitt (${weights.schriftlich ?? 50} %)`}>{istSport ? "Sportz." : "Schr."}</th>
            <th className="font-semibold pb-1" title="Gewichteter Gesamtdurchschnitt">Ges.</th>
            {showZeugnis && <th className="font-semibold pb-1" title="Manuell eingetragene Zeugnisnote">Zeugn.</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ student: s, overall, byCat, tendency, finalGrade, vergessen }) => {
            const active = selectedStudent === s.id;
            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`group cursor-pointer ${active ? "akzent-ton" : "hover:bg-stone-50"}`}
              >
                <td className={`px-2 py-1.5 rounded-l-xl sticky left-0 z-[1] shadow-[6px_0_6px_-6px_rgba(0,0,0,0.10)] ${active ? "akzent-ton" : "bg-karte group-hover:bg-stone-50"}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <StudentAvatar student={s} size={26} />
                    <span className={`truncate ${active ? "akzent-text font-semibold" : "text-stone-800 font-medium"}`}>{displayName(s.name)}</span>
                  </div>
                </td>
                <td className="text-center tnum relative" onClick={(e) => { e.stopPropagation(); setQuickGradeId(quickGradeId === s.id ? null : s.id); }}>
                  {byCat.muendlich
                    ? <span className={`font-semibold cursor-pointer hover:underline underline-offset-2 ${gradeColor(byCat.muendlich.avg, colored)}`}>{gradeLabel(byCat.muendlich.avg)}</span>
                    : <span className="text-stone-400 text-base cursor-pointer select-none" title="Schnellbewertung">+</span>}
                  {quickGradeId === s.id && (
                    <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-xl shadow-xl border border-stone-200 p-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {QUICK_SYMBOLS.map((qs) => (
                        <button key={qs.symbol}
                          onClick={() => { addQuickMuendlich(s.id, qs.value); setQuickGradeId(null); }}
                          className="w-9 h-8 rounded-lg text-sm font-semibold border transition-colors hover:text-white"
                          style={{ borderColor: isColor ? qs.color : "var(--oliv)", color: isColor ? qs.color : "var(--oliv)" }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = isColor ? qs.color : "var(--oliv)"; e.currentTarget.style.color = "white"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = ""; e.currentTarget.style.color = isColor ? qs.color : "var(--oliv)"; }}
                        >{qs.symbol}</button>
                      ))}
                    </div>
                  )}
                </td>
                <td className="text-center tnum">
                  {istSport ? (
                    (() => {
                      const gesamt = (data.incidents || []).filter((i) => i.fachId === fach.id && i.studentId === s.id && i.label === "Sportzeug").length;
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSportzeugDetail(s.id); }}
                          className={`inline-flex items-center justify-center min-w-8 h-7 px-1.5 rounded-lg text-xs font-semibold ${
                            gesamt > 0 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-300 hover:bg-amber-50 hover:text-amber-600"
                          }`}
                          title={gesamt > 0 ? `${gesamt}× Sportzeug vergessen – antippen für Details` : "Sportzeug vergessen? Antippen zum Erfassen"}
                        >
                          {gesamt > 0 ? <span className="flex items-center gap-0.5"><AlertTriangle size={11} /> {gesamt}</span> : <AlertTriangle size={13} />}
                        </button>
                      );
                    })()
                  ) : (
                    byCat.schriftlich ? <span className={`font-semibold ${gradeColor(byCat.schriftlich.avg, colored)}`}>{gradeLabel(byCat.schriftlich.avg)}</span> : <span className="text-stone-300">—</span>
                  )}
                </td>
                <td className={`text-center${showZeugnis ? "" : " rounded-r-xl"}`}>
                  {overall != null ? (
                    <span className="inline-flex flex-col items-center leading-none">
                      <span className={`text-base font-semibold tnum ${gradeColor(overall, colored)}`}>{gradeLabel(overall)}</span>
                      {tendency && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTendencyPopup({ name: s.name, tendency, overall }); }}
                          className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${isColor ? (tendency.direction === "besseren" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600") : "bg-stone-100 text-stone-500"}`}
                          title="Tendenz – antippen für Details"
                        >
                          {tendency.direction === "besseren" ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
                {showZeugnis && (
                  <td className="text-center rounded-r-xl">
                    {finalGrade ? (
                      <span className="inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-md bg-stone-900 text-white text-sm font-semibold tnum">{gradeLabel(finalGrade.value)}</span>
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={showZeugnis ? 5 : 4} className="text-sm text-stone-400 py-3 px-2">Keine Schüler:innen in dieser Klasse.</td></tr>
          )}
        </tbody>
      </table>

      {rows.some((r) => r.tendency) && (
        <p className="text-[10px] text-stone-400 mt-2 flex items-center gap-3 px-1">
          <span className="flex items-center gap-1"><TrendingUp size={9} className={isColor ? "text-emerald-600" : "text-stone-400"} /> Tendenz zur besseren Note</span>
          <span className="flex items-center gap-1"><TrendingDown size={9} className={isColor ? "text-red-500" : "text-stone-400"} /> Tendenz zur schlechteren Note</span>
        </p>
      )}

      {sportzeugDetail && (() => {
        const s = students.find((x) => x.id === sportzeugDetail);
        const eintraege = (data.incidents || [])
          .filter((i) => i.fachId === fach.id && i.studentId === sportzeugDetail && i.label === "Sportzeug")
          .sort((a, b) => b.date.localeCompare(a.date));
        function addFuer(datum) {
          update((d) => {
            d.incidents = d.incidents || [];
            d.incidents.push({ id: uid(), studentId: sportzeugDetail, fachId: fach.id, label: "Sportzeug", date: datum });
            return d;
          });
        }
        function entferne(id) {
          update((d) => { d.incidents = d.incidents.filter((i) => i.id !== id); return d; });
        }
        return (
          <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={() => setSportzeugDetail(null)}>
            <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10">
                <div className="min-w-0">
                  <div className="font-semibold text-stone-800 leading-tight truncate">Sportzeug vergessen</div>
                  <div className="text-xs text-stone-400 truncate">{s?.name}</div>
                </div>
                <button onClick={() => setSportzeugDetail(null)} className="w-11 h-11 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
              </div>
              <div className="p-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-stone-500">Insgesamt</span>
                  <span className="text-2xl font-semibold tnum text-amber-700">{eintraege.length}<span className="text-xs font-normal text-stone-400 ml-1">×</span></span>
                </div>

                {/* Neuen Vorfall für ein Datum erfassen */}
                <div className="flex gap-2 mb-4">
                  <input id="sz-date" type="date" defaultValue={isoDate(new Date())} className={inputCls} />
                  <Button onClick={() => { const el = document.getElementById("sz-date"); if (el?.value) addFuer(el.value); }} className="shrink-0"><Plus size={15} /> Erfassen</Button>
                </div>

                {eintraege.length ? (
                  <ul className="divide-y divide-stone-100">
                    {eintraege.map((i) => (
                      <li key={i.id} className="py-2.5 flex items-center gap-2 text-sm">
                        <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                        <span className="text-stone-700 tnum">{localDate(i.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                        {i.note && <span className="text-xs text-stone-400 truncate">· {i.note}</span>}
                        <button onClick={() => entferne(i.id)} className="ml-auto text-stone-300 hover:text-red-600 shrink-0 p-1" title="Eintrag löschen"><Trash2 size={14} /></button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-stone-400 text-center py-4">Noch nichts vergessen – super!</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {tendencyPopup && (
        <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={() => setTendencyPopup(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-stone-800 flex items-center gap-2">
                {tendencyPopup.tendency.direction === "besseren" ? (
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center"><TrendingUp size={14} /></span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center"><TrendingDown size={14} /></span>
                )}
                Tendenz bei {tendencyPopup.name}
              </div>
              <button onClick={() => setTendencyPopup(null)} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
            </div>

            <p className="text-sm text-stone-700 leading-relaxed mb-3">
              Der rechnerische Stand ist eine <strong>{tendencyPopup.tendency.currentLabel}</strong> ({gradeWord(tendencyPopup.tendency.currentRounded)}),
              liegt aber <strong>{tendencyPopup.tendency.strength}</strong> an der Grenze zur{" "}
              {tendencyPopup.tendency.direction === "besseren" ? "besseren" : "schlechteren"} Note (<strong>{tendencyPopup.tendency.potentialLabel}</strong>).
              {tendencyPopup.tendency.direction === "besseren"
                ? " Die nächsten guten Leistungen können den Ausschlag zur besseren Note geben."
                : " Bei schwächeren Leistungen droht das Abrutschen zur schlechteren Note."}
            </p>

            <p className="text-xs text-stone-400 leading-relaxed">
              Der Pfeil erscheint, sobald der Schnitt weniger als 0,3 Notenpunkte von einer Notengrenze (z. B. 2,5) entfernt ist.
              Grün: bessere Note in Reichweite. Rot: schlechtere Note droht.
            </p>
          </div>
        </div>
      )}
    </Card>
    </div>
  );
}

function NotenTab({ data, update, halbjahr, initialFachId, onConsumeInitial }) {
  const isColor = data.settings?.colorMode === true;
  const colored = isColor && data.settings?.notenfarben !== false;
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedFach, setSelectedFach] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Vorauswahl aus einem anderen Bereich übernehmen (z. B. Tipp auf ein Fach in der Klassenkarte)
  useEffect(() => {
    if (initialFachId) {
      const f = data.faecher.find((x) => x.id === initialFachId);
      if (f) { setSelectedClass(f.classId); setSelectedFach(f.id); setSelectedStudent(null); }
      onConsumeInitial?.();
    }
  }, [initialFachId]);
  const [category, setCategory] = useState("muendlich");
  const [value, setValue] = useState(2);
  const [gradeTitle, setGradeTitle] = useState("");
  const [gradeTopic, setGradeTopic] = useState("");
  const [gdate, setGdate] = useState(isoDate(new Date()));
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSprechtag, setShowSprechtag] = useState(false);
  const [sprechtagNotiz, setSprechtagNotiz] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmCopySprechtag, setConfirmCopySprechtag] = useState(false);
  const [printMode, setPrintMode] = useState(null); // { type: "class" } | { type: "student", studentId }
  const [showIncidents, setShowIncidents] = useState(false);
  const [showGradesList, setShowGradesList] = useState(false);
  const [editingGrade, setEditingGrade] = useState(null);
  const [gesprNDraft, setGesprNDraft] = useState({ text: "", mood: "ok", typ: "schueler" });
  const [showSprechtagPicker, setShowSprechtagPicker] = useState(false);
  const [openTopic, setOpenTopic] = useState(null); // aufgeklapptes Wissensgebiet (Kind-Aufschlüsselung)

  const fach = data.faecher.find((f) => f.id === selectedFach);
  const cls = fach ? data.classes.find((c) => c.id === fach.classId) : null;
  const students = data.students.filter((s) => s.classId === fach?.classId).sort((a, b) => a.name.localeCompare(b.name, "de"));
  const student = data.students.find((s) => s.id === selectedStudent);
  const weights = fach?.weights || DEFAULT_WEIGHTS;
  const studentGrades = data.grades.filter((g) => g.studentId === selectedStudent && g.fachId === selectedFach && g.halbjahr === halbjahr);
  const { overall, byCat } = calcOverall(studentGrades, weights);
  const tendency = tendencyInfo(overall);
  const studentNotes = data.notes.filter((n) => n.studentId === selectedStudent && n.type !== "gespraech").sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const studentGespraeche = data.notes.filter((n) => n.studentId === selectedStudent && n.type === "gespraech").sort((a, b) => b.date.localeCompare(a.date));
  const studentAbsences = (data.absences || []).filter((a) => a.studentId === selectedStudent).sort((a, b) => b.date.localeCompare(a.date));
  const finalGrade = (data.finalGrades || []).find((f) => f.studentId === selectedStudent && f.fachId === selectedFach && f.halbjahr === halbjahr);

  function setFinalGrade(value) {
    update((d) => {
      d.finalGrades = (d.finalGrades || []).filter((f) => !(f.studentId === selectedStudent && f.fachId === selectedFach && f.halbjahr === halbjahr));
      if (value != null) d.finalGrades.push({ id: uid(), studentId: selectedStudent, fachId: selectedFach, halbjahr, value });
      return d;
    });
  }

  function saveGesprNote() {
    if (!selectedStudent || !gesprNDraft.text.trim()) return;
    update((d) => {
      d.notes = d.notes || [];
      d.notes.push({ id: uid(), studentId: selectedStudent, type: "gespraech", text: gesprNDraft.text.trim(), mood: gesprNDraft.mood, gesprTyp: gesprNDraft.typ, date: isoDate(new Date()) });
      return d;
    });
    setGesprNDraft({ text: "", mood: "ok", typ: "schueler" });
  }

  const sprechtagText = useMemo(() => {
    if (!student) return "";
    const lines = [];
    lines.push(`Gesprächsnotiz zu ${student.name} (${cls?.name}, ${fach?.subject}, ${halbjahr}. Halbjahr)`);
    lines.push("");
    if (overall != null) {
      lines.push(`Rechnerischer Notendurchschnitt: ${gradeLabel(overall)} (${gradeWord(overall)}).`);
      if (tendency) {
        lines.push(`Hinweis: Die Note liegt ${tendency.strength} an der Grenze zwischen ${Math.min(tendency.currentRounded, tendency.potential)} und ${Math.max(tendency.currentRounded, tendency.potential)} – Tendenz Richtung ${tendency.direction === "besseren" ? "bessere" : "schwächere"} Note möglich.`);
      }
      lines.push("");
      CATS.forEach((c) => {
        const b = byCat[c.key];
        lines.push(`${c.label}: ${b ? `${gradeLabel(b.avg)} aus ${b.count} Note${b.count === 1 ? "" : "n"}` : "keine Noten erfasst"}`);
      });
      const autoGrades = studentGrades.filter((g) => g.auto || g.reason);
      if (autoGrades.length) {
        const byReason = {};
        autoGrades.forEach((g) => { byReason[g.reason] = (byReason[g.reason] || 0) + 1; });
        lines.push("");
        lines.push("Wichtig für das Gespräch – enthalten, aber nicht Ausdruck der fachlichen Mitarbeit:");
        Object.entries(byReason).forEach(([reason, count]) => {
          lines.push(`– ${count}x Note ${GRADE_OPTIONS.find((o) => o.value === autoGrades.find((g) => g.reason === reason).value)?.label} wegen vergessenem "${reason}"`);
        });
        const incidentNotes = data.incidents.filter((i) => i.studentId === selectedStudent && i.fachId === selectedFach && i.note);
        incidentNotes.forEach((i) => {
          lines.push(`  · ${localDate(i.date).toLocaleDateString("de-DE")}: ${i.note}`);
        });
      }
      // Vergessen-Vorfälle ohne automatische Note zusätzlich zählen (z. B. Sportzeug-Klicks)
      const alleVorfaelle = data.incidents.filter((i) => i.studentId === selectedStudent && i.fachId === selectedFach);
      const ausNoten = studentGrades.filter((g) => g.auto || g.reason).length;
      if (alleVorfaelle.length > ausNoten) {
        const byLabel = {};
        alleVorfaelle.forEach((i) => { byLabel[i.label] = (byLabel[i.label] || 0) + 1; });
        if (!autoGrades.length) {
          lines.push("");
          lines.push("Wichtig für das Gespräch – vergessenes Material:");
        }
        Object.entries(byLabel).forEach(([label, count]) => {
          lines.push(`– ${count}× ${label} vergessen`);
        });
      }
    } else {
      lines.push("In diesem Halbjahr liegen noch keine Noten vor.");
    }
    if (studentNotes.length) {
      lines.push("");
      lines.push("Zuletzt notierte Beobachtungen:");
      studentNotes.forEach((n) => lines.push(`– ${n.text} (${localDate(n.date).toLocaleDateString("de-DE")})`));
    }
    if (studentGespraeche.length) {
      lines.push("");
      lines.push("Kindgespräche (was das Kind bewegt):");
      const moodLabel = { sehr_gut: "😄", gut: "😊", ok: "😐", nicht_so_gut: "😕", schlecht: "😟" };
      studentGespraeche.slice(0, 5).forEach((g) => {
        const icon = moodLabel[g.mood] ?? "💬";
        lines.push(`${icon} ${localDate(g.date).toLocaleDateString("de-DE")}: ${g.text}`);
      });
    }
    if (studentAbsences.length) {
      const unentsch = studentAbsences.filter((a) => a.excuseStatus === "unentschuldigt");
      const ausstehend = studentAbsences.filter((a) => a.excuseStatus === "ausstehend");
      lines.push("");
      lines.push(`Fehlzeiten gesamt: ${studentAbsences.length} Einträge`);
      if (unentsch.length) lines.push(`– Unentschuldigt: ${unentsch.length}×`);
      if (ausstehend.length) lines.push(`– Entschuldigung noch ausstehend: ${ausstehend.length}×`);
    }
    if (sprechtagNotiz.trim()) {
      lines.push("");
      lines.push("Eigene Notizen fürs Gespräch:");
      lines.push(sprechtagNotiz.trim());
    }
    lines.push("");
    lines.push("Diese Angaben sind eine rechnerische Grundlage und ersetzen nicht die pädagogische Gesamteinschätzung.");
    return lines.join("\n");
  }, [student, cls, fach, halbjahr, overall, byCat, tendency, studentGrades, studentNotes, studentGespraeche, studentAbsences, sprechtagNotiz]);

  function copySprechtag() {
    navigator.clipboard?.writeText(sprechtagText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function addGrade() {
    if (!selectedStudent || !fach) return;
    const topic = category === "schriftlich" ? gradeTopic.trim() || null : null;
    update((d) => {
      d.grades.push({ id: uid(), studentId: selectedStudent, classId: fach.classId, fachId: fach.id, category, value, factor: 1, title: gradeTitle.trim(), date: gdate, halbjahr, ...(topic ? { topic } : {}) });
      return d;
    });
    setGradeTitle("");
    if (category !== "schriftlich") setGradeTopic("");
  }

  function removeGrade(id) {
    update((d) => { d.grades = d.grades.filter((g) => g.id !== id); return d; });
  }

  function addGradeForStudent() {
    const id = uid();
    update((d) => {
      d.grades.push({
        id, studentId: selectedStudent, classId: fach.classId, fachId: fach.id,
        category: "muendlich", value: 2, factor: 1, title: "", date: isoDate(new Date()), halbjahr,
      });
      return d;
    });
    setEditingGrade(id);
    setShowGradesList(true);
  }

  function updateGrade(id, changes) {
    update((d) => {
      const g = d.grades.find((g) => g.id === id);
      if (g) Object.assign(g, changes);
      return d;
    });
  }

  function saveBulk({ title, category, date, factor, entries, topic }) {
    update((d) => {
      entries.forEach(({ studentId, value }) => {
        d.grades.push({ id: uid(), studentId, classId: fach.classId, fachId: fach.id, category, value, factor, title, date, halbjahr, ...(topic ? { topic } : {}) });
      });
      return d;
    });
    setShowBulkModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Vorschlagsliste für Themen – einmal je Fach, von allen Eingabefeldern genutzt */}
      {fach && (
        <datalist id="saidy-themen-noten">
          {bekannteThemen(data.grades, fach.id).map((t) => <option key={t} value={t} />)}
        </datalist>
      )}
      {/* Deutlicher Zurück-Weg, eine Ebene nach oben */}
      {(selectedClass || fach || selectedStudent) && (
        <button
          onClick={() => {
            if (selectedStudent) setSelectedStudent(null);
            else if (fach) { setSelectedFach(null); setSelectedStudent(null); }
            else if (selectedClass) { setSelectedClass(null); setSelectedFach(null); setSelectedStudent(null); }
          }}
          className="inline-flex items-center gap-1.5 text-sm akzent-text -mb-2"
        >
          <ChevronLeft size={16} /> Zurück
        </button>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-2xl font-semibold tracking-tight">Noten</h1>
        {(selectedClass || fach) && (
          <div className="flex items-center gap-1 text-sm text-stone-500">
            <button onClick={() => { setSelectedClass(null); setSelectedFach(null); setSelectedStudent(null); }} className="hover:akzent-text underline decoration-stone-300 underline-offset-2">
              Klassen
            </button>
            {selectedClass && (
              <>
                <ChevronRight size={13} className="text-stone-300" />
                <button onClick={() => { setSelectedFach(null); setSelectedStudent(null); }} className={fach ? "hover:akzent-text underline decoration-stone-300 underline-offset-2" : "text-stone-800 font-medium"}>
                  {data.classes.find((c) => c.id === selectedClass)?.name}
                </button>
              </>
            )}
            {fach && (
              <>
                <ChevronRight size={13} className="text-stone-300" />
                <span className="text-stone-800 font-medium inline-flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isColor ? fach.color : "var(--linie)" }} />
                  {fach.subject}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!data.classes.length && <p className="text-sm text-stone-400">Lege zunächst eine Klasse mit Fächern an.</p>}

      {/* Schritt 1: Klasse wählen */}
      {!selectedClass && !!data.classes.length && (
        <div className="space-y-3">
          {data.classes.map((c) => {
            const cFaecher = data.faecher.filter((f) => f.classId === c.id);
            const cStudents = data.students.filter((s) => s.classId === c.id);
            const zeugnisSoll = cStudents.length * cFaecher.length;
            const zeugnisIst = (data.finalGrades || []).filter(
              (f) => f.halbjahr === halbjahr && cFaecher.some((fa) => fa.id === f.fachId)
            ).length;
            const offen = Math.max(0, zeugnisSoll - zeugnisIst);
            const zeugnisphase = [1, 2, 6, 7].includes(new Date().getMonth() + 1);
            return (
              <button
                key={c.id}
                onClick={() => setSelectedClass(c.id)}
                className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-4 text-left hover:akzent-rand transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-xl akzent-ton font-bold flex items-center justify-center shrink-0">
                    {c.name}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-stone-500">{cStudents.length} Schüler:innen</div>
                  </div>
                  <ChevronRight size={18} className="text-stone-300 shrink-0" />
                </div>

                {/* Zeugnis-Fortschritt: in der Zeugnisphase über mehrere Klassen hinweg
                    in einer halben Sekunde vergleichbar – als Zahlenreihe nicht. */}
                {zeugnisphase && !!zeugnisSoll && (
                  <div className="mb-3">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs text-stone-500">Zeugnisnoten</span>
                      <span className="text-xs text-stone-600 tabular-nums">
                        {zeugnisIst} von {zeugnisSoll}
                        {offen > 0 && <span className="text-stone-400"> · {offen} offen</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-[width] duration-500 ${offen === 0 ? "bg-[var(--s-gut)]" : "akzent-flaeche"}`}
                        style={{ width: `${Math.round((zeugnisIst / zeugnisSoll) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {cFaecher.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-stone-50 text-stone-600"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: isColor ? f.color : "var(--linie)" }} />
                      {f.subject}
                    </span>
                  ))}
                  {!cFaecher.length && <span className="text-xs text-stone-300">Noch keine Fächer angelegt</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Schritt 2: Fach wählen */}
      {selectedClass && !fach && (
        <div className="space-y-3">
          {data.faecher.filter((f) => f.classId === selectedClass).map((f) => {
            const fStudents = data.students.filter((s) => s.classId === selectedClass);
            const fGrades = data.grades.filter((g) => g.fachId === f.id && g.halbjahr === halbjahr);
            const schnitte = fStudents
              .map((s) => calcOverall(fGrades.filter((g) => g.studentId === s.id), f.weights || DEFAULT_WEIGHTS).overall)
              .filter((v) => v != null);
            const klassenschnitt = schnitte.length ? schnitte.reduce((a, b) => a + b, 0) / schnitte.length : null;
            return (
              <button
                key={f.id}
                onClick={() => { setSelectedFach(f.id); setSelectedStudent(null); }}
                className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-4 text-left hover:akzent-rand transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-2.5 h-11 rounded-full shrink-0" style={{ backgroundColor: isColor ? f.color : "var(--oliv)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-stone-800">{f.subject}</div>
                    <div className="text-xs text-stone-400">
                      {f.room ? `${f.room} · ` : ""}
                      Mündlich {f.weights?.muendlich ?? 50} % · Schriftlich {f.weights?.schriftlich ?? 50} %
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">{fGrades.length} Noten im {halbjahr}. Halbjahr</div>
                  </div>
                  <div className="text-right shrink-0">
                    {klassenschnitt != null ? (
                      <>
                        <div className={`text-xl font-bold ${gradeColor(klassenschnitt, colored)}`}>{gradeLabel(klassenschnitt)}</div>
                        <div className="text-[10px] text-stone-400">Schnitt</div>
                      </>
                    ) : (
                      <span className="text-stone-300 text-sm">—</span>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-stone-300 shrink-0" />
                </div>
              </button>
            );
          })}
          {!data.faecher.filter((f) => f.classId === selectedClass).length && (
            <p className="text-sm text-stone-400">Für diese Klasse sind noch keine Fächer angelegt.</p>
          )}
        </div>
      )}

      {/* Schritt 3: Übersicht und Details */}
      {!!data.faecher.length && fach && (
        <div className="space-y-4">
          <NotenUebersicht
            students={students}
            data={data}
            update={update}
            fach={fach}
            halbjahr={halbjahr}
            selectedStudent={selectedStudent}
            onSelect={setSelectedStudent}
          />

          {!!students.length && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="subtle" onClick={() => setShowBulkModal(true)}>Sammelbewertung</Button>
              <Button variant="subtle" onClick={() => setShowIncidents(true)}><AlertTriangle size={15} /> Material vergessen</Button>
              <Button variant="subtle" onClick={() => setShowSprechtagPicker(true)}>💬 Elternsprechtag</Button>
              <Button variant="subtle" onClick={() => setPrintMode({ type: "class" })}><Printer size={15} /> PDF</Button>
            </div>
          )}

          {/* Wissensgebiete: schriftliche Noten nach Thema gruppiert.
              Ein Tipp auf ein Thema zeigt, welche Kinder dort Lücken haben – aus einer
              Statistik wird so eine Fördergruppe. */}
          {(() => {
            const schriftlich = data.grades.filter((g) => g.fachId === fach.id && g.halbjahr === halbjahr && g.category === "schriftlich");
            if (!schriftlich.length) return null;
            const getaggt = schriftlich.filter((g) => typeof g.topic === "string" && g.topic.trim());
            const kopf = (
              <div className="flex items-center gap-1.5 mb-2.5">
                <BarChart2 size={14} className="text-stone-400" />
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">Wissensgebiete</span>
              </div>
            );
            // Henne-Ei: ohne getaggte Note wüsste niemand, dass es die Auswertung gibt
            if (!getaggt.length) {
              return (
                <Card className="px-4 py-3">
                  {kopf}
                  <p className="text-sm text-stone-500 leading-relaxed">
                    Vergib beim Eintragen schriftlicher Noten ein Thema (z. B. „Bruchrechnung") –
                    dann siehst du hier, wo die Klasse Lücken hat.
                  </p>
                </Card>
              );
            }
            /* Object.create(null): ein Thema wie „constructor" oder „__proto__" würde bei einem
               normalen Objekt die geerbte Property treffen und die App zum Absturz bringen.
               Kleinschreibung als Schlüssel, damit „Bruchrechnung" und „bruchrechnung" zusammenfallen. */
            const byTopic = Object.create(null);
            getaggt.forEach((g) => {
              const key = g.topic.trim().toLowerCase();
              if (!byTopic[key]) byTopic[key] = { label: g.topic.trim(), eintraege: [] };
              byTopic[key].eintraege.push(g);
            });
            const topics = Object.keys(byTopic)
              .map((key) => {
                const { label, eintraege } = byTopic[key];
                return { key, label, eintraege, avg: eintraege.reduce((a, g) => a + g.value, 0) / eintraege.length, count: eintraege.length };
              })
              .sort((a, b) => b.avg - a.avg); // schwächstes Thema zuerst
            return (
              <Card className="px-4 py-3">
                {kopf}
                <ul className="space-y-2.5">
                  {topics.map(({ key, label, avg, count, eintraege }) => {
                    // Balkenlänge = Kompetenz: lang bedeutet überall in der App „gut"
                    const pct = Math.max(4, Math.round(((6 - avg) / 5) * 100));
                    const offen = openTopic === key;
                    // Aufschlüsselung: welches Kind steht in diesem Thema wie da
                    const proKind = offen
                      ? students
                          .map((s) => {
                            const eigene = eintraege.filter((g) => g.studentId === s.id);
                            if (!eigene.length) return null;
                            return { student: s, avg: eigene.reduce((a, g) => a + g.value, 0) / eigene.length, anzahl: eigene.length };
                          })
                          .filter(Boolean)
                          .sort((a, b) => b.avg - a.avg)
                      : [];
                    return (
                      <li key={key}>
                        <button
                          onClick={() => setOpenTopic(offen ? null : key)}
                          className="w-full text-left min-h-[44px] py-1"
                          aria-expanded={offen}
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="flex-1 text-sm text-stone-700 min-w-0 break-words">{label}</span>
                            <span className={`text-sm font-bold tabular-nums shrink-0 ${gradeColor(avg, colored)}`}>{gradeLabel(avg)}</span>
                            <ChevronDown size={13} className={`text-stone-400 shrink-0 transition-transform ${offen ? "rotate-180" : ""}`} />
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full akzent-flaeche" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-[11px] text-stone-500 shrink-0 tabular-nums">{count} Note{count !== 1 ? "n" : ""}</span>
                          </div>
                        </button>
                        {offen && (
                          <ul className="mt-1.5 mb-1 pl-3 border-l-2 border-stone-100 space-y-1">
                            {proKind.map(({ student: s, avg: sAvg, anzahl }) => (
                              <li key={s.id}>
                                <button
                                  onClick={() => setSelectedStudent(s.id)}
                                  className="w-full flex items-center gap-2 text-sm min-h-[44px] text-left"
                                >
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${sAvg <= 2 ? "bg-emerald-400" : sAvg <= 3.4 ? "bg-amber-400" : "bg-red-400"}`} />
                                  <span className="flex-1 text-stone-700 truncate">{s.name}</span>
                                  {anzahl > 1 && <span className="text-[11px] text-stone-400 shrink-0">{anzahl}×</span>}
                                  <span className={`text-xs font-semibold tabular-nums shrink-0 ${gradeColor(sAvg, colored)}`}>{gradeLabel(sAvg)}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="text-[11px] text-stone-500 mt-2.5">
                  Ø aller Kinder · dieses Halbjahr · langer Balken = sicher beherrscht. Thema antippen zeigt die einzelnen Kinder.
                </p>
              </Card>
            );
          })()}

          {showSprechtagPicker && (
            <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={() => setShowSprechtagPicker(false)}>
              <div className="bg-white w-full md:max-w-sm rounded-t-3xl md:rounded-2xl shadow-xl sheet overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between">
                  <div className="font-semibold text-stone-800">Elternsprechtag – Kind wählen</div>
                  <button onClick={() => setShowSprechtagPicker(false)} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center"><X size={16} /></button>
                </div>
                <ul className="divide-y divide-stone-100 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {students.map((s) => (
                    <li key={s.id}>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 active:bg-stone-100 text-left"
                        onClick={() => { setSelectedStudent(s.id); setShowSprechtag(true); setShowSprechtagPicker(false); }}
                      >
                        <StudentAvatar student={s} size={32} />
                        <span className="text-sm font-medium text-stone-800">{s.name}</span>
                        <ChevronRight size={16} className="text-stone-300 ml-auto shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {showIncidents && (
            <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={() => setShowIncidents(false)}>
              <div className="w-full max-w-lg overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end mb-2">
                  <button onClick={() => setShowIncidents(false)} className="bg-white rounded-full p-1.5 text-stone-400 hover:text-stone-600 shadow"><X size={16} /></button>
                </div>
                <IncidentsOverview data={data} update={update} fach={fach} cls={cls} students={students} halbjahr={halbjahr} />
              </div>
            </div>
          )}

          {!student && <Card className="p-5 text-sm text-stone-400">Tippe in der Übersicht auf ein Kind, um Noten, Verlauf und Zeugnisnote zu sehen.</Card>}
          {student && (
              <div className="fixed inset-0 bg-stone-900/40 z-[55] flex items-end md:items-center md:justify-center" onClick={() => setSelectedStudent(null)}>
                <div className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-y-auto sheet " onClick={(e) => e.stopPropagation()}>
                  <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center gap-2.5 z-10 shadow-[0_4px_10px_-6px_rgba(0,0,0,0.15)]">
                    <StudentAvatar student={student} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800 leading-tight truncate">{student.name}</div>
                      <div className="text-xs text-stone-400">{cls?.name} · {fach.subject} · {halbjahr}. Halbjahr</div>
                    </div>
                    <button onClick={() => setSelectedStudent(null)} className="w-11 h-11 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
                  </div>

                  <div className="p-4 pt-3 space-y-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-stone-800">Neue Note</div>
                    <Button variant="subtle" onClick={() => setShowGradesList(true)}>Einzelnoten ({studentGrades.length})</Button>
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select className={`${inputCls} flex-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
                        {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <select className="rounded-lg border border-stone-300 px-2 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 w-20 shrink-0" value={value} onChange={(e) => setValue(Number(e.target.value))}>
                        {GRADE_OPTIONS.map((g) => <option key={g.label} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                    <input className={inputCls} placeholder="Bezeichnung, z. B. Stundenbeteiligung" value={gradeTitle} onChange={(e) => setGradeTitle(e.target.value)} maxLength={200} />
                    {category === "schriftlich" && (
                      <input className={inputCls} list="saidy-themen-noten" placeholder="Thema (optional), z. B. Bruchrechnung" value={gradeTopic} onChange={(e) => setGradeTopic(e.target.value)} maxLength={100} />
                    )}
                    <div className="flex gap-2">
                      <input className={`${inputCls} flex-1`} type="date" value={gdate} onChange={(e) => setGdate(e.target.value)} />
                      <Button onClick={addGrade} className="justify-center shrink-0"><Plus size={15} /></Button>
                    </div>
                  </div>
                </Card>

                {/* Gespräch / Stimmung direkt erfassen */}
                <Card className="p-4">
                  <div className="font-medium text-stone-800 text-sm mb-3">Gespräch &amp; Stimmung</div>
                  <div className="flex gap-1.5 mb-2 flex-wrap">
                    {GESPRAECH_TYPEN.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setGesprNDraft((d) => ({ ...d, typ: t.key }))}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${gesprNDraft.typ === t.key ? "akzent-ton akzent-rand" : "border-stone-200 text-stone-500 bg-white"}`}
                      >{t.label}</button>
                    ))}
                  </div>
                  <div className="flex gap-1 mb-2">
                    {MOOD_OPTIONS.map((m) => (
                      <button
                        key={m.key}
                        onClick={() => setGesprNDraft((d) => ({ ...d, mood: m.key }))}
                        title={m.label}
                        className={`flex-1 text-lg py-1 rounded-xl transition-colors ${gesprNDraft.mood === m.key ? "bg-[#ECEEE2] ring-1 ring-[var(--oliv)]" : "bg-stone-50 hover:bg-stone-100"}`}
                      >{m.emoji}</button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={`${inputCls} flex-1`}
                      placeholder="Notiz zum Gespräch …"
                      value={gesprNDraft.text}
                      onChange={(e) => setGesprNDraft((d) => ({ ...d, text: e.target.value }))}
                      maxLength={500}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveGesprNote(); } }}
                    />
                    <Button onClick={saveGesprNote} className="shrink-0 justify-center" disabled={!gesprNDraft.text.trim()}>
                      <Plus size={15} />
                    </Button>
                  </div>
                  {studentGespraeche.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {studentGespraeche.slice(0, 3).map((g) => {
                        const mood = MOOD_OPTIONS.find((m) => m.key === g.mood);
                        const typ = GESPRAECH_TYPEN.find((t) => t.key === g.gesprTyp);
                        return (
                          <li key={g.id} className="flex items-start gap-2 bg-stone-50 rounded-xl px-3 py-2 text-sm">
                            <span className="text-base shrink-0 leading-snug">{mood?.emoji ?? "💬"}</span>
                            <div className="flex-1 min-w-0">
                              {typ && <span className="text-[10px] font-medium akzent-text bg-[#ECEEE2] px-1.5 py-0.5 rounded mr-1">{typ.label}</span>}
                              <span className="text-stone-700">{g.text}</span>
                            </div>
                            <span className="text-stone-400 text-xs whitespace-nowrap shrink-0">{localDate(g.date).toLocaleDateString("de-DE")}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                <Card className="p-5">
                  <div className="flex gap-1.5 mb-4">
                    <Button variant="subtle" onClick={() => setShowSprechtag(true)}>Elternsprechtag</Button>
                    <Button variant="subtle" onClick={() => setPrintMode({ type: "student", studentId: student.id })}><Printer size={15} /> PDF</Button>
                  </div>

                  {overall != null ? (
                    <div className="mb-4">
                      <div className="flex items-end gap-2 mb-2">
                        <span className={`text-4xl font-semibold tracking-tight tnum ${gradeColor(overall, colored)}`}>{gradeLabel(overall)}</span>
                        <span className="text-sm text-stone-400 mb-1">{gradeWord(overall)}</span>
                      </div>

                      {/* Zusammensetzung: woraus ergibt sich die Note? Kategorien mit 0 % werden ausgeblendet. */}
                      <div className="flex items-center gap-1.5 flex-wrap text-sm mb-3">
                        {weights.muendlich > 0 && (
                          <span className="bg-stone-100 rounded-lg px-2.5 py-1 whitespace-nowrap">
                            <span className="text-stone-400 text-xs">Mündl. {weights.muendlich} %</span>{" "}
                            <span className={`font-semibold ${byCat.muendlich ? gradeColor(byCat.muendlich.avg, colored) : "text-stone-300"}`}>
                              {byCat.muendlich ? gradeLabel(byCat.muendlich.avg) : "—"}
                            </span>
                            {byCat.muendlich && <span className="text-stone-400 text-xs"> ({byCat.muendlich.count})</span>}
                          </span>
                        )}
                        {weights.muendlich > 0 && weights.schriftlich > 0 && <span className="text-stone-300">+</span>}
                        {weights.schriftlich > 0 && (
                          <span className="bg-stone-100 rounded-lg px-2.5 py-1 whitespace-nowrap">
                            <span className="text-stone-400 text-xs">Schr. {weights.schriftlich} %</span>{" "}
                            <span className={`font-semibold ${byCat.schriftlich ? gradeColor(byCat.schriftlich.avg, colored) : "text-stone-300"}`}>
                              {byCat.schriftlich ? gradeLabel(byCat.schriftlich.avg) : "—"}
                            </span>
                            {byCat.schriftlich && <span className="text-stone-400 text-xs"> ({byCat.schriftlich.count})</span>}
                          </span>
                        )}
                        <span className="text-stone-300">=</span>
                        <span className={`font-semibold ${gradeColor(overall, colored)}`}>{gradeLabel(overall)}</span>
                      </div>

                      <TendencyMeter value={overall} colored={colored} />
                      {tendency && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                          <AlertCircle size={15} className="shrink-0 mt-0.5" />
                          <span>
                            Aktuell rechnerisch eine {tendency.currentLabel} ({gradeWord(tendency.currentRounded)}), aber {tendency.strength} an
                            der Grenze zur {tendency.direction} Note ({tendency.potentialLabel}).
                          </span>
                        </div>
                      )}
                      {(() => {
                        const autoCount = studentGrades.filter((g) => g.auto).length;
                        return autoCount > 0 ? (
                          <div className="mt-2 text-xs text-amber-700 flex items-center gap-1">
                            <AlertTriangle size={11} /> davon {autoCount}x Note wegen Vergessen
                          </div>
                        ) : null;
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400 mb-4">Noch keine Noten in diesem Halbjahr erfasst.</p>
                  )}

                  {/* Zeugnisnote: darf vom rechnerischen Wert abweichen */}
                  <div className="border-t border-stone-100 pt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-stone-700">Zeugnisnote ({halbjahr}. Halbjahr)</span>
                    <select
                      className="text-sm rounded-lg border border-stone-300 px-2 py-1.5 w-20"
                      value={finalGrade?.value ?? ""}
                      onChange={(e) => setFinalGrade(e.target.value === "" ? null : Number(e.target.value))}
                    >
                      <option value="">—</option>
                      {GRADE_OPTIONS.map((g) => <option key={g.label} value={g.value}>{g.label}</option>)}
                    </select>
                    {overall != null && !finalGrade && (
                      <button
                        onClick={() => setFinalGrade(nearestGrade(overall).value)}
                        className="text-xs akzent-text hover:underline"
                      >
                        Vorschlag übernehmen ({gradeLabel(overall)})
                      </button>
                    )}
                    {finalGrade && overall != null && finalGrade.value !== nearestGrade(overall).value && (
                      <span className="text-xs text-amber-700 flex items-center gap-1">
                        <AlertCircle size={12} /> weicht vom rechnerischen Stand ({gradeLabel(overall)}) ab
                      </span>
                    )}
                  </div>
                </Card>

                {/* Verlauf: wie sich die Note über die Stunden entwickelt hat */}
                {!!studentGrades.length && (
                  <Card className="p-5">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-stone-800">Verlauf</div>
                      <Button variant="subtle" onClick={addGradeForStudent}><Plus size={15} /> Note</Button>
                    </div>
                    <p className="text-xs text-stone-400 mb-4">Jede Bewertung mit dem Notenstand, der sich bis zu diesem Tag ergeben hat. Zum Ändern einfach antippen.</p>
                    <ol className="space-y-0">
                      {(() => {
                        const sorted = [...studentGrades].sort((a, b) => a.date.localeCompare(b.date));
                        return sorted.map((g, i) => {
                          const runningOverall = calcOverall(sorted.slice(0, i + 1), weights).overall;
                          const prevOverall = i === 0 ? null : calcOverall(sorted.slice(0, i), weights).overall;
                          const better = prevOverall != null && runningOverall != null && runningOverall < prevOverall - 0.001;
                          const worse = prevOverall != null && runningOverall != null && runningOverall > prevOverall + 0.001;
                          return (
                            <li key={g.id} className="flex gap-3">
                              {/* Zeitstrahl */}
                              <div className="flex flex-col items-center shrink-0">
                                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${g.auto ? "bg-amber-400" : g.category === "schriftlich" ? "bg-stone-700" : "akzent-ton"}`} />
                                {i < sorted.length - 1 && <span className="w-px flex-1 bg-stone-200 my-1" />}
                              </div>
                              <button
                                type="button"
                                onClick={() => { setEditingGrade(g.auto ? null : g.id); setShowGradesList(true); }}
                                className="flex-1 pb-4 min-w-0 text-left rounded-lg -mx-1.5 px-1.5 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                                title={g.auto ? "Automatische Note – nur löschbar" : "Antippen zum Bearbeiten"}
                              >
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold ${g.auto ? "text-amber-700" : gradeColor(g.value, colored)}`}>
                                    {GRADE_OPTIONS.find((o) => o.value === g.value)?.label}
                                  </span>
                                  <span className="text-xs text-stone-400">
                                    {CATS.find((c) => c.key === g.category)?.label}
                                    {g.factor && g.factor !== 1 ? ` · x${g.factor}` : ""}
                                  </span>
                                  <span className="text-xs text-stone-400 ml-auto flex items-center gap-1">
                                    {localDate(g.date).toLocaleDateString("de-DE")}
                                    <Settings2 size={12} className="text-stone-300" />
                                  </span>
                                </div>
                                <div className="text-sm text-stone-600 truncate">
                                  {g.title || "—"}{g.auto ? " (automatisch)" : ""}
                                </div>
                                {runningOverall != null && (
                                  <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                                    Stand danach: <span className={`font-medium ${gradeColor(runningOverall, colored)}`}>{gradeLabel(runningOverall)}</span>
                                    {better && <TrendingUp size={11} className={isColor ? "text-emerald-600" : "text-stone-400"} />}
                                    {worse && <TrendingDown size={11} className={isColor ? "text-red-500" : "text-stone-400"} />}
                                  </div>
                                )}
                              </button>
                            </li>
                          );
                        });
                      })()}
                    </ol>
                  </Card>
                )}

                {showSprechtag && (
                  <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-[60]" onClick={() => setShowSprechtag(false)}>
                    <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
                      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10">
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-800 leading-tight">Elternsprechtag</div>
                          <div className="text-xs text-stone-400 truncate">{student.name} · {fach.subject}</div>
                        </div>
                        <button onClick={() => setShowSprechtag(false)} className="w-11 h-11 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
                      </div>
                      <div className="p-4 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-4">
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1.5">Eigene Notizen fürs Gespräch</div>
                          <textarea
                            className={inputCls + " min-h-[80px] resize-none"}
                            placeholder="z. B. Gesprächsthemen, Absprachen, Beobachtungen …"
                            maxLength={2000}
                            value={sprechtagNotiz}
                            onChange={(e) => setSprechtagNotiz(e.target.value)}
                          />
                        </div>
                        {studentAbsences.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-2">Fehlzeiten</div>
                            <div className="flex flex-wrap gap-2">
                              {Object.entries(
                                studentAbsences.reduce((acc, a) => { acc[a.excuseStatus] = (acc[a.excuseStatus] || 0) + 1; return acc; }, {})
                              ).map(([status, count]) => (
                                <span key={status} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100" style={{ color: isColor ? (EXCUSE_STATUS[status]?.color ?? "#555") : "#78716C" }}>
                                  {EXCUSE_STATUS[status]?.label ?? status}: {count}×
                                </span>
                              ))}
                            </div>
                            {studentAbsences.slice(0, 4).length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {studentAbsences.slice(0, 4).map((a) => (
                                  <li key={a.id} className="flex items-center gap-2 text-xs text-stone-600">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: isColor ? (EXCUSE_STATUS[a.excuseStatus]?.color ?? "#aaa") : "#A8A29E" }} />
                                    <span className="text-stone-400 shrink-0">{localDate(a.date).toLocaleDateString("de-DE")}</span>
                                    <span>{a.reason || "—"}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

                        {studentGespraeche.length > 0 && (
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-2">Kindgespräche</div>
                            <ul className="space-y-1.5">
                              {studentGespraeche.slice(0, 5).map((g) => {
                                const mood = MOOD_OPTIONS.find((m) => m.key === g.mood);
                                const typ = GESPRAECH_TYPEN.find((t) => t.key === g.gesprTyp);
                                return (
                                  <li key={g.id} className="flex items-start gap-2 bg-stone-50 rounded-xl px-3 py-2 text-sm">
                                    <span className="text-base shrink-0 leading-snug">{mood?.emoji ?? "💬"}</span>
                                    <div className="flex-1 min-w-0">
                                      {typ && <span className="text-[10px] font-medium akzent-text bg-[#ECEEE2] px-1.5 py-0.5 rounded mr-1">{typ.label}</span>}
                                      <span className="text-stone-700">{g.text}</span>
                                    </div>
                                    <span className="text-stone-400 text-xs whitespace-nowrap shrink-0">{localDate(g.date).toLocaleDateString("de-DE")}</span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )}
                        <div className="rounded-xl bg-stone-50 border border-stone-200 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs font-medium text-stone-500">Gesprächsgrundlage</div>
                            <Button variant="subtle" onClick={() => copied ? null : setConfirmCopySprechtag(true)}>
                              {copied ? <><CheckCircle2 size={15} /> Kopiert</> : <><Copy size={15} /> Kopieren</>}
                            </Button>
                          </div>
                          <pre className="whitespace-pre-wrap font-sans text-sm text-stone-700 leading-relaxed">{sprechtagText}</pre>
                        </div>
                      </div>
                    </div>

                    {confirmCopySprechtag && (
                      <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[70]" onClick={() => setConfirmCopySprechtag(false)}>
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-5" onClick={(e) => e.stopPropagation()}>
                          <div className="font-semibold text-stone-800 mb-2">Text kopieren</div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-3">
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              <strong>Datenschutzhinweis:</strong> Dieser Text enthält personenbezogene Schülerdaten. Nur über sichere, schulisch genehmigte Kanäle weitergeben – keine privaten Messenger oder Cloud-Dienste.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setConfirmCopySprechtag(false)} className="flex-1 justify-center">Abbrechen</Button>
                            <Button onClick={() => { setConfirmCopySprechtag(false); copySprechtag(); }} className="flex-1 justify-center">Verstanden, kopieren</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {showGradesList && (
                  <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-[60]" onClick={() => { setShowGradesList(false); setEditingGrade(null); }}>
                    <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
                      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10">
                        <div className="font-semibold text-stone-800">Einzelnoten – {student.name}</div>
                        <button onClick={() => { setShowGradesList(false); setEditingGrade(null); }} className="w-11 h-11 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
                      </div>
                      <div className="p-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
                      <ul className="divide-y divide-stone-100">
                        {[...studentGrades].sort((a, b) => b.date.localeCompare(a.date)).map((g) => (
                          editingGrade === g.id ? (
                            <li key={g.id} className="py-3 space-y-2">
                              <div className="flex gap-2">
                                <select className={inputCls} value={g.category} onChange={(e) => updateGrade(g.id, { category: e.target.value })}>
                                  {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                                </select>
                                <select className={inputCls} value={g.value} onChange={(e) => updateGrade(g.id, { value: Number(e.target.value) })}>
                                  {GRADE_OPTIONS.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}
                                </select>
                              </div>
                              <input className={inputCls} placeholder="Bezeichnung (z. B. Mitarbeit)" value={g.title || ""} onChange={(e) => updateGrade(g.id, { title: e.target.value })} />
                              {g.category === "schriftlich" && (
                                <input
                                  className={inputCls}
                                  list="saidy-themen-noten"
                                  placeholder="Thema (optional), z. B. Bruchrechnung"
                                  value={g.topic || ""}
                                  onChange={(e) => updateGrade(g.id, { topic: e.target.value.trim() || null })}
                                  maxLength={100}
                                />
                              )}
                              <div className="flex gap-2 items-center">
                                <input className={inputCls} type="date" value={g.date} onChange={(e) => updateGrade(g.id, { date: e.target.value })} />
                                {g.category === "schriftlich" && (
                                  <select className={inputCls + " w-24"} value={g.factor || 1} onChange={(e) => updateGrade(g.id, { factor: Number(e.target.value) })} title="Gewichtung">
                                    {[1, 2, 3].map((f) => <option key={f} value={f}>×{f}</option>)}
                                  </select>
                                )}
                              </div>
                              {/* Vergessen-Vermerk: markiert die Note als Folge von vergessenem Material */}
                              <label className="flex items-center gap-2 text-sm text-stone-600 py-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  className="w-5 h-5 shrink-0 rounded"
                                  style={{ accentColor: "#4F5844" }}
                                  checked={!!g.reason}
                                  onChange={(e) => updateGrade(g.id, { reason: e.target.checked ? "Sportzeug" : undefined })}
                                />
                                Wegen vergessenem Material
                              </label>
                              {g.reason && (
                                <input
                                  className={inputCls}
                                  placeholder="Was wurde vergessen? (z. B. Sportzeug, Heft)"
                                  value={g.reason}
                                  onChange={(e) => updateGrade(g.id, { reason: e.target.value })}
                                />
                              )}
                              <div className="flex gap-2">
                                <Button variant="danger" onClick={() => { removeGrade(g.id); setEditingGrade(null); }} className="justify-center"><Trash2 size={15} /> Löschen</Button>
                                <Button onClick={() => setEditingGrade(null)} className="flex-1 justify-center">Fertig</Button>
                              </div>
                            </li>
                          ) : (
                            <li key={g.id} className="py-2.5 flex items-center gap-3 text-sm">
                              {g.auto ? (
                                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-xs font-semibold min-w-8 h-6 px-1 justify-center rounded-lg shrink-0" title={`Automatisch: ${g.reason} vergessen`}>
                                  <AlertTriangle size={11} /> {GRADE_OPTIONS.find((o) => o.value === g.value)?.label}
                                </span>
                              ) : (
                                <span className={`font-semibold w-8 shrink-0 tnum ${gradeColor(g.value, colored)}`}>{GRADE_OPTIONS.find((o) => o.value === g.value)?.label}</span>
                              )}
                              <span className="text-xs text-stone-400 w-16 shrink-0">{CATS.find((c) => c.key === g.category)?.label}</span>
                              <span className="flex-1 text-stone-700 truncate flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{g.title || "—"}{g.factor && g.factor !== 1 ? ` · ×${g.factor}` : ""}</span>
                                {g.topic && (
                                  <span className="inline-flex items-center text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded-full shrink-0 max-w-[80px] truncate">{g.topic}</span>
                                )}
                                {!g.auto && g.reason && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0" title={`${g.reason} vergessen`}>
                                    <AlertTriangle size={9} /> {g.reason}
                                  </span>
                                )}
                              </span>
                              <span className="text-stone-400 text-xs shrink-0 tnum">{localDate(g.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>
                              {!g.auto ? (
                                <button onClick={() => setEditingGrade(g.id)} className="text-stone-300 hover:akzent-text shrink-0 p-1" title="Bearbeiten"><Settings2 size={15} /></button>
                              ) : (
                                <button onClick={() => removeGrade(g.id)} className="text-stone-300 hover:text-red-600 shrink-0 p-1" title="Löschen"><Trash2 size={15} /></button>
                              )}
                            </li>
                          )
                        ))}
                        {!studentGrades.length && <li className="py-3 text-sm text-stone-400">Noch keine Noten erfasst.</li>}
                      </ul>
                      <Button onClick={addGradeForStudent} className="w-full justify-center mt-4"><Plus size={15} /> Note hinzufügen</Button>
                      </div>
                    </div>
                  </div>
                )}
                  </div>
                </div>
              </div>
            )}
        </div>
      )}

      {showBulkModal && fach && (
        <BulkGradeModal
          fach={fach}
          cls={cls}
          students={students}
          halbjahr={halbjahr}
          isColor={data.settings?.colorMode === true}
          onSave={saveBulk}
          onClose={() => setShowBulkModal(false)}
        />
      )}

      {printMode && fach && (
        <PrintReport
          mode={printMode}
          fach={fach}
          cls={cls}
          students={students}
          data={data}
          halbjahr={halbjahr}
          onClose={() => setPrintMode(null)}
        />
      )}
    </div>
  );
}

