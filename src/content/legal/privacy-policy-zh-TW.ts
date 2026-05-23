import type { LegalDocument } from "./types";

/** Traditional Chinese privacy policy — public URL for OAuth / Google API Services User Data Policy. */
export const privacyPolicyZhTw: LegalDocument = {
  title: "隱私權政策",
  effectiveDate: "2026 年 5 月 19 日",
  intro: [
    "MacroKeep（「我們」或「本 App」）是一款用於熱量與三大營養素追蹤的網頁應用程式。行銷網站位於 macrokeep.com；App 位於 app.macrokeep.com（及相關網域）。本隱私權政策說明當你使用 MacroKeep 時，我們如何存取、使用、儲存與分享資訊。",
    "使用 MacroKeep 即表示你同意本隱私權政策。若不同意，請勿使用本 App。",
  ],
  sections: [
    {
      title: "摘要",
      paragraphs: [
        "你的飲食紀錄、設定、進度照片，以及選用的 Gemini API 金鑰，皆儲存在你自己的 Google 雲端硬碟應用程式資料夾中，而非 MacroKeep 的伺服器。我們僅使用 Google 登入來識別你的帳戶並存取該資料夾。我們的代管基礎設施可能會暫時處理 OAuth 權杖以完成登入與更新存取權；我們不會營運儲存你餐點資料的使用者資料庫。",
      ],
    },
    {
      title: "我們存取的資訊",
      paragraphs: ["當你使用 Google 登入時，MacroKeep 可能存取："],
      bullets: [
        "基本個人資料（Google 帳戶 ID、電子郵件地址與個人資料），透過 OpenID Connect 範圍 openid、email 與 profile。",
        "你的 Google 雲端硬碟應用程式資料（範圍 drive.appdata）：MacroKeep 在隱藏的 App 專用資料夾中建立的檔案。其中包括餐點紀錄、三大營養素目標、個人設定、已儲存餐點、進度照片的中繼資料與影像，以及你選用的 Google Gemini API 金鑰。MacroKeep 不會要求存取你在「我的雲端硬碟」中可見的其他 Google 雲端硬碟檔案或資料夾。",
      ],
    },
    {
      title: "你的資料儲存位置",
      paragraphs: [
        "主要儲存：與你的 Google 帳戶關聯的 Google 雲端硬碟應用程式資料。在 MacroKeep 設定中，重複點選已登入的電子郵件以顯示進階選項，然後開啟 Drive 應用程式資料瀏覽器以檢視檔案，或使用「刪除所有 Drive 資料」以移除 App 資料夾中的所有內容。",
        "在你的裝置上：OAuth 權杖與帳戶識別碼可能儲存在瀏覽器的 local storage 中，以便保持登入狀態。餐點與進度照片縮圖可能快取在瀏覽器的 IndexedDB 中以提升效能。語言偏好可能儲存在本機並與你的 Drive 個人資料同步。",
        "我們的代管：我們在提供 App 服務的基礎設施上運作 OAuth 起始與回呼端點，以及存取權杖更新端點。登入期間，權杖會傳送至你的瀏覽器；重新整理權杖保留在你的裝置上。更新存取權杖時，你的瀏覽器會將重新整理權杖傳送至我們的伺服器，伺服器再轉送請求給 Google 並回傳短期存取權杖。我們的服務設計上不會在伺服器上持久保存你的重新整理權杖或餐點資料。",
      ],
    },
    {
      title: "選用的 Gemini API 金鑰",
      paragraphs: [
        "若你選擇新增 Google Gemini API 金鑰，它會與其他 MacroKeep 資料一起儲存在你的 Drive 應用程式資料夾中。照片與文字餐點分析請求會直接從你的瀏覽器，使用你的金鑰傳送至 Google 的 Generative Language API。MacroKeep 不會在伺服器上儲存你的 Gemini 金鑰。Google 的 Gemini API 包含有速率限制的免費方案；只有在你為該金鑰的 Google Cloud 專案啟用計費時才會產生費用。你對 Gemini 的使用亦受 Google 該服務的條款與政策約束。",
      ],
    },
    {
      title: "我們如何使用資訊",
      paragraphs: ["我們僅將上述資訊用於："],
      bullets: [
        "驗證你的身分並維持登入工作階段。",
        "在 Drive 應用程式資料中讀寫你的 MacroKeep 資料。",
        "提供熱量／三大營養素追蹤、歷史紀錄、進度照片，以及在你提供 Gemini 金鑰時的可選 AI 餐點估算。",
        "在適用時記住 UI 偏好（例如語言）。",
      ],
    },
    {
      title: "分享與揭露",
      paragraphs: [
        "我們不會出售你的個人資訊。除以下情況外，我們不會與第三方分享你的 Google 使用者資料：",
      ],
      bullets: [
        "Google——當你使用 Google 登入、Google 雲端硬碟或 Gemini API 時（依其政策）。",
        "代管我們網站與 API 的基礎設施提供者，可能依其隱私權政策處理網路請求。",
        "法律要求，或為保護權利、安全與資訊安全所必要時。",
      ],
    },
    {
      title: "意見回饋與支援",
      paragraphs: [
        "若你寄信至 feedback@macrokeep.com（例如透過 App 內的意見回饋連結），你可自行決定訊息內容。我們的郵件範本可能附加非個人的診斷資訊，例如 App 版本、語言、是否以 PWA 安裝，以及瀏覽器 user-agent 字串，以協助我們排除問題。",
      ],
    },
    {
      title: "保留與刪除",
      paragraphs: [
        "Google 雲端硬碟中的資料會保留，直到你在 MacroKeep 中刪除，或在 Google 帳戶安全性設定中移除 MacroKeep 的存取權。登出會清除瀏覽器中儲存的 OAuth 權杖。要在 App 中刪除所有 MacroKeep 雲端資料，請在設定中解鎖進階 Drive 選項（重複點選已登入的電子郵件），然後使用「刪除所有 Drive 資料」。本機快取可能保留，直到由瀏覽器或 App 清除。",
      ],
    },
    {
      title: "安全性",
      paragraphs: [
        "我們對正式環境流量使用 HTTPS。你須自行保護 Google 帳戶與裝置安全。任何傳輸或儲存方式皆無法保證完全安全。",
      ],
    },
    {
      title: "兒童",
      paragraphs: [
        "MacroKeep 並非針對 13 歲以下（或你所在司法管轄區的最低年齡）兒童。我們不會故意向兒童收集個人資訊。",
      ],
    },
    {
      title: "國際使用者",
      paragraphs: [
        "你的資料可能在 Google 與我們代管提供者營運的國家／地區處理。使用本 App 即表示你了解這些地點的資料保護法律可能與你所在國家不同。",
      ],
    },
    {
      title: "政策變更",
      paragraphs: [
        "我們可能不時更新本隱私權政策。修訂版將發布於本 URL 並更新生效日期。變更後繼續使用即表示你接受更新後的政策。",
      ],
    },
    {
      title: "Google API 服務揭露",
      paragraphs: [
        "MacroKeep 對自 Google API 收到的資訊之使用，將遵守 Google API 服務使用者資料政策，包括有限使用要求。",
      ],
    },
    {
      title: "聯絡方式",
      paragraphs: ["有關本隱私權政策的問題：feedback@macrokeep.com"],
    },
  ],
};
