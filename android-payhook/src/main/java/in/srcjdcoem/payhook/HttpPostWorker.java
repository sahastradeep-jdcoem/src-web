package in.srcjdcoem.payhook;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class HttpPostWorker implements Runnable {

    private final String notificationContent;
    private final String packageName;

    public HttpPostWorker(String notificationContent, String packageName) {
        this.notificationContent = notificationContent;
        this.packageName = packageName;
    }

    @Override
    public void run() {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(PaymentNotificationListenerService.WEBHOOK_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("x-src-webhook-key", PaymentNotificationListenerService.SECRET_KEY);
            conn.setRequestProperty("User-Agent", "SRCPayHook-NativeAndroid/1.0");

            JSONObject payload = new JSONObject();
            payload.put("text", notificationContent);
            payload.put("notificationText", notificationContent);
            payload.put("packageName", packageName);
            payload.put("timestamp", System.currentTimeMillis());

            byte[] postBytes = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(postBytes);
                os.flush();
            }

            int responseCode = conn.getResponseCode();
            if (responseCode >= 200 && responseCode < 300) {
                PaymentNotificationListenerService.addLog("FORWARDED OK (HTTP " + responseCode + "): Pass confirmed on website!");
            } else {
                BufferedReader br = new BufferedReader(new InputStreamReader(conn.getErrorStream() != null ? conn.getErrorStream() : conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line);
                PaymentNotificationListenerService.addLog("FORWARD WARNING (HTTP " + responseCode + "): " + sb.toString());
            }
        } catch (Exception err) {
            PaymentNotificationListenerService.addLog("NETWORK ERROR: " + err.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
