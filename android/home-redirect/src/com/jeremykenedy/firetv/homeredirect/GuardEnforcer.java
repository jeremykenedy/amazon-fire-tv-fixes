package com.jeremykenedy.firetv.homeredirect;

import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Log;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Reads, saves and puts back the guarded settings. The locked values live in
 * this app's own preferences, so they survive a reboot and an app update.
 */
final class GuardEnforcer {
    private static final String TAG = "FireTvGuard";

    private static final String PREFS = "guard";

    private static final String LOCKED = "locked";

    private static final int JOB_ID = 1;

    private static final long EVERY_MS = 15 * 60 * 1000L;

    private GuardEnforcer() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isLocked(Context context) {
        return prefs(context).getBoolean(LOCKED, false);
    }

    static String read(ContentResolver resolver, String setting) {
        String key = Guard.key(setting);
        String value = "system".equals(Guard.namespace(setting))
                ? Settings.System.getString(resolver, key)
                : Settings.Secure.getString(resolver, key);
        return value == null ? Guard.ABSENT : value;
    }

    private static void write(ContentResolver resolver, String setting,
            String value) {
        String key = Guard.key(setting);
        String stored = Guard.ABSENT.equals(value) ? null : value;
        if ("system".equals(Guard.namespace(setting))) {
            Settings.System.putString(resolver, key, stored);
        } else {
            Settings.Secure.putString(resolver, key, stored);
        }
    }

    /** Saves every guarded setting as it is now and turns the guard on. */
    static void lock(Context context) {
        ContentResolver resolver = context.getContentResolver();
        SharedPreferences.Editor editor = prefs(context).edit().clear();
        for (String setting : Guard.SETTINGS) {
            editor.putString(setting, read(resolver, setting));
        }
        editor.putBoolean(LOCKED, true).apply();
        schedule(context);
    }

    /** Forgets the saved values, so nothing is put back any more. */
    static void unlock(Context context) {
        prefs(context).edit().clear().apply();
        JobScheduler jobs = context.getSystemService(JobScheduler.class);
        if (jobs != null) {
            jobs.cancel(JOB_ID);
        }
    }

    /**
     * Records a value the toolkit or the picker is about to set, so the guard
     * keeps the new value instead of putting the old one back.
     */
    static void remember(Context context, String setting, String value) {
        if (isLocked(context) && prefs(context).contains(setting)) {
            prefs(context).edit().putString(setting, value).apply();
        }
    }

    /**
     * Stops guarding one setting until the next lock, so it can be changed
     * from anywhere.
     */
    static void forget(Context context, String setting) {
        if (Guard.isGuarded(setting)) {
            prefs(context).edit().remove(setting).apply();
        }
    }

    /** Puts back every guarded setting that drifted. */
    static List<String> enforce(Context context) {
        ContentResolver resolver = context.getContentResolver();
        Map<String, String> locked = new HashMap<>();
        Map<String, String> current = new HashMap<>();
        if (isLocked(context)) {
            for (String setting : Guard.SETTINGS) {
                locked.put(setting, prefs(context).getString(setting, null));
                current.put(setting, read(resolver, setting));
            }
        }
        List<String> changed = Guard.drift(locked, current);
        for (String setting : changed) {
            try {
                write(resolver, setting, locked.get(setting));
                if (Guard.needsAccessibilityOn(setting, locked.get(setting))) {
                    Settings.Secure.putInt(resolver,
                            "accessibility_enabled", 1);
                }
                Log.i(TAG, "Put back " + setting);
            } catch (SecurityException e) {
                Log.w(TAG, "Not allowed to put back " + setting, e);
            }
        }
        return changed;
    }

    /** A check every 15 minutes, which also survives a reboot. */
    static void schedule(Context context) {
        JobScheduler jobs = context.getSystemService(JobScheduler.class);
        if (jobs == null || !isLocked(context)) {
            return;
        }
        ComponentName service = new ComponentName(context, GuardJob.class);
        jobs.schedule(new JobInfo.Builder(JOB_ID, service)
                .setPeriodic(EVERY_MS)
                .setPersisted(true)
                .build());
    }
}
