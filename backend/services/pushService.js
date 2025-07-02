const { Expo } = require('expo-server-sdk');
const PushToken = require('../models/PushToken');
const Notification = require('../models/Notification');

// Create a new Expo SDK client explicitly
const expo = new Expo();

/**
 * Send a push notification to multiple users by their Mongo userIds.
 * @param {Array<string>} userIds list of user _id strings
 * @param {{title:string, body:string, data?:any}} payload
 */
exports.sendToUsers = async (userIds, payload) => {
  try {
    // Fetch tokens for users
    const tokensDocs = await PushToken.find({ user: { $in: userIds } });
    const messages = [];

    for (const doc of tokensDocs) {
      if (!Expo.isExpoPushToken(doc.token)) continue;
      messages.push({
        to: doc.token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
      });
      // Create in-app notification document (non-blocking)
      Notification.create({
        user: doc.user,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      }).catch(()=>{});
    }

    if (messages.length === 0) return;

    // Expo recommends chunking
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (err) {
    console.error('Error sending push notifications', err);
  }
}; 