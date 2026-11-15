import { Bill, Product, DEFAULT_PRODUCTS } from "./billing";
import {
  LiveWeatherData,
  WEATHER_PRESETS,
  getWeatherAndTimeAdvice,
} from "./weather";

export type DayReportSummary = {
  date: string;
  revenue: number;
  billsCount: number;
  topItem: string;
};

export type TimeWindowDip = {
  windowLabel: string; // e.g. "13:00 - 16:00 (மதியம்)"
  startHour: number;
  endHour: number;
  todayCount: number;
  todayRevenue: number;
  historicalMedianCount: number;
  dipPercent: number; // e.g. 50%
  isFlagged: boolean; // dipPercent >= 25%
  statusTa: string;
  recommendationTa: string;
};

export type StoreAIAnalysis = {
  todayDate: string;
  yesterdayDate: string;
  todayRevenue: number;
  todayBillsCount: number;
  todayUnitsSold: number;
  yesterdayRevenue: number;
  yesterdayBillsCount: number;
  dayOverDayDeltaRevenue: number; // today - yesterday
  dayOverDayDipPercent: number; // e.g. -35%
  isDayDip: boolean;

  // Products
  topProduct: { name: string; nameTa: string; units: number; revenue: number } | null;
  lowestProduct: { name: string; nameTa: string; units: number; revenue: number } | null;
  productSalesList: { name: string; nameTa: string; units: number; revenue: number }[];

  // Time window dips (DukaanPulse signature feature)
  timeWindows: TimeWindowDip[];
  flaggedDipWindows: TimeWindowDip[];

  // 6 Sales Reports Breakdown (Multi-day performance)
  sixDayReports: DayReportSummary[];
  total6DayRevenue: number;
  avg6DayDailyRevenue: number;

  // Live Weather & Climate Integration
  activeWeather: LiveWeatherData;
  weatherAdvice: ReturnType<typeof getWeatherAndTimeAdvice>;
  weatherReportTa: string;
  sixDaySummaryTa: string;

  // Spoken Tamil briefing
  fullReportTa: string;
  dipSummaryTa: string;
  productSummaryTa: string;
  offerAdviceTa: string;
};

export const STANDARD_WINDOWS = [
  { label: "07:00 - 11:00 (காலை வேளை)", start: 7, end: 11 },
  { label: "11:00 - 15:00 (மதிய மந்தமான வேளை)", start: 11, end: 15 },
  { label: "15:00 - 19:00 (மாலை பீக் வேளை)", start: 15, end: 19 },
  { label: "19:00 - 22:00 (இரவு வேளை)", start: 19, end: 22 },
];

/**
 * Calculates complete AI analysis for the store:
 * 1. Day sales and dip vs previous days
 * 2. Time-window dip (DukaanPulse sound-to-time dip detection)
 * 3. Item-wise sales and ranking
 */
export function analyzeStoreBills(
  bills: Bill[],
  todayDate = "2026-11-15",
  products: Product[] = DEFAULT_PRODUCTS,
  weather?: LiveWeatherData,
  currentHour?: number,
): StoreAIAnalysis {
  const dates = [...new Set(bills.map((b) => b.date))].sort().reverse();
  const actualToday = dates.includes(todayDate) ? todayDate : dates[0] || "2026-11-15";
  const yesterdayIndex = dates.indexOf(actualToday) + 1;
  const yesterdayDate = dates[yesterdayIndex] || "2026-11-14";

  const todayBills = bills.filter((b) => b.date === actualToday);
  const yesterdayBills = bills.filter((b) => b.date === yesterdayDate);
  const historicalDays = dates.filter((d) => d !== actualToday);

  // Today metrics
  const todayRevenue = todayBills.reduce((acc, b) => acc + b.totalAmount, 0);
  const todayBillsCount = todayBills.length;
  const todayUnitsSold = todayBills.reduce((acc, b) => acc + b.totalItems, 0);

  // Yesterday metrics
  const yesterdayRevenue = yesterdayBills.reduce((acc, b) => acc + b.totalAmount, 0);
  const yesterdayBillsCount = yesterdayBills.length;

  // Day-over-day dip
  const deltaRevenue = todayRevenue - yesterdayRevenue;
  const isDayDip = deltaRevenue < 0;
  const dayOverDayDipPercent =
    yesterdayRevenue > 0
      ? Math.round(Math.abs(deltaRevenue / yesterdayRevenue) * 100)
      : 0;

  // Product sales breakdown
  const prodMap = new Map<string, { units: number; revenue: number }>();
  todayBills.forEach((b) => {
    b.items.forEach((it) => {
      const cur = prodMap.get(it.productId) || { units: 0, revenue: 0 };
      prodMap.set(it.productId, {
        units: cur.units + it.quantity,
        revenue: cur.revenue + it.itemTotal,
      });
    });
  });

  const productSalesList = products
    .map((p) => {
      const s = prodMap.get(p.id) || { units: 0, revenue: 0 };
      return {
        name: p.name,
        nameTa: p.nameTa,
        units: s.units,
        revenue: s.revenue,
      };
    })
    .filter((p) => p.units > 0)
    .sort((a, b) => b.units - a.units);

  const topProduct = productSalesList.length > 0 ? productSalesList[0] : null;
  const lowestProduct =
    productSalesList.length > 0 ? productSalesList[productSalesList.length - 1] : null;

  // Time Window Dips (DukaanPulse Signature Feature)
  const timeWindows: TimeWindowDip[] = STANDARD_WINDOWS.map((win) => {
    const todayWindowBills = todayBills.filter(
      (b) => b.hour >= win.start && b.hour < win.end,
    );
    const todayCount = todayWindowBills.length;
    const todayWindowRevenue = todayWindowBills.reduce(
      (acc, b) => acc + b.totalAmount,
      0,
    );

    // Compute historical median count for this specific window across past days
    const pastCounts = historicalDays.map((d) => {
      return bills.filter(
        (b) => b.date === d && b.hour >= win.start && b.hour < win.end,
      ).length;
    });

    pastCounts.sort((a, b) => a - b);
    const mid = Math.floor(pastCounts.length / 2);
    const historicalMedianCount =
      pastCounts.length === 0
        ? 0
        : pastCounts.length % 2 === 0
          ? Math.round((pastCounts[mid - 1] + pastCounts[mid]) / 2)
          : pastCounts[mid];

    const diff = historicalMedianCount - todayCount;
    const dipPercent =
      historicalMedianCount > 0 && diff > 0
        ? Math.round((diff / historicalMedianCount) * 100)
        : 0;
    const isFlagged = dipPercent >= 25 && todayCount < historicalMedianCount;

    let statusTa = "விற்பனை சீராக உள்ளது";
    let recommendationTa = "வழக்கமான விற்பனையைத் தொடரவும்.";

    if (isFlagged) {
      statusTa = `⚠️ ${dipPercent}% விற்பனை சரிவு! (முந்தைய சராசரி ${historicalMedianCount} பில்கள், இன்று ${todayCount} மட்டுமே)`;
      recommendationTa = `இந்த ${win.label} நேரத்தில் 'டீ + சமோசா ₹25 காம்போ' அல்லது ₹5 சிறப்பு சலுகை மூலம் சரிவை ஈடுசெய்யலாம்!`;
    } else if (todayCount > historicalMedianCount && todayCount > 0) {
      statusTa = `🔥 அதிக விற்பனை! முந்தைய சராசரியை விட அதிகம்.`;
      recommendationTa = `முக்கிய பொருட்களின் இருப்பு குறையாமல் பார்த்துக் கொள்ளவும்.`;
    }

    return {
      windowLabel: win.label,
      startHour: win.start,
      endHour: win.end,
      todayCount,
      todayRevenue: todayWindowRevenue,
      historicalMedianCount,
      dipPercent,
      isFlagged,
      statusTa,
      recommendationTa,
    };
  });

  const flaggedDipWindows = timeWindows.filter((w) => w.isFlagged);

  // Spoken Tamil briefing texts
  const dipPhrase = isDayDip
    ? `நேற்றைய விற்பனையை விட இன்று ரூபாய் ${Math.abs(deltaRevenue)} (${dayOverDayDipPercent}%) குறைவாக உள்ளது.`
    : `நேற்றைய விற்பனையை விட இன்று ரூபாய் ${deltaRevenue} அதிகமாக விற்பனையாகியுள்ளது!`;

  const windowDipPhrase =
    flaggedDipWindows.length > 0
      ? `குறிப்பாக ${flaggedDipWindows.map((w) => w.windowLabel).join(", ")} நேரத்தில் விற்பனை கணிசமாக சரிந்துள்ளது.`
      : `அனைத்து நேரங்களிலும் விற்பனை சுமாராக நடந்துள்ளது.`;

  const topProdPhrase = topProduct
    ? `இன்று அதிகம் விற்ற பொருள் ${topProduct.nameTa}, மொத்தம் ${topProduct.units} விற்று ரூபாய் ${topProduct.revenue} வசூலானது.`
    : `விற்பனை விவரம் பதிவு செய்யப்படுகிறது.`;

  const fullReportTa = `வணக்கம்! உங்கள் கடையின் AI ஆய்வு அறிக்கை: இன்று ${actualToday} அன்று மொத்தம் ${todayRevenue} ரூபாய் வசூலாகியுள்ளது, ${todayBillsCount} பில்கள் போடப்பட்டுள்ளன. ${dipPhrase} ${topProdPhrase} ${windowDipPhrase}`;

  const dipSummaryTa = isDayDip
    ? `விற்பனை சரிவு ஆய்வு: இன்று நேற்றை விட ரூபாய் ${Math.abs(deltaRevenue)} குறைவு (${dayOverDayDipPercent}% சரிவு). ${windowDipPhrase}`
    : `இன்று சரிவு எதுவும் இல்லை! நேற்றை விட ரூபாய் ${deltaRevenue} கூடுதலாக விற்பனை ஆகியுள்ளது.`;

  const productSummaryTa = topProduct
    ? `பொருட்கள் விற்பனை நிலவரம்: முதலிடத்தில் ${topProduct.nameTa} (${topProduct.units} எண்ணிக்கை, ₹${topProduct.revenue}). ${lowestProduct && lowestProduct.name !== topProduct.name ? `குறைந்த விற்பனையில் ${lowestProduct.nameTa} (${lowestProduct.units} எண்ணிக்கை).` : ""}`
    : `பொருட்கள் விற்பனை விவரம் பதிவு செய்யப்படுகிறது.`;

  const offerAdviceTa =
    flaggedDipWindows.length > 0
      ? `DukaanPulse AI பரிந்துரை: சரிவு கண்டறியப்பட்ட ${flaggedDipWindows[0].windowLabel} நேரத்திற்கு 'டீ + சமோசா ₹25 காம்போ' அறிவித்து ₹150 முதல் ₹300 வரை கூடுதல் வருவாய் ஈட்டலாம். முடிவை நீங்களே அங்கீகரித்து சுவரொட்டி தயார் செய்யலாம்.`
      : `தற்போதைய விற்பனை போக்கு சீராக உள்ளது. புதிய காம்போ சலுகைகள் மூலம் வாடிக்கையாளர் வருகையை மேலும் 15% வரை உயர்த்தலாம்.`;

  // 6 Sales Reports Breakdown (Multi-day performance)
  const sixDates = dates.slice(0, 6);
  const sixDayReports: DayReportSummary[] = sixDates.map((d) => {
    const dBills = bills.filter((b) => b.date === d);
    const dRev = dBills.reduce((acc, b) => acc + b.totalAmount, 0);
    const dCount = dBills.length;
    const dProdCounts: Record<string, number> = {};
    dBills.forEach((b) => {
      b.items.forEach((it) => {
        dProdCounts[it.name] = (dProdCounts[it.name] || 0) + it.quantity;
      });
    });
    const topEntry = Object.entries(dProdCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      date: d,
      revenue: dRev,
      billsCount: dCount,
      topItem: topEntry ? topEntry[0] : "Masala Tea",
    };
  });
  const total6DayRevenue = sixDayReports.reduce((acc, r) => acc + r.revenue, 0);
  const avg6DayDailyRevenue = Math.round(
    total6DayRevenue / (sixDayReports.length || 1),
  );
  const bestDay = [...sixDayReports].sort((a, b) => b.revenue - a.revenue)[0];
  const sixDaySummaryTa = `கடந்த 6 நாட்களின் விற்பனை அறிக்கை: மொத்தம் ₹${total6DayRevenue} வசூல், தினசரி சராசரி ₹${avg6DayDailyRevenue}. அதிகபட்ச விற்பனை நாள் ${bestDay?.date || actualToday} (₹${bestDay?.revenue || todayRevenue}). இன்று ₹${todayRevenue} வசூலாகியுள்ளது.`;

  // Live Weather & Climate Integration
  const activeWeather = weather || WEATHER_PRESETS.cloudy;
  const activeHour = currentHour ?? new Date().getHours();
  const weatherAdvice = getWeatherAndTimeAdvice(activeWeather, activeHour, true);
  const weatherReportTa = `தற்போதைய வானிலை: ${activeWeather.emoji} ${activeWeather.conditionLabelTa} (${activeWeather.tempC}°C, ஈரப்பதம் ${activeWeather.humidity}%). ${weatherAdvice.adviceText} பரிந்துரைக்கப்படும் பொருட்கள்: ${weatherAdvice.recommendedItems.join(", ")}.`;

  return {
    todayDate: actualToday,
    yesterdayDate,
    todayRevenue,
    todayBillsCount,
    todayUnitsSold,
    yesterdayRevenue,
    yesterdayBillsCount,
    dayOverDayDeltaRevenue: deltaRevenue,
    dayOverDayDipPercent,
    isDayDip,
    topProduct,
    lowestProduct,
    productSalesList,
    timeWindows,
    flaggedDipWindows,
    sixDayReports,
    total6DayRevenue,
    avg6DayDailyRevenue,
    activeWeather,
    weatherAdvice,
    weatherReportTa,
    sixDaySummaryTa,
    fullReportTa,
    dipSummaryTa,
    productSummaryTa,
    offerAdviceTa,
  };
}

/**
 * Intelligent Tamil conversational question answering based on store bills
 */
export function answerStoreAIQuestion(
  question: string,
  bills: Bill[],
  todayDate = "2026-11-15",
  products: Product[] = DEFAULT_PRODUCTS,
  weather?: LiveWeatherData,
  currentHour?: number,
): { title: string; answerTa: string; answerEn: string; topic: string } {
  const analysis = analyzeStoreBills(bills, todayDate, products, weather, currentHour);
  const q = question.toLowerCase();

  // 1. Weather / Climate question ("வானிலை", "climate", "weather", "மழை", "rain", "வெயில்", "குளிர்")
  if (
    q.includes("வானிலை") ||
    q.includes("weather") ||
    q.includes("climate") ||
    q.includes("மழை") ||
    q.includes("rain") ||
    q.includes("வெயில்") ||
    q.includes("சூடு") ||
    q.includes("குளிர்")
  ) {
    return {
      title: "🌤️ நேரடி வானிலை & தேவை வழிகாட்டுதல் (Weather & Demand Forecast)",
      answerTa: analysis.weatherReportTa,
      answerEn: `Current weather: ${analysis.activeWeather.conditionLabelEn} (${analysis.activeWeather.tempC}°C, humidity ${analysis.activeWeather.humidity}%). ${analysis.weatherAdvice.adviceText}`,
      topic: "weather",
    };
  }

  // 2. 6 Sales Reports Breakdown question ("6 நாள்", "6 sale", "ஆறு நாள்", "six day", "வரலாறு", "trend")
  if (
    q.includes("6 நாள்") ||
    q.includes("6 sale") ||
    q.includes("ஆறு நாள்") ||
    q.includes("six") ||
    q.includes("வரலாறு") ||
    q.includes("trend") ||
    q.includes("history")
  ) {
    return {
      title: "📊 6 நாள் விற்பனை அறிக்கை & போக்கு (6-Day Sales Trend)",
      answerTa: analysis.sixDaySummaryTa,
      answerEn: `6-Day Sales Report: Total revenue ₹${analysis.total6DayRevenue}, Daily average ₹${analysis.avg6DayDailyRevenue}. Today recorded ₹${analysis.todayRevenue}.`,
      topic: "six_day_report",
    };
  }

  // 3. Smart Store Guide question ("வழிகாட்டி", "guide", "assist", "ஆலோசனை", "உதவி")
  if (
    q.includes("வழிகாட்டி") ||
    q.includes("guide") ||
    q.includes("assist") ||
    q.includes("ஆலோசனை") ||
    q.includes("உதவி")
  ) {
    const fullGuideTa = `DukaanPulse Sarvam AI நேரடி வழிகாட்டி: ${analysis.weatherAdvice.adviceText} கடந்த 6 நாட்களில் தினசரி சராசரி ₹${analysis.avg6DayDailyRevenue} வசூலாகியுள்ளது. ${analysis.flaggedDipWindows.length > 0 ? `கண்டறியப்பட்ட சரிவு நேரம்: ${analysis.flaggedDipWindows[0].windowLabel}.` : "விற்பனை சீராக உள்ளது."} சிறந்த பரிந்துரை: ${analysis.weatherAdvice.recommendedItems.join(", ")} காம்போ சலுகை தயார் செய்யவும்.`;
    return {
      title: "🤖 Sarvam AI நேரடி வணிக வழிகாட்டி (Smart Store Guide)",
      answerTa: fullGuideTa,
      answerEn: `Sarvam AI Store Guide: ${analysis.weatherAdvice.adviceText} 6-Day daily average is ₹${analysis.avg6DayDailyRevenue}. Focus on ${analysis.weatherAdvice.recommendedItems.join(", ")}.`,
      topic: "guide",
    };
  }

  // 4. Time-Window Dip question ("எந்த நேரத்தில்", "நேரம்", "time", "slump", "dead", "window", "sound to time")
  if (
    q.includes("நேர") ||
    q.includes("time") ||
    q.includes("மணி") ||
    q.includes("hour") ||
    q.includes("மந்த")
  ) {
    const flagged = analysis.flaggedDipWindows;
    const windowText =
      flagged.length > 0
        ? `கண்டறியப்பட்ட மந்தமான நேரம்: ${flagged.map((w) => `${w.windowLabel} (${w.dipPercent}% சரிவு, முந்தைய இடைநிலை ${w.historicalMedianCount} vs இன்று ${w.todayCount})`).join("; ")}. ${flagged[0].recommendationTa}`
        : `இன்று குறிப்பிடத்தக்க நேரச் சரிவு எதுவும் இல்லை. விற்பனை சீராகப் பதிவாகியுள்ளது.`;

    return {
      title: "நேரச் சாளர விற்பனை சரிவு (Time-Window Dip Analysis)",
      answerTa: windowText,
      answerEn:
        flagged.length > 0
          ? `Specific time window dip detected: ${flagged[0].windowLabel} with ${flagged[0].dipPercent}% drop vs historical median (${flagged[0].todayCount} bills vs median ${flagged[0].historicalMedianCount}).`
          : `All hourly operational windows performed steadily today.`,
      topic: "time_window",
    };
  }

  // 2. Dip / Day Comparison question ("எவ்வளவு கம்மியா இருக்கு", "சரிவு", "நேற்று விட", "dip", "less", "lower")
  if (
    q.includes("கம்மி") ||
    q.includes("சரிவு") ||
    q.includes("நேற்று") ||
    q.includes("dip") ||
    q.includes("low") ||
    q.includes("loss") ||
    q.includes("decrease")
  ) {
    return {
      title: "விற்பனை சரிவு & ஒப்பீடு (Sales Dip Analysis)",
      answerTa: analysis.dipSummaryTa,
      answerEn: analysis.isDayDip
        ? `Today recorded ₹${analysis.todayRevenue} vs yesterday's ₹${analysis.yesterdayRevenue}, a dip of ₹${Math.abs(analysis.dayOverDayDeltaRevenue)} (${analysis.dayOverDayDipPercent}% drop). ${analysis.flaggedDipWindows.length > 0 ? `Noticeable slump during ${analysis.flaggedDipWindows[0].windowLabel}.` : ""}`
        : `No sales dip today. Revenue grew by ₹${analysis.dayOverDayDeltaRevenue} compared to yesterday.`,
      topic: "dip",
    };
  }

  // 3. Product Sales question ("எந்த பொருள்", "டீ", "சமோசா", "product", "item", "விற்றது", "விற்பனை ஆனது")
  if (
    q.includes("பொருள்") ||
    q.includes("item") ||
    q.includes("product") ||
    q.includes("டீ") ||
    q.includes("tea") ||
    q.includes("சமோசா") ||
    q.includes("samosa") ||
    q.includes("வடை")
  ) {
    return {
      title: "பொருள் வாரியான விற்பனை (Product Performance)",
      answerTa: analysis.productSummaryTa,
      answerEn: analysis.topProduct
        ? `Best seller today is ${analysis.topProduct.name} with ${analysis.topProduct.units} units sold (₹${analysis.topProduct.revenue}).`
        : `No items sold yet.`,
      topic: "products",
    };
  }

  // 4. Offer / Advice question ("சலுகை", "என்ன பண்ணலாம்", "offer", "advice", "யோசனை", "increase")
  if (
    q.includes("சலுகை") ||
    q.includes("யோசனை") ||
    q.includes("பரிந்துரை") ||
    q.includes("offer") ||
    q.includes("combo") ||
    q.includes("advice")
  ) {
    return {
      title: "DukaanPulse AI வணிகப் பரிந்துரை (Decision & Offer Advice)",
      answerTa: analysis.offerAdviceTa,
      answerEn: analysis.offerAdviceTa,
      topic: "offer",
    };
  }

  // Default: Full Daily Report
  return {
    title: "இன்றைய முழு AI வணிக அறிக்கை (Full AI Store Report)",
    answerTa: analysis.fullReportTa,
    answerEn: `Today's total revenue is ₹${analysis.todayRevenue} across ${analysis.todayBillsCount} bills. ${analysis.isDayDip ? `Dip of ₹${Math.abs(analysis.dayOverDayDeltaRevenue)} compared to yesterday.` : `Growth of ₹${analysis.dayOverDayDeltaRevenue} compared to yesterday.`} Top item is ${analysis.topProduct ? analysis.topProduct.name : "N/A"}.`,
    topic: "general",
  };
}
