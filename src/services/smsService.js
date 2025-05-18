class SmsService {
  sendSms(userId, message) {
    console.log(`[SMS Service] Sending SMS to user ${userId}: ${message}`);
    // In a real implementation, this would use an SMS provider API
    return true;
  }
}

module.exports = { SmsService }
