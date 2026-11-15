"use client";

import { useMemo } from "react";
import {
  Bill,
  Product,
  getSavedBills,
  getSavedProducts,
} from "@/lib/billing";
import {
  analyzeStoreBills,
} from "@/lib/ai-assistant";
import {
  Printer,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Award,
  Sparkles,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldCheck,
  Store,
} from "lucide-react";

export function PresentationReportScreen({
  lang,
  onGoToBilling,
  onGoToActions,
}: {
  lang: "en-IN" | "hi-IN" | "ta-IN";
  onGoToBilling: () => void;
  onGoToActions: () => void;
}) {
  const isTamil = lang === "ta-IN";
  const bills: Bill[] = useMemo(() => getSavedBills(), []);
  const products: Product[] = useMemo(() => getSavedProducts(), []);

  const analysis = useMemo(() => {
    return analyzeStoreBills(bills, "2026-11-15", products);
  }, [bills, products]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleDownloadHTML = () => {
    if (typeof window === "undefined") return;
    const reportElem = document.getElementById("presentation-report-paper");
    if (!reportElem) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>DukaanPulse - Executive Presentation Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 20px; color: #102c40; background: #fff; }
    .report-paper { max-width: 900px; margin: 0 auto; padding: 30px; border: 1px solid #cbd5e1; border-radius: 12px; }
    h1, h2, h3 { margin-top: 0; color: #002970; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .kpi-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; text-align: center; }
    .kpi-box strong { font-size: 22px; color: #007b94; display: block; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    th { background: #f1f5f9; font-size: 12px; }
    .alert-banner { background: #fff7ed; border: 1px solid #fdba74; padding: 14px; border-radius: 8px; margin: 16px 0; color: #9a3412; }
    .terms-box { background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 16px 0; }
    @media print {
      body { margin: 0; }
      .report-paper { border: none; box-shadow: none; padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="report-paper">
    ${reportElem.innerHTML}
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DukaanPulse-Executive-Presentation-Report-${analysis.todayDate}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="presentation-report-container">
      {/* Top Action Bar (Hidden during printing) */}
      <div className="report-top-actions no-print">
        <div>
          <h1 className="report-main-title">
            {isTamil
              ? "விளக்கக் காட்சி அறிக்கை & முன்மொழிவு (Presentation PDF)"
              : "Executive Presentation Report & Pilot Proposal"}
          </h1>
          <p className="report-subtitle">
            {isTamil
              ? "நீதிபதிகள், வழிகாட்டிகள் மற்றும் கூட்டாளர்களுக்கான அதிகாரப்பூர்வ ஆய்வு அறிக்கை."
              : "Official presentation-grade report for jury, mentors, and merchant partners."}
          </p>
        </div>

        <div className="action-buttons-group">
          <button className="download-btn" onClick={onGoToBilling}>
            <Store size={16} />
            <span>{isTamil ? "பில்லிங் POS" : "Billing POS"}</span>
          </button>
          <button className="download-btn" onClick={onGoToActions}>
            <span>{isTamil ? "முடிவு நடவடிக்கைகள்" : "Actions"}</span>
            <ArrowRight size={14} />
          </button>
          <button className="download-btn" onClick={handleDownloadHTML}>
            <Download size={16} />
            <span>{isTamil ? "HTML சேமி" : "Download HTML"}</span>
          </button>
          <button className="print-report-btn" onClick={handlePrint}>
            <Printer size={18} />
            <span>{isTamil ? "அறிக்கையை அச்சிடு / PDF சேமி" : "Print / Save PDF Report"}</span>
          </button>
        </div>
      </div>

      {/* Printable Report Paper */}
      <div id="presentation-report-paper" className="report-paper">
        {/* Header Strip */}
        <header className="report-header">
          <div className="header-left">
            <div className="report-logo">
              <span className="logo-icon">DP</span>
              <div>
                <h2>DukaanPulse</h2>
                <small>MERCHANT GROWTH AI · TRACK 1</small>
              </div>
            </div>
            <p className="hackathon-tag">
              Paytm Build for India AI Hackathon · Chennai · Team Trio
            </p>
          </div>

          <div className="header-right">
            <div className="store-badge">
              <Store size={15} />
              <strong>Marina Tea & Snacks</strong>
            </div>
            <span className="report-meta">
              Date: <strong>{analysis.todayDate}</strong> | Asia/Kolkata
            </span>
            <span className="report-status-badge verified">
              <CheckCircle2 size={12} /> Independent Pilot Proposal
            </span>
          </div>
        </header>

        <hr className="report-divider" />

        {/* 1. Executive Summary */}
        <section className="report-section">
          <h3 className="section-title">
            <FileText size={17} />
            1. Executive Summary & Value Proposition
          </h3>
          <p className="report-text">
            Small neighborhood snack shops and tea stalls frequently face silent demand dips during off-peak hours
            (such as the 12:00 PM – 3:00 PM slump or mid-afternoon windows) without clear metrics or actionable marketing tools.
            <strong> DukaanPulse</strong> transforms everyday payment signals into verified time-window diagnostics, generates
            instant dynamic Paytm UPI QR codes for streamlined billing, and provides owner-approved, margin-guarded combo experiments
            with full Indic voice briefings via Sarvam AI.
          </p>
        </section>

        {/* 2. Store Key Performance Indicators */}
        <section className="report-section">
          <h3 className="section-title">
            <Award size={17} />
            2. Verified Daily Store Performance (Today: {analysis.todayDate})
          </h3>

          <div className="report-kpi-grid">
            <div className="report-kpi-box">
              <span className="kpi-title">{isTamil ? "இன்றைய மொத்த வசூல்" : "Total Revenue"}</span>
              <strong className="kpi-num text-cyan">₹{analysis.todayRevenue}</strong>
              <small className="kpi-sub">{analysis.todayBillsCount} completed bills</small>
            </div>

            <div className="report-kpi-box">
              <span className="kpi-title">{isTamil ? "விற்பனையான பொருட்கள்" : "Units Sold"}</span>
              <strong className="kpi-num">{analysis.todayUnitsSold}</strong>
              <small className="kpi-sub">items dispensed</small>
            </div>

            <div className="report-kpi-box">
              <span className="kpi-title">{isTamil ? "சராசரி பில் மதிப்பு" : "Avg Ticket Size"}</span>
              <strong className="kpi-num">
                ₹{analysis.todayBillsCount > 0 ? Math.round(analysis.todayRevenue / analysis.todayBillsCount) : 0}
              </strong>
              <small className="kpi-sub">per customer transaction</small>
            </div>

            <div className="report-kpi-box">
              <span className="kpi-title">{isTamil ? "நேற்றுடன் ஒப்பீடு" : "Day-over-Day Dip"}</span>
              <strong className={`kpi-num ${analysis.isDayDip ? "text-amber" : "text-green"}`}>
                {analysis.isDayDip ? `-${analysis.dayOverDayDipPercent}%` : `+${analysis.dayOverDayDeltaRevenue}`}
              </strong>
              <small className="kpi-sub">vs yesterday (₹{analysis.yesterdayRevenue})</small>
            </div>
          </div>
        </section>

        {/* 3. Time-Window Sales Dip Diagnostics (DukaanPulse Signature Feature) */}
        <section className="report-section">
          <h3 className="section-title">
            <TrendingDown size={17} />
            3. Time-Window Dip Diagnostics & Root Cause Analysis
          </h3>
          <p className="report-text">
            Comparing today&apos;s transaction volume against matching historical weekday medians across operational windows:
          </p>

          <div className="table-responsive">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Time Window</th>
                  <th>Today&apos;s Bills</th>
                  <th>Today&apos;s Revenue</th>
                  <th>Historical Median</th>
                  <th>Performance Status</th>
                  <th>AI Diagnostic Note</th>
                </tr>
              </thead>
              <tbody>
                {analysis.timeWindows.map((win, idx) => (
                  <tr key={idx} className={win.isFlagged ? "flagged-row" : ""}>
                    <td><strong>{win.windowLabel}</strong></td>
                    <td>{win.todayCount}</td>
                    <td>₹{win.todayRevenue}</td>
                    <td>{win.historicalMedianCount} bills</td>
                    <td>
                      {win.isFlagged ? (
                        <span className="table-badge badge-alert">
                          ⚠️ {win.dipPercent}% Dip Flagged
                        </span>
                      ) : (
                        <span className="table-badge badge-normal">
                          ✓ Steady / Peak
                        </span>
                      )}
                    </td>
                    <td>
                      <small>{win.statusTa}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {analysis.flaggedDipWindows.length > 0 && (
            <div className="report-callout alert-callout">
              <div className="callout-head">
                <AlertTriangle size={18} />
                <strong>Primary Evidence Signal Detected</strong>
              </div>
              <p>
                <strong>{analysis.flaggedDipWindows[0].windowLabel}</strong> recorded a significant drop
                of <strong>{analysis.flaggedDipWindows[0].dipPercent}%</strong> compared to the historical baseline.
                Rather than accepting passive losses during quiet hours, DukaanPulse activates bounded, owner-approved merchant offers.
              </p>
            </div>
          )}
        </section>

        {/* 4. Owner-Approved Experiment: Decision Receipt & Economics */}
        <section className="report-section">
          <h3 className="section-title">
            <ShieldCheck size={17} />
            4. The Decision Receipt: Margin-Guarded Combo Experiment
          </h3>

          <div className="economics-card">
            <div className="combo-header">
              <div>
                <h4>Tea + Hot Snack Combo (தேநீர் + சிற்றுண்டி காம்போ)</h4>
                <p>Designed for the flagged slump window to stimulate incremental tea stall footfall.</p>
              </div>
              <span className="approved-pill">✓ Owner Approved Terms</span>
            </div>

            <div className="economics-grid">
              <div className="eco-item">
                <span>Standard Price</span>
                <strong>₹40.00</strong>
              </div>
              <div className="eco-item">
                <span>Promotional Discount</span>
                <strong className="text-amber">-₹5.00</strong>
              </div>
              <div className="eco-item">
                <span>Net Customer Price</span>
                <strong className="text-cyan">₹35.00</strong>
              </div>
              <div className="eco-item">
                <span>Unit Cost (COGS)</span>
                <strong>₹28.00</strong>
              </div>
              <div className="eco-item highlight">
                <span>Net Contribution / Redemption</span>
                <strong className="text-green">+₹7.00</strong>
              </div>
            </div>

            <div className="guardrails-row">
              <div className="guard-item">
                <small>Floor Protection:</small>
                <span>Contribution margin strictly guarded above ₹0 floor</span>
              </div>
              <div className="guard-item">
                <small>Capped Exposure:</small>
                <span>Max 20 redemptions (Hard budget cap ₹100 max promotional expense)</span>
              </div>
              <div className="guard-item">
                <small>Target Window:</small>
                <span>12:00 – 16:00 (Asia/Kolkata) | Single day verification</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Menu Profitability & Product Sales Breakdown */}
        <section className="report-section">
          <h3 className="section-title">
            <Layers size={17} />
            5. Product Mix & Menu Performance
          </h3>

          <div className="table-responsive">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Item Name (Tamil / English)</th>
                  <th>Price</th>
                  <th>Units Sold Today</th>
                  <th>Total Revenue</th>
                  <th>Revenue Share</th>
                </tr>
              </thead>
              <tbody>
                {analysis.productSalesList.map((p, idx) => (
                  <tr key={idx}>
                    <td>
                      <strong>{p.nameTa}</strong> <small>({p.name})</small>
                    </td>
                    <td>₹{p.units > 0 ? Math.round(p.revenue / p.units) : "—"}</td>
                    <td><strong>{p.units}</strong></td>
                    <td>₹{p.revenue}</td>
                    <td>
                      {analysis.todayRevenue > 0
                        ? Math.round((p.revenue / analysis.todayRevenue) * 100)
                        : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Indic Voice & Sarvam AI Integration */}
        <section className="report-section">
          <h3 className="section-title">
            <Sparkles size={17} />
            6. Indic Multilingual & Sarvam AI Architecture
          </h3>

          <div className="sarvam-integration-box">
            <div className="sarvam-feature-grid">
              <div className="sarvam-feature">
                <strong>Sarvam Bulbul:v3 (Text-to-Speech)</strong>
                <p>Delivers natural colloquial Tamil voice briefings of receipts, daily numbers, and Paytm Soundbox chime alerts.</p>
              </div>
              <div className="sarvam-feature">
                <strong>Sarvam Saaras:v3 (Speech-to-Text)</strong>
                <p>Enables hands-free spoken Tamil questions (&quot;இன்னைக்கு எவ்வளவு சேல்ஸ்?&quot;, &quot;எந்த நேரம் மந்தம்?&quot;) for busy merchants.</p>
              </div>
              <div className="sarvam-feature">
                <strong>Sarvam-105b (Reasoning & Focus)</strong>
                <p>Grounds merchant questions into validated financial parameters, preventing LLM numeric hallucinations.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="report-footer">
          <div className="footer-left">
            <strong>DukaanPulse Team Trio</strong> · Track 1: Merchant Growth AI · Chennai
            <p>Independent hackathon demonstration. No production Paytm connection or endorsement claimed.</p>
          </div>
          <div className="footer-right">
            <span>Generated: {new Date().toISOString().slice(0, 19).replace("T", " ")} IST</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
