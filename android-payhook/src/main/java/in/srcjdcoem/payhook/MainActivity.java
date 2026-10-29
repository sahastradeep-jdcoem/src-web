package in.srcjdcoem.payhook;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import java.util.List;

public class MainActivity extends Activity implements View.OnClickListener, Runnable {

    private TextView tvStatus;
    private TextView tvStatusDesc;
    private LinearLayout statusCard;
    private Button btnGrantPermission;
    private Button btnBatteryOpt;
    private Button btnTestPing;
    private TextView tvLogs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        tvStatus = findViewById(R.id.tvStatus);
        tvStatusDesc = findViewById(R.id.tvStatusDesc);
        statusCard = findViewById(R.id.statusCard);
        btnGrantPermission = findViewById(R.id.btnGrantPermission);
        btnBatteryOpt = findViewById(R.id.btnBatteryOpt);
        btnTestPing = findViewById(R.id.btnTestPing);
        tvLogs = findViewById(R.id.tvLogs);

        btnGrantPermission.setOnClickListener(this);
        btnBatteryOpt.setOnClickListener(this);
        btnTestPing.setOnClickListener(this);
    }

    @Override
    public void onClick(View v) {
        int id = v.getId();
        if (id == R.id.btnGrantPermission) {
            try {
                Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                startActivity(intent);
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "Could not open settings: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        } else if (id == R.id.btnBatteryOpt) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                        startActivity(fallback);
                    } catch (Exception ignored) {}
                }
            }
        } else if (id == R.id.btnTestPing) {
            PaymentNotificationListenerService.addLog("Triggering manual test ping to website...");
            PaymentNotificationListenerService.forwardNotificationAsync(
                "SRC MANUAL TEST PING: Received Rs. 10.00 from Delegate Test. UTR: TEST999888",
                getPackageName()
            );
            Toast.makeText(MainActivity.this, "Test ping sent! Check activity logs below.", Toast.LENGTH_SHORT).show();
        }
    }

    @Override
    public void run() {
        updateLogsView();
    }

    @Override
    protected void onResume() {
        super.onResume();
        PaymentNotificationListenerService.activeMainActivity = this;
        checkPermissionsAndStatus();
        updateLogsView();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (PaymentNotificationListenerService.activeMainActivity == this) {
            PaymentNotificationListenerService.activeMainActivity = null;
        }
    }

    private void checkPermissionsAndStatus() {
        boolean isNotificationAccessGranted = isNotificationServiceEnabled();

        if (isNotificationAccessGranted) {
            tvStatus.setText("● LISTENER ACTIVE & RUNNING");
            tvStatus.setTextColor(Color.parseColor("#065F46"));
            statusCard.setBackgroundColor(Color.parseColor("#D1FAE5"));
            tvStatusDesc.setText("Actively capturing Paytm / UPI payment notifications and pushing to srcjdcoem.in");
            tvStatusDesc.setTextColor(Color.parseColor("#047857"));
            btnGrantPermission.setVisibility(View.GONE);
        } else {
            tvStatus.setText("⚠ NOTIFICATION ACCESS REQUIRED");
            tvStatus.setTextColor(Color.parseColor("#991B1B"));
            statusCard.setBackgroundColor(Color.parseColor("#FEE2E2"));
            tvStatusDesc.setText("Tap the button below to grant notification access so the app can detect payments.");
            tvStatusDesc.setTextColor(Color.parseColor("#B91C1C"));
            btnGrantPermission.setVisibility(View.VISIBLE);
        }

        // Battery optimization status
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && pm.isIgnoringBatteryOptimizations(getPackageName())) {
                btnBatteryOpt.setText("✓ Battery Optimization Disabled (Safe in Background)");
                btnBatteryOpt.setEnabled(false);
                btnBatteryOpt.setTextColor(Color.parseColor("#047857"));
            } else {
                btnBatteryOpt.setText("Disable Battery Optimization (Recommended)");
                btnBatteryOpt.setEnabled(true);
            }
        }
    }

    private boolean isNotificationServiceEnabled() {
        String pkgName = getPackageName();
        final String flat = Settings.Secure.getString(getContentResolver(), "enabled_notification_listeners");
        if (!TextUtils.isEmpty(flat)) {
            final String[] names = flat.split(":");
            for (String name : names) {
                final ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && TextUtils.equals(pkgName, cn.getPackageName())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void updateLogsView() {
        List<String> logs = PaymentNotificationListenerService.LOG_BUFFER;
        if (logs.isEmpty()) {
            tvLogs.setText("Ready and listening for notifications...\nWebhook: " + PaymentNotificationListenerService.WEBHOOK_URL);
        } else {
            StringBuilder sb = new StringBuilder();
            for (String line : logs) {
                sb.append(line).append("\n\n");
            }
            tvLogs.setText(sb.toString());
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (PaymentNotificationListenerService.activeMainActivity == this) {
            PaymentNotificationListenerService.activeMainActivity = null;
        }
    }
}
