import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Request permissions and return the Expo push token, or null if not granted/unsupported.
export const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      console.log('Push notifications: not running on physical device');
      return null;
    }

    // Get existing status
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Ask if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Some Android configs (skip if FCM not configured)
    if (Platform.OS === 'android') {
      const hasFCM = Boolean(
        // EAS build: googleServicesFile is set in app config
        Constants.expoConfig?.android?.googleServicesFile ||
        // Bare / prebuild: legacy manifest
        (Constants.manifest as any)?.android?.googleServicesFile
      );

      // If the project is missing FCM config, skip token registration to avoid
      // the "Default FirebaseApp is not initialized" runtime error.
      if (!hasFCM) {
        console.log('FCM not configured – skipping push token registration on Android');
        return null;
      }

      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // If you are using the new EAS push service, you can pass your projectId here.
    const tokenData = await Notifications.getExpoPushTokenAsync({
      // projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    console.log('Obtained push token', tokenData.data);
    return tokenData.data;
  } catch (err) {
    // Swallow FirebaseApp-not-initialized errors on Android when FCM is missing
    if (
      Platform.OS === 'android' &&
      (err as Error)?.message?.includes('Default FirebaseApp is not initialized')
    ) {
      console.log('Skipping push notifications – Firebase not configured');
      return null;
    }
    console.error('Error registering for push notifications', err);
    return null;
  }
}; 