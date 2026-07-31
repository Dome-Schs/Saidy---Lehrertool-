import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Papa from "papaparse";
import {
  LayoutGrid, Users, CalendarDays, GraduationCap,
  Plus, X, Trash2, ChevronLeft, ChevronRight, ChevronDown, Settings2, Check,
  Clock, StickyNote, ClipboardCheck, Copy, CheckCircle2, AlertCircle, AlertTriangle,
  ListChecks, Inbox, FolderCheck, Sparkles, ShoppingBag, Zap, Briefcase,
  FileText, AlarmClock, Bookmark, MessageSquare, Smile, Image as ImageIcon,
  Calculator, PartyPopper, Bell, ShoppingCart, ThumbsDown, Phone, Printer, TrendingUp, TrendingDown, Download, Upload, ShieldCheck, MoreHorizontal,
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

const EMPTY_DATA = { classes: [], students: [], notes: [], timetable: [], events: [], grades: [], periodTimes: {}, subjectColors: {}, faecher: [], taskLists: [], tasks: [], incidents: [], finalGrades: [], duties: [], lessonTopics: [], absences: [], deletedSnapshot: null, settings: { dashboardOrder: ["unterricht", "aufgaben", "kalender", "geburtstage"], bundesland: null, ferienAdded: false, showFerienCountdown: true, countdownSchooldaysOnly: true, fehlzeitenImportInterval: 7, fehlzeitenLastImport: null, notenfarben: true } };

const DASHBOARD_SECTIONS = {
  unterricht: "Unterricht",
  aufgaben: "Tagesaufgaben",
  kalender: "Kalendereinträge",
  geburtstage: "Geburtstage",
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

/* Offizielle Ferientermine (Quelle: Schulministerium NRW). Weitere Bundesländer können ergänzt werden.
   Format: [Titel, Start ISO, Ende ISO (letzter Ferientag)] */
const FERIEN = {
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
};

const TASK_COLORS = ["#2E3328", "#A3402F", "#B07D2B", "#5F7A45", "#41697E"];

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
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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
  const base = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed";
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
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
        </div>
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
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

/* Einstellungen: Reihenfolge der Dashboard-Karten per Pfeiltasten anpassen */
function SettingsModal({ data, update, halbjahr, setHalbjahr, onExport, onShare, onImport, onReset, onClose, onOpenUntisImport }) {
  const gespeicherteReihenfolge = data.settings?.dashboardOrder || Object.keys(DASHBOARD_SECTIONS);
  const order = [
    ...gespeicherteReihenfolge.filter((k) => DASHBOARD_SECTIONS[k]),
    ...Object.keys(DASHBOARD_SECTIONS).filter((k) => !gespeicherteReihenfolge.includes(k)),
  ];
  const currentBundesland = data.settings?.bundesland || "";
  const importInputRef = useRef(null);
  const [importMsg, setImportMsg] = useState(null); // { ok, msg }
  const [confirmImport, setConfirmImport] = useState(null); // File
  const [confirmBackupAction, setConfirmBackupAction] = useState(null); // 'export' | 'share'
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [confirmDeleteSnapshot, setConfirmDeleteSnapshot] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showICloudSteps, setShowICloudSteps] = useState(false);
  const [showPromote, setShowPromote] = useState(false);

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
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
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

        <div className="text-xs font-medium text-stone-500 mb-1">Neues Schuljahr</div>
        <Button variant="subtle" onClick={() => setShowPromote(true)} disabled={!data.classes.length} className="w-full justify-center mb-5 pb-2">
          <ChevronRight size={15} className="-rotate-90" /> Klassen versetzen (z. B. 5c → 6c)
        </Button>
        <div className="border-b border-stone-100 mb-5" />

        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Übersicht (Startseite)</div>

        <label className="flex items-center justify-between gap-2 py-2 cursor-pointer">
          <span className="text-sm text-stone-700">Ferien-Countdown anzeigen</span>
          <input type="checkbox" checked={!!data.settings?.showFerienCountdown} onChange={(e) => setSetting("showFerienCountdown", e.target.checked)} className="w-5 h-5" />
        </label>
        {data.settings?.showFerienCountdown && (
          <label className="flex items-center justify-between gap-2 py-2 pl-3 mb-2 cursor-pointer">
            <span className="text-xs text-stone-500">Nur Schultage zählen (Mo–Fr)</span>
            <input type="checkbox" checked={!!data.settings?.countdownSchooldaysOnly} onChange={(e) => setSetting("countdownSchooldaysOnly", e.target.checked)} className="w-5 h-5" />
          </label>
        )}

        <label className="flex items-center justify-between gap-2 py-2 mb-2 cursor-pointer">
          <span className="text-xs text-stone-500">Notenfarben anzeigen (grün / gelb / rot)</span>
          <input type="checkbox" checked={data.settings?.notenfarben !== false} onChange={(e) => setSetting("notenfarben", e.target.checked)} className="w-5 h-5" />
        </label>

        <div className="text-xs font-medium text-stone-500 mb-2">Reihenfolge der Karten</div>
        <ul className="space-y-1.5 mb-2">
          {order.map((key, i) => (
            <li key={key} className="flex items-center gap-2 bg-stone-50 rounded-lg px-3 py-2">
              <span className="flex-1 text-sm text-stone-700">{DASHBOARD_SECTIONS[key] || key}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="w-7 h-7 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={15} className="rotate-90" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="w-7 h-7 flex items-center justify-center rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={15} className="rotate-90" />
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone-400 mb-4">Legt fest, in welcher Reihenfolge Unterricht, Tagesaufgaben, Kalendereinträge und Geburtstage auf der Übersicht erscheinen.</p>

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
            <Button variant="subtle" onClick={() => setConfirmBackupAction("share")} className="flex-1 justify-center">Teilen</Button>
          </div>
          <Button variant="ghost" onClick={() => importInputRef.current?.click()} className="w-full justify-center"><Upload size={15} /> Gesichertes wiederherstellen</Button>
          <input
            ref={importInputRef} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) setConfirmImport(f); e.target.value = ""; }}
          />
          {importMsg && (
            <p className={`text-xs mt-2 ${importMsg.ok ? "akzent-text" : "text-red-600"}`}>{importMsg.msg}</p>
          )}
          <p className="text-xs text-stone-400 mt-3 flex items-start gap-1.5">
            <ShieldCheck size={13} className="shrink-0 mt-0.5" />
            Backup-Dateien enthalten alle Schülerdaten im Klartext – <strong>nicht</strong> in privaten Cloud-Diensten (Google Drive, Dropbox, iCloud) speichern.
          </p>
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
          {!showICloudSteps ? (
            <button
              onClick={() => setShowICloudSteps(true)}
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

        <Button onClick={onClose} className="w-full justify-center mt-5">Schließen</Button>
        </div>

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
  return data.timetable
    .filter((t) => t.day === dayKey)
    .map((t) => {
      const fach = data.faecher.find((f) => f.id === t.fachId);
      if (!fach) return null;
      const cls = data.classes.find((c) => c.id === fach.classId);
      const pt = data.periodTimes?.[t.period];
      if (!pt?.end || nowHM < pt.end) return null;
      const graded = data.grades.some((g) => g.fachId === fach.id && g.date === todayStr);
      if (graded) return null;
      return { key: `${fach.id}-${todayStr}`, fach, cls, period: t.period, start: pt.start, end: pt.end };
    })
    .filter(Boolean)
    .sort((a, b) => b.period - a.period); // neueste Stunde zuerst
}

function demoData() {
  const classId = uid();
  const class2Id = uid();
  const fachMatheId = uid();
  const fachSportId = uid();
  const fachSport7aId = uid();
  const maxId = uid();
  const jennyId = uid();
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
    { id: uid(), studentId: maxId, classId, fachId: fachMatheId, category: "schriftlich", value: 3.25, factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj },
    // Max – Sport: stark, inkl. einer automatischen 5 wegen Sportzeug
    { id: uid(), studentId: maxId, classId, fachId: fachSportId, category: "muendlich", value: 1, factor: 1, title: "Mitarbeit", date: d(12), halbjahr: hj },
    { id: uid(), studentId: maxId, classId, fachId: fachSportId, category: "muendlich", value: 5, factor: 1, title: "Sportzeug vergessen", date: d(5), halbjahr: hj, auto: true, reason: "Sportzeug" },
    // Jenny – Mathematik: sehr gut
    { id: uid(), studentId: jennyId, classId, fachId: fachMatheId, category: "muendlich", value: 1, factor: 1, title: "Mitarbeit", date: d(14), halbjahr: hj },
    { id: uid(), studentId: jennyId, classId, fachId: fachMatheId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(7), halbjahr: hj },
    { id: uid(), studentId: jennyId, classId, fachId: fachMatheId, category: "schriftlich", value: 1.75, factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj },
    // Jenny – Sport
    { id: uid(), studentId: jennyId, classId, fachId: fachSportId, category: "muendlich", value: 2, factor: 1, title: "Mitarbeit", date: d(12), halbjahr: hj },
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
    if ([maxId, jennyId, leonId, aylinId].includes(s.id)) return;
    if (s.classId === classId) {
      // 5c: Mathematik (2 mündlich + 1 Arbeit) und Sport (2 mündlich)
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachMatheId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(14), halbjahr: hj });
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachMatheId, category: "muendlich", value: pick(muendlichWerte), factor: 1, title: "Mitarbeit", date: d(7), halbjahr: hj });
      grades.push({ id: uid(), studentId: s.id, classId, fachId: fachMatheId, category: "schriftlich", value: pick(schriftlichWerte), factor: 2, title: "Klassenarbeit Nr. 1", date: d(10), halbjahr: hj });
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
      { id: fachMatheId, classId, subject: "Mathematik", color: COLOR_PALETTE[0], room: "0.107", weights: DEFAULT_WEIGHTS },
      { id: fachSportId, classId, subject: "Sport", color: COLOR_PALETTE[2], room: "Sporthalle", weights: { muendlich: 100, schriftlich: 0 } },
      { id: fachSport7aId, classId: class2Id, subject: "Sport", color: COLOR_PALETTE[2], room: "Sporthalle", weights: { muendlich: 100, schriftlich: 0 } },
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
function OnboardingModal({ onApply, onSkip }) {
  const [code, setCode] = useState("NW");
  const available = !!FERIEN[code];

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex flex-col items-center mb-5">
          <SaidyLogoMark size={56} className="mb-3" />
          <div className="text-xl font-semibold tracking-widest text-stone-800 uppercase">Saidy</div>
          <div className="text-xs text-stone-400 tracking-widest uppercase mt-0.5">Noten. Notizen. Organisiert.</div>
        </div>
        <div className="font-semibold text-stone-800 mb-1">Willkommen!</div>
        <p className="text-sm text-stone-500 mb-4">
          Wähle dein Bundesland, dann kann ich die offiziellen Schulferien direkt in deinen Kalender eintragen.
        </p>

        <Field label="Bundesland">
          <select className={inputCls} value={code} onChange={(e) => setCode(e.target.value)}>
            {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </select>
        </Field>

        {!available && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Für dieses Bundesland sind die Ferientermine noch nicht hinterlegt. Du kannst es trotzdem auswählen und Ferien später manuell eintragen.
          </p>
        )}

        <div className="flex flex-col gap-2 mt-5">
          <Button onClick={() => onApply(code, true)} disabled={!available} className="w-full justify-center">
            Bundesland speichern & Ferien eintragen
          </Button>
          <Button variant="ghost" onClick={() => onApply(code, false)} className="w-full justify-center">
            Nur speichern, keine Ferien
          </Button>
          <button onClick={onSkip} className="text-xs text-stone-400 hover:text-stone-600 mt-1">Später einrichten</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Hilfe-Inhalte ----------
   WICHTIG: Wird ein neues Feature eingebaut oder ein bestehender Workflow geändert,
   muss HELP_DATA hier entsprechend aktualisiert werden. */
const HELP_DATA = [
  {
    category: "Erste Schritte",
    items: [
      { q: "Wie lege ich eine neue Klasse an?", a: "Tippe auf „Klassen" in der Navigation, dann oben rechts auf „+". Gib den Klassennamen ein und bestätige mit „Anlegen"." },
      { q: "Wie füge ich Schüler:innen hinzu?", a: "Öffne eine Klasse und tippe auf „+ Schüler:in". Namen können einzeln oder als Liste eingegeben werden." },
      { q: "Wie stelle ich mein Bundesland ein?", a: "Gehe zu „Mehr" → „Einstellungen" und wähle dein Bundesland. Danach kannst du die offiziellen Schulferien automatisch eintragen lassen." },
    ],
  },
  {
    category: "Klassen & Schüler:innen",
    items: [
      { q: "Wie bearbeite ich eine:n Schüler:in?", a: "Tippe in der Klassenliste auf den Namen. Im Profil kannst du Name, Foto und weitere Angaben bearbeiten." },
      { q: "Wie lösche ich eine Klasse?", a: "Öffne die Klasse, tippe auf das Bearbeiten-Symbol und wähle „Klasse löschen". Achtung: alle Daten dieser Klasse werden unwiderruflich entfernt." },
      { q: "Was sind Dienste?", a: "Dienste sind Aufgaben, die Saidy Schüler:innen der Reihe nach zuweist (z. B. Tafeldienst). Anlegen unter Klasse → „Dienste", mit einem Tippen weiter zum nächsten Kind." },
      { q: "Wie erfasse ich Fehlzeiten?", a: "Gehe zu Klasse → „Fehlzeiten" → „+ Fehlzeit". Wähle Schüler:in, Datum und ob die Fehlzeit entschuldigt oder unentschuldigt ist." },
    ],
  },
  {
    category: "Noten",
    items: [
      { q: "Wie trage ich eine Note ein?", a: "Gehe zu „Noten", wähle Klasse und Fach. Tippe auf eine:n Schüler:in und dann auf „+ Note". Du kannst Art, Gewichtung und Datum angeben." },
      { q: "Wie berechnet sich die Zeugnisnote?", a: "Saidy bildet den gewichteten Durchschnitt aller Noten. Schriftliche Noten werden standardmäßig doppelt gewichtet. Die berechnete Note erscheint in der Notenübersicht." },
      { q: "Was ist der Schnellerfassungs-Modus?", a: "Das Blitz-Symbol nach einer Stunde öffnet einen Modus, in dem du für alle Schüler:innen einer Klasse auf einem Bildschirm Noten, Notizen und Auffälligkeiten eintragen kannst." },
    ],
  },
  {
    category: "Kalender & Termine",
    items: [
      { q: "Wie lege ich einen Termin an?", a: "Gehe zu „Kalender" und tippe auf „+ Neuen Termin anlegen". Gib Titel, Datum, Uhrzeit und Art ein." },
      { q: "Wie trage ich Schulferien ein?", a: "Stelle zuerst dein Bundesland in den Einstellungen ein. Dann erscheint dort „Schulferien eintragen" – Saidy übernimmt alle Ferien automatisch." },
      { q: "Wie erledige ich einen Termin?", a: "Tippe auf den Kreis links neben dem Termin. Er wandert in den „Erledigt"-Bereich ganz unten." },
    ],
  },
  {
    category: "Backup & Daten",
    items: [
      { q: "Wie erstelle ich ein Backup?", a: "Gehe zu „Mehr" → „Einstellungen" → „Backup" → „Backup exportieren" (Datei speichern) oder „Backup teilen" (z. B. per AirDrop)." },
      { q: "Wie stelle ich ein Backup wieder her?", a: "Gehe zu „Mehr" → „Einstellungen" → „Backup" → „Backup importieren" und wähle deine Backup-Datei." },
      { q: "Wo werden meine Daten gespeichert?", a: "Alle Daten bleiben ausschließlich auf deinem Gerät (lokaler Browser-Speicher). Es werden keine Daten an Server übertragen." },
      { q: "Warum bekomme ich eine Backup-Erinnerung?", a: "Saidy erinnert nach 7 Tagen ohne Backup. Da die Daten nur lokal gespeichert sind, schützt ein regelmäßiges Backup vor Datenverlust." },
    ],
  },
  {
    category: "Import",
    items: [
      { q: "Wie importiere ich Fehlzeiten aus WebUntis?", a: "Gehe zu „Mehr" → „WebUntis-Import". Exportiere in WebUntis die Fehlzeiten als CSV und lade sie hier hoch. Saidy übernimmt sie automatisch in die passenden Klassen." },
    ],
  },
];

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
        className="bg-white rounded-t-3xl w-full p-4 pb-[max(2rem,env(safe-area-inset-bottom))] max-h-[88vh] flex flex-col sheet"
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
            placeholder="Suche, z. B. „Backup" oder „Note eintragen""
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

export default function App() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved
  const [halbjahr, setHalbjahr] = useState(currentHalbjahr());
  const [showSettings, setShowSettings] = useState(false);
  const [showUntisImport, setShowUntisImport] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [klassenSubTab, setKlassenSubTab] = useState("klassen");
  const [backupReminderDays, setBackupReminderDays] = useState(null); // null=kein Banner, 0=nie gesichert, >0=Tage seit letztem Backup
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [notenFachId, setNotenFachId] = useState(null); // Vorauswahl für den Noten-Tab

  // Wechselt den Bereich und optional den Unterreiter (z. B. direkt zu den Diensten)
  const goTo = useCallback((ziel, unterreiter) => {
    setTab(ziel);
    if (unterreiter) setKlassenSubTab(unterreiter);
  }, []);
  // Direkt in die Notenübersicht eines bestimmten Fachs springen
  const goToFach = useCallback((fachId) => {
    setNotenFachId(fachId);
    setTab("noten");
  }, []);
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
          if (!parsed.settings?.bundesland) setShowOnboarding(true);
          if ((parsed.classes || []).length > 0) {
            const lastBackup = localStorage.getItem("last_backup_at");
            if (!lastBackup) {
              setBackupReminderDays(0);
            } else {
              const daysSince = Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24));
              if (daysSince >= 7) setBackupReminderDays(daysSince);
            }
          }
        } else {
          setData(demoData());
          setShowOnboarding(true);
        }
      } catch (e) {
        // noch keine Daten vorhanden – Standard bleibt
        setData(demoData());
        setShowOnboarding(true);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set("app_data", JSON.stringify(data));
        setSaveState("saved");
      } catch (e) {
        setSaveState("idle");
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
    setShowOnboarding(false);
  }

  function showToast(msg) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  function recordBackup() {
    localStorage.setItem("last_backup_at", new Date().toISOString());
    setBackupReminderDays(null);
  }

  function exportBackup() {
    const payload = { app: "saidy", version: 1, exportedAt: new Date().toISOString(), data };
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

  async function shareBackup() {
    const payload = { app: "saidy", version: 1, exportedAt: new Date().toISOString(), data };
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
    update((d) => {
      const snapshot = { deletedAt: new Date().toISOString(), data: { ...d, deletedSnapshot: null } };
      return { ...EMPTY_DATA, deletedSnapshot: snapshot };
    });
  }

  function importBackup(file, onResult) {
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
        setData(merged);
        recordBackup();
        onResult?.({ ok: true, msg: "Backup erfolgreich geladen." });
      } catch (e) {
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
    { key: "noten", label: "Noten", icon: GraduationCap },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center app-bg gap-4">
        <SaidyLogoMark size={72} />
        <div className="text-stone-400 text-sm">Lade Daten …</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-bg text-[color:var(--ink)] font-sans">
      <style>{`
        :root {
          --oliv: #4F5844;        /* Salbei-Oliv: Akzent */
          --oliv-dunkel: #3E4636;
          --oliv-hell: #ECEEE2;   /* heller Salbeiton für Flächen */
          --creme: #F4F1E8;       /* Grundfläche */
          --karte: #FFFDF8;       /* Kartenfläche, leicht warm */
          --linie: #E4DFD2;       /* Haarlinie */
          --ink: #2E3328;         /* Text */
        }
        .app-bg { background: var(--creme); }
        .karte { background: var(--karte); border: 1px solid var(--linie); }
        .bg-karte { background: var(--karte); }
        .akzent-flaeche { background: var(--oliv); color: #fff; }
        .akzent-flaeche:hover { background: var(--oliv-dunkel); }
        .akzent-text { color: var(--oliv); }
        .akzent-ton { background: var(--oliv-hell); color: var(--oliv); }
        .akzent-rand { border-color: var(--oliv); }
        /* Ziffern laufen exakt untereinander wie in einer Notenliste */
        .tnum { font-variant-numeric: tabular-nums; }
        /* Bottom-Sheets: nie hinter den App-Balken; immer Sicherheitsabstand oben und unten */
        .sheet {
          max-height: calc(100dvh - env(safe-area-inset-top) - 64px);
          margin-top: max(env(safe-area-inset-top), 12px);
          overscroll-behavior: contain;
        }
        /* Zentrierte Dialoge: nie höher als der sichtbare Bereich */
        .dialog {
          max-height: calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px);
          overscroll-behavior: contain;
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition-duration: 0.01ms !important; }
        }
      `}</style>
      {showOnboarding && (
        <OnboardingModal onApply={applyBundesland} onSkip={() => setShowOnboarding(false)} />
      )}
      <div className="md:flex">
        {/* Seitenleiste (Desktop) */}
        <aside className="hidden md:w-56 md:fixed md:inset-y-0 md:flex md:flex-col border-r border-stone-200 bg-white">
          {/* App-Kopf */}
          <div className="px-4 py-4 border-b border-stone-100">
            <div className="flex items-center gap-2.5">
              <SaidyLogoMark size={34} className="shrink-0" />
              <div>
                <div className="text-sm font-semibold text-stone-800 leading-tight tracking-wide">Saidy</div>
                <div className="text-[10px] text-stone-400 leading-none mt-0.5">
                  {saveState === "saving" ? "Speichert …" : "Gespeichert"}
                </div>
              </div>
            </div>
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

          {/* Einstellungen unten */}
          <div className="px-2 py-3 border-t border-stone-100">
            <button
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors"
            >
              <Settings2 size={17} strokeWidth={2} /> Einstellungen
            </button>
          </div>
        </aside>

        {/* Inhalt */}
        <main className="flex-1 md:ml-56 px-4 pt-[max(env(safe-area-inset-top),1.25rem)] pb-24 md:px-8 md:pt-8 md:pb-8 max-w-5xl">
          {backupReminderDays !== null && (
            <div className="mb-5 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
              <Download size={16} className="text-amber-600 shrink-0" />
              <span className="flex-1 text-stone-700">
                {backupReminderDays === 0
                  ? "Noch kein Backup gespeichert – sichere deine Daten kurz."
                  : `Letztes Backup vor ${backupReminderDays} Tagen – Zeit für ein neues.`}
              </span>
              <button
                onClick={() => { setShowSettings(true); setBackupReminderDays(null); }}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
              >
                Jetzt sichern
              </button>
              <button onClick={() => setBackupReminderDays(null)} className="text-stone-400 hover:text-stone-600 shrink-0">
                <X size={15} />
              </button>
            </div>
          )}
          {tab === "dashboard" && <Dashboard data={activeData} update={update} onNavigate={goTo} onOpenUntisImport={() => setShowUntisImport(true)} halbjahr={halbjahr} setCaptureLesson={setCaptureLesson} pendingLessons={pendingLessons} now={now} />}
          {tab === "klassen" && <KlassenTab data={activeData} update={update} subTab={klassenSubTab} setSubTab={setKlassenSubTab} onOpenFach={goToFach} />}
          {tab === "stundenplan" && <StundenplanTab data={activeData} update={update} />}
          {tab === "kalender" && <KalenderTab data={activeData} update={update} />}
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
            />
          )}
        </main>
      </div>

      {/* Feste untere Navigation (nur mobil) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-lg border-t border-stone-200/80 z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px_rgba(0,0,0,0.12)]">
        <div className="flex items-stretch justify-around px-2 pt-2 pb-1.5">
          {[tabs[0], tabs[1], tabs[3], tabs[5]].map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setShowMore(false); }}
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
          <button
            onClick={() => setShowMore(true)}
            className="flex-1 flex flex-col items-center gap-1"
          >
            <span className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${["stundenplan", "aufgaben"].includes(tab) ? "akzent-ton" : ""}`}>
              <MoreHorizontal size={20} strokeWidth={2.2} className={["stundenplan", "aufgaben"].includes(tab) ? "akzent-text" : "text-stone-400"} />
            </span>
            <span className={`text-[10px] leading-none ${["stundenplan", "aufgaben"].includes(tab) ? "akzent-text font-semibold" : "text-stone-400"}`}>Mehr</span>
          </button>
        </div>
      </nav>

      {/* Mehr-Menü (mobil) */}
      {showMore && (
        <div className="md:hidden fixed inset-0 bg-stone-900/40 z-50 flex items-end" onClick={() => setShowMore(false)}>
          <div className="bg-white rounded-t-3xl w-full p-4 pb-[max(2rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-2 gap-3">
              {[tabs[2], tabs[4]].map((t) => {
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

      {/* Toast-Meldung */}
      {toast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-stone-800 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg pointer-events-none">
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
function QuickCaptureModal({ data, update, fach, cls, students, date: initialDate, halbjahr, onClose }) {
  const [date, setDate] = useState(initialDate || isoDate(new Date()));
  const [category, setCategory] = useState("muendlich");
  const [incidentLabel, setIncidentLabel] = useState("Sportzeug");
  const [autoGrade, setAutoGrade] = useState(true);
  const [expanded, setExpanded] = useState(null); // studentId, dessen Notizfeld offen ist
  const [noteDrafts, setNoteDrafts] = useState({});

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
    update((d) => {
      d.grades = d.grades.filter((g) => !(g.quick && g.fachId === fach.id && g.studentId === studentId && g.date === date && g.category === category));
      if (value != null) {
        d.grades.push({ id: uid(), studentId, classId: fach.classId, fachId: fach.id, category, value, factor: 1, title: "Schnellerfassung", date, halbjahr, quick: true });
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

  return (
    <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={onClose}>
      <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet overflow-x-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Kopf bleibt beim Scrollen sichtbar */}
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center gap-2 z-10 shadow-[0_4px_10px_-6px_rgba(0,0,0,0.15)]">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-stone-800 leading-tight">Schnellerfassung</div>
            <div className="text-xs text-stone-400 truncate">{cls?.name} · {fach.subject}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">

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

          {/* Optionales Stundenthema */}
          <div className="mb-4">
            <input
              className={inputCls}
              placeholder="Thema der Stunde (optional) – z. B. Bruchrechnung einführen"
              value={topic}
              onChange={(e) => saveTopic(e.target.value)}
            />
          </div>

          {/* Frage zum Mitbringen – mit direkt änderbarem Begriff */}
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2 flex-wrap text-sm text-amber-900">
              <span>Haben alle ihr</span>
              <input
                className="text-sm rounded-lg border border-amber-300 bg-white px-2 py-1 w-32"
                value={incidentLabel}
                onChange={(e) => setIncidentLabel(e.target.value)}
                placeholder="Sportzeug"
              />
              <span>dabei?</span>
            </div>
            <p className="text-xs text-amber-700 mt-1.5">
              Fehlt es, beim Kind auf <AlertTriangle size={11} className="inline -mt-0.5" /> tippen
              {autoGrade ? " – trägt automatisch eine mündliche 5 mit Vermerk ein." : "."}
            </p>
          </div>

          <ul className="divide-y divide-stone-100">
            {students.map((s) => {
              const fehlt = incidentActive(s.id);
              const hatNotiz = !!noteFor(s.id);
              return (
                <li key={s.id} className="py-2.5">
                  {/* Name und die beiden Schalter */}
                  <div className="flex items-center gap-2 mb-2">
                    <StudentAvatar student={s} size={26} />
                    <span className="flex-1 text-sm text-stone-800 truncate min-w-0">{s.name}</span>
                    <button
                      onClick={() => setExpanded((cur) => (cur === s.id ? null : s.id))}
                      className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                        hatNotiz ? "akzent-ton akzent-rand" : "border-stone-200 text-stone-400"
                      }`}
                      aria-label="Notiz"
                    >
                      <StickyNote size={16} />
                    </button>
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => toggleIncident(s.id)}
                        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                          fehlt ? "bg-red-600 border-red-600 text-white" : "border-stone-200 text-stone-400"
                        }`}
                        aria-label={`${incidentLabel} vergessen`}
                      >
                        <AlertTriangle size={16} />
                      </button>
                      {fehlt && autoGrade && <span className="text-[9px] leading-none text-red-600 font-medium">Note 5</span>}
                    </div>
                  </div>

                  {fehlt && (
                    <input
                      className="w-full text-xs rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-2 mb-2"
                      placeholder={`Vermerk, z. B. nur Schuhe vergessen`}
                      value={incidentNoteFor(s.id)}
                      onChange={(e) => setIncidentNote(s.id, e.target.value)}
                    />
                  )}

                  {category === "muendlich" ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {QUICK_SYMBOLS.map((qs) => {
                        const active = gradeFor(s.id) === qs.value;
                        return (
                          <button
                            key={qs.symbol}
                            onClick={() => setGrade(s.id, active ? "" : String(qs.value))}
                            className="h-9 rounded-lg text-sm font-semibold border"
                            style={active ? { backgroundColor: qs.color, borderColor: qs.color, color: "white" } : { borderColor: "#E7E5E4", color: "#78716C" }}
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

                  {expanded === s.id && (
                    <input
                      autoFocus
                      className="w-full mt-2 text-sm rounded-lg border border-stone-300 px-2.5 py-2"
                      placeholder="Beobachtung notieren …"
                      value={noteFor(s.id)}
                      onChange={(e) => setNoteDrafts((d) => ({ ...d, [s.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { saveNote(s.id); setExpanded(null); } }}
                      onBlur={() => saveNote(s.id)}
                    />
                  )}
                </li>
              );
            })}
            {!students.length && <li className="py-3 text-sm text-stone-400">Keine Schüler:innen in dieser Klasse.</li>}
          </ul>

          <Button onClick={onClose} className="w-full justify-center mt-4">Fertig</Button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, update, onNavigate, onOpenUntisImport, halbjahr, setCaptureLesson, pendingLessons, now }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showPending, setShowPending] = useState(false);
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

  const openTasks = (data.tasks || []).filter((t) => !t.done).slice(0, 6);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight leading-tight">Guten Tag</h1>
          <p className="text-stone-500 text-xs">
            {selectedDate.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <div className="flex items-end gap-2 shrink-0">
          {showImportReminder && (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => onOpenUntisImport?.()}
                className="relative w-9 h-9 rounded-full bg-stone-100 text-stone-400 hover:bg-stone-200 flex items-center justify-center shrink-0"
                title={daysSinceLast === null ? "WebUntis-Fehlzeiten noch nie importiert" : `WebUntis-Import fällig (vor ${daysSinceLast} Tagen)`}
              >
                <Upload size={16} />
                <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white" />
              </button>
              <span className="text-[9px] leading-none text-amber-600 font-medium">Fehlzeiten</span>
            </div>
          )}
          {isToday && (
            <div className="flex flex-col items-center gap-0.5">
              <button
                onClick={() => setShowPending((v) => !v)}
                className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                  (pendingLessons || []).length
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-stone-100 text-stone-300 hover:bg-stone-200"
                }`}
                title={(pendingLessons || []).length ? "Unterricht erfassen" : "Alle Stunden erfasst"}
              >
                <ClipboardCheck size={17} />
                {!!(pendingLessons || []).length && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-600 text-white text-[10px] font-semibold flex items-center justify-center">
                    {pendingLessons.length}
                  </span>
                )}
              </button>
              <span className={`text-[9px] leading-none ${(pendingLessons || []).length ? "text-amber-600 font-medium" : "text-stone-400"}`}>
                {(pendingLessons || []).length ? "Nachtragen" : "Erfasst"}
              </span>
            </div>
          )}
        {data.settings?.showFerienCountdown && (() => {
          const cd = nextFerienCountdown(data.events, data.settings?.countdownSchooldaysOnly);
          if (!cd) return null;
          if (cd.inFerien) {
            return (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-center gap-1.5 shrink-0" title={cd.title}>
                <span className="text-base leading-none">🌴</span>
                <span className="text-[11px] font-medium text-emerald-800">{cd.title}</span>
              </div>
            );
          }
          return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 flex items-baseline gap-1.5 shrink-0">
              <span className="text-lg font-bold text-emerald-700 leading-none">{cd.days}</span>
              <span className="text-[11px] text-emerald-800">
                {data.settings?.countdownSchooldaysOnly
                  ? (cd.days === 1 ? "Schultag" : "Schultage")
                  : (cd.days === 1 ? "Tag" : "Tage")} bis {cd.title}
              </span>
            </div>
          );
        })()}
        </div>
      </div>

      {/* Aufklappbare Liste der nachzutragenden Stunden */}
      {isToday && showPending && !!(pendingLessons || []).length && (
        <Card className="p-3">
          <div className="text-xs font-medium text-stone-500 mb-2">Noch nicht erfasst</div>
          <ul className="space-y-1.5">
            {pendingLessons.map((p) => (
              <li key={p.key} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-stone-400 w-11 shrink-0">{p.start}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.fach.color }} />
                <span className="flex-1 text-stone-700 truncate">{p.cls?.name} – {p.fach.subject}</span>
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

      {/* Wochentagsleiste */}
      <Card className="p-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setSelectedDate((d) => addDays(d, -7))} className="p-1.5 text-stone-400 hover:text-stone-700 shrink-0">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1 grid grid-cols-7 gap-1">
            {week.map((d, i) => {
              const active = isoDate(d) === selStr;
              const isTodayCol = isoDate(d) === todayStr;
              return (
                <button key={i} onClick={() => setSelectedDate(d)} className="flex flex-col items-center gap-1 py-1.5 rounded-lg hover:bg-stone-50">
                  <span className={`text-[11px] ${isTodayCol ? "text-red-500" : "text-stone-400"}`}>{WEEKDAY_LABELS[i]}</span>
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full text-sm ${
                      active ? "bg-stone-900 text-white font-medium" : isTodayCol ? "text-red-500 font-medium" : "text-stone-700"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setSelectedDate((d) => addDays(d, 7))} className="p-1.5 text-stone-400 hover:text-stone-700 shrink-0">
            <ChevronRight size={18} />
          </button>
        </div>
        {!isToday && (
          <button onClick={() => setSelectedDate(new Date())} className="text-xs akzent-text hover:underline mt-2 ml-1">
            Zu heute springen
          </button>
        )}
      </Card>

      {(() => {
        const sections = {
          unterricht: (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <button onClick={() => onNavigate?.("stundenplan")} className="flex items-center gap-2 text-stone-800 font-medium text-sm hover:akzent-text">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#ECEEE2", color: "#4F5844" }}><Clock size={14} /></span> Unterricht
                  <ChevronRight size={13} className="text-stone-300" />
                </button>
              </div>
              {!dayKey && <p className="text-xs text-stone-300 mb-2">Wochenende – kein regulärer Stundenplan</p>}
              {dayKey && !dayLessons.length && <p className="text-xs text-stone-300 mb-2">Keine Stunden im Plan</p>}
              <ul className="divide-y divide-stone-100">
                {dayLessons.map((l) => {
                  const fach = data.faecher.find((f) => f.id === l.fachId);
                  const cls = fach ? data.classes.find((c) => c.id === fach.classId) : null;
                  const pt = data.periodTimes?.[l.period];
                  const offen = isToday && fach && (pendingLessons || []).some((p) => p.fach.id === fach.id);
                  const istLetzte = isToday && fach && letzteStunde?.id === l.id;
                  return (
                    <li key={l.id} className={`py-1.5 flex items-center justify-between text-sm gap-2 ${istLetzte ? "-mx-2 px-2 rounded-lg bg-stone-50" : ""}`}>
                      <span className="text-stone-400 text-xs w-11 shrink-0">{pt ? pt.start : `${l.period}.`}</span>
                      <span className="flex-1 font-medium text-stone-800 flex flex-col min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          {fach && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: fach.color }} />}
                          <span className="truncate">{fach && cls ? `${cls.name} – ${fach.subject}` : "—"}</span>
                        </span>
                        {(() => {
                          const t = fach && (data.lessonTopics || []).find((x) => x.fachId === fach.id && x.date === selStr);
                          return t ? <span className="text-xs font-normal text-stone-400 truncate pl-3.5">{t.text}</span> : null;
                        })()}
                      </span>
                      {istLetzte && <span className="text-[10px] text-stone-400 shrink-0 hidden sm:inline">zuletzt</span>}
                      {fach && cls && (
                        <button
                          onClick={() => setCaptureLesson({ fach, cls, date: selStr })}
                          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            offen ? "bg-amber-100 text-amber-700 hover:bg-amber-200" : "bg-stone-100 text-stone-400 hover:akzent-ton hover:akzent-text"
                          }`}
                          aria-label="Stunde erfassen"
                          title="Stunde erfassen"
                        >
                          <ClipboardCheck size={15} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ),
          aufgaben: (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => onNavigate?.("aufgaben")} className="flex items-center gap-2 text-stone-800 font-medium text-sm hover:akzent-text">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E9EDF0", color: "#41697E" }}><ListChecks size={14} /></span> Tagesaufgaben
                  {!!openTasks.length && <span className="text-xs text-stone-400">{openTasks.length}</span>}
                  <ChevronRight size={13} className="text-stone-300" />
                </button>
                <button onClick={() => onNavigate?.("aufgaben")} className="text-xs text-stone-400 hover:akzent-text shrink-0">+</button>
              </div>
              {openTasks.length ? (
                <ul className="space-y-1.5">
                  {openTasks.map((t) => (
                    <li key={t.id} className="text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-stone-700 truncate">{t.title}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-300">Nichts offen</p>
              )}
            </Card>
          ),
          kalender: (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => onNavigate?.("kalender")} className="flex items-center gap-2 text-stone-800 font-medium text-sm hover:akzent-text">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F3E7D6", color: "#B07D2B" }}><CalendarDays size={14} /></span> Termine
                  <ChevronRight size={13} className="text-stone-300" />
                </button>
                <button onClick={() => onNavigate?.("kalender")} className="text-xs text-stone-400 hover:akzent-text shrink-0">+</button>
              </div>
              {dayEvents.length ? (
                <ul className="space-y-1.5">
                  {dayEvents.map((e) => (
                    <li key={e.id} className="text-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.type === "ferien" ? "#10b981" : (e.color || "#c9702f") }} />
                      <span className="text-stone-700 truncate">{e.title}</span>
                      {e.time && <span className="text-stone-400 text-xs ml-auto shrink-0">{e.time}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-300">Nichts geplant</p>
              )}
            </Card>
          ),
          geburtstage: (
            <Card className="p-4">
              <button onClick={() => onNavigate?.("klassen")} className="flex items-center gap-2 text-stone-800 font-medium text-sm mb-2 hover:akzent-text">
                <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F4DBD7", color: "#C0392B" }}><PartyPopper size={14} /></span> Geburtstage
                <ChevronRight size={13} className="text-stone-300" />
              </button>
              {birthdays.length || kommendeGeburtstage.length ? (
                <ul className="space-y-2">
                  {birthdays.map((s) => {
                    const info = birthdayInfo(s, selectedDate);
                    return (
                      <li key={s.id} className="text-sm flex items-center gap-2.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider w-11 shrink-0" style={{ color: "#C0392B" }}>heute</span>
                        <span className="text-stone-900 font-medium truncate">{s.name}</span>
                        {info?.alter != null && (
                          <span className="ml-auto shrink-0 tnum text-sm font-semibold" style={{ color: "#C0392B" }}>
                            {info.alter}<span className="text-[10px] font-normal text-stone-400 ml-0.5">Jahre</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                  {kommendeGeburtstage.map(({ s, info }) => (
                    <li key={s.id} className="text-sm flex items-center gap-2.5">
                      <span className="text-[11px] text-stone-400 w-11 shrink-0 tnum">
                        {info.next.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="text-stone-600 truncate">{s.name}</span>
                      {info.alter != null && (
                        <span className="ml-auto shrink-0 tnum text-sm text-stone-500">
                          {info.alter}<span className="text-[10px] text-stone-300 ml-0.5">Jahre</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-stone-300">Keine in den nächsten drei Wochen</p>
              )}
            </Card>
          ),
          dienste: (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => onNavigate?.("klassen", "dienste")} className="flex items-center gap-2 text-stone-800 font-medium text-sm hover:akzent-text">
                  <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E4EAD9", color: "#5F7A45" }}><ClipboardCheck size={14} /></span> Dienste
                  <ChevronRight size={13} className="text-stone-300" />
                </button>
                <span className="text-[11px] text-stone-400">{currentSchoolWeek().label}</span>
              </div>
              {(() => {
                const alleDienste = data.duties || [];
                if (!alleDienste.length) {
                  return <p className="text-xs text-stone-300">Keine Dienste angelegt</p>;
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
                          <div className="text-[11px] font-medium text-stone-400 mb-1">{c.name}</div>
                          <ul className="space-y-1">
                            {cDuties.map((duty) => {
                              const kinder = (map[duty.id] || [])
                                .map((id) => data.students.find((s) => s.id === id))
                                .filter(Boolean);
                              return (
                                <li key={duty.id} className="flex items-start gap-2 text-sm">
                                  <span className="w-1.5 h-4 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: duty.color }} />
                                  <span className="text-stone-700 shrink-0">{duty.name}</span>
                                  <span className="flex-1 text-right text-stone-500 text-xs">
                                    {kinder.length ? kinder.map((s) => s.name).join(", ") : "—"}
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
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-stone-800 font-medium text-sm">
                    <span className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}><AlertTriangle size={14} /></span>
                    Offene Entschuldigungen
                    {ausstehend.length > 0 && <span className="text-xs font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{ausstehend.length}</span>}
                  </div>
                </div>
                {!studentEntries.length
                  ? <p className="text-xs text-stone-300">Alle Entschuldigungen erledigt 👍</p>
                  : (
                    <ul className="divide-y divide-stone-100">
                      {studentEntries.slice(0, 5).map(({ student, absences: sa }) => (
                        <li key={student.id} className="py-2 flex items-center gap-2 text-sm">
                          <StudentAvatar student={student} size={22} />
                          <span className="flex-1 text-stone-700 truncate">{student.name}</span>
                          <span className="text-xs text-amber-700 font-medium shrink-0">{sa.length}×</span>
                          <span className="text-xs text-stone-400 shrink-0">{new Date(sa[0].date).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}</span>
                        </li>
                      ))}
                      {studentEntries.length > 5 && <li className="pt-1.5 text-xs text-stone-400">… und {studentEntries.length - 5} weitere</li>}
                    </ul>
                  )}
              </Card>
            );
          })(),
        };
        const gespeichert = data.settings?.dashboardOrder || Object.keys(sections);
        // Neu hinzugekommene Karten anhängen, falls die gespeicherte Reihenfolge sie noch nicht kennt
        const order = [...gespeichert, ...Object.keys(sections).filter((k) => !gespeichert.includes(k))].filter((k) => sections[k]);
        return (
          <div className="grid md:grid-cols-2 gap-3">
            {order.map((key) => sections[key] ? <div key={key}>{sections[key]}</div> : null)}
          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => onNavigate?.("klassen")} className="bg-white rounded-xl border border-stone-200 py-2 text-center hover:akzent-rand transition-colors">
          <div className="text-base font-semibold text-stone-800 leading-tight">{data.classes.length}</div>
          <div className="text-[10px] text-stone-400">Klassen</div>
        </button>
        <button onClick={() => onNavigate?.("klassen")} className="bg-white rounded-xl border border-stone-200 py-2 text-center hover:akzent-rand transition-colors">
          <div className="text-base font-semibold text-stone-800 leading-tight">{data.students.length}</div>
          <div className="text-[10px] text-stone-400">Schüler:innen</div>
        </button>
      </div>
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
            className={inputCls} placeholder="z. B. 7c" value={name} autoFocus
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
    onSave({ classId: classId === "__new__" ? null : classId, newClassName: finalClassName, subject: subject.trim(), color, room: room.trim(), weights });
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
                onChange={(e) => setNewClassName(e.target.value)} autoFocus
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
              onFocus={() => setCustomSubject(true)}
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
            <input className={inputCls} placeholder="z. B. 0.107" value={room} onChange={(e) => setRoom(e.target.value)} />
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
              className={inputCls} placeholder="Name eingeben" value={name} autoFocus
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
                      {r.birthday && <span className="text-xs text-stone-400">{new Date(r.birthday).toLocaleDateString("de-DE")}</span>}
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
  { key: "gut", emoji: "😊", label: "Gut" },
  { key: "ok", emoji: "😐", label: "Ok" },
  { key: "schlecht", emoji: "😟", label: "Nicht so gut" },
];

/* Eigenständiges Fenster für die Schülerliste einer Klasse – bewusst getrennt von der Klassenübersicht */
function StudentsModal({ cls, students, notes, selectedStudent, setSelectedStudent, onDeleteStudent, onUpdateField, onAddNote, newNote, setNewNote, gespraechDraft, setGespraechDraft, onAddGespraech, onDeleteNote, onOpenAdd, onClose }) {
  const [photoError, setPhotoError] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  async function handlePhoto(studentId, file) {
    if (!file) return;
    try {
      const dataUrl = await resizeImageFile(file);
      onUpdateField(studentId, "photo", dataUrl);
      setPhotoError("");
    } catch (e) {
      setPhotoError("Foto konnte nicht verarbeitet werden.");
    }
  }

  return (
    <>
    <div className="fixed inset-0 bg-stone-900/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 overflow-y-auto dialog" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-stone-800">Schüler:innen – {cls.name}</div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X size={18} /></button>
        </div>

        <Button onClick={onOpenAdd} className="w-full justify-center mb-3"><Plus size={15} /> Hinzufügen</Button>
        {photoError && <p className="text-xs text-red-600 mb-2">{photoError}</p>}

        <ul className="divide-y divide-stone-100">
          {students.map((s) => {
            const open = selectedStudent === s.id;
            const studentNotes = notes.filter((n) => n.studentId === s.id && n.type !== "gespraech").sort((a, b) => b.date.localeCompare(a.date));
            const studentGespraeche = notes.filter((n) => n.studentId === s.id && n.type === "gespraech").sort((a, b) => b.date.localeCompare(a.date));
            return (
              <li key={s.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedStudent(open ? null : s.id)}
                    className={`text-sm flex-1 text-left truncate flex items-center gap-2 ${open ? "akzent-text font-medium" : "text-stone-700 hover:akzent-text"}`}
                  >
                    <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                    <StudentAvatar student={s} size={26} />
                    {s.name}
                    {s.medicalInfo && <AlertCircle size={13} className="text-amber-500 shrink-0" />}
                  </button>
                  <button onClick={() => setConfirmDeleteId(s.id)} className="text-stone-300 hover:text-red-500 p-1 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>

                {open && (
                  <div className="mt-3 mb-2 pl-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <StudentAvatar student={s} size={56} />
                      <div>
                        <input
                          type="file" accept="image/*" id={`photo-${s.id}`} className="hidden"
                          onChange={(e) => handlePhoto(s.id, e.target.files?.[0])}
                        />
                        <label
                          htmlFor={`photo-${s.id}`}
                          className="cursor-pointer text-xs font-medium text-stone-500 hover:text-stone-800 underline underline-offset-2 inline-block"
                        >
                          Foto {s.photo ? "ändern" : "hinzufügen"}
                        </label>
                        {s.photo && (
                          <button onClick={() => onUpdateField(s.id, "photo", "")} className="ml-2 text-xs text-stone-400 hover:text-red-500">
                            Entfernen
                          </button>
                        )}
                        <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                          <ShieldCheck size={10} className="shrink-0" />
                          Nur mit schriftlicher Einwilligung der Erziehungsberechtigten speichern.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Geburtstag">
                        <input
                          type="date"
                          value={s.birthday || ""}
                          onChange={(e) => onUpdateField(s.id, "birthday", e.target.value)}
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Telefon Eltern">
                        <div className="flex gap-1">
                          <input
                            type="tel"
                            placeholder="0176 …"
                            value={s.parentPhone || ""}
                            onChange={(e) => onUpdateField(s.id, "parentPhone", e.target.value)}
                            className={inputCls}
                          />
                          {s.parentPhone && (
                            <a
                              href={`tel:${s.parentPhone}`}
                              className="shrink-0 w-9 h-9 rounded-lg akzent-ton flex items-center justify-center"
                              title="Anrufen"
                            >
                              <Phone size={15} />
                            </a>
                          )}
                        </div>
                      </Field>
                    </div>

                    <Field label="Name Eltern/Erziehungsberechtigte">
                      <input
                        placeholder="z. B. Frau Mustermann"
                        value={s.parentName || ""}
                        onChange={(e) => onUpdateField(s.id, "parentName", e.target.value)}
                        className={inputCls}
                      />
                    </Field>

                    <p className="text-[10px] text-stone-400 flex items-center gap-1 -mt-1">
                      <ShieldCheck size={10} className="shrink-0" />
                      Kontaktdaten sind personenbezogen (DSGVO) – nur auf diesem Gerät gespeichert, nicht weitergeben.
                    </p>

                    <Field label="Besonderheiten / Vorerkrankungen">
                      <textarea
                        placeholder="z. B. Nussallergie, Asthma-Spray in der Tasche …"
                        value={s.medicalInfo || ""}
                        onChange={(e) => onUpdateField(s.id, "medicalInfo", e.target.value)}
                        rows={2}
                        className={`${inputCls} resize-none`}
                      />
                      <p className="text-[11px] text-amber-600 mt-1 flex items-start gap-1">
                        <ShieldCheck size={11} className="shrink-0 mt-0.5" />
                        Gesundheitsdaten (Art. 9 DSGVO) – nur mit schriftlicher Einwilligung der Erziehungsberechtigten speichern.
                      </p>
                    </Field>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <StickyNote size={15} className="text-stone-400" />
                        <div className="font-medium text-stone-800 text-sm">Notizen</div>
                      </div>
                      <div className="flex gap-2 mb-2">
                        <input
                          className={inputCls} placeholder="Beobachtung, Info, Elterngespräch …" value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && onAddNote(s.id)}
                        />
                        <Button onClick={() => onAddNote(s.id)}><Plus size={15} /></Button>
                      </div>
                      <ul className="space-y-1.5">
                        {studentNotes.map((n) => (
                          <li key={n.id} className="text-sm bg-stone-50 rounded-lg px-3 py-2 flex justify-between gap-3">
                            <span className="text-stone-700">{n.text}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-stone-400 text-xs whitespace-nowrap">{new Date(n.date).toLocaleDateString("de-DE")}</span>
                              <button onClick={() => onDeleteNote(n.id)} className="text-stone-300 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                          </li>
                        ))}
                        {!studentNotes.length && <li className="text-sm text-stone-400">Noch keine Notizen.</li>}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare size={15} className="text-stone-400" />
                        <div className="font-medium text-stone-800 text-sm">Kindgespräche</div>
                        <span className="text-[10px] text-stone-400 font-normal">Unabhängig vom Unterricht</span>
                      </div>
                      <div className="space-y-2 mb-2">
                        <div className="flex gap-1.5">
                          {MOOD_OPTIONS.map((m) => (
                            <button
                              key={m.key}
                              onClick={() => setGespraechDraft((d) => ({ ...d, mood: m.key }))}
                              title={m.label}
                              className={`flex-1 py-1.5 rounded-lg border text-base transition-colors ${gespraechDraft.mood === m.key ? "akzent-rand akzent-ton" : "border-stone-200 bg-stone-50"}`}
                            >
                              {m.emoji}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <input
                            className={inputCls}
                            placeholder="Was bewegt das Kind, wie geht es ihm/ihr …"
                            value={gespraechDraft.text}
                            onChange={(e) => setGespraechDraft((d) => ({ ...d, text: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && onAddGespraech(s.id)}
                          />
                          <Button onClick={() => onAddGespraech(s.id)}><Plus size={15} /></Button>
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {studentGespraeche.map((g) => {
                          const mood = MOOD_OPTIONS.find((m) => m.key === g.mood);
                          return (
                            <li key={g.id} className="text-sm bg-stone-50 rounded-lg px-3 py-2.5">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm leading-none">{mood?.emoji ?? "💬"}</span>
                                  <span className="text-[11px] font-medium text-stone-500">{new Date(g.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                                </div>
                                <button onClick={() => onDeleteNote(g.id)} className="text-stone-300 hover:text-red-500"><Trash2 size={13} /></button>
                              </div>
                              <p className="text-stone-700 leading-snug">{g.text}</p>
                            </li>
                          );
                        })}
                        {!studentGespraeche.length && <li className="text-sm text-stone-400">Noch keine Gespräche erfasst.</li>}
                      </ul>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {!students.length && <li className="py-3 text-sm text-stone-400">Noch keine Schüler:innen in dieser Klasse.</li>}
        </ul>
      </div>
    </div>
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
          <div className="font-semibold text-stone-800">Klassen versetzen</div>
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
                                          {new Date(eintrag.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
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

        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4">
          <Field label="Bezeichnung">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Tafeldienst" autoFocus />
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

function KlassenTab({ data, update, subTab, setSubTab, onOpenFach }) {
  const [selectedClass, setSelectedClass] = useState(data.classes[0]?.id ?? null);
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [newNote, setNewNote] = useState("");
  const [gespraechDraft, setGespraechDraft] = useState({ text: "", mood: "ok" });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [renamingClass, setRenamingClass] = useState(null);
  const [confirmState, setConfirmState] = useState(null); // { title, message, onConfirm }
  const [expandedClass, setExpandedClass] = useState(null); // aufgeklappte Klassenkarte
  const [renameValue, setRenameValue] = useState("");

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
    update((d) => {
      const cls = d.classes.find((c) => c.id === id);
      if (cls) cls.deletedAt = ts;
      d.students.filter((s) => s.classId === id).forEach((s) => { s.deletedAt = ts; });
      return d;
    });
    if (selectedClass === id) setSelectedClass(null);
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
    update((d) => {
      const existingNames = new Set(d.students.filter((s) => s.classId === selectedClass).map((s) => s.name.toLowerCase()));
      rows.forEach((r) => {
        if (existingNames.has(r.name.toLowerCase())) return;
        d.students.push({ id: uid(), name: r.name, classId: selectedClass, birthday: r.birthday || null });
        existingNames.add(r.name.toLowerCase());
      });
      return d;
    });
    setShowImportModal(false);
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
      d.notes.push({ id: uid(), studentId, date: isoDate(new Date()), text: gespraechDraft.text.trim(), type: "gespraech", mood: gespraechDraft.mood });
      return d;
    });
    setGespraechDraft({ text: "", mood: "ok" });
  }

  function deleteNote(noteId) {
    update((d) => {
      const n = d.notes.find((n) => n.id === noteId);
      if (n) n.deletedAt = isoDate(new Date());
      return d;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Klassen & Schüler</h1>
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
                className={inputCls} value={renameValue} autoFocus
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
          onOpenAdd={() => setShowAddModal(true)}
          onClose={() => { setShowStudentsModal(false); setSelectedStudent(null); }}
        />
      )}

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

  function saveFach({ classId, newClassName, subject, color, room, weights }) {
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
        if (f) { f.classId = finalClassId; f.subject = subject; f.color = color; f.room = room; f.weights = weights || DEFAULT_WEIGHTS; }
      } else {
        d.faecher.push({ id: uid(), classId: finalClassId, subject, color, room, weights: weights || DEFAULT_WEIGHTS });
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
                              ? { backgroundColor: fach.color + "1f", borderColor: fach.color + "40", color: fach.color }
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
      <div className="absolute top-0 left-0 z-20 bg-white border akzent-rand rounded-lg p-1.5 space-y-1 shadow-lg w-24">
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
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 bg-white border akzent-rand rounded-lg p-1.5 space-y-1 shadow-lg w-40">
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

function KalenderTab({ data, update }) {
  const [view, setView] = useState("liste"); // "liste" | "monat"
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [filterDate, setFilterDate] = useState(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState("");
  const [type, setType] = useState("termin");
  const [color, setColor] = useState(TASK_COLORS[0]);
  const [showForm, setShowForm] = useState(false);
  const [showAllFerien, setShowAllFerien] = useState(false);

  const typeLabels = { termin: "Termin", erinnerung: "Erinnerung", ferien: "Ferien" };
  const typeColors = { termin: "bg-amber-100 text-amber-700", erinnerung: "bg-red-100 text-red-700", ferien: "bg-emerald-100 text-emerald-700" };

  function addEvent() {
    if (!title.trim()) return;
    update((d) => {
      d.events.push({ id: uid(), title: title.trim(), date, time, type, color, done: false });
      return d;
    });
    setTitle(""); setTime("");
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
    .filter((e) => !filterDate || e.date === filterDate)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  const open = sorted.filter((e) => !e.done);
  const done = sorted.filter((e) => e.done && e.type !== "ferien");

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
              const dayHasEvents = data.events.filter((e) => (e.endDate ? e.date <= ds && ds <= e.endDate : e.date === ds));
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
                  {!!dayHasEvents.length && (
                    <span className="flex gap-0.5">
                      {dayHasEvents.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: active ? "#ffffff" : e.type === "ferien" ? "#10b981" : (e.color || "#c9702f") }}
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
              Filter für {new Date(filterDate).toLocaleDateString("de-DE")} zurücksetzen
            </button>
          )}
        </Card>
      )}

      <Card className="p-5">
        <div className="font-medium text-stone-800 mb-3">Termine & Erinnerungen</div>
        <ul className="space-y-3">
          {open.filter((e) => e.type !== "ferien").map((e) => (
            <li key={e.id} className="flex items-start gap-2.5 text-sm">
              <button onClick={() => toggleDone(e.id)} className="w-5 h-5 rounded-full border-2 border-stone-300 hover:akzent-rand shrink-0 mt-0.5" />
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: e.color || "#c9702f" }} />
              <div className="flex-1 min-w-0">
                <div className="text-stone-800 leading-snug">{e.title}</div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${typeColors[e.type]}`}>{typeLabels[e.type]}</span>
                  <span className="text-stone-400 text-xs">
                    {new Date(e.date).toLocaleDateString("de-DE")}{e.time ? `, ${e.time}` : ""}
                  </span>
                </div>
              </div>
              <button onClick={() => remove(e.id)} className="text-stone-300 hover:text-red-500 shrink-0 mt-0.5"><Trash2 size={14} /></button>
            </li>
          ))}
          {!open.filter((e) => e.type !== "ferien").length && <li className="text-sm text-stone-400">Keine offenen Termine.</li>}
        </ul>
      </Card>

      {(() => {
        const ferienList = open.filter((e) => e.type === "ferien");
        if (!ferienList.length) return null;
        const visible = showAllFerien ? ferienList : ferienList.slice(0, 1);
        return (
          <Card className="p-5">
            <div className="font-medium text-stone-800 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Schulferien
            </div>
            <ul className="space-y-1.5">
              {visible.map((e) => {
                const von = new Date(e.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
                const bis = e.endDate ? new Date(e.endDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null;
                return (
                  <li key={e.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
                    <span className="text-stone-700">{e.title}</span>
                    <span className="text-stone-400 text-xs tnum whitespace-nowrap text-right">
                      {von}{bis ? <span className="text-stone-300"> – </span> : ""}{bis}
                    </span>
                    <button onClick={() => remove(e.id)} className="text-stone-300 hover:text-red-600 shrink-0 justify-self-end"><Trash2 size={14} /></button>
                  </li>
                );
              })}
            </ul>
            {ferienList.length > 3 && (
              <button
                onClick={() => setShowAllFerien(!showAllFerien)}
                className="mt-3 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
              >
                <ChevronDown size={14} className={showAllFerien ? "rotate-180" : ""} />
                {showAllFerien ? "Weniger anzeigen" : `${ferienList.length - 1} weitere Ferien`}
              </button>
            )}
          </Card>
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
            <input className={inputCls} placeholder="z. B. Elternabend" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEvent()} autoFocus />
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
            <Field label="Farbe">
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
          </div>
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
            <input className={inputCls} placeholder="Aufgabenname eingeben" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
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
                <input className={inputCls} placeholder="Listenname eingeben" value={newListName} onChange={(e) => setNewListName(e.target.value)} autoFocus />
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Aufgaben</h1>

      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        <Card className="p-3 h-fit">
          <div className="space-y-1">
            <button
              onClick={() => setSelected("alle")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selected === "alle" ? "akzent-ton font-medium" : "text-stone-600 hover:bg-stone-50"}`}
            >
              <span className="flex items-center gap-2"><Inbox size={15} /> Alle Aufgaben</span>
              <span className="text-xs text-stone-400">{tasks.filter((t) => !t.done).length}</span>
            </button>
            {lists.map((l) => {
              const Icon = LIST_ICON_MAP[l.icon] || ListChecks;
              const count = tasks.filter((t) => !t.done && t.listId === l.id).length;
              return (
                <div key={l.id} className="group flex items-center">
                  <button
                    onClick={() => setSelected(l.id)}
                    className={`flex-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selected === l.id ? "akzent-ton font-medium" : "text-stone-600 hover:bg-stone-50"}`}
                  >
                    <span className="flex items-center gap-2"><Icon size={15} /> {l.name}</span>
                    <span className="text-xs text-stone-400">{count}</span>
                  </button>
                  <button onClick={() => removeList(l.id)} className="text-stone-300 hover:text-red-500 px-1 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                </div>
              );
            })}
            <button
              onClick={() => setSelected("erledigt")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm ${selected === "erledigt" ? "akzent-ton font-medium" : "text-stone-500 hover:bg-stone-50"}`}
            >
              <span className="flex items-center gap-2"><FolderCheck size={15} /> Erledigt</span>
              <span className="text-xs text-stone-400">{doneCount}</span>
            </button>
          </div>
        </Card>

        <Card className="p-5">
          <ul className="divide-y divide-stone-100">
            {visibleTasks.map((t) => {
              const list = lists.find((l) => l.id === t.listId);
              return (
                <li key={t.id} className="py-2.5 flex items-center gap-3">
                  <button
                    onClick={() => toggleDone(t.id)}
                    className="w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center"
                    style={{ borderColor: t.color, backgroundColor: t.done ? t.color : "transparent" }}
                  >
                    {t.done && <Check size={12} className="text-white" />}
                  </button>
                  <button onClick={() => { setEditingTask(t); setShowModal(true); }} className="flex-1 text-left">
                    <div className={`text-sm ${t.done ? "text-stone-400 line-through" : "text-stone-800"}`}>{t.title}</div>
                    {list && <div className="text-xs text-stone-400">{list.name}</div>}
                  </button>
                  {t.dueDate && (
                    <span className="text-xs bg-stone-900 text-white rounded-full px-2.5 py-1 shrink-0">
                      {new Date(t.dueDate).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}, {t.dueDate.slice(11, 16)}
                    </span>
                  )}
                  <button onClick={() => removeTask(t.id)} className="text-stone-300 hover:text-red-500 shrink-0"><Trash2 size={14} /></button>
                </li>
              );
            })}
            {!visibleTasks.length && <li className="py-6 text-sm text-stone-400 text-center">Keine Aufgaben hier.</li>}
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
      </div>

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
function GradeDistributionBar({ values }) {
  const counts = [1, 2, 3, 4, 5, 6].map((n) => values.filter((v) => Math.round(v) === n).length);
  const bg = ["bg-emerald-700/40", "bg-emerald-600/40", "bg-lime-600/40", "bg-amber-600/40", "bg-orange-600/40", "bg-red-700/40"];
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
function BulkGradeModal({ fach, cls, students, halbjahr, onSave, onClose }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("muendlich");
  const [date, setDate] = useState(isoDate(new Date()));
  const [factor, setFactor] = useState(1);
  const [gradeMap, setGradeMap] = useState({});

  const values = Object.values(gradeMap).filter((v) => v != null);

  function setGrade(studentId, val) {
    setGradeMap((m) => ({ ...m, [studentId]: val === "" ? null : Number(val) }));
  }

  function save() {
    const entries = Object.entries(gradeMap).filter(([, v]) => v != null).map(([studentId, value]) => ({ studentId, value }));
    if (!entries.length) return;
    onSave({ title: title.trim() || `Mitarbeit am ${new Date(date).toLocaleDateString("de-DE")}`, category, date, factor, entries });
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
          <Field label="Faktor (z. B. x2 für Klassenarbeiten)">
            <input className={inputCls} type="number" step="0.5" min="0.5" value={factor} onChange={(e) => setFactor(Number(e.target.value))} />
          </Field>
        </div>

        <div className="mb-4">
          <div className="text-xs text-stone-400 mb-1.5">Verteilung ({values.length} von {students.length} bewertet)</div>
          <GradeDistributionBar values={values} />
        </div>

        <ul className="divide-y divide-stone-100 -mx-1">
          {students.map((s) => (
            <li key={s.id} className="py-2 px-1 flex items-center gap-3">
              <StudentAvatar student={s} size={24} />
              <span className="flex-1 text-sm text-stone-700">{s.name}</span>
              {category === "muendlich" ? (
                <div className="flex gap-1">
                  {QUICK_SYMBOLS.map((qs) => {
                    const active = gradeMap[s.id] === qs.value;
                    return (
                      <button
                        key={qs.symbol}
                        onClick={() => setGrade(s.id, active ? "" : String(qs.value))}
                        className="w-9 h-8 rounded-lg text-sm font-semibold border"
                        style={active ? { backgroundColor: qs.color, borderColor: qs.color, color: "white" } : { borderColor: "#E7E5E4", color: "#78716C" }}
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
          <input className={inputCls} placeholder="z. B. Sportzeug" value={label} onChange={(e) => setLabel(e.target.value)} />
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
            <input type="checkbox" className="w-5 h-5 shrink-0" checked={autoGrade} onChange={(e) => setAutoGrade(e.target.checked)} />
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
        doc.txt(490, new Date(g.date).toLocaleDateString("de-DE"), { size: 9, gray: 0.45 });
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
          doc.para(`– ${n.text} (${new Date(n.date).toLocaleDateString("de-DE")})`, { size: 9, maxChars: 105 });
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
          <Button onClick={downloadPdf}><Printer size={15} /> Als PDF herunterladen</Button>
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
                        <td className="py-1 pl-2 text-stone-500 text-right whitespace-nowrap">{new Date(g.date).toLocaleDateString("de-DE")}</td>
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
                      <li key={n.id}>– {n.text} <span className="text-stone-400">({new Date(n.date).toLocaleDateString("de-DE")})</span></li>
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
    </div>
  );
}

/* Klassenübersicht: alle Kinder eines Fachs auf einen Blick, mit Foto und farbcodierten Noten */
function NotenUebersicht({ students, data, update, fach, halbjahr, selectedStudent, onSelect }) {
  const weights = fach?.weights || DEFAULT_WEIGHTS;
  const colored = data.settings?.notenfarben !== false;
  const [tendencyPopup, setTendencyPopup] = useState(null); // { name, tendency, overall }
  const [sortDir, setSortDir] = useState("az"); // "az" | "za"
  const [nameOrder, setNameOrder] = useState("vorname"); // "vorname" | "nachname"
  const [sportzeugDetail, setSportzeugDetail] = useState(null); // studentId für das Detailfenster

  // Nur im Fach Sport gibt es die Sportzeug-Spalte
  const istSport = /sport/i.test(fach?.subject || "");

  // Nachname = letztes Wort, Vorname(n) = Rest
  function splitName(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length < 2) return { vor: name, nach: "" };
    return { vor: parts.slice(0, -1).join(" "), nach: parts[parts.length - 1] };
  }
  function displayName(name) {
    const { vor, nach } = splitName(name);
    if (!nach) return name;
    return nameOrder === "nachname" ? `${nach}, ${vor}` : name;
  }
  function sortKey(name) {
    const { vor, nach } = splitName(name);
    return (nameOrder === "nachname" ? `${nach} ${vor}` : name).toLowerCase();
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
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600"
        >
          {sortDir === "az" ? "A → Z" : "Z → A"}
        </button>
        <button
          onClick={() => setNameOrder((o) => (o === "vorname" ? "nachname" : "vorname"))}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 text-stone-600"
        >
          {nameOrder === "vorname" ? "Vorname zuerst" : "Nachname zuerst"}
        </button>
        {istSport && <span className="text-[11px] text-stone-400 ml-auto self-center">Tipp auf „Sportz." erfasst vergessenes Sportzeug für heute</span>}
      </div>

    <Card className="p-2 overflow-x-auto">
      <table className="w-full text-sm border-separate border-spacing-y-1 table-fixed">
        <colgroup>
          <col />
          <col className="w-12" />
          <col className={istSport ? "w-20" : "w-12"} />
          <col className="w-14" />
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="text-[10px] text-stone-400 uppercase tracking-wide">
            <th className="text-left font-semibold px-2 pb-1 sticky left-0 z-[2] bg-karte">Name</th>
            <th className="font-semibold pb-1">Mündl.</th>
            <th className="font-semibold pb-1">{istSport ? "Sportz." : "Schr."}</th>
            <th className="font-semibold pb-1">Ges.</th>
            <th className="font-semibold pb-1">Zeugn.</th>
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
                <td className="text-center tnum">
                  {byCat.muendlich ? <span className={`font-semibold ${gradeColor(byCat.muendlich.avg, colored)}`}>{gradeLabel(byCat.muendlich.avg)}</span> : <span className="text-stone-300">—</span>}
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
                <td className="text-center">
                  {overall != null ? (
                    <span className="inline-flex flex-col items-center leading-none">
                      <span className={`text-base font-semibold tnum ${gradeColor(overall, colored)}`}>{gradeLabel(overall)}</span>
                      {tendency && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setTendencyPopup({ name: s.name, tendency, overall }); }}
                          className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center ${tendency.direction === "besseren" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}
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
                <td className="text-center rounded-r-xl">
                  {finalGrade ? (
                    <span className="inline-flex items-center justify-center min-w-7 h-7 px-1 rounded-md bg-stone-900 text-white text-sm font-semibold tnum">{gradeLabel(finalGrade.value)}</span>
                  ) : (
                    <span className="text-stone-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr><td colSpan={5} className="text-sm text-stone-400 py-3 px-2">Keine Schüler:innen in dieser Klasse.</td></tr>
          )}
        </tbody>
      </table>

      {rows.some((r) => r.tendency) && (
        <p className="text-[10px] text-stone-400 mt-2 flex items-center gap-3 px-1">
          <span className="flex items-center gap-1"><TrendingUp size={9} className="text-emerald-600" /> Tendenz zur besseren Note</span>
          <span className="flex items-center gap-1"><TrendingDown size={9} className="text-red-500" /> Tendenz zur schlechteren Note</span>
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
                <button onClick={() => setSportzeugDetail(null)} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
              </div>
              <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                        <span className="text-stone-700 tnum">{new Date(i.date).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}</span>
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
  const colored = data.settings?.notenfarben !== false;
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
          lines.push(`  · ${new Date(i.date).toLocaleDateString("de-DE")}: ${i.note}`);
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
      studentNotes.forEach((n) => lines.push(`– ${n.text} (${new Date(n.date).toLocaleDateString("de-DE")})`));
    }
    if (studentGespraeche.length) {
      lines.push("");
      lines.push("Kindgespräche (was das Kind bewegt):");
      const moodLabel = { gut: "😊", ok: "😐", schlecht: "😟" };
      studentGespraeche.slice(0, 5).forEach((g) => {
        const icon = moodLabel[g.mood] ?? "💬";
        lines.push(`${icon} ${new Date(g.date).toLocaleDateString("de-DE")}: ${g.text}`);
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
    update((d) => {
      d.grades.push({ id: uid(), studentId: selectedStudent, classId: fach.classId, fachId: fach.id, category, value, factor: 1, title: gradeTitle.trim(), date: gdate, halbjahr });
      return d;
    });
    setGradeTitle("");
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

  function saveBulk({ title, category, date, factor, entries }) {
    update((d) => {
      entries.forEach(({ studentId, value }) => {
        d.grades.push({ id: uid(), studentId, classId: fach.classId, fachId: fach.id, category, value, factor, title, date, halbjahr });
      });
      return d;
    });
    setShowBulkModal(false);
  }

  return (
    <div className="space-y-6">
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
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: fach.color }} />
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
                    {!!cFaecher.length && (
                      <div className="text-xs text-stone-400">
                        {offen === 0 ? "Zeugnisnoten vollständig" : `${offen} Zeugnisnote${offen === 1 ? "" : "n"} offen`}
                      </div>
                    )}
                  </div>
                  <ChevronRight size={18} className="text-stone-300 shrink-0" />
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {cFaecher.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-stone-50 text-stone-600"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: f.color }} />
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
                  <span className="w-2.5 h-11 rounded-full shrink-0" style={{ backgroundColor: f.color }} />
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
              <Button variant="subtle" onClick={() => setPrintMode({ type: "class" })}><Printer size={15} /> PDF</Button>
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
              <div className="fixed inset-0 bg-stone-900/40 z-50 flex items-end md:items-center md:justify-center" onClick={() => setSelectedStudent(null)}>
                <div className="bg-stone-50 w-full md:max-w-lg md:rounded-2xl rounded-t-3xl overflow-y-auto sheet " onClick={(e) => e.stopPropagation()}>
                  <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-200 px-4 py-3 flex items-center gap-2.5 z-10 shadow-[0_4px_10px_-6px_rgba(0,0,0,0.15)]">
                    <StudentAvatar student={student} size={34} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-stone-800 leading-tight truncate">{student.name}</div>
                      <div className="text-xs text-stone-400">{cls?.name} · {fach.subject} · {halbjahr}. Halbjahr</div>
                    </div>
                    <button onClick={() => setSelectedStudent(null)} className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
                  </div>

                  <div className="p-4 pt-3 space-y-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <Card className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-medium text-stone-800">Neue Note</div>
                    <Button variant="subtle" onClick={() => setShowGradesList(true)}>Einzelnoten ({studentGrades.length})</Button>
                  </div>
                  <div className="grid md:grid-cols-[130px_90px_1fr_140px_auto] gap-2">
                    <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                      {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select className={inputCls} value={value} onChange={(e) => setValue(Number(e.target.value))}>
                      {GRADE_OPTIONS.map((g) => <option key={g.label} value={g.value}>{g.label}</option>)}
                    </select>
                    <input className={inputCls} placeholder="Bezeichnung, z. B. Stundenbeteiligung" value={gradeTitle} onChange={(e) => setGradeTitle(e.target.value)} />
                    <input className={inputCls} type="date" value={gdate} onChange={(e) => setGdate(e.target.value)} />
                    <Button onClick={addGrade} className="justify-center"><Plus size={15} /></Button>
                  </div>
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
                                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${g.auto ? "bg-amber-400" : g.category === "schriftlich" ? "bg-stone-700" : "akzent-ton0"}`} />
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
                                    {new Date(g.date).toLocaleDateString("de-DE")}
                                    <Settings2 size={12} className="text-stone-300" />
                                  </span>
                                </div>
                                <div className="text-sm text-stone-600 truncate">
                                  {g.title || "—"}{g.auto ? " (automatisch)" : ""}
                                </div>
                                {runningOverall != null && (
                                  <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
                                    Stand danach: <span className={`font-medium ${gradeColor(runningOverall, colored)}`}>{gradeLabel(runningOverall)}</span>
                                    {better && <TrendingUp size={11} className="text-emerald-600" />}
                                    {worse && <TrendingDown size={11} className="text-red-500" />}
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
                  <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={() => setShowSprechtag(false)}>
                    <div className="bg-white w-full md:max-w-lg rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
                      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10">
                        <div className="min-w-0">
                          <div className="font-semibold text-stone-800 leading-tight">Elternsprechtag</div>
                          <div className="text-xs text-stone-400 truncate">{student.name} · {fach.subject}</div>
                        </div>
                        <button onClick={() => setShowSprechtag(false)} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
                      </div>
                      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-4">
                        <div>
                          <div className="text-[11px] font-medium uppercase tracking-wide text-stone-400 mb-1.5">Eigene Notizen fürs Gespräch</div>
                          <textarea
                            className={inputCls + " min-h-[80px] resize-none"}
                            placeholder="z. B. Gesprächsthemen, Absprachen, Beobachtungen …"
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
                                <span key={status} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-stone-100" style={{ color: EXCUSE_STATUS[status]?.color ?? "#555" }}>
                                  {EXCUSE_STATUS[status]?.label ?? status}: {count}×
                                </span>
                              ))}
                            </div>
                            {studentAbsences.slice(0, 4).length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {studentAbsences.slice(0, 4).map((a) => (
                                  <li key={a.id} className="flex items-center gap-2 text-xs text-stone-600">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: EXCUSE_STATUS[a.excuseStatus]?.color ?? "#aaa" }} />
                                    <span className="text-stone-400 shrink-0">{new Date(a.date).toLocaleDateString("de-DE")}</span>
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
                                return (
                                  <li key={g.id} className="flex items-start gap-2 bg-stone-50 rounded-xl px-3 py-2 text-sm">
                                    <span className="text-base shrink-0 leading-snug">{mood?.emoji ?? "💬"}</span>
                                    <span className="flex-1 text-stone-700">{g.text}</span>
                                    <span className="text-stone-400 text-xs whitespace-nowrap shrink-0">{new Date(g.date).toLocaleDateString("de-DE")}</span>
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
                  <div className="fixed inset-0 bg-stone-900/40 flex items-end md:items-center md:justify-center md:p-4 z-50" onClick={() => { setShowGradesList(false); setEditingGrade(null); }}>
                    <div className="bg-white w-full md:max-w-md rounded-t-3xl md:rounded-2xl shadow-xl overflow-y-auto sheet" onClick={(e) => e.stopPropagation()}>
                      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-stone-100 px-4 py-3 flex items-center justify-between z-10">
                        <div className="font-semibold text-stone-800">Einzelnoten – {student.name}</div>
                        <button onClick={() => { setShowGradesList(false); setEditingGrade(null); }} className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center shrink-0"><X size={16} /></button>
                      </div>
                      <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
                                  className="w-5 h-5 shrink-0 rounded accent-current akzent-text"
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
                              <span className="flex-1 text-stone-700 truncate flex items-center gap-1.5">
                                <span className="truncate">{g.title || "—"}{g.factor && g.factor !== 1 ? ` · ×${g.factor}` : ""}</span>
                                {!g.auto && g.reason && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0" title={`${g.reason} vergessen`}>
                                    <AlertTriangle size={9} /> {g.reason}
                                  </span>
                                )}
                              </span>
                              <span className="text-stone-400 text-xs shrink-0 tnum">{new Date(g.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}</span>
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

