import api from './api';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    return registration;
  } catch (err) {
    console.warn('SW registration failed:', err);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return await Notification.requestPermission();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPush(registration) {
  if (!registration) return null;
  try {
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      console.warn('No VAPID key configured');
      return null;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    await api.post('/notifications/subscribe', {
      subscription: subscription.toJSON(),
      user_agent: navigator.userAgent,
    });
    return subscription;
  } catch (err) {
    console.warn('Push subscription failed:', err);
    return null;
  }
}

export async function unsubscribeFromPush() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await api.delete('/notifications/unsubscribe', {
        data: { endpoint: subscription.endpoint }
      });
    }
  } catch (err) {
    console.warn('Unsubscribe failed:', err);
  }
}

export function showLocalNotification(title, body, options = {}) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.svg',
      badge: '/favicon.png',
      ...options,
    });
  }
}

/**
 * Play a bell/chime sound for notifications using Web Audio API.
 * Emergency: urgent alarm tone. Standard: pleasant bell chime.
 */
export function playNotificationBell(isEmergency = false) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (isEmergency) {
      // Urgent alarm: fast alternating tones
      for (let i = 0; i < 8; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + i * 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.13);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.13);
      }
    } else {
      // Pleasant bell chime: two-tone ding-dong
      const notes = [1047, 784, 1047]; // C6, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.18);
        gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.18 + 0.35);
        osc.start(ctx.currentTime + i * 0.18);
        osc.stop(ctx.currentTime + i * 0.18 + 0.35);
      });
    }
  } catch (e) { /* Audio not allowed */ }
}

/**
 * Set up service worker message listener for notification sounds.
 * Call this once during app initialization.
 */
export function setupNotificationSoundListener() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') {
      playNotificationBell(event.data.isEmergency);
    }
  });
}

/**
 * Initialize push notifications: request permission + subscribe.
 * Call this after login.
 */
export async function initPushNotifications() {
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return;
  const registration = await registerServiceWorker();
  if (!registration) return;
  await subscribeToPush(registration);
  setupNotificationSoundListener();
}
