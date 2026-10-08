package com.jeremykenedy.firetv.homeredirect;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * Sends the Home button to the AT4K launcher. Fire OS has no setting for
 * choosing a Home app and does not hand the Home key to accessibility
 * services, so this watches for the Amazon home screen coming to the front
 * and opens AT4K over it.
 *
 * Fire OS opens Settings by showing the home screen first and putting
 * Settings on top a moment later, and Settings is opened from AT4K's own gear
 * icon. So when the home screen appears straight after AT4K or Amazon's
 * settings app, the redirect waits briefly and is called off if another Amazon launcher screen arrives.
 * Coming from any other app there is nothing to wait for, so the redirect is
 * immediate. That is what keeps Settings reachable without slowing Home down.
 */
public class HomeRedirectService extends AccessibilityService {
    private static final String TAG = "FireTvHomeRedirect";
    private static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";
    private static final String AMAZON_HOME_PREFIX = "com.amazon.tv.launcher.ui.HomeActivity";
    private static final String AMAZON_SETTINGS_PREFIX = "com.amazon.tv.settings";
    private static final String TARGET_LAUNCHER = "com.overdevs.at4k";
    private static final long SETTLE_MS = 550;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable redirect = new Runnable() {
        @Override
        public void run() {
            waiting = false;
            openTargetLauncher();
        }
    };
    private boolean waiting;
    private boolean settingsMayFollow;

    /** AT4K's gear icon hands off to Amazon's settings app, which is what brings the home screen up. */
    static boolean canOpenSettings(CharSequence pkg) {
        return TARGET_LAUNCHER.contentEquals(pkg) || pkg.toString().startsWith(AMAZON_SETTINGS_PREFIX);
    }

    static boolean isAmazonHome(CharSequence pkg, CharSequence cls) {
        return AMAZON_LAUNCHER.contentEquals(pkg) && cls != null && cls.toString().startsWith(AMAZON_HOME_PREFIX);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        CharSequence pkg = event.getPackageName();
        if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED || pkg == null) {
            return;
        }
        if (!isAmazonHome(pkg, event.getClassName())) {
            cancelWait();
            settingsMayFollow = canOpenSettings(pkg);
            return;
        }
        if (waiting) {
            return;
        }
        if (settingsMayFollow) {
            waiting = true;
            handler.postDelayed(redirect, SETTLE_MS);
        } else {
            openTargetLauncher();
        }
    }

    private void cancelWait() {
        waiting = false;
        handler.removeCallbacks(redirect);
    }

    private void openTargetLauncher() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(TARGET_LAUNCHER);
        if (launch == null) {
            Log.w(TAG, TARGET_LAUNCHER + " is not installed, leaving the Amazon home screen up");
            return;
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(launch);
    }

    @Override
    public void onInterrupt() {
        cancelWait();
    }

    @Override
    public void onDestroy() {
        cancelWait();
        super.onDestroy();
    }
}
