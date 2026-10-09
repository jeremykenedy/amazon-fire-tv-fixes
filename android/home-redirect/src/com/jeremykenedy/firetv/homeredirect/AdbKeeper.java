package com.jeremykenedy.firetv.homeredirect;

import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.provider.Settings;
import android.util.Log;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Keeps ADB debugging on, so the toolkit can still reach the TV after a
 * restart. It never touches wireless debugging, which would make Fire OS ask
 * to allow debugging on the network. On by default; the toolkit can release
 * it with the "adb" guard command.
 */
final class AdbKeeper {
    private static final String TAG = "FireTvAdb";

    private static final String PREFS = "adb";

    private static final String KEEP = "keep";

    private AdbKeeper() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static boolean isKept(Context context) {
        return prefs(context).getBoolean(KEEP, true);
    }

    static void setKept(Context context, boolean keep) {
        prefs(context).edit().putBoolean(KEEP, keep).commit();
        keepOn(context);
    }

    /** Turns ADB debugging back on if it went off. */
    static List<String> keepOn(Context context) {
        ContentResolver resolver = context.getContentResolver();
        Map<String, String> current = new HashMap<>();
        for (String key : Guard.ADB_SWITCHES) {
            String value = Settings.Global.getString(resolver, key);
            current.put(key, value == null ? Guard.ABSENT : value);
        }
        List<String> off = Guard.adbOff(current);
        if (!isKept(context)) {
            return off;
        }
        for (String key : off) {
            try {
                Settings.Global.putInt(resolver, key, 1);
                Log.i(TAG, "Turned " + key + " back on");
            } catch (SecurityException e) {
                Log.w(TAG, "Not allowed to turn " + key + " on", e);
            }
        }
        return off;
    }
}
