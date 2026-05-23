import type { MarketingMessages } from "./types";

export const messagesZhTw: MarketingMessages = {
  locale: "zh-TW",
  htmlLang: "zh-Hant",
  siteTitle: "MacroKeep",
  meta: {
    homeDescription:
      "免費的熱量與三大營養素追蹤，可選用 AI 估算餐點。你的飲食紀錄保存在 Google 雲端硬碟，而非我們的伺服器。",
    privacyDescription: "MacroKeep 如何存取、使用與儲存你的資訊。",
    termsDescription: "使用 MacroKeep 的服務條款。",
  },
  nav: {
    openApp: "開啟 App",
    openMacroKeep: "開啟 MacroKeep",
  },
  footer: {
    privacy: "隱私權",
    terms: "服務條款",
  },
  home: {
    eyebrow: "熱量與三大營養素追蹤",
    headline: "免費追蹤熱量與營養",
    lead: "記錄飲食、查看進度，並從照片估算營養資訊。",
    ctaPrimary: "開啟 MacroKeep",
    ctaSecondary: "運作方式",
  },
  screenshots: {
    heading: "介面預覽",
    lead: "清楚的介面，同時支援用照片估算餐點營養。",
    stripLabel: "App 截圖",
    items: [
      {
        id: "setup",
        src: "/screenshots/setup-targets.png",
        alt: "設定目標：個人資料與建議的三大營養素",
        label: "設定目標",
      },
      {
        id: "today",
        src: "/screenshots/today.png",
        alt: "今日畫面：熱量環、營養素進度條與餐點",
        label: "今日畫面",
      },
      {
        id: "history",
        src: "/screenshots/history.png",
        alt: "依日期分組的歷史紀錄與餐點縮圖",
        label: "歷史紀錄",
      },
      {
        id: "detail",
        src: "/screenshots/meal-details.png",
        alt: "餐點詳情：照片與營養素分解",
        label: "餐點詳情",
      },
      {
        id: "log-meal",
        src: "/screenshots/log-meal.png",
        alt: "記錄餐點：照片、描述與手動輸入",
        label: "記錄餐點",
      },
    ],
  },
  why: {
    heading: "為什麼會有 MacroKeep",
    body: "市面上的 App 常常需要訂閱才能拍照估算熱量，或是塞滿全螢幕的廣告。我想要的只是一個免費、簡單的工具，於是做了 MacroKeep 給自己用，同時分享給有同樣需求的人。",
  },
  features: {
    heading: "MacroKeep 能做什麼",
    items: [
      {
        title: "每日營養紀錄",
        description:
          "記錄餐點熱量，查看蛋白質、碳水化合物與脂肪是否符合每日目標。",
      },
      {
        title: "超方便的記錄方式",
        description:
          "拍照、描述吃了什麼，或自行輸入營養素。需要 AI 時，Gemini 可從照片與文字估算。",
      },
      {
        title: "查看歷史紀錄與進度",
        description: "瀏覽過去日期、圖表、已儲存餐點與進度照片。",
      },
    ],
  },
  howItWorks: {
    heading: "運作方式",
    steps: [
      "使用 Google 登入。",
      {
        before: "你的紀錄保存在",
        highlight: "你自己的 Google 雲端硬碟應用程式資料夾",
        after: "中，不在我們的伺服器上，也與「我的雲端硬碟」分開。",
      },
      "在手機或電腦瀏覽器開啟，或安裝到主畫面。",
    ],
  },
  faq: {
    heading: "常見問題",
    ctaPrimary: "開啟 MacroKeep",
    items: [
      {
        question: "MacroKeep 是免費的嗎？",
        answer:
          "是的，App 完全免費。AI 餐點估算需使用 Google AI Studio 的 Gemini API 金鑰；個人使用也是免費的。只有在你為該金鑰的 Google Cloud 專案開啟計費時，才需付費給 Google。",
      },
      {
        question: "為什麼需要 Gemini API 金鑰？",
        answer:
          "照片與文字餐點估算透過 Google Gemini 執行。你的金鑰會與其他 MacroKeep 資料一起儲存在 Google 雲端硬碟中。",
      },
      {
        question: "我的資料存在哪裡？",
        answer:
          "在你 Google 帳戶下的隱藏 Google 雲端硬碟應用程式資料夾。MacroKeep 無法存取你其他的 Google 雲端硬碟檔案。",
      },
      {
        question: "有問題或建議？",
        answer: "",
      },
    ],
  },
  legal: {
    homeLink: "← 首頁",
    effectiveDateLabel: "生效日期：",
    privacyTitle: "隱私權政策",
    termsTitle: "服務條款",
  },
  langSwitcher: {
    label: "語言",
    en: "English",
    zhTW: "繁體中文",
  },
};
