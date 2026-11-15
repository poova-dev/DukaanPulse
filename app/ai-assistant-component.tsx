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

  const initialReport = useMemo(() => {
    return analyzeStoreBills(bills, "2026-11-15", products).fullReportTa;
  }, [bills, products]);

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
    return analyzeStoreBills(bills, "2026-11-15", products);
  }, [bills, products]);

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

    const reply = answerStoreAIQuestion(q, bills, "2026-11-15", products);

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
              label: isTamil ? "🎙️ இன்றைய முழு அறிக்கை" : "Daily Report",
              q: "இன்றைய முழு விற்பனை அறிக்கை என்ன?",
            },
            {
              label: isTamil ? "📉 நேற்றை விட எவ்வளவு கம்மியாச்சு?" : "Sales Dip vs Yesterday",
              q: "நேற்றை விட இன்று எவ்வளவு கம்மியாகியுள்ளது?",
            },
            {
              label: isTamil ? "⏰ எந்த நேரத்துல சேல்ஸ் சரிந்தது?" : "Time Window Dip",
              q: "எந்த நேரத்தில் விற்பனை சரிந்தது அல்லது மந்தமாக இருந்தது?",
            },
            {
              label: isTamil ? "🛍️ எந்த பொருள் அதிகம் விற்றது?" : "Top Items",
              q: "எந்த பொருள் அதிகம் மற்றும் குறைவாக விற்றது?",
            },
            {
              label: isTamil ? "💡 விற்பனையை கூட்ட என்ன யோசனை?" : "Offer Advice",
              q: "விற்பனையை அதிகரிக்க AI யோசனை என்ன?",
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
