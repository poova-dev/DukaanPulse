"use client";
import {
  useState,
  useEffect,
  useRef,
  useMemo,
  createContext,
  useContext,
  ReactNode,
  FormEvent,
} from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Coffee,
  Download,
  FileCheck2,
  FileText,
  Info,
  Languages,
  LoaderCircle,
  Settings2,
  ShieldCheck,
  Store,
  Upload,
  X,
  AlertTriangle,
  RefreshCw,
  CheckCheck,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { BillingScreen, AnalyticsScreen } from "./billing-components";
import { AIAssistantScreen } from "./ai-assistant-component";
import { PresentationReportScreen } from "./presentation-report-component";
import {
  getSavedBills,
  getSavedProducts,
  Bill,
  Product,
  computeSalesAnalytics,
} from "@/lib/billing";
import { analyzeStoreBills } from "@/lib/ai-assistant";
import {
  State,
  Lang,
  Context,
  Experiment,
  ImportResult,
  clone,
  emptyState,
  money,
  time,
  minute,
  addDays,
  MAX_BYTES,
} from "@/lib/domain";
import {
  analyze,
  parseCSV,
  splitCSV,
  REQUIRED,
} from "@/lib/analytics";
import { tr, periodLabel } from "@/lib/i18n";
import { sampleCSV, sampleContext } from "@/lib/fixtures";
import {
  Command,
  contextSchema,
} from "@/lib/commands";
import { download } from "@/lib/poster";

type StateResponse = { state?: State; error?: string };
type Page =
  | "billing"
  | "analytics"
  | "assistant"
  | "report"
  | "pulse"
  | "setup";
type InputCommand =
  | Omit<Extract<Command, { type: "loadSample" }>, "expectedVersion">
  | Omit<Extract<Command, { type: "upload" }>, "expectedVersion">
  | Omit<Extract<Command, { type: "context" }>, "expectedVersion">
  | Omit<Extract<Command, { type: "approve" }>, "expectedVersion">
  | Omit<Extract<Command, { type: "reject" }>, "expectedVersion">
  | Omit<Extract<Command, { type: "stage" }>, "expectedVersion">
  | Omit<Extract<Command, { type: "review" }>, "expectedVersion">
  | { type: "reset" };
type AppCtx = {
  s: State;
  l: Lang;
  t: (key: string) => string;
  busy: boolean;
  run: (c: InputCommand) => Promise<boolean>;
  go: (p: Page) => void;
  notify: (s: string) => void;
  provider: { configured: boolean; dailyApplicationLimit: number } | null;
};
const AppContext = createContext<AppCtx>(null!);
const useApp = () => useContext(AppContext);
const NAV: [Page, string, typeof Activity][] = [
  ["billing", "Quick Billing & POS", ShoppingCart],
  ["analytics", "Sales & Time Analytics", BarChart3],
  ["assistant", "AI Assistant (Tamil Voice)", Sparkles],
  ["report", "Executive Report (PDF)", FileText],
  ["pulse", "Today’s Pulse", Activity],
  ["setup", "Setup & upload", Upload],
];
function IconButton({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      className="icon-button"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${secondary ? "button secondary" : "button"} ${className}`}
    >
      {children}
    </button>
  );
}
function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Empty({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Store size={32} />
      </span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {children}
    </div>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
    >
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <IconButton label={tr(useApp().l, "Close")} onClick={onClose}>
          <X size={22} />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
function Status({ e }: { e: Experiment }) {
  const { t } = useApp();
  return (
    <Tag
      tone={e.stage === "Reviewed" ? "lime" : e.invalidated ? "amber" : "cyan"}
    >
      {t(e.stage)}
    </Tag>
  );
}

export default function Workspace() {
  const [s, setS] = useState<State>(emptyState),
    [l, setL] = useState<Lang>("en-IN"),
    [page, setPage] = useState<Page>("billing"),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [settings, setSettings] = useState(false),
    [reset, setReset] = useState(false),
    [provider, setProvider] = useState<AppCtx["provider"]>(null),
    [sarvamKeyInput, setSarvamKeyInput] = useState(""),
    [sarvamSaving, setSarvamSaving] = useState(false),
    [sarvamMsg, setSarvamMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const lock = useRef(false);
  const main = useRef<HTMLElement>(null);
  const t = (key: string) => tr(l, key);
  useEffect(() => {
    const saved = localStorage.getItem("dp-language");
    if (["en-IN", "hi-IN", "ta-IN"].includes(saved || "")) setL(saved as Lang);
    Promise.all([
      fetch("/api/state")
        .then((r) => r.json() as Promise<StateResponse>)
        .then((d) => {
          if (d.state) {
            setS(d.state);
            setError("");
          } else setError(d.error || "network");
        }),
      fetch("/api/health")
        .then((r) => r.json() as Promise<AppCtx["provider"]>)
        .then(setProvider),
    ])
      .catch(() => setError("network"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = l;
    localStorage.setItem("dp-language", l);
  }, [l]);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  function go(p: Page) {
    setPage(p);
    requestAnimationFrame(() => {
      main.current?.focus({ preventScroll: true });
      window.scrollTo({
        top: 0,
        behavior: "instant",
      });
    });
  }
  async function handleSaveSarvamKey(e: React.FormEvent) {
    e.preventDefault();
    if (!sarvamKeyInput.trim()) return;
    setSarvamSaving(true);
    setSarvamMsg(null);
    try {
      const res = await fetch("/api/config-sarvam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: sarvamKeyInput.trim() }),
      });
      const data = (await res.json()) as { message?: string };
      if (res.ok) {
        setSarvamMsg({
          text:
            l === "ta-IN"
              ? "சர்வம் API சாவி வெற்றிகரமாக இணைக்கப்பட்டது!"
              : "Sarvam API Key connected successfully!",
          ok: true,
        });
        setSarvamKeyInput("");
        fetch("/api/health")
          .then((r) => r.json() as Promise<AppCtx["provider"]>)
          .then(setProvider)
          .catch(() => {});
      } else {
        setSarvamMsg({
          text: data.message || "Failed to update key",
          ok: false,
        });
      }
    } catch {
      setSarvamMsg({ text: "Network error saving API key", ok: false });
    } finally {
      setSarvamSaving(false);
    }
  }
  async function run(c: InputCommand) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...c, expectedVersion: s.version }),
      });
      const d = (await r.json()) as StateResponse;
      if (!r.ok || !d.state) {
        setError(d.error || "network");
        if (r.status === 409) {
          const fresh = await fetch("/api/state").then(
            (x) => x.json() as Promise<StateResponse>,
          );
          if (fresh.state) setS(fresh.state);
        }
        return false;
      }
      setS(d.state);
      return true;
    } catch {
      setError("network");
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const ctx: AppCtx = {
    s,
    l,
    t,
    busy,
    run,
    go,
    notify: setNotice,
    provider,
  };
  return (
    <AppContext.Provider value={ctx}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="logo"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              go("pulse");
            }}
          >
            <span className="logo-symbol">
              <Activity size={26} />
            </span>
            <span>
              Dukaan<span className="logo-light">Pulse</span>
              <small>PAYTM MERCHANT POS & AI</small>
            </span>
          </a>
          <div className="workspace-label">{t("Merchant workspace")}</div>
          <nav aria-label={t("Merchant workspace")}>
            {NAV.map(([id, label, Icon]) => (
              <button
                key={id}
                className={page === id ? "nav-item active" : "nav-item"}
                onClick={() => go(id)}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{t(label)}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="pilot-note">
              <ShieldCheck size={20} />
              <p>
                {t("Independent hackathon prototype. No Paytm connection.")}
              </p>
            </div>
            <button className="nav-item" onClick={() => setSettings(true)}>
              <Settings2 size={19} />
              <span>{t("Settings & provider")}</span>
            </button>
            <div className="team-label">
              <span className="team-avatar">T₃</span>
              <div>
                <strong>Team Trio</strong>
                <small>Merchant Growth AI · Chennai</small>
              </div>
            </div>
          </div>
        </aside>
        <div className="main-wrap">
          <header className="topbar">
            <div className="shop-header">
              <span className="shop-icon">
                <Coffee size={21} />
              </span>
              <div>
                <strong>{s.context.shop}</strong>
                <small>{t("All times Asia/Kolkata")}</small>
              </div>
            </div>
            <div className="top-actions">
              <span className={`save-state ${error ? "failed" : ""}`}>
                {busy ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <CheckCheck size={15} />
                )}
                <span>
                  {t(
                    busy
                      ? "Saving…"
                      : error
                        ? "Save failed"
                        : "Saved on server",
                  )}
                </span>
              </span>
              <label className="language-picker">
                <Languages size={17} />
                <select
                  aria-label={t("Language")}
                  value={l}
                  onChange={(e) => setL(e.target.value as Lang)}
                >
                  <option value="en-IN">English</option>
                  <option value="hi-IN">हिन्दी</option>
                  <option value="ta-IN">தமிழ்</option>
                </select>
              </label>
              <button className="icon-button mobile-settings" onClick={() => setSettings(true)} aria-label={t("Settings & provider")}>
                <Settings2 size={18}/>
              </button>
            </div>
          </header>
          <main id="main" ref={main} tabIndex={-1}>
            {error && (
              <div role="alert" className="alert error">
                <AlertTriangle size={20} />
                <span>{t(error)}</span>
                <button onClick={() => location.reload()}>
                  {t("Continue")}
                </button>
              </div>
            )}
            {loading ? (
              <div className="loading">
                <LoaderCircle className="spin" />
                {t("Loading your workspace…")}
              </div>
            ) : (
              <>
                {page === "billing" ? (
                  <BillingScreen
                    lang={l}
                    onGoToAnalytics={() => setPage("analytics")}
                  />
                ) : page === "analytics" ? (
                  <AnalyticsScreen
                    lang={l}
                    onGoToBilling={() => setPage("billing")}
                    onGoToActions={() => setPage("pulse")}
                  />
                ) : page === "assistant" ? (
                  <AIAssistantScreen
                    lang={l}
                    onGoToBilling={() => setPage("billing")}
                    onGoToActions={() => setPage("pulse")}
                  />
                ) : page === "report" ? (
                  <PresentationReportScreen
                    lang={l}
                    onGoToBilling={() => setPage("billing")}
                    onGoToActions={() => setPage("pulse")}
                  />
                ) : page === "setup" ? (
                  <Setup />
                ) : (
                  <Pulse />
                )}
              </>
            )}
          </main>
          <footer className="app-footer">
            <span>
              DukaanPulse <span className="footer-dot">/</span>{" "}
              {t("Team Trio · Track 1")}
            </span>
            <span>
              {s.loaded && s.sourceName.startsWith("synthetic-")
                ? t("Synthetic demonstration")
                : t("Independent hackathon prototype. No Paytm connection.")}
            </span>
          </footer>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          {t(notice)}
        </div>
      )}
      {settings && (
        <Modal
          title={t("Sarvam configuration")}
          onClose={() => setSettings(false)}
        >
          <div className="stack">
            <Tag tone={provider?.configured ? "cyan" : "amber"}>
              {t(
                provider?.configured
                  ? "Configured, live check pending"
                  : "Not configured",
              )}
            </Tag>
            <p>
              {t(
                "Organiser allocation: 500 credits (reported). Unit, current balance, eligibility and expiry are unverified.",
              )}
            </p>
            <p className="muted">
              {t(
                "Server-side calls only. No automatic retries. Daily application limit is not a provider balance.",
              )}
            </p>
            <div className="facts">
              <div>
                <span>TTS</span>
                <strong>bulbul:v3</strong>
              </div>
              <div>
                <span>STT</span>
                <strong>saaras:v3</strong>
              </div>
              <div>
                <span>Q&A</span>
                <strong>sarvam-105b</strong>
              </div>
              <div>
                <span>{t("Limit")}</span>
                <strong>12 / UTC day / workspace</strong>
              </div>
            </div>
            <div
              style={{
                marginTop: 12,
                padding: "14px",
                background: "var(--surface-hover)",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Sparkles size={15} style={{ color: "var(--accent)" }} />
                <span>
                  {l === "ta-IN"
                    ? "சர்வம் AI API சாவி (Sarvam Key)"
                    : "Connect Your Sarvam API Key"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                {l === "ta-IN"
                  ? "உங்களிடம் உள்ள சர்வம் API சாவியை உள்ளிட்டு நேரடி bulbul:v3 குரல், saaras:v3 பேச்சு அறிதல் & sarvam-105b வணிக பகுப்பாய்வை இயக்கவும்."
                  : "Enter your Sarvam API key to activate live bulbul:v3 neural Tamil speech, saaras:v3 STT & sarvam-105b analytics."}
              </p>
              <form
                onSubmit={handleSaveSarvamKey}
                style={{ display: "flex", gap: 8, flexDirection: "column" }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="password"
                    placeholder="Enter Sarvam API key..."
                    value={sarvamKeyInput}
                    onChange={(e) => setSarvamKeyInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      color: "inherit",
                      fontSize: 13,
                    }}
                  />
                  <Button
                    type="submit"
                    disabled={sarvamSaving || !sarvamKeyInput.trim()}
                  >
                    {sarvamSaving
                      ? "..."
                      : l === "ta-IN"
                      ? "இணைக்க"
                      : "Connect"}
                  </Button>
                </div>
                {sarvamMsg && (
                  <div
                    style={{
                      fontSize: 12,
                      color: sarvamMsg.ok ? "var(--good)" : "var(--warn)",
                      fontWeight: 500,
                    }}
                  >
                    {sarvamMsg.text}
                  </div>
                )}
              </form>
            </div>
            <p className="small">
              {t(
                "Server storage is isolated by signed-in owner or private demo-session cookie. Keep an export.",
              )}
            </p>
            <Button
              secondary
              onClick={() => {
                setSettings(false);
                setReset(true);
              }}
            >
              <RefreshCw size={16} />
              {t("Reset demo")}
            </Button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title={t("Reset demo")} onClose={() => setReset(false)}>
          <p>
            {t(
              "Reset clears this workspace’s saved records. Download an export first.",
            )}
          </p>
          <div className="dialog-actions">
            <Button secondary onClick={() => setReset(false)}>
              {t("Cancel")}
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (await run({ type: "reset" })) {
                  setReset(false);
                  go("pulse");
                }
              }}
            >
              {t("Confirm reset")}
            </Button>
          </div>
        </Modal>
      )}
    </AppContext.Provider>
  );
}
function PageHead({
  eyebrow,
  title,
  detail,
  children,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {detail && <p className="page-detail">{detail}</p>}
      </div>
      {children && <div className="head-actions">{children}</div>}
    </div>
  );
}
function NoData() {
  const { t, run, go, busy } = useApp();
  return (
    <Empty
      title={t("No records yet")}
      detail={t("Upload a CSV or explore the labelled synthetic shop.")}
    >
      <div className="inline-actions">
        <Button
          onClick={async () => {
            await run({ type: "loadSample", kind: "valid" });
          }}
          disabled={busy}
        >
          <Coffee size={18} />
          {t("Load synthetic shop")}
          <ArrowRight size={18} />
        </Button>
        <Button secondary onClick={() => go("setup")}>
          <Upload size={18} />
          {t("Start with your records")}
        </Button>
      </div>
    </Empty>
  );
}
function Pulse() {
  const { s, t, l, go } = useApp();
  const [bills] = useState<Bill[]>(() => getSavedBills());
  const [products] = useState<Product[]>(() => getSavedProducts());

  // Compute live analytics from recorded store bills
  const liveAnalysis = useMemo(() => {
    return analyzeStoreBills(
      bills,
      new Date().toISOString().slice(0, 10),
      products,
      undefined,
      new Date().getHours(),
      s.context,
    );
  }, [bills, products, s.context]);

  const salesAnalytics = useMemo(() => computeSalesAnalytics(bills), [bills]);
  const todayRev = liveAnalysis.todayRevenue || salesAnalytics.totalRevenue;
  const todayCount = liveAnalysis.todayBillsCount || salesAnalytics.totalBills;
  const avgBill = todayCount > 0 ? Math.round(todayRev / todayCount) : 0;
  const isTamil = l === "ta-IN";
  const isHindi = l === "hi-IN";

  return (
    <>
      <PageHead
        eyebrow={t("Today’s Pulse")}
        title={isTamil ? "இன்றைய வணிகத் துடிப்பு & நேரடி புள்ளிவிவரங்கள்" : isHindi ? "आज की व्यापारिक नब्ज और लाइव आंकड़े" : "Today’s Store Pulse & Real-time Metrics"}
        detail={isTamil ? "நேரடி பில்லிங், விற்பனை ஓட்டம் மற்றும் நேரச் சாளர பகுப்பாய்வு." : isHindi ? "लाइव बिलिंग, बिक्री प्रवाह और समय-अवधि विश्लेषण।" : "Live store pulse, real-time bill flow, and time-window velocity."}
      >
        <Tag tone="cyan">
          <span className="status-dot" />
          {new Date().toISOString().slice(0, 10)} · {isTamil ? "நேரடி விற்பனை" : isHindi ? "लाइव बिक्री" : "Live Store POS"}
        </Tag>
      </PageHead>

      <div className="stat-grid">
        <article className="stat-card">
          <div className="stat-label">
            {isTamil ? "இன்றைய மொத்த வசூல்" : isHindi ? "आज का कुल राजस्व" : "Today’s Recorded Sales"}
            <span>01</span>
          </div>
          <strong>₹{todayRev.toLocaleString("en-IN")}</strong>
          <small>
            {liveAnalysis.yesterdayRevenue > 0
              ? `${liveAnalysis.isDayDip ? "📉 -" : "📈 +"}${liveAnalysis.dayOverDayDipPercent}% ${isTamil ? `நேற்றைய வசூலுடன் (₹${liveAnalysis.yesterdayRevenue})` : isHindi ? `कल की तुलना में (₹${liveAnalysis.yesterdayRevenue})` : `vs yesterday (₹${liveAnalysis.yesterdayRevenue})`}`
              : isTamil ? "நேரடி பில்லிங் மூலம் பெறப்பட்டது" : isHindi ? "लाइव बिलिंग से दर्ज" : "From live POS records"}
          </small>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            {isTamil ? "இன்றைய பில்கள் எண்ணிக்கை" : isHindi ? "आज के कुल बिल" : "Completed Payments"}
            <span>02</span>
          </div>
          <strong>{todayCount} {isTamil ? "பில்கள்" : isHindi ? "बिल" : "bills"}</strong>
          <small>
            {isTamil ? `மொத்தம் ${liveAnalysis.todayUnitsSold} பொருட்கள் விற்றுள்ளன` : isHindi ? `कुल ${liveAnalysis.todayUnitsSold} उत्पाद बिके` : `${liveAnalysis.todayUnitsSold} total units sold today`}
          </small>
        </article>

        <article className="stat-card">
          <div className="stat-label">
            {isTamil ? "சராசரி பில் மதிப்பு" : isHindi ? "औसत बिल मूल्य" : "Average Ticket Size"}
            <span>03</span>
          </div>
          <strong>₹{avgBill}</strong>
          <small>
            {liveAnalysis.topProduct
              ? `${isTamil ? "அதிகம் விற்றது: " : isHindi ? "सर्वाधिक बिका: " : "Top seller: "}${isTamil ? liveAnalysis.topProduct.nameTa : isHindi ? liveAnalysis.topProduct.nameHi : liveAnalysis.topProduct.name} (${liveAnalysis.topProduct.units})`
              : isTamil ? "பொருட்கள் விவரம்" : "Product metrics"}
          </small>
        </article>
      </div>

      <div className="pulse-grid">
        <section className="panel chart-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{isTamil ? "நேரச் சாளர விற்பனை ஓட்டம்" : isHindi ? "समय-अवधि बिक्री प्रवाह" : "Hourly Velocity"}</p>
              <h2>{isTamil ? "நேர வாரியாக விற்பனை மற்றும் பில்கள்" : isHindi ? "समय अनुसार बिक्री व बिल" : "Payments by Time Window"}</h2>
            </div>
            <BarChart3 size={20} className="muted" />
          </div>

          <div
            className="chart"
            role="img"
            aria-label={liveAnalysis.timeWindows
              .map((w) => `${isTamil ? w.windowLabelTa : isHindi ? w.windowLabelHi : w.windowLabelEn}: ${w.todayCount} bills, ₹${w.todayRevenue}`)
              .join("; ")}
          >
            {liveAnalysis.timeWindows.map((w, i) => {
              const maxCount = Math.max(...liveAnalysis.timeWindows.map((x) => x.todayCount), 1);
              const heightPct = Math.max(8, (w.todayCount / maxCount) * 100);
              const isQuiet = w.isFlagged;
              const isClosed = w.state === "closed";
              const isUnknown = w.state === "unknown";
              return (
                <div
                  className={`bar-group ${isQuiet ? "quiet" : isClosed ? "state-closed" : isUnknown ? "state-unknown" : ""}`}
                  key={i}
                >
                  <span className="bar-number">
                    {w.todayCount > 0 ? `₹${w.todayRevenue}` : "0"}
                  </span>
                  <div className="bar-track">
                    <div
                      className="bar"
                      style={{ height: `${heightPct}%` }}
                    >
                      <span />
                    </div>
                  </div>
                  <strong>
                    {String(w.startHour).padStart(2, "0")}:00–{String(w.endHour).padStart(2, "0")}:00
                  </strong>
                  <small>
                    {isClosed
                      ? isTamil ? "கடை மூடல்" : isHindi ? "बंद" : "Closed"
                      : isUnknown
                        ? isTamil ? "அபுஷ்ட்" : "Unknown"
                        : `${w.todayCount} ${isTamil ? "பில்கள்" : isHindi ? "बिल" : "bills"}`}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="chart-caption">
            <span className="legend-dot" />
            {isTamil ? "நேரடி பில்லிங் அடிப்படையில் பதிவு செய்யப்பட்டது" : isHindi ? "लाइव बिलिंग के आधार पर दर्ज" : "Recorded from active store transactions"}{" "}
            <span className="chart-timezone">Asia/Kolkata</span>
          </div>
        </section>

        {/* Live Recommendation Card */}
        <section className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{isTamil ? "சர்வம் AI நேரடி பகுப்பாய்வு" : isHindi ? "सर्वम AI लाइव परामर्श" : "Sarvam AI Store Insights"}</p>
              <h2>{isTamil ? "இன்றைய வணிக வழிகாட்டுதல்" : isHindi ? "आज का व्यापारिक सुझाव" : "Live Store Guidance"}</h2>
            </div>
            <Sparkles size={20} className="text-amber" />
          </div>

          <p style={{ fontSize: 14, lineHeight: 1.7, color: "var(--text)" }}>
            {isTamil ? liveAnalysis.offerAdviceTa : isHindi ? liveAnalysis.fullReportHi : liveAnalysis.fullReportEn}
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: "auto" }}>
            <Button onClick={() => go("billing")}>
              <ShoppingCart size={17} />
              {isTamil ? "பில்லிங் செல்க" : isHindi ? "बिलिंग पर जाएं" : "Quick Billing"}
            </Button>
            <Button secondary onClick={() => go("assistant")}>
              <Sparkles size={17} />
              {isTamil ? "குரல் AI உதவியாளர்" : isHindi ? "वॉइस AI सहायक" : "Voice AI"}
            </Button>
            <Button secondary onClick={() => go("report")}>
              <FileText size={17} />
              {isTamil ? "அறிக்கை" : isHindi ? "रिपोर्ट" : "Report"}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}

type CSVSelection = {
  csv: string;
  mapping: Record<string, string>;
  report: ImportResult;
  name: string;
};
function CsvPicker({
  onSelect,
}: {
  onSelect: (v: CSVSelection | null) => void;
}) {
  const { t } = useApp();
  const [raw, setRaw] = useState(""),
    [name, setName] = useState(""),
    [mapping, setMapping] = useState<Record<string, string>>({}),
    [error, setError] = useState("");
  let matrix: string[][] = [];
  let report: ImportResult | null = null;
  try {
    if (raw) {
      matrix = splitCSV(raw);
      report = parseCSV(raw, mapping);
    }
  } catch {}
  useEffect(() => {
    if (!raw) {
      onSelect(null);
      return;
    }
    try {
      const r = parseCSV(raw, mapping);
      onSelect({ csv: raw, mapping, report: r, name });
      setError("");
    } catch (e) {
      onSelect(null);
      setError(e instanceof Error ? e.message : "invalidInput");
    }
  }, [raw, mapping, name]);
  return (
    <div className="csv-picker">
      <label className="upload-zone">
        <Upload size={27} />
        <strong>{t("Choose CSV")}</strong>
        <span>{name || t("Payment CSV")}</span>
        <small>
          {t(
            "2 MB maximum. 10,000 rows. ISO timestamps with timezone. Amounts in rupees.",
          )}
        </small>
        <input
          aria-label={t("Choose CSV")}
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > MAX_BYTES) {
              setError("fileSize");
              return;
            }
            setMapping({});
            setName(file.name);
            setRaw(await file.text());
          }}
        />
      </label>
      {raw && matrix.length > 0 && (
        <details open className="evidence-details">
          <summary>{t("Preview & map columns")}</summary>
          <div className="form-grid mapping-grid">
            {REQUIRED.map((k) => (
              <Field key={k} label={k}>
                <select
                  value={mapping[k] || k}
                  onChange={(e) =>
                    setMapping({ ...mapping, [k]: e.target.value })
                  }
                >
                  <option value="">—</option>
                  {matrix[0].map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {matrix[0].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.slice(1, 4).map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {error && (
        <p role="alert" className="form-error">
          {t(error)}
        </p>
      )}
      {report && <ValidationReport report={report} />}
    </div>
  );
}
function ValidationReport({ report }: { report: ImportResult }) {
  const { t } = useApp();
  return (
    <div className="validation-report">
      <div className="validation-totals">
        <Tag tone="cyan">
          {report.rows.length} {t("Valid completed rows")}
        </Tag>
        <Tag tone={report.issues.length ? "amber" : "neutral"}>
          {report.issues.length} {t("Validation issues")}
        </Tag>
        <span>
          {report.duplicates} {t("Identical duplicates removed")}
        </span>
      </div>
      {Object.keys(report.excluded).length > 0 && (
        <p className="small">
          {t("Excluded statuses")}:{" "}
          {Object.entries(report.excluded)
            .map(([k, v]) => `${k}: ${v}`)
            .join(", ")}
        </p>
      )}
      {report.issues.length > 0 && (
        <details className="evidence-details">
          <summary>{t("Validation issues")}</summary>
          <p className="small">
            {t(
              "Conflicting IDs are excluded entirely. Review all issues before importing.",
            )}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("Row")}</th>
                  <th>{t("Reason")}</th>
                  <th>ID / value</th>
                </tr>
              </thead>
              <tbody>
                {report.issues.slice(0, 60).map((x, i) => (
                  <tr key={i}>
                    <td>{x.row}</td>
                    <td>{t(x.code)}</td>
                    <td className="mono">{x.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
function Samples() {
  const { t } = useApp();
  return (
    <details className="evidence-details">
      <summary>{t("Download sample files")}</summary>
      <div className="sample-list">
        {[
          ["valid", "Valid sample"],
          ["insufficient", "Insufficient history"],
          ["dirty", "Dirty data"],
          ["positive", "Positive follow-up"],
          ["negative", "Negative follow-up"],
        ].map(([kind, label]) => (
          <button
            key={kind}
            className="sample-link"
            onClick={() =>
              download(`dukaanpulse-${kind}.csv`, sampleCSV(kind), "text/csv")
            }
          >
            <FileText size={16} />
            {t(label)}
            <Download size={15} />
          </button>
        ))}
        <button
          className="sample-link"
          onClick={() =>
            download(
              "dukaanpulse-coverage.json",
              JSON.stringify(sampleContext(), null, 2),
              "application/json",
            )
          }
        >
          <FileCheck2 size={16} />
          {t("Coverage context")}
          <Download size={15} />
        </button>
      </div>
    </details>
  );
}
function Setup() {
  const { s, t, l, busy, run, notify } = useApp();
  const [c, setC] = useState<Context>(() => clone(s.context)),
    [reason, setReason] = useState(""),
    [selection, setSelection] = useState<CSVSelection | null>(null),
    [formError, setFormError] = useState("");
  useEffect(() => setC(clone(s.context)), [s.revision]);
  const dates = [
    ...new Set([
      c.date,
      ...s.data.rows.map((r) => r.date),
      ...Object.keys(c.coverage),
    ]),
  ]
    .filter((d) => d <= c.date)
    .sort()
    .reverse()
    .slice(0, 20);
  function patch<K extends keyof Context>(k: K, v: Context[K]) {
    setC({ ...c, [k]: v });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!contextSchema.safeParse(c).success || !reason.trim()) {
      setFormError("invalidInput");
      return;
    }
    if (await run({ type: "context", context: c, reason })) {
      setFormError("");
      setReason("");
      notify("Saved on server");
    }
  }
  return (
    <>
      <PageHead
        eyebrow={t("Setup & upload")}
        title={t("Setup & upload")}
        detail={t("Merchant-provided context")}
      />
      <div className="setup-grid">
        <div className="stack">
          <section className="panel">
            <div className="section-heading">
              <h2>{t("Payment CSV")}</h2>
              <Upload size={20} />
            </div>
            <CsvPicker onSelect={setSelection} />
            <p className="small muted">
              {t(
                "Importing clears prior coverage confirmations. Confirm them again.",
              )}
            </p>
            <Button
              disabled={busy || !selection?.report.rows.length}
              onClick={async () => {
                if (
                  selection &&
                  (await run({
                    type: "upload",
                    csv: selection.csv,
                    mapping: selection.mapping,
                    name: selection.name,
                  }))
                )
                  notify("Saved on server");
              }}
            >
              {t("Import validated rows")}
              <ArrowRight size={17} />
            </Button>
            <Samples />
          </section>
          <section className="panel">
            <h3>{t("Synthetic demonstration")}</h3>
            <p className="small muted">
              {t("Fixed reference date")}: 2026-11-14
            </p>
            <div className="sample-list">
              {[
                ["valid", "Load synthetic shop"],
                ["insufficient", "Insufficient history"],
                ["dirty", "Dirty data"],
              ].map(([kind, label]) => (
                <Button
                  secondary
                  disabled={busy}
                  key={kind}
                  onClick={async () => {
                    await run({
                      type: "loadSample",
                      kind: kind as "valid" | "insufficient" | "dirty",
                    });
                  }}
                >
                  {t(label)}
                  <ArrowRight size={16} />
                </Button>
              ))}
            </div>
          </section>
          {s.loaded && (
            <section className="panel">
              <p className="eyebrow">{t("Source file")}</p>
              <h3 className="break-word">{s.sourceName}</h3>
              <ValidationReport report={s.data} />
            </section>
          )}
        </div>
        <form className="stack" onSubmit={save}>
          <section className="panel">
            <div className="section-heading">
              <h2>{t("Merchant-provided context")}</h2>
              <Store size={21} />
            </div>
            <div className="form-grid">
              <Field label={t("Shop name")}>
                <input
                  value={c.shop}
                  maxLength={80}
                  required
                  onChange={(e) => patch("shop", e.target.value)}
                />
              </Field>
              <Field label={t("Reference date")}>
                <input
                  type="date"
                  value={c.date}
                  required
                  onChange={(e) => patch("date", e.target.value)}
                />
              </Field>
              <Field label={t("Regular opening")}>
                <input
                  type="time"
                  value={time(c.open)}
                  required
                  onChange={(e) => {
                    if (e.target.value) patch("open", minute(e.target.value));
                  }}
                />
              </Field>
              <Field label={t("Regular closing")}>
                <input
                  type="time"
                  value={time(c.close)}
                  required
                  onChange={(e) => {
                    if (e.target.value) patch("close", minute(e.target.value));
                  }}
                />
              </Field>
              <Field label={t("Experiment date")}>
                <input
                  type="date"
                  value={c.testDate}
                  required
                  min={addDays(c.date || "2026-11-14", 1)}
                  onChange={(e) => patch("testDate", e.target.value)}
                />
              </Field>
              <Field label={t("Review date")}>
                <input
                  type="date"
                  value={c.reviewDate}
                  required
                  min={c.testDate}
                  onChange={(e) => patch("reviewDate", e.target.value)}
                />
              </Field>
              <Field label={t("Goal")}>
                <select
                  value={c.goal}
                  onChange={(e) =>
                    patch("goal", e.target.value as Context["goal"])
                  }
                >
                  <option value="count">{t("Increase payment count")}</option>
                  <option value="average">
                    {t("Increase average payment value")}
                  </option>
                </select>
              </Field>
              <Field label={`${t("Flagging threshold")} (%)`}>
                <input
                  type="number"
                  min={5}
                  max={90}
                  value={c.threshold}
                  onChange={(e) => patch("threshold", +e.target.value)}
                />
              </Field>
            </div>
            <p className="small muted">
              {t("A bundle does not establish more customers or payments.")}
            </p>
          </section>
          <section className="panel">
            <h2>{t("Coverage & date exceptions")}</h2>
            <p className="small muted">
              {t(
                "Confirm only dates and hours actually covered by your upload.",
              )}
            </p>
            {dates.map((date) => {
              const cov = c.coverage[date] || {
                  state: "unknown",
                  start: 720,
                  end: 1200,
                },
                ex = c.exceptions[date];
              return (
                <details className="date-detail" key={date}>
                  <summary>
                    <span>
                      {date}
                      {date === c.date && (
                        <Tag tone="cyan">{t("Current window")}</Tag>
                      )}
                    </span>
                    <Tag tone={cov.state === "confirmed" ? "lime" : "amber"}>
                      {t(
                        cov.state === "confirmed"
                          ? "Complete upload coverage"
                          : "Coverage unknown",
                      )}
                    </Tag>
                  </summary>
                  <div className="date-detail-content">
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={cov.state === "confirmed"}
                        onChange={(e) =>
                          patch("coverage", {
                            ...c.coverage,
                            [date]: {
                              ...cov,
                              state: e.target.checked ? "confirmed" : "unknown",
                            },
                          })
                        }
                      />
                      {t("Complete upload coverage")}
                    </label>
                    <div className="form-grid">
                      <Field label={t("Coverage starts")}>
                        <input
                          type="time"
                          value={time(cov.start)}
                          onChange={(e) => {
                            if (e.target.value)
                              patch("coverage", {
                                ...c.coverage,
                                [date]: {
                                  ...cov,
                                  start: minute(e.target.value),
                                },
                              });
                          }}
                        />
                      </Field>
                      <Field label={t("Coverage ends")}>
                        <input
                          type="time"
                          value={time(cov.end)}
                          onChange={(e) => {
                            if (e.target.value)
                              patch("coverage", {
                                ...c.coverage,
                                [date]: { ...cov, end: minute(e.target.value) },
                              });
                          }}
                        />
                      </Field>
                    </div>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={!!ex}
                        onChange={(e) => {
                          const next = { ...c.exceptions };
                          if (e.target.checked)
                            next[date] = {
                              closed: false,
                              open: c.open,
                              close: c.close,
                              exclude: false,
                              reason: "",
                            };
                          else delete next[date];
                          patch("exceptions", next);
                        }}
                      />
                      {t("Opening override")} / {t("Exclude exceptional day")}
                    </label>
                    {ex && (
                      <>
                        <div className="form-grid">
                          <Field label={t("Opening override")}>
                            <input
                              type="time"
                              value={time(ex.open)}
                              onChange={(e) => {
                                if (e.target.value)
                                  patch("exceptions", {
                                    ...c.exceptions,
                                    [date]: {
                                      ...ex,
                                      open: minute(e.target.value),
                                    },
                                  });
                              }}
                            />
                          </Field>
                          <Field label={t("Closing override")}>
                            <input
                              type="time"
                              value={time(ex.close)}
                              onChange={(e) => {
                                if (e.target.value)
                                  patch("exceptions", {
                                    ...c.exceptions,
                                    [date]: {
                                      ...ex,
                                      close: minute(e.target.value),
                                    },
                                  });
                              }}
                            />
                          </Field>
                        </div>
                        <label className="check-field">
                          <input
                            type="checkbox"
                            checked={ex.closed}
                            onChange={(e) =>
                              patch("exceptions", {
                                ...c.exceptions,
                                [date]: { ...ex, closed: e.target.checked },
                              })
                            }
                          />
                          {t("Closed all day")}
                        </label>
                        <label className="check-field">
                          <input
                            type="checkbox"
                            checked={ex.exclude}
                            onChange={(e) =>
                              patch("exceptions", {
                                ...c.exceptions,
                                [date]: { ...ex, exclude: e.target.checked },
                              })
                            }
                          />
                          {t("Exclude exceptional day")}
                        </label>
                        <Field label={t("Exception reason")}>
                          <input
                            maxLength={200}
                            required={ex.exclude}
                            value={ex.reason}
                            onChange={(e) =>
                              patch("exceptions", {
                                ...c.exceptions,
                                [date]: { ...ex, reason: e.target.value },
                              })
                            }
                          />
                        </Field>
                      </>
                    )}
                  </div>
                </details>
              );
            })}
            <p className="small muted">
              {t("No coverage confirmation means unknown, never zero.")}
            </p>
          </section>
          <section className="save-context">
            <Field label={t("Why did this change?")}>
              <input
                value={reason}
                maxLength={240}
                required
                placeholder={t("Owner correction")}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {formError && (
              <p role="alert" className="form-error">
                {t(formError)}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              <Check size={17} />
              {t("Save context")}
            </Button>
          </section>
        </form>
      </div>
    </>
  );
}
