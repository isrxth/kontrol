package com.kontrol.app;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Handles silent background attendance logging when an action button (Attend, Skip, Ghost)
 * is clicked from a lecture pop-up notification without forcing the app to open.
 */
public class AttendanceActionReceiver extends BroadcastReceiver {
    private static final String TAG = "AttendanceReceiver";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if ("android.intent.action.BOOT_COMPLETED".equals(action)) {
            Log.i(TAG, "Device rebooted. Reminders can be re-synchronized upon next app start.");
            return;
        }

        if (!"com.kontrol.app.ACTION_ATTENDANCE".equals(action)) return;

        String courseId = intent.getStringExtra("course_id");
        String status = intent.getStringExtra("status");
        int notificationId = intent.getIntExtra("notification_id", -1);

        // Dismiss the notification immediately
        if (notificationId != -1) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(notificationId);
            }
        }

        if (courseId == null || status == null) {
            Log.w(TAG, "Missing course_id or status in attendance action intent.");
            return;
        }

        // Perform HTTP request on background thread
        executor.execute(() -> {
            try {
                SharedPreferences prefs = context.getSharedPreferences("KontrolPrefs", Context.MODE_PRIVATE);
                String token = prefs.getString("auth_token", null);
                String apiUrl = prefs.getString("api_url", "https://kontrol-omega.vercel.app/api");

                if (token == null || token.trim().isEmpty()) {
                    Log.w(TAG, "Cannot log attendance: no auth token found in SharedPreferences.");
                    return;
                }

                String endpoint = apiUrl + "/courses/" + courseId + "/logs";
                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);

                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                String today = sdf.format(new Date());

                String payload = String.format("{\"status\":\"%s\",\"logDate\":\"%s\"}", status, today);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(payload.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                Log.i(TAG, "Background attendance log response: " + code + " for course " + courseId + " status " + status);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "Failed to log attendance in background", e);
            }
        });
    }
}
