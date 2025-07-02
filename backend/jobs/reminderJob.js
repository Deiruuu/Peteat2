const cron = require('node-cron');
const Booking = require('../models/Booking');
const pushService = require('../services/pushService');

/**
 * Look for bookings occurring in the next 24h and send reminder push notifications
 */
async function runReminders() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'scheduled'] },
      bookingDate: { $gte: now, $lte: in24h },
    }).select('petOwner clinic bookingDate appointmentTime');

    if (bookings.length === 0) return;

    for (const b of bookings) {
      const whenStr = b.bookingDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
        ' ' + b.appointmentTime;
      const title = 'Appointment Reminder';
      const body = `You have an appointment on ${whenStr}`;
      await pushService.sendToUsers([b.petOwner, b.clinic], {
        title,
        body,
        data: { bookingId: b._id },
      });
    }

    console.log(`[ReminderJob] Sent ${bookings.length} reminders at ${now.toISOString()}`);
  } catch (err) {
    console.error('[ReminderJob] Error', err);
  }
}

// Schedule job to run hourly at minute 0
cron.schedule('0 * * * *', runReminders);

module.exports = { runReminders }; 