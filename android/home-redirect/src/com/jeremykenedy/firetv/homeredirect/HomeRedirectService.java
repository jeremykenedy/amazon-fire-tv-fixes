package com.jeremykenedy.firetv.homeredirect;

import android.accessibilityservice.AccessibilityService;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.ContentObserver;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.provider.Settings;
import android.view.accessibility.AccessibilityEvent;

/**
 * Sends the Home button to the chosen launcher, AT4K or LTvLauncher. Fire OS
 * has no setting for choosing a Home app and does not hand the Home key to
 * accessibility services, so this watches for the Amazon home screen coming
 * to the front and opens the launcher over it.
 *
 * Fire OS opens Settings by showing the home screen first and putting
 * Settings on top a moment later, and Settings is opened from the launcher's
 * own gear icon. So when the home screen appears straight after the launcher
 * or Amazon's
 * settings app, the redirect waits briefly and is called off if another
 * Amazon launcher screen arrives. Coming from any other app there is nothing
 * to wait for, so the redirect is immediate. That is what keeps Settings
 * reachable without slowing Home down.
 */
public class HomeRedirectService extends AccessibilityService {
    private static final String TAG = "FireTvHomeRedirect";

    private static final String AMAZON_LAUNCHER = "com.amazon.tv.launcher";

    private static final String AMAZON_HOME_PREFIX =
            "com.amazon.tv.launcher.ui.HomeActivity";

    private static final String AMAZON_SETTINGS_PREFIX =
            "com.amazon.tv.settings";

    private static final long SETTLE_MS = 550;

    private static final long GUARD_DELAY_MS = 1000;

    private final Handler handler = new Handler(Looper.getMainLooper());

    private final Runnable redirect = new Runnable() {
        @Override
        public void run() {
            waiting = false;
            openTargetLauncher();
        }
    };

    private final Runnable guardCheck = new Runnable() {
        @Override
        public void run() {
            GuardEnforcer.enforce(HomeRedirectService.this);
        }
    };

    private final ContentObserver guardObserver = new ContentObserver(handler) {
        @Override
        public void onChange(boolean selfChange) {
            handler.removeCallbacks(guardCheck);
            handler.postDelayed(guardCheck, GUARD_DELAY_MS);
        }
    };

    private final ContentObserver adbObserver = new ContentObserver(handler) {
        @Override
        public void onChange(boolean selfChange) {
            AdbKeeper.keepOn(HomeRedirectService.this);
        }
    };

    private boolean waiting;

    private boolean settingsMayFollow;

    /**
     * The launcher's gear icon hands off to Amazon's settings app, which is
     * what brings the home screen up.
     */
    static boolean canOpenSettings(CharSequence pkg, String launcher) {
        return launcher.contentEquals(pkg)
                || pkg.toString().startsWith(AMAZON_SETTINGS_PREFIX);
    }

    static boolean isAmazonHome(CharSequence pkg, CharSequence cls) {
        return AMAZON_LAUNCHER.contentEquals(pkg)
                && cls != null
                && cls.toString().startsWith(AMAZON_HOME_PREFIX);
    }

    /** Watches every guarded setting and the ADB switches while this runs. */
    @Override
    protected void onServiceConnected() {
        ContentResolver resolver = getContentResolver();
        for (String setting : Guard.SETTINGS) {
            String key = Guard.key(setting);
            Uri uri = "system".equals(Guard.namespace(setting))
                    ? Settings.System.getUriFor(key)
                    : Settings.Secure.getUriFor(key);
            resolver.registerContentObserver(uri, false, guardObserver);
        }
        for (String key : Guard.ADB_SWITCHES) {
            resolver.registerContentObserver(Settings.Global.getUriFor(key),
                    false, adbObserver);
        }
        AdbKeeper.keepOn(this);
        GuardEnforcer.enforce(this);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        CharSequence pkg = event.getPackageName();
        int type = event.getEventType();
        if (type != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || pkg == null) {
            return;
        }
        if (!isAmazonHome(pkg, event.getClassName())) {
            cancelWait();
            settingsMayFollow = canOpenSettings(pkg, targetLauncher());
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

    private String targetLauncher() {
        return HomeTarget.packageFor(HomeTargetStore.get(this));
    }

    private void openTargetLauncher() {
        String launcher = targetLauncher();
        Intent launch = getPackageManager().getLaunchIntentForPackage(launcher);
        if (launch == null) {
            Log.w(TAG, launcher
                    + " is not installed, leaving the Amazon home screen up");
            return;
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        startActivity(launch);
    }

    @Override
    public void onInterrupt() {
        cancelWait();
    }

    @Override
    public void onDestroy() {
        cancelWait();
        handler.removeCallbacks(guardCheck);
        getContentResolver().unregisterContentObserver(guardObserver);
        getContentResolver().unregisterContentObserver(adbObserver);
        super.onDestroy();
    }
}
