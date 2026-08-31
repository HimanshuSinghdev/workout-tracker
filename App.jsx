import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  X,
  TrendingUp,
  Scale,
  Trash2,
  GitCompare,
  Plus,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  ImageOff,
  Download,
  FileUp,
  HeartHandshake,
  LogIn,
  LogOut,
  CloudUpload,
} from "lucide-react";
import { auth, signInWithGoogle, signOutOfGoogle } from "./firebase.js";
import { localStorageBackend } from "./storagePolyfill.js";

const INDEX_KEY = "workoutlog:index";
const photoKey = (id) => `workoutlog:photo:${id}`;

const THUMB_MAX = 140;
const FULL_MAX = 1000;
const THUMB_QUALITY = 0.55;
const FULL_QUALITY = 0.82;

function resizeImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("That file isn't a readable image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#14161A";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function formatDateBadge(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysBetween(a, b) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}

function todayStr() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function nowTimeStr() {
  const d = new Date();
  return d.toTimeString().slice(0, 5);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function Sparkline({ points }) {
  if (points.length < 2) return null;
  const w = 280;
  const h = 48;
  const vals = points.map((p) => p.weight);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (w - 8) + 4;
    const y = h - 4 - ((p.weight - min) / range) * (h - 8);
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <polyline
        className="wt-spark-line"
        points={coords.join(" ")}
        fill="none"
        stroke="#FFD23F"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        className="wt-spark-dot"
        cx={coords[coords.length - 1].split(",")[0]}
        cy={coords[coords.length - 1].split(",")[1]}
        r="3.5"
        fill="#FFD23F"
      />
    </svg>
  );
}

function Toast({ message, tone, onClose }) {
  if (!message) return null;
  return (
    <div
      className="wt-toast"
      style={{
        position: "sticky",
        top: 8,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: tone === "error" ? "#3A1712" : "#1D2A18",
        border: `1px solid ${tone === "error" ? "#7A2E22" : "#3D5C31"}`,
        color: tone === "error" ? "#FFB3A1" : "#C8E6A8",
        borderRadius: 8,
        padding: "10px 12px",
        fontSize: 13,
        fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
        marginBottom: 12,
      }}
    >
      <AlertCircle size={15} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          color: "inherit",
          cursor: "pointer",
          padding: 2,
        }}
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function WorkoutTracker() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: "", tone: "info" });
  const [view, setView] = useState("log");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unit, setUnit] = useState("kg");

  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [pendingFullFile, setPendingFullFile] = useState(null);
  const [formDate, setFormDate] = useState(todayStr());
  const [formTime, setFormTime] = useState(nowTimeStr());
  const [formWeight, setFormWeight] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formError, setFormError] = useState("");

  const [compareAId, setCompareAId] = useState("");
  const [compareBId, setCompareBId] = useState("");
  const [comparePhotos, setComparePhotos] = useState({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [justExported, setJustExported] = useState(false);

  const [user, setUser] = useState(() => auth.currentUser);
  const [offerMigration, setOfferMigration] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleOutsideClick = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [accountMenuOpen]);

  const fileInputRef = useRef(null);
  const importInputRef = useRef(null);

  const notify = useCallback((message, tone = "info") => {
    setToast({ message, tone });
    if (tone !== "error") {
      window.clearTimeout(notify._t);
      notify._t = window.setTimeout(() => setToast({ message: "", tone: "info" }), 3500);
    }
  }, []);

  const loadIndex = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.storage.get(INDEX_KEY, false);
      const list = result && result.value ? JSON.parse(result.value) : [];
      list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      setEntries(list);
    } catch (err) {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIndex();
  }, [loadIndex]);

  const checkForLocalDataToMigrate = useCallback(async () => {
    try {
      const cloudResult = await window.storage.get(INDEX_KEY, false).catch(() => null);
      const cloudHasData = !!(cloudResult && cloudResult.value && JSON.parse(cloudResult.value).length > 0);
      if (cloudHasData) return;
      const localResult = await localStorageBackend.get(INDEX_KEY, false).catch(() => null);
      const localHasData = !!(localResult && localResult.value && JSON.parse(localResult.value).length > 0);
      if (localHasData) setOfferMigration(true);
    } catch (err) {
      // Nothing to migrate, or couldn't check — not worth bothering the user about.
    }
  }, []);

  // Fired by main.jsx whenever Google sign-in state changes, so this
  // component reloads data from whichever backend window.storage now
  // points to (local IndexedDB vs. this user's Firestore data).
  useEffect(() => {
    const handleBackendChanged = (e) => {
      setUser(e.detail.user || null);
      loadIndex();
      if (e.detail.signedIn) {
        checkForLocalDataToMigrate();
      } else {
        setOfferMigration(false);
      }
    };
    window.addEventListener("storage-backend-changed", handleBackendChanged);
    return () => window.removeEventListener("storage-backend-changed", handleBackendChanged);
  }, [loadIndex, checkForLocalDataToMigrate]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      notify(err.message || "Sign-in failed.", "error");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutOfGoogle();
      notify("Signed out. This device will keep using local storage.");
    } catch (err) {
      notify(err.message || "Sign-out failed.", "error");
    }
  };

  const migrateLocalDataToCloud = async () => {
    setMigrating(true);
    try {
      const localResult = await localStorageBackend.get(INDEX_KEY, false);
      const list = JSON.parse(localResult.value);
      for (const entry of list) {
        try {
          const photo = await localStorageBackend.get(photoKey(entry.id), false);
          await window.storage.set(photoKey(entry.id), photo.value, false);
        } catch (err) {
          // This entry just has no saved full photo — fine, skip it.
        }
      }
      await window.storage.set(INDEX_KEY, JSON.stringify(list), false);
      setOfferMigration(false);
      notify(`Imported ${list.length} ${list.length === 1 ? "entry" : "entries"} into your account.`);
      loadIndex();
    } catch (err) {
      notify(err.message || "Couldn't import local data.", "error");
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (entries.length >= 2 && !compareAId && !compareBId) {
      setCompareAId(entries[0].id);
      setCompareBId(entries[entries.length - 1].id);
    }
  }, [entries, compareAId, compareBId]);

  const saveIndex = async (list) => {
    const sorted = [...list].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    await window.storage.set(INDEX_KEY, JSON.stringify(sorted), false);
    return sorted;
  };

  const handleFilePicked = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      setFormError("Choose an image file.");
      return;
    }
    setFormError("");
    try {
      const thumb = await resizeImage(file, THUMB_MAX, THUMB_QUALITY);
      setPendingPhoto(thumb);
      setPendingFullFile(file);
    } catch (err) {
      setFormError(err.message || "Couldn't process that photo.");
    }
  };

  const openForm = () => {
    setFormDate(todayStr());
    setFormTime(nowTimeStr());
    setFormWeight("");
    setFormNote("");
    setPendingPhoto(null);
    setPendingFullFile(null);
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
  };

  const handleSaveEntry = async () => {
    if (!pendingPhoto || !pendingFullFile) {
      setFormError("Add a photo first.");
      return;
    }
    if (!formDate) {
      setFormError("Pick a date.");
      return;
    }
    const weightNum = parseFloat(formWeight);
    if (!formWeight || Number.isNaN(weightNum) || weightNum <= 0) {
      setFormError("Enter a valid weight.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const full = await resizeImage(pendingFullFile, FULL_MAX, FULL_QUALITY);
      const id = uid();
      await window.storage.set(photoKey(id), full, false);
      const entry = {
        id,
        date: formDate,
        time: formTime || "00:00",
        weight: weightNum,
        unit,
        note: formNote.trim(),
        thumb: pendingPhoto,
      };
      const nextList = await saveIndex([...entries, entry]);
      setEntries(nextList);
      setShowForm(false);
      notify("Entry saved.");
    } catch (err) {
      setFormError("Couldn't save this entry. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const nextList = await saveIndex(entries.filter((e) => e.id !== id));
      setEntries(nextList);
      try {
        await window.storage.delete(photoKey(id), false);
      } catch (e) {
        // photo may already be gone; index is the source of truth for the UI
      }
      notify("Entry deleted.");
      if (compareAId === id) setCompareAId("");
      if (compareBId === id) setCompareBId("");
    } catch (err) {
      notify("Couldn't delete that entry. Try again.", "error");
    }
  };

  const handleRemovePhoto = async (id) => {
    try {
      const nextList = await saveIndex(entries.map((e) => (e.id === id ? { ...e, thumb: null } : e)));
      setEntries(nextList);
      try {
        await window.storage.delete(photoKey(id), false);
      } catch (e) {
        // photo may already be gone; index is the source of truth for the UI
      }
      setComparePhotos((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setLightbox(null);
      notify("Photo removed. Entry kept.");
    } catch (err) {
      notify("Couldn't remove that photo. Try again.", "error");
    }
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await window.storage.get(INDEX_KEY, false);
      const list = result && result.value ? JSON.parse(result.value) : [];
      const photos = {};
      for (const entry of list) {
        try {
          const p = await window.storage.get(photoKey(entry.id), false);
          photos[entry.id] = p && p.value ? p.value : null;
        } catch (err) {
          photos[entry.id] = null;
        }
      }
      const payload = {
        app: "TRAIN LOG",
        version: 1,
        exportedAt: new Date().toISOString(),
        unit,
        entries: list,
        photos,
      };
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `train-log-backup-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`Backup saved · ${list.length} ${list.length === 1 ? "entry" : "entries"}.`);
      setJustExported(true);
      window.setTimeout(() => setJustExported(false), 1800);
    } catch (err) {
      notify("Couldn't create a backup. Try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    if (importing) return;
    setImporting(true);
    try {
      const text = await file.text();
      let payload;
      try {
        payload = JSON.parse(text);
      } catch (err) {
        throw new Error("bad-json");
      }
      if (!payload || !Array.isArray(payload.entries)) {
        throw new Error("bad-shape");
      }
      const indexResult = await window.storage.get(INDEX_KEY, false).catch(() => null);
      const existingList = indexResult && indexResult.value ? JSON.parse(indexResult.value) : [];
      const existingIds = new Set(existingList.map((e) => e.id));
      const merged = [...existingList];
      let added = 0;
      for (const incoming of payload.entries) {
        if (!incoming || !incoming.date || typeof incoming.weight !== "number") continue;
        let entry = incoming;
        if (existingIds.has(incoming.id)) {
          entry = { ...incoming, id: uid() };
        }
        existingIds.add(entry.id);
        const photoData = payload.photos ? payload.photos[incoming.id] : null;
        if (photoData) {
          try {
            await window.storage.set(photoKey(entry.id), photoData, false);
          } catch (err) {
            // skip photo if it fails to write, keep the entry
          }
        }
        merged.push(entry);
        added += 1;
      }
      const nextList = await saveIndex(merged);
      setEntries(nextList);
      notify(added > 0 ? `Imported ${added} ${added === 1 ? "entry" : "entries"}.` : "Nothing new to import.");
    } catch (err) {
      notify("Couldn't import that file. Make sure it's a Train Log backup.", "error");
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const fetchFullPhoto = useCallback(
    async (id) => {
      if (!id || comparePhotos[id]) return;
      try {
        const result = await window.storage.get(photoKey(id), false);
        setComparePhotos((prev) => ({ ...prev, [id]: result ? result.value : null }));
      } catch (err) {
        setComparePhotos((prev) => ({ ...prev, [id]: null }));
      }
    },
    [comparePhotos]
  );

  useEffect(() => {
    if (view !== "compare") return;
    setCompareLoading(true);
    Promise.all([fetchFullPhoto(compareAId), fetchFullPhoto(compareBId)]).finally(() =>
      setCompareLoading(false)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, compareAId, compareBId]);

  const openLightbox = async (entry) => {
    setLightbox({ entry, src: entry.thumb });
    try {
      const result = await window.storage.get(photoKey(entry.id), false);
      if (result && result.value) {
        setLightbox({ entry, src: result.value });
      }
    } catch (err) {
      // keep showing the thumbnail if the full photo can't load
    }
  };

  const sortedDesc = [...entries].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  const sortedAsc = [...entries].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const sparkPoints = sortedAsc.map((e) => ({ weight: e.weight, id: e.id }));

  const entryA = entries.find((e) => e.id === compareAId);
  const entryB = entries.find((e) => e.id === compareBId);
  const dayIndexOf = (id) => sortedAsc.findIndex((e) => e.id === id) + 1;

  const styles = {
    page: {
      fontFamily: "ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace",
      background: "#14161A",
      color: "#EDEEEC",
      minHeight: "100%",
      padding: "20px 16px 40px",
      boxSizing: "border-box",
      maxWidth: 720,
      margin: "0 auto",
      position: "relative",
    },
  };

  return (
    <div style={styles.page}>
      <style>{`
        * { box-sizing: border-box; }
        input, select, textarea, button { font-family: inherit; }
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=time]::-webkit-calendar-picker-indicator { filter: invert(1); opacity: 0.6; }
        ::placeholder { color: #5B6069; }

        @keyframes wt-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes wt-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes wt-card-in {
          from { opacity: 0; transform: translateY(10px) scale(0.99); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wt-sheet-in {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wt-pop-in {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wt-toast-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wt-glow-pulse {
          0%, 100% { box-shadow: 0 4px 14px rgba(255,210,63,0.28); }
          50% { box-shadow: 0 4px 22px rgba(255,210,63,0.55); }
        }
        @keyframes wt-draw-line {
          from { stroke-dashoffset: 340; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes wt-pop-dot {
          from { r: 0; opacity: 0; }
          to { opacity: 1; }
        }

        .wt-btn { transition: transform 0.08s ease, background 0.15s ease, box-shadow 0.2s ease; }
        .wt-btn:active { transform: scale(0.97); }
        .wt-ghost:hover:not(:disabled) { border-color: #3D424B !important; color: #EDEEEC !important; }
        .wt-card {
          animation: wt-card-in 0.36s cubic-bezier(0.16, 1, 0.3, 1) both;
          transition: transform 0.18s ease, border-color 0.18s ease;
        }
        .wt-card:hover { border-color: #3A3F47 !important; transform: translateY(-2px); }
        .wt-fab {
          animation: wt-glow-pulse 2.6s ease-in-out infinite;
        }
        .wt-fab:hover { transform: translateY(-1px) scale(1.015); }
        .wt-spark-line {
          stroke-dasharray: 340;
          animation: wt-draw-line 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .wt-spark-dot { animation: wt-pop-in 0.25s ease 0.7s both; }
        .wt-trend-card { animation: wt-card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .wt-toast { animation: wt-toast-in 0.25s ease both; }
        .wt-sheet { animation: wt-sheet-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .wt-sheet-overlay { animation: wt-fade-in 0.2s ease both; }
        .wt-lightbox-overlay { animation: wt-fade-in 0.2s ease both; }
        .wt-lightbox-img { animation: wt-pop-in 0.28s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .wt-footer { animation: wt-fade-in 0.6s ease 0.1s both; }

        @media (prefers-reduced-motion: reduce) {
          .wt-card, .wt-fab, .wt-spark-line, .wt-spark-dot, .wt-trend-card,
          .wt-toast, .wt-sheet, .wt-sheet-overlay, .wt-lightbox-overlay,
          .wt-lightbox-img, .wt-footer {
            animation: none !important;
          }
          .wt-fab { box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important; }
        }
      `}</style>

      <header
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px solid #262A31",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'Arial Black', Arial, sans-serif",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              lineHeight: 1,
            }}
          >
            TRAIN LOG
          </div>
          <div style={{ fontSize: 11, color: "#9099A3", marginTop: 6, letterSpacing: "0.5px" }}>
            {entries.length} {entries.length === 1 ? "ENTRY" : "ENTRIES"} LOGGED
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              transform: "rotate(-3deg)",
              border: "1.5px solid #FFD23F",
              color: "#FFD23F",
              fontFamily: "'Arial Black', Arial, sans-serif",
              fontSize: 12,
              fontWeight: 900,
              padding: "4px 8px",
              borderRadius: 3,
            }}
          >
            DAY {String(entries.length).padStart(3, "0")}
          </div>

          <div ref={accountMenuRef} style={{ position: "relative" }}>
            <button
          onClick={() => setAccountMenuOpen((v) => !v)}
          aria-label={user ? "Account menu" : "Sign in with Google"}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: user ? "none" : "1.5px solid #3A3F47",
            background: user ? "transparent" : "#1B1E24",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {user && user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <LogIn size={14} color="#9099A3" />
          )}
        </button>

        {accountMenuOpen && (
          <div
            style={{
              position: "absolute",
              top: 38,
              right: 0,
              minWidth: 210,
              background: "#1B1E24",
              border: "1px solid #2A2E35",
              borderRadius: 10,
              padding: 12,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
              fontSize: 12,
              animation: "wt-pop-in 0.12s ease-out",
            }}
          >
            {user ? (
              <>
                <div style={{ color: "#EDEEEC", fontWeight: 700, marginBottom: 2, wordBreak: "break-word" }}>
                  {user.displayName || "Signed in"}
                </div>
                <div style={{ color: "#9099A3", marginBottom: 10, wordBreak: "break-word" }}>
                  {user.email}
                </div>
                <button
                  className="wt-btn"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleSignOut();
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </>
            ) : (
              <>
                <div style={{ color: "#9099A3", marginBottom: 10 }}>
                  Sign in to sync your entries across devices.
                </div>
                <button
                  className="wt-btn"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    handleSignIn();
                  }}
                  style={{
                    width: "100%",
                    padding: "6px 10px",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <LogIn size={13} /> Sign in with Google
                </button>
              </>
            )}
          </div>
        )}
          </div>
        </div>
      </header>

      {offerMigration && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#1D2A18",
            border: "1px solid #3D5C31",
            color: "#C8E6A8",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            marginBottom: 16,
          }}
        >
          <CloudUpload size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            Found entries saved on this device from before you signed in. Import them into your account?
          </span>
          <button
            className="wt-btn"
            onClick={migrateLocalDataToCloud}
            disabled={migrating}
            style={{ padding: "4px 10px", fontSize: 11 }}
          >
            {migrating ? "Importing…" : "Import"}
          </button>
          <button
            onClick={() => setOfferMigration(false)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <Toast message={toast.message} tone={toast.tone} onClose={() => setToast({ message: "", tone: "info" })} />

      <nav style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          className="wt-btn"
          onClick={() => setView("log")}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 6,
            border: `1px solid ${view === "log" ? "#FFD23F" : "#262A31"}`,
            background: view === "log" ? "rgba(255,210,63,0.08)" : "#1D2025",
            color: view === "log" ? "#FFD23F" : "#9099A3",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.5px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Scale size={14} /> LOG
        </button>
        <button
          className="wt-btn"
          onClick={() => setView("compare")}
          disabled={entries.length < 2}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 6,
            border: `1px solid ${view === "compare" ? "#FFD23F" : "#262A31"}`,
            background: view === "compare" ? "rgba(255,210,63,0.08)" : "#1D2025",
            color: entries.length < 2 ? "#4A4E56" : view === "compare" ? "#FFD23F" : "#9099A3",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.5px",
            cursor: entries.length < 2 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
          title={entries.length < 2 ? "Log at least 2 entries to compare" : "Compare two days"}
        >
          <GitCompare size={14} /> COMPARE
        </button>
      </nav>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 20,
          marginTop: -10,
        }}
      >
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(e) => handleImportFile(e.target.files && e.target.files[0])}
        />
        <button
          className="wt-btn wt-ghost"
          onClick={handleExport}
          disabled={exporting || entries.length === 0}
          title={entries.length === 0 ? "Nothing to back up yet" : "Download a backup of your log"}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: `1px solid ${justExported ? "#3D5C31" : "#262A31"}`,
            background: justExported ? "rgba(143,209,107,0.08)" : "transparent",
            color: entries.length === 0 ? "#4A4E56" : justExported ? "#8FD16B" : "#9099A3",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.4px",
            cursor: exporting || entries.length === 0 ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {exporting ? (
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          ) : justExported ? (
            <Check size={13} />
          ) : (
            <Download size={13} />
          )}
          {justExported ? "SAVED" : "EXPORT"}
        </button>
        <button
          className="wt-btn wt-ghost"
          onClick={() => importInputRef.current && importInputRef.current.click()}
          disabled={importing}
          title="Restore entries from a backup file"
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid #262A31",
            background: "transparent",
            color: "#9099A3",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.4px",
            cursor: importing ? "default" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {importing ? (
            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
          ) : (
            <FileUp size={13} />
          )}
          {importing ? "IMPORTING" : "IMPORT"}
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9099A3", padding: "40px 0", justifyContent: "center", fontSize: 13 }}>
          <Loader2 size={16} className="wt-spin" style={{ animation: "spin 1s linear infinite" }} />
          Loading your log...
        </div>
      ) : view === "log" ? (
        <>
          {sparkPoints.length >= 2 && (
            <div
              className="wt-trend-card"
              style={{
                background: "#1D2025",
                border: "1px solid #262A31",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 10, color: "#9099A3", letterSpacing: "0.5px", marginBottom: 4 }}>
                  WEIGHT TREND
                </div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {sparkPoints[sparkPoints.length - 1].weight} {entries[0]?.unit || unit}
                </div>
              </div>
              <Sparkline points={sparkPoints} />
            </div>
          )}

          {sortedDesc.length === 0 ? (
            <div
              style={{
                border: "1px dashed #333842",
                borderRadius: 8,
                padding: "36px 20px",
                textAlign: "center",
                color: "#9099A3",
                fontSize: 13,
              }}
            >
              <ImageOff size={22} style={{ marginBottom: 10, opacity: 0.6 }} />
              <div style={{ marginBottom: 4, color: "#EDEEEC", fontWeight: 700 }}>No entries yet</div>
              <div>Log your first after-workout photo to start the streak.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sortedDesc.map((entry) => {
                const idx = dayIndexOf(entry.id);
                const prev = sortedAsc[idx - 2];
                const delta = prev ? +(entry.weight - prev.weight).toFixed(1) : null;
                return (
                  <div
                    key={entry.id}
                    className="wt-card"
                    style={{
                      display: "flex",
                      gap: 12,
                      background: "#1D2025",
                      border: "1px solid #262A31",
                      borderRadius: 8,
                      padding: 10,
                      alignItems: "center",
                      animationDelay: `${Math.min(idx, 12) * 35}ms`,
                    }}
                  >
                    <button
                      onClick={() => entry.thumb && openLightbox(entry)}
                      style={{
                        width: 56,
                        height: 56,
                        flexShrink: 0,
                        borderRadius: 5,
                        overflow: "hidden",
                        border: "1px solid #333842",
                        padding: 0,
                        cursor: entry.thumb ? "pointer" : "default",
                        background: "#101215",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label={entry.thumb ? "View photo" : "No photo"}
                    >
                      {entry.thumb ? (
                        <img src={entry.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : (
                        <ImageOff size={18} color="#4A4E56" />
                      )}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{formatDateBadge(entry.date)}</span>
                        <span style={{ fontSize: 11, color: "#9099A3" }}>{entry.time}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "#FFD23F" }}>
                          {entry.weight} {entry.unit}
                        </span>
                        {delta !== null && delta !== 0 && (
                          <span style={{ fontSize: 11, color: delta > 0 ? "#FF8A6B" : "#8FD16B" }}>
                            {delta > 0 ? "+" : ""}
                            {delta}
                          </span>
                        )}
                      </div>
                      {entry.note && (
                        <div style={{ fontSize: 11, color: "#9099A3", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {entry.note}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#5B6069",
                        cursor: "pointer",
                        padding: 6,
                        flexShrink: 0,
                      }}
                      aria-label="Delete entry"
                      title="Delete entry"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <button
            className="wt-btn wt-fab"
            onClick={openForm}
            style={{
              position: "sticky",
              bottom: 16,
              width: "100%",
              marginTop: 20,
              padding: "13px 16px",
              borderRadius: 8,
              border: "none",
              background: "#FFD23F",
              color: "#14161A",
              fontWeight: 900,
              fontSize: 13,
              letterSpacing: "0.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Plus size={16} /> LOG TODAY
          </button>

          <div
            className="wt-footer"
            style={{
              textAlign: "center",
              fontSize: 10,
              letterSpacing: "0.5px",
              color: "#4A4E56",
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
            }}
          >
            <HeartHandshake size={11} style={{ opacity: 0.8 }} />
            CRAFTED BY HIMANSHU
          </div>
        </>
      ) : (
        <div>
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {[
              { label: "DAY A", value: compareAId, set: setCompareAId },
              { label: "DAY B", value: compareBId, set: setCompareBId },
            ].map((sel) => (
              <div key={sel.label} style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#9099A3", marginBottom: 4, letterSpacing: "0.5px" }}>{sel.label}</div>
                <select
                  value={sel.value}
                  onChange={(e) => sel.set(e.target.value)}
                  style={{
                    width: "100%",
                    background: "#1D2025",
                    color: "#EDEEEC",
                    border: "1px solid #262A31",
                    borderRadius: 6,
                    padding: "9px 8px",
                    fontSize: 12,
                  }}
                >
                  {sortedAsc.map((e, i) => (
                    <option key={e.id} value={e.id}>
                      Day {i + 1} · {formatDateBadge(e.date)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {compareLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0", color: "#9099A3", fontSize: 13 }}>
              <Loader2 size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
              Loading photos...
            </div>
          ) : entryA && entryB ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {[
                  { entry: entryA, id: compareAId, label: `DAY ${dayIndexOf(compareAId)}` },
                  { entry: entryB, id: compareBId, label: `DAY ${dayIndexOf(compareBId)}` },
                ].map(({ entry, id, label }) => (
                  <div key={id} style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 8,
                        overflow: "hidden",
                        border: "1px solid #262A31",
                        background: "#101215",
                        aspectRatio: "3 / 4",
                      }}
                    >
                      {comparePhotos[id] || entry.thumb ? (
                        <img
                          src={comparePhotos[id] || entry.thumb}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <ImageOff size={24} color="#4A4E56" />
                        </div>
                      )}
                      <div
                        style={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          background: "rgba(20,22,26,0.85)",
                          border: "1px solid #FFD23F",
                          color: "#FFD23F",
                          fontSize: 10,
                          fontWeight: 900,
                          padding: "3px 6px",
                          borderRadius: 3,
                          letterSpacing: "0.5px",
                        }}
                      >
                        {label}
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{entry.weight} {entry.unit}</div>
                      <div style={{ fontSize: 10, color: "#9099A3" }}>{formatDateBadge(entry.date)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <div style={{ background: "#1D2025", border: "1px solid #262A31", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9099A3", letterSpacing: "0.5px", marginBottom: 4 }}>
                    DAYS ELAPSED
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {Math.abs(daysBetween(entryA.date, entryB.date))}
                  </div>
                </div>
                <div style={{ background: "#1D2025", border: "1px solid #262A31", borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#9099A3", letterSpacing: "0.5px", marginBottom: 4 }}>
                    WEIGHT CHANGE
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color:
                        entryB.weight - entryA.weight === 0
                          ? "#EDEEEC"
                          : entryB.weight - entryA.weight > 0
                          ? "#FF8A6B"
                          : "#8FD16B",
                    }}
                  >
                    {entryB.weight - entryA.weight > 0 ? "+" : ""}
                    {(entryB.weight - entryA.weight).toFixed(1)} {entryA.unit}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: "#9099A3", fontSize: 13, textAlign: "center", padding: "30px 0" }}>
              Pick two days to compare.
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div
          className="wt-sheet-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,11,13,0.72)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={closeForm}
        >
          <div
            className="wt-sheet"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#1A1C21",
              borderRadius: "14px 14px 0 0",
              border: "1px solid #262A31",
              borderBottom: "none",
              padding: "18px 18px 22px",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontFamily: "'Arial Black', Arial, sans-serif", fontSize: 16, fontWeight: 900 }}>
                LOG ENTRY
              </div>
              <button
                onClick={closeForm}
                style={{ background: "none", border: "none", color: "#9099A3", cursor: "pointer", padding: 4 }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => handleFilePicked(e.target.files && e.target.files[0])}
            />

            {pendingPhoto ? (
              <div style={{ position: "relative", marginBottom: 14 }}>
                <img
                  src={pendingPhoto}
                  alt="Selected"
                  style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 8, border: "1px solid #262A31", display: "block" }}
                />
                <button
                  onClick={() => {
                    setPendingPhoto(null);
                    setPendingFullFile(null);
                  }}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(20,22,26,0.85)",
                    border: "1px solid #333842",
                    color: "#EDEEEC",
                    borderRadius: 6,
                    padding: 6,
                    cursor: "pointer",
                  }}
                  aria-label="Remove photo"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  className="wt-btn"
                  onClick={() => fileInputRef.current && fileInputRef.current.click()}
                  style={{
                    flex: 1,
                    padding: "22px 10px",
                    borderRadius: 8,
                    border: "1px dashed #333842",
                    background: "#14161A",
                    color: "#9099A3",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <Camera size={20} />
                  Camera
                </button>
                <label
                  className="wt-btn"
                  style={{
                    flex: 1,
                    padding: "22px 10px",
                    borderRadius: 8,
                    border: "1px dashed #333842",
                    background: "#14161A",
                    color: "#9099A3",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  <Upload size={20} />
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleFilePicked(e.target.files && e.target.files[0])}
                  />
                </label>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#9099A3", marginBottom: 4 }}>DATE</div>
                <input
                  type="date"
                  value={formDate}
                  max={todayStr()}
                  onChange={(e) => setFormDate(e.target.value)}
                  style={{ width: "100%", background: "#14161A", color: "#EDEEEC", border: "1px solid #262A31", borderRadius: 6, padding: "9px 8px", fontSize: 13 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#9099A3", marginBottom: 4 }}>TIME</div>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  style={{ width: "100%", background: "#14161A", color: "#EDEEEC", border: "1px solid #262A31", borderRadius: 6, padding: "9px 8px", fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "#9099A3", marginBottom: 4 }}>WEIGHT</div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder="0.0"
                  value={formWeight}
                  onChange={(e) => setFormWeight(e.target.value)}
                  style={{ width: "100%", background: "#14161A", color: "#EDEEEC", border: "1px solid #262A31", borderRadius: 6, padding: "9px 8px", fontSize: 13 }}
                />
              </div>
              <div style={{ width: 90 }}>
                <div style={{ fontSize: 10, color: "#9099A3", marginBottom: 4 }}>UNIT</div>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  style={{ width: "100%", background: "#14161A", color: "#EDEEEC", border: "1px solid #262A31", borderRadius: 6, padding: "9px 8px", fontSize: 13 }}
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: "#9099A3", marginBottom: 4 }}>NOTE (OPTIONAL)</div>
              <input
                type="text"
                placeholder="Leg day, felt strong"
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                maxLength={80}
                style={{ width: "100%", background: "#14161A", color: "#EDEEEC", border: "1px solid #262A31", borderRadius: 6, padding: "9px 8px", fontSize: 13 }}
              />
            </div>

            {formError && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#FF8A6B", fontSize: 12, marginBottom: 12 }}>
                <AlertCircle size={13} /> {formError}
              </div>
            )}

            <button
              className="wt-btn"
              onClick={handleSaveEntry}
              disabled={saving}
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 8,
                border: "none",
                background: saving ? "#8A7A2E" : "#FFD23F",
                color: "#14161A",
                fontWeight: 900,
                fontSize: 13,
                letterSpacing: "0.5px",
                cursor: saving ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {saving ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> SAVING
                </>
              ) : (
                <>
                  <Check size={15} /> SAVE ENTRY
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="wt-lightbox-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(10,11,13,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 20,
          }}
          onClick={() => setLightbox(null)}
        >
          <img
            className="wt-lightbox-img"
            src={lightbox.src}
            alt=""
            style={{ maxWidth: "100%", maxHeight: "78vh", borderRadius: 8, border: "1px solid #262A31" }}
          />
          <div style={{ marginTop: 14, color: "#EDEEEC", fontSize: 13, textAlign: "center" }}>
            <div style={{ fontWeight: 700 }}>{formatDateBadge(lightbox.entry.date)} · {lightbox.entry.weight} {lightbox.entry.unit}</div>
            {lightbox.entry.note && <div style={{ color: "#9099A3", marginTop: 4 }}>{lightbox.entry.note}</div>}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm("Remove this photo? The entry (date, weight, note) will be kept.")) {
                handleRemovePhoto(lightbox.entry.id);
              }
            }}
            className="wt-btn"
            style={{
              marginTop: 14,
              background: "transparent",
              border: "1px solid #7A2E22",
              color: "#FF8A6B",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Trash2 size={14} /> REMOVE PHOTO
          </button>
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(29,32,37,0.9)",
              border: "1px solid #333842",
              color: "#EDEEEC",
              borderRadius: 8,
              padding: 8,
              cursor: "pointer",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
