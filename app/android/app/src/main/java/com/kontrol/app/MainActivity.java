package com.kontrol.app;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private int lastTopDp = 0;
    private int lastBottomDp = 0;
    private int lastKbDp = 0;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private void injectInsets(int topDp, int bottomDp, int kbDp) {
        if (getBridge() != null && getBridge().getWebView() != null) {
            String js = String.format(
                "document.documentElement.style.setProperty('--sat','%dpx');" +
                "document.documentElement.style.setProperty('--sab','%dpx');" +
                "document.documentElement.style.setProperty('--kb','%dpx');",
                topDp, bottomDp, kbDp
            );
            getBridge().getWebView().evaluateJavascript(js, null);
        }
    }

    private void setupInsetsListener() {
        View decorView = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            float density = getResources().getDisplayMetrics().density;
            if (density > 0) {
                int topDp = Math.round(bars.top / density);
                int bottomDp = Math.round(bars.bottom / density);
                int imeDp = Math.max(0, Math.round((ime.bottom - bars.bottom) / density));
                if (topDp != lastTopDp || bottomDp != lastBottomDp || imeDp != lastKbDp) {
                    lastTopDp = topDp;
                    lastBottomDp = bottomDp;
                    lastKbDp = imeDp;
                    injectInsets(lastTopDp, lastBottomDp, lastKbDp);
                }
            }
            return WindowInsetsCompat.CONSUMED;
        });
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }

        setupInsetsListener();
    }

    @Override
    public void onResume() {
        super.onResume();
        // Hardware acceleration for 60fps WebView rendering
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView wv = getBridge().getWebView();
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        }

        // Re-inject last known insets immediately
        injectInsets(lastTopDp, lastBottomDp, lastKbDp);
        ViewCompat.requestApplyInsets(getWindow().getDecorView());

        // Re-request and inject after DOM / WebView render stabilization (150ms & 500ms)
        mainHandler.postDelayed(() -> {
            injectInsets(lastTopDp, lastBottomDp, lastKbDp);
            ViewCompat.requestApplyInsets(getWindow().getDecorView());
        }, 150);

        mainHandler.postDelayed(() -> {
            injectInsets(lastTopDp, lastBottomDp, lastKbDp);
            ViewCompat.requestApplyInsets(getWindow().getDecorView());
        }, 500);
    }
}
