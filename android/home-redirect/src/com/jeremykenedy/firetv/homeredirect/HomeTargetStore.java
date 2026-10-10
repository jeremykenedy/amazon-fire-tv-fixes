package com.jeremykenedy.firetv.homeredirect;

import android.content.Context;
import android.content.SharedPreferences;

/** Keeps the chosen Home launcher in this app's own preferences. */
final class HomeTargetStore {
    private static final String PREFS = "home";

    private static final String TARGET = "target";

    private HomeTargetStore() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String get(Context context) {
        String target = prefs(context).getString(TARGET, HomeTarget.DEFAULT);
        return HomeTarget.isKnown(target) ? target : HomeTarget.DEFAULT;
    }

    static void set(Context context, String target) {
        prefs(context).edit().putString(TARGET, target).commit();
    }
}
