import type { MarketingMessages } from "./types";

export const messagesZhTw: MarketingMessages = {
  locale: "zh-TW",
  htmlLang: "zh-Hant",
  siteTitle: "MacroKeep",
  meta: {
    homeTitle: "MacroKeep — 免費熱量與三大營養素追蹤（支援 AI）",
    homeDescription:
      "免費熱量與三大營養素追蹤，可從照片或文字以 AI 估算餐點。透過 Google 雲端硬碟同步，使用你自己的 Gemini API 金鑰。",
    schemaAbstract:
      "免費熱量與三大營養素追蹤 App，可選用 AI 估算餐點，透過 Google 雲端硬碟同步並使用你自己的 Gemini API 金鑰。",
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
    guidesLabel: "指南",
  },
  home: {
    eyebrow: "熱量與三大營養素追蹤",
    headline: "免費熱量與三大營養素追蹤，支援 AI 估算",
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
    body: "市面上的 App 常常需要訂閱才能拍照估算熱量，或是塞滿全螢幕的廣告。我想要的只是一個免費、簡單的工具，於是做了 MacroKeep 給自己用，同時分享給有一樣需求的人。",
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
  landingPages: {
    aiMealEstimates: {
      path: "/features/ai-meal-estimates",
      title: "AI 餐點估算 — 三大營養素追蹤",
      description:
        "用 MacroKeep 從餐點照片或文字估算蛋白質、碳水與脂肪，使用你自己的免費 Gemini API 金鑰。",
      headline: "免訂閱的 AI 餐點估算",
      linkLabel: "AI 餐點估算",
      lead: "拍照或描述餐點，MacroKeep 透過 Google Gemini 與你自己的 API 金鑰建議營養素 — 無需付費掃描功能。",
      sections: [
        {
          heading: "照片與文字記錄",
          body: "以拍照、文字描述或手動輸入記錄餐點。需要協助時，Gemini 可從照片與簡短描述估算熱量與三大營養素。",
        },
        {
          heading: "你的金鑰，你的控制",
          body: "MacroKeep 將 Gemini API 金鑰與飲食紀錄一起保存在 Google 雲端硬碟的私人應用程式資料夾。使用 Google AI Studio 的免費金鑰，用量與費用由你掌控。",
        },
        {
          heading: "清楚的每日總計",
          body: "接受的估算會進入每日紀錄，與蛋白質、碳水、脂肪及熱量目標對照 — 與手動輸入使用相同的 Today 畫面。",
        },
      ],
      cta: "免費試用 MacroKeep",
    },
    googleDrive: {
      path: "/features/google-drive",
      title: "保存在 Google 雲端硬碟的營養追蹤",
      description:
        "MacroKeep 將飲食紀錄保存在 Google 雲端硬碟的私人應用程式資料夾 — 不在 MacroKeep 伺服器上。",
      headline: "飲食紀錄保存在 Google 雲端硬碟",
      linkLabel: "Google 雲端硬碟",
      lead: "MacroKeep 沒有你的餐點資料庫。一切資料都存在與 Google 帳戶綁定的隱藏應用程式資料夾中。",
      sections: [
        {
          heading: "私人應用程式資料夾",
          body: "餐點、營養目標、已儲存餐點與進度照片保存在 Google 雲端硬碟應用程式資料中 — 與「我的雲端硬碟」中的檔案分開。",
        },
        {
          heading: "紀錄不在 MacroKeep 伺服器",
          body: "我們不代管或販售你的個人飲食資料。使用 Google 登入後，紀錄透過 Drive API 在你的瀏覽器與帳戶之間同步。",
        },
        {
          heading: "隨處存取",
          body: "在手機或電腦瀏覽器開啟 MacroKeep，或安裝到主畫面。資料跟著你的 Google 帳戶走。",
        },
      ],
      cta: "開啟 MacroKeep",
    },
    myfitnesspalAlternative: {
      path: "/compare/myfitnesspal-alternative",
      title: "免費 MyFitnessPal 替代方案 — 三大營養素追蹤",
      description:
        "MacroKeep 是免費、無廣告的熱量與三大營養素追蹤 App，可選 AI 餐點估算，資料保存在 Google 雲端硬碟。",
      headline: "免費的三大營養素追蹤替代方案",
      linkLabel: "MyFitnessPal 替代方案",
      lead: "若你想要每日營養總計，又不想被雜訊、廣告或付費掃描功能困擾，MacroKeep 正是為此而設。",
      sections: [
        {
          heading: "核心追蹤完全免費",
          body: "記錄餐點、設定目標、瀏覽歷史與查看進度圖表均無需付費。日記本身不需要訂閱。",
        },
        {
          heading: "需要時再使用 AI",
          body: "照片與文字估算使用你自己的 Gemini API 金鑰，而非將掃描功能鎖在進階方案後面。",
        },
        {
          heading: "簡潔專注的介面",
          body: "MacroKeep 著重清楚的 Today 畫面、直覺的營養進度條與快速記錄 — 而非滿版的推銷。",
        },
      ],
      cta: "免費開始追蹤",
    },
    howToTrackMacros: {
      path: "/guides/how-to-track-macros",
      title: "如何追蹤三大營養素：簡易指南",
      description:
        "了解如何用 MacroKeep 每日追蹤蛋白質、碳水與脂肪 — 設定目標、記錄餐點、檢視進度。",
      headline: "如何追蹤三大營養素",
      linkLabel: "三大營養素入門",
      lead: "三大營養素追蹤就是記錄飲食，並將蛋白質、碳水化合物與脂肪與每日目標對照。以下是簡單的入門方式。",
      sections: [
        {
          heading: "1. 設定目標",
          body: "輸入個人資料，讓 MacroKeep 建議每日熱量與營養素，或在設定中自行設定蛋白質、碳水與脂肪目標。",
        },
        {
          heading: "2. 記錄每一餐",
          body: "用餐後以照片、簡短描述或手動輸入新增餐點。持續記錄比完美估算更重要。",
        },
        {
          heading: "3. 檢視當日進度",
          body: "在 Today 畫面查看剩餘熱量與營養素。在 History 觀察模式，在 Progress 查看長期圖表。",
        },
        {
          heading: "4. 隨時間調整",
          body: "目標改變時更新設定。熟悉固定份量後，已儲存餐點可加快重複記錄。",
        },
      ],
      cta: "開啟 MacroKeep，記錄第一餐",
    },
  },
};
