export interface NotificationPrefs {
  dailyReminder: boolean // whether daily evening reminder is enabled
  dailyReminderTime: string // HH:mm e.g. "21:00" (9:00 PM)
  mondayInsights: boolean // whether Monday morning insights ready alert is enabled
  mondayInsightsTime: string // HH:mm e.g. "09:00" (9:00 AM)
  chapterEnding: boolean // whether chapter ending alert (T-2/T-1) is enabled
  chapterPlannedEndDate?: string // YYYY-MM-DD planned end of the active chapter
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  dailyReminder: true,
  dailyReminderTime: '21:00',
  mondayInsights: true,
  mondayInsightsTime: '09:00',
  chapterEnding: true,
}

export interface PushSubscriptionKeys {
  p256dh: string
  auth: string
}

export interface PushSubscriptionData {
  endpoint: string
  keys: PushSubscriptionKeys
  expirationTime?: number | null
}

export interface StoredSubscription {
  id: string
  subscription: PushSubscriptionData
  tz: string // IANA timezone e.g. "America/New_York", "Asia/Kolkata"
  prefs: NotificationPrefs
  manageTokenHash?: string // SHA-256 hex digest of the client's 32-byte manage token
  createdAt: number
  updatedAt: number
  lastSent?: {
    dailyReminder?: string // last YYYY-MM-DD sent
    mondayInsights?: string // last YYYY-MM-DD sent
    chapterEnding?: string // last YYYY-MM-DD sent
  }
}

export interface GenericNotificationPayload {
  title: string
  body: string
  url: string
  tag: string
}
