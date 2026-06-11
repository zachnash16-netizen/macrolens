import { useState, useEffect, useRef } from "react";

// ─── Palette & Globals ───────────────────────────────────────────────────────
const COLORS = {
  bg: "#0a0a0f",
  surface: "#12121a",
  card: "#1a1a26",
  border: "#2a2a3f",
  accent: "#7c6fff",
  accentGlow: "rgba(124,111,255,0.25)",
  green: "#3dffa0",
  orange: "#ff8c42",
  red: "#ff4d6d",
  text: "#e8e8f0",
  muted: "#7070a0",
};

// ─── Storage Helpers (localStorage) ──────────────────────────────────────────
const STORAGE_KEY = "macrolens_data";
const loadData = async () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const saveData = async (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
};

const DEFAULT_PROFILE = (id, name) => ({
  id,
  name,
  avatar: name[0].toUpperCase(),
  goal: "maintain",
  calories: 2000,
  protein: 150,
  carbs: 225,
  fat: 67,
  weight: "",
  height: "",
  age: "",
  activityLevel: "moderate",
  logs: [],
});

const GOAL_PRESETS = {
  cut:      { label: "Cut (Fat Loss)",     calories: 1600, protein: 180, carbs: 120, fat: 55 },
  maintain: { label: "Maintain",           calories: 2000, protein: 150, carbs: 225, fat: 67 },
  bulk:     { label: "Bulk (Muscle Gain)", calories: 2600, protein: 200, carbs: 325, fat: 80 },
  keto:     { label: "Keto",              calories: 1800, protein: 150, carbs: 25,  fat: 140 },
  custom:   { label: "Custom",            calories: 2000, protein: 150, carbs: 225, fat: 67 },
};

const todayStr = () => new Date().toISOString().split("T")[0];
const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// ─── Macro Donut ─────────────────────────────────────────────────────────────
function MacroDonut({ value, max, color, label, unit = "g", size = 80 }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / (max || 1), 1);
  const dash = pct * circ;
  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={COLORS.border} strokeWidth={8} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 9, color: COLORS.muted }}>{unit}</div>
      </div>
      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{label}</div>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function MacroBar({ label, value, max, color, unit = "g" }) {
  const pct = Math.min((value / (max || 1)) * 100, 100);
  const over = value > max;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
        <span style={{ color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>{label}</span>
        <span style={{ color: over ? COLORS.red : color, fontWeight: 600 }}>
          {value}<span style={{ color: COLORS.muted }}>/{max}{unit}</span>
        </span>
      </div>
      <div style={{ height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: over ? COLORS.red : color,
          borderRadius: 3, transition: "width 0.5s ease",
          boxShadow: `0 0 8px ${over ? COLORS.red : color}80` }} />
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function MacroLens() {
  const [appData, setAppData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("dashboard");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [pendingMeal, setPendingMeal] = useState(null);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    (async () => {
      const saved = await loadData();
      if (saved && saved.users && saved.users.length > 0) {
        setAppData(saved);
      } else {
        const defaultUser = DEFAULT_PROFILE("user_1", "Me");
        setAppData({ users: [defaultUser], activeUserId: "user_1" });
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded && appData) saveData(appData);
  }, [appData, loaded]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const activeUser = appData?.users?.find(u => u.id === appData.activeUserId);

  const updateUser = (updates) => {
    setAppData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === prev.activeUserId ? { ...u, ...updates } : u)
    }));
  };

  const getTodayLog = () => {
    const today = todayStr();
    return activeUser?.logs?.find(l => l.date === today) || { date: today, meals: [] };
  };

  const addMealToToday = (meal) => {
    const today = todayStr();
    const logs = [...(activeUser?.logs || [])];
    const idx = logs.findIndex(l => l.date === today);
    if (idx >= 0) logs[idx] = { ...logs[idx], meals: [...logs[idx].meals, meal] };
    else logs.push({ date: today, meals: [meal] });
    updateUser({ logs });
  };

  const deleteMeal = (mealId) => {
    const today = todayStr();
    const logs = [...(activeUser?.logs || [])];
    const idx = logs.findIndex(l => l.date === today);
    if (idx >= 0) logs[idx] = { ...logs[idx], meals: logs[idx].meals.filter(m => m.id !== mealId) };
    setAppData(prev => ({ ...prev, users: prev.users.map(u => u.id === prev.activeUserId ? { ...u, logs } : u) }));
    showToast("Meal removed");
  };

  // ── AI Analysis via Vercel proxy ─────────────────────────────────────────
  const analyzeImage = async (base64, mediaType) => {
    setAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError("");
    try {
      const resp = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mediaType }),
      });
      const data = await resp.json();
      const text = data.content?.find(b => b.type === "text")?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      setAnalysisResult(parsed);
      setPendingMeal({
        id: `meal_${Date.now()}`,
        name: parsed.mealName,
        image: `data:${mediaType};base64,${base64}`,
        calories: parsed.totals.calories,
        protein: parsed.totals.protein,
        carbs: parsed.totals.carbs,
        fat: parsed.totals.fat,
        time: nowTime(),
        items: parsed.items,
        notes: parsed.notes,
        confidence: parsed.confidence,
      });
    } catch (e) {
      setAnalysisError("Could not analyze image. Please try again with a clearer photo.");
    }
    setAnalyzing(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const mediaType = file.type || "image/jpeg";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setCapturedImage(ev.target.result);
      analyzeImage(base64, mediaType);
    };
    reader.readAsDataURL(file);
  };

  const confirmMeal = () => {
    if (!pendingMeal) return;
    addMealToToday(pendingMeal);
    setPendingMeal(null);
    setCapturedImage(null);
    setAnalysisResult(null);
    setView("dashboard");
    showToast("Meal logged! 🎯");
  };

  const discardScan = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setPendingMeal(null);
    setAnalysisError("");
    setView("dashboard");
  };

  const todayLog = getTodayLog();
  const todayTotals = todayLog.meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const calPct = Math.round((todayTotals.calories / (activeUser?.calories || 2000)) * 100);

  if (!loaded) return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: COLORS.accent, fontFamily: "monospace", fontSize: 14 }}>LOADING MACROLENS...</div>
    </div>
  );

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: COLORS.text, maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: ${COLORS.bg}; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
        input, select, textarea { outline: none; }
        button { cursor: pointer; border: none; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes slideUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        .fade-in { animation: fadeIn 0.35s ease forwards; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999,
          background: toast.type === "error" ? COLORS.red : COLORS.green, color: "#000",
          padding: "10px 20px", borderRadius: 20, fontSize: 13, fontWeight: 600,
          animation: "slideUp 0.3s ease", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.msg}
        </div>
      )}

      <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: COLORS.muted, fontFamily: "'DM Mono', monospace", textTransform: "uppercase" }}>MacroLens</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {view === "dashboard" && `Hey, ${activeUser?.name?.split(" ")[0] || "there"} 👋`}
            {view === "scan" && "Scan Meal"}
            {view === "log" && "Today's Log"}
            {view === "profile" && "Profile & Goals"}
            {view === "users" && "Switch Profile"}
          </div>
        </div>
        <button onClick={() => setView("users")} style={{ width: 42, height: 42, borderRadius: "50%",
          background: COLORS.accent, color: "#fff", fontSize: 16, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 16px ${COLORS.accentGlow}` }}>
          {activeUser?.avatar || "?"}
        </button>
      </div>

      {view === "dashboard" && <DashboardView user={activeUser} todayTotals={todayTotals} todayLog={todayLog} calPct={calPct} setView={setView} deleteMeal={deleteMeal} />}
      {view === "scan" && (
        <ScanView capturedImage={capturedImage} analyzing={analyzing} analysisResult={analysisResult}
          analysisError={analysisError} pendingMeal={pendingMeal}
          fileInputRef={fileInputRef} handleFileSelect={handleFileSelect}
          confirmMeal={confirmMeal} discardScan={discardScan}
          setPendingMeal={setPendingMeal} />
      )}
      {view === "log" && <LogView user={activeUser} deleteMeal={deleteMeal} />}
      {view === "profile" && <ProfileView user={activeUser} updateUser={updateUser} showToast={showToast} />}
      {view === "users" && <UsersView appData={appData} setAppData={setAppData} setView={setView} showToast={showToast} />}

      {view !== "scan" && (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 480, background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`, display: "flex", padding: "8px 0" }}>
          {[
            { id: "dashboard", icon: "⊞", label: "Home" },
            { id: "log", icon: "📋", label: "Log" },
            { id: "scan", icon: "◎", label: "Scan", primary: true },
            { id: "profile", icon: "◈", label: "Goals" },
          ].map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              style={{ flex: 1, background: "none", padding: "6px 0", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 3, color: view === item.id ? COLORS.accent : COLORS.muted }}>
              {item.primary
                ? <div style={{ width: 48, height: 48, borderRadius: "50%", background: COLORS.accent,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginTop: -20,
                    boxShadow: `0 0 20px ${COLORS.accentGlow}` }}>{item.icon}</div>
                : <span style={{ fontSize: 20 }}>{item.icon}</span>
              }
              <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function DashboardView({ user, todayTotals, todayLog, calPct, setView, deleteMeal }) {
  const remaining = (user?.calories || 2000) - todayTotals.calories;
  const calorieColor = remaining < 0 ? COLORS.red : remaining < 200 ? COLORS.orange : COLORS.green;

  const weekData = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const log = user?.logs?.find(l => l.date === ds);
    const cals = log ? log.meals.reduce((a, m) => a + (m.calories || 0), 0) : 0;
    weekData.push({ day: d.toLocaleDateString("en", { weekday: "short" })[0], cals, isToday: i === 0 });
  }
  const maxCals = Math.max(...weekData.map(d => d.cals), user?.calories || 2000);

  return (
    <div style={{ padding: "20px" }} className="fade-in">
      <div style={{ background: COLORS.card, borderRadius: 20, padding: 24, marginBottom: 16,
        border: `1px solid ${COLORS.border}`, textAlign: "center", boxShadow: `0 0 40px ${COLORS.accentGlow}` }}>
        <div style={{ position: "relative", display: "inline-block" }}>
          <svg width={160} height={160} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={80} cy={80} r={68} fill="none" stroke={COLORS.border} strokeWidth={12} />
            <circle cx={80} cy={80} r={68} fill="none" stroke={calorieColor} strokeWidth={12}
              strokeDasharray={`${Math.min(calPct, 100) / 100 * (2 * Math.PI * 68)} ${2 * Math.PI * 68}`}
              strokeLinecap="round" style={{ transition: "stroke-dasharray 0.8s ease", filter: `drop-shadow(0 0 8px ${calorieColor})` }} />
          </svg>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: calorieColor }}>{todayTotals.calories}</div>
            <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace" }}>KCAL</div>
            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>of {user?.calories || 2000}</div>
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: remaining < 0 ? COLORS.red : COLORS.text }}>
          {remaining < 0 ? `${Math.abs(remaining)} kcal over` : `${remaining} kcal remaining`}
        </div>
      </div>

      <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, marginBottom: 16, border: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-around" }}>
        <MacroDonut value={todayTotals.protein} max={user?.protein || 150} color={COLORS.accent} label="PROTEIN" />
        <MacroDonut value={todayTotals.carbs} max={user?.carbs || 225} color={COLORS.orange} label="CARBS" />
        <MacroDonut value={todayTotals.fat} max={user?.fat || 67} color={COLORS.green} label="FAT" />
      </div>

      <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 16 }}>7-DAY CALORIES</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
          {weekData.map((d, i) => (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: "100%", background: d.isToday ? COLORS.accent : COLORS.border,
                height: d.cals ? `${Math.round((d.cals / maxCals) * 72)}px` : "4px",
                borderRadius: 4, minHeight: 4, transition: "height 0.5s ease",
                boxShadow: d.isToday ? `0 0 12px ${COLORS.accentGlow}` : "none" }} />
              <div style={{ fontSize: 10, color: d.isToday ? COLORS.accent : COLORS.muted, fontFamily: "'DM Mono', monospace" }}>{d.day}</div>
            </div>
          ))}
        </div>
      </div>

      {todayLog.meals.length > 0 && (
        <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, border: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 12 }}>TODAY'S MEALS</div>
          {todayLog.meals.slice(-3).map((meal) => (
            <div key={meal.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
              padding: 10, background: COLORS.surface, borderRadius: 12 }}>
              {meal.image
                ? <img src={meal.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover" }} />
                : <div style={{ width: 44, height: 44, borderRadius: 10, background: COLORS.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🍽️</div>
              }
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{meal.name}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>{meal.time} · {meal.calories} kcal</div>
              </div>
              <div style={{ textAlign: "right", fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace" }}>
                <div style={{ color: COLORS.accent }}>P {meal.protein}g</div>
                <div>C {meal.carbs}g</div>
              </div>
            </div>
          ))}
          {todayLog.meals.length > 3 && (
            <button onClick={() => setView("log")} style={{ background: "none", color: COLORS.accent, fontSize: 12, padding: "4px 0", fontFamily: "'DM Mono', monospace" }}>
              View all {todayLog.meals.length} meals →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scan View ────────────────────────────────────────────────────────────────
function ScanView({ capturedImage, analyzing, analysisResult, analysisError, pendingMeal, fileInputRef, handleFileSelect, confirmMeal, discardScan, setPendingMeal }) {
  return (
    <div style={{ padding: "20px" }} className="fade-in">
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
        onChange={handleFileSelect} style={{ display: "none" }} />

      {!capturedImage && (
        <div>
          <div style={{ background: COLORS.card, borderRadius: 24, border: `2px dashed ${COLORS.border}`,
            padding: 48, textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>📸</div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Snap Your Meal</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginBottom: 24, lineHeight: 1.6 }}>
              Take a photo or upload an image.<br />AI will analyze the macros instantly.
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button onClick={() => { fileInputRef.current.removeAttribute("capture"); fileInputRef.current.click(); }}
                style={{ padding: "12px 24px", borderRadius: 12, background: COLORS.border, color: COLORS.text, fontSize: 13, fontWeight: 600 }}>
                📁 Gallery
              </button>
              <button onClick={() => { fileInputRef.current.setAttribute("capture", "environment"); fileInputRef.current.click(); }}
                style={{ padding: "12px 24px", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 13, fontWeight: 600,
                  boxShadow: `0 0 20px ${COLORS.accentGlow}` }}>
                📷 Camera
              </button>
            </div>
          </div>
          <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, border: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 8 }}>TIPS FOR BEST RESULTS</div>
            {["Ensure food is clearly visible", "Flat lay shots work great", "Include all items in frame", "Good lighting improves accuracy"].map((tip, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.accent }} />{tip}
              </div>
            ))}
          </div>
        </div>
      )}

      {capturedImage && (
        <div>
          <img src={capturedImage} alt="Food" style={{ width: "100%", borderRadius: 20, marginBottom: 16, maxHeight: 260, objectFit: "cover" }} />

          {analyzing && (
            <div style={{ background: COLORS.card, borderRadius: 20, padding: 32, textAlign: "center", border: `1px solid ${COLORS.border}` }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: `3px solid ${COLORS.border}`,
                borderTop: `3px solid ${COLORS.accent}`, margin: "0 auto 16px",
                animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 14, color: COLORS.muted }}>Analyzing macros with AI...</div>
            </div>
          )}

          {analysisError && (
            <div style={{ background: `${COLORS.red}15`, border: `1px solid ${COLORS.red}`, borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ color: COLORS.red, fontSize: 14, marginBottom: 12 }}>{analysisError}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => fileInputRef.current.click()}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, background: COLORS.card, color: COLORS.text, fontSize: 13 }}>Try Again</button>
                <button onClick={discardScan}
                  style={{ flex: 1, padding: "10px", borderRadius: 10, background: COLORS.border, color: COLORS.text, fontSize: 13 }}>Cancel</button>
              </div>
            </div>
          )}

          {analysisResult && pendingMeal && (
            <div style={{ background: COLORS.card, borderRadius: 20, padding: 20, border: `1px solid ${COLORS.border}` }} className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{analysisResult.mealName}</div>
                  <div style={{ fontSize: 11, color: analysisResult.confidence === "high" ? COLORS.green : COLORS.orange,
                    fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                    {analysisResult.confidence?.toUpperCase()} CONFIDENCE
                  </div>
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.accent }}>{analysisResult.totals.calories}<span style={{ fontSize: 12, color: COLORS.muted }}> kcal</span></div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Protein", val: analysisResult.totals.protein, color: COLORS.accent },
                  { label: "Carbs", val: analysisResult.totals.carbs, color: COLORS.orange },
                  { label: "Fat", val: analysisResult.totals.fat, color: COLORS.green },
                ].map(m => (
                  <div key={m.label} style={{ flex: 1, background: COLORS.surface, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: m.color }}>{m.val}g</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, fontFamily: "'DM Mono', monospace" }}>{m.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              {analysisResult.items?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 8 }}>ITEMS DETECTED</div>
                  {analysisResult.items.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12,
                      padding: "6px 0", borderBottom: `1px solid ${COLORS.border}` }}>
                      <div>
                        <span style={{ color: COLORS.text }}>{item.name}</span>
                        <span style={{ color: COLORS.muted, marginLeft: 8 }}>{item.portion}</span>
                      </div>
                      <span style={{ color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>{item.calories} kcal</span>
                    </div>
                  ))}
                </div>
              )}

              {analysisResult.notes && (
                <div style={{ background: `${COLORS.accent}10`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: COLORS.muted, lineHeight: 1.6 }}>
                  💡 {analysisResult.notes}
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 8 }}>ADJUST IF NEEDED</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {["calories", "protein", "carbs", "fat"].map(key => (
                    <div key={key}>
                      <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>{key.toUpperCase()}</div>
                      <input type="number" value={pendingMeal[key]}
                        onChange={e => setPendingMeal(p => ({ ...p, [key]: Number(e.target.value) }))}
                        style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`,
                          borderRadius: 8, padding: "8px 10px", color: COLORS.text, fontSize: 14 }} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={discardScan} style={{ flex: 1, padding: "13px", borderRadius: 12, background: COLORS.border, color: COLORS.text, fontSize: 14, fontWeight: 600 }}>Discard</button>
                <button onClick={confirmMeal} style={{ flex: 2, padding: "13px", borderRadius: 12, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 600,
                  boxShadow: `0 0 20px ${COLORS.accentGlow}` }}>Log Meal ✓</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Log View ─────────────────────────────────────────────────────────────────
function LogView({ user, deleteMeal }) {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const log = user?.logs?.find(l => l.date === selectedDate) || { date: selectedDate, meals: [] };
  const totals = log.meals.reduce((a, m) => ({
    calories: a.calories + (m.calories || 0),
    protein: a.protein + (m.protein || 0),
    carbs: a.carbs + (m.carbs || 0),
    fat: a.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const recentDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    recentDates.push(d.toISOString().split("T")[0]);
  }

  return (
    <div style={{ padding: "20px" }} className="fade-in">
      <div style={{ display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {recentDates.map(d => {
          const hasData = user?.logs?.find(l => l.date === d)?.meals?.length > 0;
          return (
            <button key={d} onClick={() => setSelectedDate(d)}
              style={{ minWidth: 52, padding: "8px 10px", borderRadius: 12,
                background: selectedDate === d ? COLORS.accent : COLORS.card,
                border: `1px solid ${selectedDate === d ? COLORS.accent : COLORS.border}`,
                color: selectedDate === d ? "#fff" : COLORS.muted, fontSize: 12, textAlign: "center" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
                {new Date(d + "T12:00:00").toLocaleDateString("en", { weekday: "short" })}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
                {new Date(d + "T12:00:00").getDate()}
              </div>
              {hasData && <div style={{ width: 4, height: 4, borderRadius: "50%", background: selectedDate === d ? "#fff" : COLORS.green, margin: "2px auto 0" }} />}
            </button>
          );
        })}
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <MacroBar label="CALORIES" value={totals.calories} max={user?.calories || 2000} color={COLORS.green} unit="kcal" />
        <MacroBar label="PROTEIN" value={totals.protein} max={user?.protein || 150} color={COLORS.accent} />
        <MacroBar label="CARBS" value={totals.carbs} max={user?.carbs || 225} color={COLORS.orange} />
        <MacroBar label="FAT" value={totals.fat} max={user?.fat || 67} color="#ff6b8a" />
      </div>

      {log.meals.length === 0
        ? <div style={{ textAlign: "center", padding: 48, color: COLORS.muted, fontSize: 14 }}>No meals logged for this day</div>
        : log.meals.map(meal => (
          <div key={meal.id} style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12,
            border: `1px solid ${COLORS.border}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
            {meal.image
              ? <img src={meal.image} alt="" style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 60, height: 60, borderRadius: 12, background: COLORS.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>🍽️</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{meal.name}</div>
              <div style={{ fontSize: 11, color: COLORS.muted, marginBottom: 8 }}>{meal.time}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { label: `${meal.calories} kcal`, color: COLORS.text },
                  { label: `P ${meal.protein}g`, color: COLORS.accent },
                  { label: `C ${meal.carbs}g`, color: COLORS.orange },
                  { label: `F ${meal.fat}g`, color: COLORS.green },
                ].map(t => (
                  <span key={t.label} style={{ fontSize: 11, color: t.color, fontFamily: "'DM Mono', monospace",
                    background: COLORS.surface, padding: "2px 7px", borderRadius: 6 }}>{t.label}</span>
                ))}
              </div>
            </div>
            {selectedDate === todayStr() && (
              <button onClick={() => deleteMeal(meal.id)}
                style={{ background: "none", color: COLORS.muted, fontSize: 18, padding: 4, flexShrink: 0 }}>×</button>
            )}
          </div>
        ))
      }
    </div>
  );
}

// ─── Profile View ─────────────────────────────────────────────────────────────
function ProfileView({ user, updateUser, showToast }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    goal: user?.goal || "maintain",
    calories: user?.calories || 2000,
    protein: user?.protein || 150,
    carbs: user?.carbs || 225,
    fat: user?.fat || 67,
    weight: user?.weight || "",
    height: user?.height || "",
    age: user?.age || "",
    activityLevel: user?.activityLevel || "moderate",
  });

  const applyPreset = (goal) => {
    if (goal === "custom") { setForm(f => ({ ...f, goal })); return; }
    const p = GOAL_PRESETS[goal];
    setForm(f => ({ ...f, goal, calories: p.calories, protein: p.protein, carbs: p.carbs, fat: p.fat }));
  };

  const save = () => {
    updateUser({ ...form, avatar: form.name[0]?.toUpperCase() || "?" });
    showToast("Profile saved!");
  };

  const calcCalories = () => {
    const w = parseFloat(form.weight), h = parseFloat(form.height), a = parseFloat(form.age);
    if (!w || !h || !a) { showToast("Enter weight, height, and age first", "error"); return; }
    const bmr = 10 * w + 6.25 * h - 5 * a + 5;
    const actMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, veryActive: 1.9 };
    const tdee = Math.round(bmr * (actMult[form.activityLevel] || 1.55));
    const goalAdj = { cut: -400, maintain: 0, bulk: 300, keto: -200, custom: 0 };
    const target = tdee + (goalAdj[form.goal] || 0);
    setForm(f => ({ ...f, calories: target }));
    showToast(`TDEE: ${tdee} kcal → Target: ${target} kcal`);
  };

  return (
    <div style={{ padding: "20px" }} className="fade-in">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 6 }}>DISPLAY NAME</div>
        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 14 }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 8 }}>GOAL PRESET</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(GOAL_PRESETS).map(([k, v]) => (
            <button key={k} onClick={() => applyPreset(k)}
              style={{ padding: "8px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: form.goal === k ? COLORS.accent : COLORS.card,
                border: `1px solid ${form.goal === k ? COLORS.accent : COLORS.border}`,
                color: form.goal === k ? "#fff" : COLORS.muted }}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 12 }}>DAILY TARGETS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["CALORIES (kcal)", "calories"], ["PROTEIN (g)", "protein"], ["CARBS (g)", "carbs"], ["FAT (g)", "fat"]].map(([l, k]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>{l}</div>
              <input type="number" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: Number(e.target.value) }))}
                style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.text, fontSize: 14 }} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 12 }}>BODY STATS (optional)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {[["Weight (kg)", "weight"], ["Height (cm)", "height"], ["Age", "age"]].map(([l, k]) => (
            <div key={k}>
              <div style={{ fontSize: 10, color: COLORS.muted, marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>{l}</div>
              <input type="number" value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 8px", color: COLORS.text, fontSize: 13 }} />
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 1, marginBottom: 6 }}>ACTIVITY LEVEL</div>
          <select value={form.activityLevel} onChange={e => setForm(f => ({ ...f, activityLevel: e.target.value }))}
            style={{ width: "100%", background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 14 }}>
            <option value="sedentary">Sedentary (little exercise)</option>
            <option value="light">Light (1-3x/week)</option>
            <option value="moderate">Moderate (3-5x/week)</option>
            <option value="active">Active (6-7x/week)</option>
            <option value="veryActive">Very Active (2x/day)</option>
          </select>
        </div>
        <button onClick={calcCalories}
          style={{ width: "100%", padding: "10px", borderRadius: 10, background: COLORS.surface,
            border: `1px solid ${COLORS.border}`, color: COLORS.accent, fontSize: 13, fontWeight: 600 }}>
          ⚡ Auto-Calculate Calorie Target
        </button>
      </div>

      <button onClick={save}
        style={{ width: "100%", padding: "15px", borderRadius: 14, background: COLORS.accent, color: "#fff",
          fontSize: 15, fontWeight: 700, boxShadow: `0 0 24px ${COLORS.accentGlow}` }}>
        Save Profile
      </button>
    </div>
  );
}

// ─── Users View ───────────────────────────────────────────────────────────────
function UsersView({ appData, setAppData, setView, showToast }) {
  const [newName, setNewName] = useState("");

  const switchUser = (id) => {
    setAppData(prev => ({ ...prev, activeUserId: id }));
    setView("dashboard");
  };

  const addUser = () => {
    if (!newName.trim()) return;
    const id = `user_${Date.now()}`;
    const user = DEFAULT_PROFILE(id, newName.trim());
    setAppData(prev => ({ ...prev, users: [...prev.users, user], activeUserId: id }));
    setNewName("");
    setView("profile");
    showToast(`Profile "${newName}" created!`);
  };

  const removeUser = (id) => {
    if (appData.users.length === 1) { showToast("Can't remove last profile", "error"); return; }
    const newUsers = appData.users.filter(u => u.id !== id);
    setAppData(prev => ({
      ...prev,
      users: newUsers,
      activeUserId: prev.activeUserId === id ? newUsers[0].id : prev.activeUserId
    }));
    showToast("Profile removed");
  };

  return (
    <div style={{ padding: "20px" }} className="fade-in">
      <div style={{ marginBottom: 20 }}>
        {appData.users.map(user => {
          const active = user.id === appData.activeUserId;
          const today = todayStr();
          const log = user.logs?.find(l => l.date === today);
          const cals = log?.meals?.reduce((a, m) => a + (m.calories || 0), 0) || 0;
          return (
            <div key={user.id} onClick={() => switchUser(user.id)}
              style={{ background: active ? `${COLORS.accent}20` : COLORS.card,
                border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                borderRadius: 16, padding: 16, marginBottom: 12, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: active ? COLORS.accent : COLORS.border,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700,
                boxShadow: active ? `0 0 16px ${COLORS.accentGlow}` : "none" }}>
                {user.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {GOAL_PRESETS[user.goal]?.label || "Custom"} · {cals} kcal today
                </div>
              </div>
              {active && <div style={{ fontSize: 11, color: COLORS.accent, fontFamily: "'DM Mono', monospace" }}>ACTIVE</div>}
              {!active && (
                <button onClick={e => { e.stopPropagation(); removeUser(user.id); }}
                  style={{ background: "none", color: COLORS.muted, fontSize: 18, padding: 4 }}>×</button>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ background: COLORS.card, borderRadius: 16, padding: 16, border: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, color: COLORS.muted, fontFamily: "'DM Mono', monospace", letterSpacing: 2, marginBottom: 12 }}>ADD PROFILE</div>
        <div style={{ display: "flex", gap: 10 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addUser()}
            placeholder="Profile name..." maxLength={20}
            style={{ flex: 1, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "10px 12px", color: COLORS.text, fontSize: 14 }} />
          <button onClick={addUser}
            style={{ padding: "10px 20px", borderRadius: 10, background: COLORS.accent, color: "#fff", fontSize: 14, fontWeight: 600 }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
