"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Bill,
  Product,
  getSavedBills,
  getSavedProducts,
  speakTamil,
} from "@/lib/billing";
import {
  analyzeStoreBills,
  answerStoreAIQuestion,
  StoreAIAnalysis,
} from "@/lib/ai-assistant";
import {
  LiveWeatherData,
  WEATHER_PRESETS,
  fetchLiveOnlineWeather,
} from "@/lib/weather";
import {
  Mic,
  Volume2,
  VolumeX,
  Sparkles,
  Clock3,
  AlertTriangle,
  ArrowRight,
  Send,
  Bot,
  User,
  CheckCircle2,
  SlidersHorizontal,
  Zap,
  CloudSun,
  Layers,
  RefreshCw,
} from "lucide-react";

type Message = {
  id: string;
  sender: "user" | "ai";
  title?: string;
  text: string;
  timestamp: string;
  topic?: string;
};

export function AIAssistantScreen({
  lang,
  onGoToActions,
}: {
  lang: "en-IN" | "hi-IN" | "ta-IN";
  onGoToBilling?: () => void;
  onGoToActions: () => void;
}) {
  const isTamil = lang === "ta-IN";
  const [bills] = useState<Bill[]>(() => getSavedBills());
  const [products] = useState<Product[]>(() => getSavedProducts());
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Live Weather & Climate State (Online Open-Meteo Integration)
  const [weather, setWeather] = useState<LiveWeatherData>(WEATHER_PRESETS.cloudy);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherPreset, setWeatherPreset] = useState<string>("online");

  useEffect(() => {
    let active = true;
    setWeatherLoading(true);
    fetchLiveOnlineWeather()
      .then((w) => {
        if (active) {
          setWeather(w);
          setWeatherLoading(false);
        }
      })
      .catch(() => {
        if (active) setWeatherLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSelectWeather = (key: string) => {
    setWeatherPreset(key);
    if (key === "online") {
      setWeatherLoading(true);
      fetchLiveOnlineWeather().then((w) => {
        setWeather(w);
        setWeatherLoading(false);
      });
    } else if (key in WEATHER_PRESETS) {
      setWeather(WEATHER_PRESETS[key as keyof typeof WEATHER_PRESETS]);
    }
  };

  const currentHour = useMemo(() => new Date().getHours(), []);

  const initialReport = useMemo(() => {
    return analyzeStoreBills(bills, "2026-11-15", products, weather, currentHour).fullReportTa;
  }, [bills, products, weather, currentHour]);

  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: "welcome",
      sender: "ai",
      title: isTamil
        ? "வணக்கம்! DukaanPulse AI வணிக உதவியாளர் தயார்."
        : "Welcome! DukaanPulse AI Store Assistant is ready.",
      text: initialReport,
      timestamp: "இன்று",
      topic: "general",
    },
  ]);

  // Recognition ref
  const recognitionRef = useRef<unknown>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);

  const analysis: StoreAIAnalysis = useMemo(() => {
    return analyzeStoreBills(bills, "2026-11-15", products, weather, currentHour);
  }, [bills, products, weather, currentHour]);

  // Scroll to bottom on message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Voice Speech-To-Text (STT) toggle
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        (recognitionRef.current as { stop: () => void }).stop();
      }
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      (window as unknown as { SpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      alert(
        isTamil
          ? "உங்கள் உலாவியில் குரல் உள்ளீடு (STT) ஆதரிக்கப்படவில்லை. தயவுசெய்து தட்டச்சு செய்யவும்."
          : "Voice recognition not supported in this browser. Please type.",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass() as {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        start: () => void;
        stop: () => void;
        onstart: () => void;
        onresult: (e: {
          results: { [key: number]: { [key: number]: { transcript: string } } };
        }) => void;
        onerror: (e: unknown) => void;
        onend: () => void;
      };

      recognition.lang = "ta-IN"; // Tamil India
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript && transcript.trim()) {
          setInputText(transcript);
          handleAskAI(transcript);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition error:", err);
      setIsListening(false);
    }
  };

  // Submit Question to AI
  const handleAskAI = (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;

    msgCounter.current += 1;
    const count = msgCounter.current;

    const userMsg: Message = {
      id: `user_msg_${count}`,
      sender: "user",
      text: q,
      timestamp: "இப்போது",
    };

    const reply = answerStoreAIQuestion(
      q,
      bills,
      "2026-11-15",
      products,
      weather,
      currentHour,
    );

    const aiMsg: Message = {
      id: `ai_msg_${count}`,
      sender: "ai",
      title: reply.title,
      text: reply.answerTa,
      timestamp: "இப்போது",
      topic: reply.topic,
    };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInputText("");

    // Read answer out loud using Tamil TTS
    handlePlayTTS(reply.answerTa);
  };

  // Text-To-Speech (TTS)
  const handlePlayTTS = (textToSpeak: string) => {
    setIsSpeaking(true);
    speakTamil(
      textToSpeak,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false),
    );
  };

  const handleStopTTS = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  return (
    <div className="ai-assistant-container">
      {/* Top Banner */}
      <div className="ai-topbar">
        <div className="ai-title-wrap">
          <div className="ai-symbol-badge">
            <Sparkles size={24} />
          </div>
          <div>
            <h1 className="ai-title">
              {isTamil
                ? "DukaanPulse AI வணிக உதவியாளர்"
                : "DukaanPulse AI Store Assistant"}
            </h1>
            <p className="ai-subtitle">
              {isTamil
                ? "விற்பனை சரிவு ஆய்வு, நேரச் சாளர பரிசோதனை (DukaanPulse Feature) மற்றும் தமிழ் குரல் உரையாடல்."
                : "Real-time sales dip diagnostics, time-window dip analysis, and Tamil voice conversation."}
            </p>
          </div>
        </div>

        <div className="ai-status-pill">
          <span className="live-dot"></span>
          <span>Sarvam AI & Grounded Tamil Voice Active</span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* LIVE CLIMATE, WEATHER & TIME STORE GUIDE (OPEN-METEO)   */}
      {/* ======================================================== */}
      <div className="weather-guide-card">
        <div className="weather-header">
          <div className="weather-header-left">
            <span className="weather-main-emoji">{weather.emoji}</span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="weather-temp-num">{weather.tempC}°C</span>
                <span className="weather-condition-label">
                  {isTamil ? weather.conditionLabelTa : weather.conditionLabelEn}
                </span>
              </div>
              <small style={{ color: "#64748b", fontSize: 11 }}>
                {weather.city} · {weather.updatedAt}
              </small>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="weather-online-badge">
              <span className="live-dot"></span>
              <span>
                {weather.source === "online"
                  ? isTamil ? "நேரடி ஆன்லைன் தகவல்" : "Live Online Data"
                  : isTamil ? "பரிசோதனை வானிலை" : "Simulated Weather"}
              </span>
            </span>
            <button
              className="weather-preset-pill"
              onClick={() => handleSelectWeather("online")}
              disabled={weatherLoading}
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <RefreshCw size={12} className={weatherLoading ? "spin" : ""} />
              <span>{isTamil ? "ஆன்லைன் புதுப்பி" : "Sync Live"}</span>
            </button>
          </div>
        </div>

        {/* Climate Metrics Row */}
        <div className="weather-meta-row">
          <span>💧 {isTamil ? "ஈரப்பதம்:" : "Humidity:"} <strong>{weather.humidity}%</strong></span>
          <span>🌧️ {isTamil ? "மழை அளவு:" : "Rainfall:"} <strong>{weather.precipitationMm} mm</strong></span>
          <span>💨 {isTamil ? "காற்று வேகம்:" : "Wind:"} <strong>{weather.windSpeedKmH} km/h</strong></span>
          <span>
            ⏰ {isTamil ? "இயக்க நேரம்:" : "Time Window:"}{" "}
            <strong>
              {currentHour < 11
                ? (isTamil ? "காலை வேளை (07:00 - 11:00)" : "Morning Rush (07-11)")
                : currentHour < 15
                ? (isTamil ? "மதிய மந்தமான வேளை (11:00 - 15:00)" : "Afternoon Slump (11-15)")
                : currentHour < 19
                ? (isTamil ? "மாலை பீக் வேளை (15:00 - 19:00)" : "Evening Rush (15-19)")
                : (isTamil ? "இரவு வேளை (19:00 - 22:00)" : "Night (19-22)")}
            </strong>
          </span>
        </div>

        {/* Weather Preset Selector Bar */}
        <div className="weather-presets-bar">
          <span style={{ fontSize: 11, fontWeight: 700, color: "#475569", whiteSpace: "nowrap" }}>
            {isTamil ? "வானிலை மாதிரி தேர்வு:" : "Test Weather:"}
          </span>
          {[
            { id: "online", label: isTamil ? "🌐 நேரடி ஆன்லைன்" : "🌐 Live Online" },
            { id: "rain", label: "🌧️ மழை / குளிர் (Rainy)" },
            { id: "hot", label: "☀️ கடும் வெயில் (Hot Summer)" },
            { id: "cloudy", label: "⛅ மேகமூட்டம் (Cloudy)" },
            { id: "pleasant", label: "🍃 மிதமான இதமான (Pleasant)" },
          ].map((preset) => (
            <button
              key={preset.id}
              className={`weather-preset-pill ${weatherPreset === preset.id ? "active" : ""}`}
              onClick={() => handleSelectWeather(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Live Retail Advice Box */}
        <div className="weather-advice-box">
          <div className="weather-advice-title">
            <CloudSun size={17} style={{ color: "#0284c7" }} />
            <span>{analysis.weatherAdvice.title}</span>
          </div>
          <p className="weather-advice-text">{analysis.weatherAdvice.adviceText}</p>
          <div className="recommended-items-row">
            <span style={{ fontWeight: 700, color: "#166534" }}>
              {isTamil ? "பரிந்துரைக்கப்படும் பொருட்கள்:" : "High-Demand Items:"}
            </span>
            {analysis.weatherAdvice.recommendedItems.map((item, idx) => (
              <span key={idx} className="rec-item-badge">
                ✓ {item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 6 SALES REPORTS PERFORMANCE BREAKDOWN (MULTI-DAY TREND) */}
      {/* ======================================================== */}
      <div className="six-day-card">
        <div className="six-day-header">
          <h3 className="six-day-title">
            <Layers size={18} style={{ color: "var(--navy)" }} />
            <span>
              {isTamil
                ? "6 நாள் விற்பனை அறிக்கைகளின் ஒப்பீடு (6 Sales Reports Trend)"
                : "6-Day Sales Reports Performance Trend"}
            </span>
          </h3>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {isTamil
              ? `6 நாள் மொத்த வசூல்: ₹${analysis.total6DayRevenue} | தினசரி சராசரி: ₹${analysis.avg6DayDailyRevenue}`
              : `Total 6-Day Revenue: ₹${analysis.total6DayRevenue} | Daily Avg: ₹${analysis.avg6DayDailyRevenue}`}
          </div>
        </div>

        <div className="six-day-grid">
          {analysis.sixDayReports.map((r, i) => (
            <div key={i} className={`day-box ${r.date === "2026-11-15" ? "is-today" : ""}`}>
              <span className="day-date">
                {r.date === "2026-11-15" ? (isTamil ? "இன்று (15 Nov)" : "Today") : r.date.slice(5)}
              </span>
              <strong className="day-rev">₹{r.revenue}</strong>
              <small className="day-sub">{r.billsCount} bills</small>
              <small style={{ fontSize: 9.5, color: "#0284c7", fontWeight: 600 }}>
                {r.topItem}
              </small>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* DUKAANPULSE TIME-WINDOW SALES DIP CARD (SOUND TO TIME DIP) */}
      {/* ======================================================== */}
      <div className="ai-dip-card">
        <div className="dip-card-head">
          <div className="dip-head-left">
            <Clock3 size={20} className="text-amber" />
            <div>
              <h3>
                {isTamil
                  ? "நேரச் சாளர விற்பனை சரிவு ஆய்வு (DukaanPulse Time-Window Dips)"
                  : "Time-Window Sales Dip Diagnostics"}
              </h3>
              <p>
                {isTamil
                  ? "ஒவ்வொரு நேரத்திலும் முந்தைய சராசரியை விட விற்பனை எவ்வளவு குறைந்துள்ளது (சரிவு) என்பதை AI கண்டறிந்துள்ளது."
                  : "Detects time-window transaction drops against historical medians to flag revenue leaks."}
              </p>
            </div>
          </div>
          <button className="goto-actions-pill" onClick={onGoToActions}>
            <SlidersHorizontal size={15} />
            <span>{isTamil ? "காம்போ சலுகை உருவாக்குக" : "Create Combo Offer"}</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {/* Windows Grid */}
        <div className="windows-grid">
          {analysis.timeWindows.map((win, idx) => (
            <div
              key={idx}
              className={`window-card ${win.isFlagged ? "flagged-window" : ""}`}
            >
              <div className="window-header">
                <strong>{win.windowLabel}</strong>
                {win.isFlagged ? (
                  <span className="dip-badge">
                    <AlertTriangle size={13} />
                    {win.dipPercent}% {isTamil ? "சரிவு!" : "Dip!"}
                  </span>
                ) : (
                  <span className="normal-badge">
                    <CheckCircle2 size={13} />
                    {isTamil ? "சீர்" : "Normal"}
                  </span>
                )}
              </div>

              <div className="window-counts-row">
                <div>
                  <small>{isTamil ? "இன்று பில்கள்" : "Today Bills"}</small>
                  <strong>{win.todayCount}</strong>
                </div>
                <div className="count-divider">vs</div>
                <div>
                  <small>{isTamil ? "முந்தைய சராசரி" : "Past Median"}</small>
                  <strong>{win.historicalMedianCount}</strong>
                </div>
                <div className="window-rev">
                  <small>{isTamil ? "இன்று வசூல்" : "Revenue"}</small>
                  <strong>₹{win.todayRevenue}</strong>
                </div>
              </div>

              <div className="window-status-text">
                <p>{win.statusTa}</p>
                {win.isFlagged && (
                  <div className="ai-rec-box">
                    <Zap size={14} className="rec-icon" />
                    <span>{win.recommendationTa}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================== */}
      {/* DAY-OVER-DAY SALES DIP KPI SUMMARY */}
      {/* ======================================================== */}
      <div className="ai-kpis-row">
        <div className="ai-kpi-card">
          <span className="kpi-tag">{isTamil ? "இன்றைய விற்பனை" : "Today Sales"}</span>
          <strong className="kpi-big text-cyan">₹{analysis.todayRevenue}</strong>
          <small>{analysis.todayBillsCount} {isTamil ? "பில்கள் போடப்பட்டுள்ளன" : "bills recorded"}</small>
        </div>

        <div className={`ai-kpi-card ${analysis.isDayDip ? "kpi-alert" : "kpi-success"}`}>
          <span className="kpi-tag">
            {isTamil ? "நேற்றுடன் ஒப்பீடு (விற்பனை சரிவு)" : "Comparison vs Yesterday"}
          </span>
          <strong className="kpi-big">
            {analysis.isDayDip ? (
              <span className="text-red">
                -₹{Math.abs(analysis.dayOverDayDeltaRevenue)} ({analysis.dayOverDayDipPercent}% {isTamil ? "குறைவு" : "Dip"})
              </span>
            ) : (
              <span className="text-green">
                +₹{analysis.dayOverDayDeltaRevenue} ({isTamil ? "அதிகம்" : "Growth"})
              </span>
            )}
          </strong>
          <small>
            {isTamil ? `நேற்றைய வசூல்: ₹${analysis.yesterdayRevenue}` : `Yesterday: ₹${analysis.yesterdayRevenue}`}
          </small>
        </div>

        <div className="ai-kpi-card">
          <span className="kpi-tag">{isTamil ? "அதிகம் விற்ற பொருள்" : "Top Item"}</span>
          <strong className="kpi-big text-navy">
            {analysis.topProduct ? analysis.topProduct.nameTa : "—"}
          </strong>
          <small>
            {analysis.topProduct
              ? `${analysis.topProduct.units} ${isTamil ? "எண்ணிக்கை" : "sold"} (₹${analysis.topProduct.revenue})`
              : "பதிவு இல்லை"}
          </small>
        </div>
      </div>

      {/* ======================================================== */}
      {/* INTERACTIVE CHAT & VOICE CONVERSATION SECTION */}
      {/* ======================================================== */}
      <div className="ai-chat-card">
        <div className="chat-card-header">
          <div className="chat-header-left">
            <Bot size={22} className="text-cyan" />
            <div>
              <h3>
                {isTamil
                  ? "AI வணிக உதவியாளருடன் குரல் உரையாடல்"
                  : "Conversational Store Assistant"}
              </h3>
              <p>
                {isTamil
                  ? "மைக் பட்டனை அழுத்தி தமிழில் பேசலாம்; AI பதில்களை தமிழ் குரலில் பேசிப் புரியவைக்கும்."
                  : "Speak in Tamil using microphone; AI understands and replies aloud."}
              </p>
            </div>
          </div>

          <div className="chat-audio-controls">
            {isSpeaking ? (
              <button className="tts-stop-btn" onClick={handleStopTTS}>
                <VolumeX size={16} />
                <span>{isTamil ? "குரலை நிறுத்துக" : "Stop Speech"}</span>
              </button>
            ) : (
              <span className="tts-hint">
                <Volume2 size={16} />
                {isTamil ? "குரல் அறிவிப்பு தயார்" : "Voice Ready"}
              </span>
            )}
          </div>
        </div>

        {/* Quick Voice Question Chips */}
        <div className="quick-query-chips">
          <span className="chips-label">
            {isTamil ? "உடனடிக் கேள்விகள்:" : "Quick Queries:"}
          </span>
          {[
            {
              label: isTamil ? "🌤️ வானிலைக்கேற்ப என்ன விற்கலாம்?" : "Weather Demand",
              q: "இன்றைய வானிலை மற்றும் தட்பவெப்பத்திற்கு என்ன விற்கலாம்?",
            },
            {
              label: isTamil ? "🤖 நேரடி வழிகாட்டி (Smart Guide)" : "Store Guide",
              q: "இன்றைய நேரடி வழிகாட்டி உதவி சொல்லுங்கள்",
            },
            {
              label: isTamil ? "📊 6 நாள் விற்பனை அறிக்கை" : "6-Day Report",
              q: "6 நாள் விற்பனை அறிக்கை விவரம் கொடுங்கள்",
            },
            {
              label: isTamil ? "⏰ எந்த நேரத்துல சேல்ஸ் சரிந்தது?" : "Time Window Dip",
              q: "எந்த நேரத்தில் விற்பனை சரிந்தது அல்லது மந்தமாக இருந்தது?",
            },
            {
              label: isTamil ? "📉 நேற்றை விட எவ்வளவு கம்மியாச்சு?" : "Sales Dip",
              q: "நேற்றை விட இன்று எவ்வளவு கம்மியாகியுள்ளது?",
            },
            {
              label: isTamil ? "🛍️ அதிகம் விற்ற பொருள் எது?" : "Top Items",
              q: "எந்த பொருள் அதிகம் மற்றும் குறைவாக விற்றது?",
            },
          ].map((item, i) => (
            <button
              key={i}
              className="query-pill"
              onClick={() => handleAskAI(item.q)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Chat Messages Feed */}
        <div className="chat-messages-container">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`message-bubble ${m.sender === "user" ? "user-bubble" : "ai-bubble"}`}
            >
              <div className="bubble-sender">
                {m.sender === "ai" ? (
                  <span className="sender-tag ai-tag">
                    <Bot size={14} /> DukaanPulse AI
                  </span>
                ) : (
                  <span className="sender-tag user-tag">
                    <User size={14} /> {isTamil ? "வணிகர் (நீங்கள்)" : "You"}
                  </span>
                )}
                <span className="bubble-time">{m.timestamp}</span>
              </div>

              {m.title && <h4 className="bubble-title">{m.title}</h4>}
              <p className="bubble-text">{m.text}</p>

              {m.sender === "ai" && (
                <div className="bubble-actions">
                  <button
                    className="speak-bubble-btn"
                    onClick={() => handlePlayTTS(m.text)}
                  >
                    <Volume2 size={15} />
                    <span>{isTamil ? "தமிழில் கேட்க" : "Listen in Tamil"}</span>
                  </button>
                  {m.topic === "time_window" && (
                    <button
                      className="offer-action-btn"
                      onClick={onGoToActions}
                    >
                      <SlidersHorizontal size={14} />
                      <span>{isTamil ? "சலுகை உருவாக்குக" : "Create Offer"}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>

        {/* Input Bar with Microphone & Text */}
        <div className="chat-input-bar">
          <button
            type="button"
            className={`mic-button ${isListening ? "mic-recording" : ""}`}
            onClick={toggleListening}
            title={
              isListening
                ? "கேட்கிறது... பேசவும்"
                : "குரல் மூலம் பேச மைக் அழுத்தவும்"
            }
          >
            {isListening ? (
              <span className="pulse-ring">
                <Mic size={22} className="mic-icon-active" />
              </span>
            ) : (
              <Mic size={20} />
            )}
          </button>

          <input
            type="text"
            className="chat-text-input"
            placeholder={
              isListening
                ? isTamil
                  ? "கேட்கிறது... தமிழில் பேசவும்..."
                  : "Listening... speak now in Tamil..."
                : isTamil
                  ? "கேள்வி கேளுங்கள் (எ.கா: நேற்றை விட எவ்வளவு கம்மியாச்சு?)..."
                  : "Ask AI (e.g. How much dip vs yesterday?)..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAskAI(inputText);
            }}
          />

          <button
            type="button"
            className="send-button"
            onClick={() => handleAskAI(inputText)}
            disabled={!inputText.trim()}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
