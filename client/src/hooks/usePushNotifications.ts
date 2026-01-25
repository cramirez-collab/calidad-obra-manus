import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  
  const { data: vapidData } = trpc.notificaciones.getVapidPublicKey.useQuery();
  const subscribeMutation = trpc.notificaciones.subscribePush.useMutation();
  const unsubscribeMutation = trpc.notificaciones.unsubscribePush.useMutation();
  const testPushMutation = trpc.notificaciones.testPush.useMutation();
  
  // Verificar soporte de push notifications
  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, []);
  
  // Verificar si ya existe una suscripción
  const checkExistingSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('[Push] Error verificando suscripción:', error);
    }
  };
  
  // Convertir clave VAPID a Uint8Array
  const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };
  
  // Suscribirse a notificaciones push
  const subscribe = useCallback(async () => {
    if (!isSupported || !vapidData?.publicKey || !user) return false;
    
    setIsLoading(true);
    try {
      // Solicitar permiso
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      
      if (permissionResult !== 'granted') {
        console.log('[Push] Permiso denegado');
        return false;
      }
      
      // Registrar service worker si no existe
      let registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw-push.js');
        await navigator.serviceWorker.ready;
      }
      
      // Crear suscripción
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });
      
      const json = subscription.toJSON();
      
      // Guardar en el servidor
      await subscribeMutation.mutateAsync({
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      });
      
      setIsSubscribed(true);
      console.log('[Push] Suscripción exitosa');
      return true;
    } catch (error) {
      console.error('[Push] Error al suscribirse:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, vapidData, user, subscribeMutation]);
  
  // Desuscribirse de notificaciones push
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;
    
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribeMutation.mutateAsync({ endpoint: subscription.endpoint });
      }
      
      setIsSubscribed(false);
      console.log('[Push] Desuscripción exitosa');
      return true;
    } catch (error) {
      console.error('[Push] Error al desuscribirse:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, unsubscribeMutation]);
  
  // Enviar notificación de prueba
  const sendTestNotification = useCallback(async () => {
    if (!isSubscribed) return false;
    
    try {
      const result = await testPushMutation.mutateAsync();
      return result.success;
    } catch (error) {
      console.error('[Push] Error enviando prueba:', error);
      return false;
    }
  }, [isSubscribed, testPushMutation]);
  
  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}
