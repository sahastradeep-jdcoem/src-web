package in.srcjdcoem.payhook;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class PaymentNotificationListenerService extends NotificationListenerService {

    private static final String TAG = "SRCPayHook";
    public static final String WEBHOOK_URL = "https://www.srcjdcoem.in/api/upi/webhook?secret=SRC_UPI_2026_GATEWAY";
    public static final String SECRET_KEY = "SRC_UPI_2026_GATEWAY";

    // Circular in-memory log buffer for MainActivity UI
    public static final List<String> LOG_BUFFER = new ArrayList<>();
    public static MainActivity activeMainActivity = null;

    public static synchronized void addLog(String entry) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String line = "[" + timestamp + "] " + entry;
        Log.i(TAG, line);
        LOG_BUFFER.add(0, line);
        if (LOG_BUFFER.size() > 50) {
            LOG_BUFFER.remove(LOG_BUFFER.size() - 1);
        }
        if (activeMainActivity != null) {
            try {
                activeMainActivity.runOnUiThread(activeMainActivity);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onListenerConnected() {
        super.onListenerConnected();
        addLog("Service connected and listening for payments.");
    }

    @Override
    public void onListenerDisconnected() {
        super.onListenerDisconnected();
        addLog("Service disconnected.");
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        try {
            String packageName = sbn.getPackageName();
            Bundle extras = sbn.getNotification().extras;
            if (extras == null) return;

            CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

            String title = titleSeq != null ? titleSeq.toString() : "";
            String text = textSeq != null ? textSeq.toString() : "";
            String bigText = bigTextSeq != null ? bigTextSeq.toString() : "";

            String combinedText = (title + " " + text + " " + (bigText.isEmpty() ? "" : bigText)).trim();
            if (combinedText.isEmpty()) return;

            // Target known payment and SMS apps
            boolean isKnownApp = packageName.contains("paytm") ||
                                 packageName.contains("messaging") ||
                                 packageName.contains("mms") ||
                                 packageName.contains("paisa") ||
                                 packageName.contains("phonepe") ||
                                 packageName.contains("npci");

            // Match payment keywords (UPI, received, credited, Rs, INR, UTR)
            String lower = combinedText.toLowerCase(Locale.ROOT);
            boolean isPaymentKeyword = lower.contains("received") ||
                                       lower.contains("credited") ||
                                       lower.contains("rs") ||
                                       lower.contains("₹") ||
                                       lower.contains("inr") ||
                                       lower.contains("utr") ||
                                       lower.contains("ref") ||
                                       lower.contains("paid you") ||
                                       lower.contains("upi");

            if (isKnownApp || isPaymentKeyword) {
                addLog("Payment notification detected from " + packageName + ": " + (combinedText.length() > 60 ? combinedText.substring(0, 60) + "..." : combinedText));
                forwardNotificationAsync(combinedText, packageName);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error processing notification", e);
        }
    }

    public static void forwardNotificationAsync(final String notificationContent, final String packageName) {
        Thread thread = new Thread(new HttpPostWorker(notificationContent, packageName));
        thread.start();
    }
}
