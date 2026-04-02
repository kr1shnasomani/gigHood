// Web Push Notification service for gigHood worker app
// Handles FCM device token registration and in-app notification display

export interface NotificationPayload {
  title: string;
  body: string;
  type: 'PAYOUT_PROCESSED' | 'VERIFICATION_REQUIRED' | 'ALERT' | 'ELEVATED_WATCH' | 'DEGRADED_MODE';
  data?: Record<string, string>;
}

// Check if browser supports notifications
export function isNotificationSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  return await Notification.requestPermission();
}

// Register device token with backend
export async function registerDeviceToken(token: string): Promise<void> {
  const api = (await import('./api')).default;
  await api.post('/workers/me/device-token', { device_token: token });
}

// Show an in-app notification (browser Notification API)
export function showNotification(payload: NotificationPayload): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const iconMap: Record<NotificationPayload['type'], string> = {
    PAYOUT_PROCESSED: '/icons/payout.png',
    VERIFICATION_REQUIRED: '/icons/verify.png',
    ALERT: '/icons/alert.png',
    ELEVATED_WATCH: '/icons/watch.png',
    DEGRADED_MODE: '/icons/degraded.png',
  };

  new Notification(payload.title, {
    body: payload.body,
    icon: iconMap[payload.type] || '/icon.jpg',
    badge: '/icon.jpg',
    tag: payload.type, // Replaces existing notification of same type
    data: payload.data,
  });
}

// Notification templates matching backend triggers
export const NotificationTemplates = {
  payoutCredited: (amount: number): NotificationPayload => ({
    title: '₹' + amount + ' credited — income protected',
    body: 'Your disruption payout has been processed via UPI.',
    type: 'PAYOUT_PROCESSED',
  }),

  elevatedWatch: (): NotificationPayload => ({
    title: 'Zone Risk Alert',
    body: 'Your zone shows elevated disruption risk. Stay alert.',
    type: 'ELEVATED_WATCH',
  }),

  claimFlagged: (): NotificationPayload => ({
    title: 'Payout Under Verification',
    body: 'Your payout is being verified. We\'ll update you shortly.',
    type: 'VERIFICATION_REQUIRED',
  }),

  degradedMode: (): NotificationPayload => ({
    title: 'Reduced Signal Coverage',
    body: 'Monitoring with reduced signal coverage in your zone.',
    type: 'DEGRADED_MODE',
  }),

  tierUpgradeOffer: (forecastDci: number): NotificationPayload => ({
    title: 'High Risk Forecasted Next Week',
    body: `DCI forecast: ${forecastDci.toFixed(2)}. Consider upgrading your tier for better coverage.`,
    type: 'ALERT',
  }),
};

// Initialize notifications on app load
export async function initNotifications(): Promise<void> {
  if (!isNotificationSupported()) return;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return;

  // Register service worker for background notifications (if available)
  try {
    await navigator.serviceWorker.register('/sw.js');
    console.log('Service worker registered for push notifications');
  } catch {
    // Service worker not available — in-app notifications only
    console.log('Push notifications: in-app mode only');
  }
}
