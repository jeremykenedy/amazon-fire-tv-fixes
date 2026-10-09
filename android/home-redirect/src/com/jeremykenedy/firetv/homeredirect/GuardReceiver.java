package com.jeremykenedy.firetv.homeredirect;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Commands from the fire-tv-toolkit CLI over adb, and the system's boot and
 * app-update notices. Only a sender holding WRITE_SECURE_SETTINGS (the adb
 * shell, or the system) can reach it.
 *
 * adb shell am broadcast
 *   -n com.jeremykenedy.firetv.homeredirect/.GuardReceiver
 *   -a com.jeremykenedy.firetv.homeredirect.GUARD --es cmd lock|unlock|check
 * and for remember: --es setting secure/screensaver_components --es value X
 */
public class GuardReceiver extends BroadcastReceiver {
    static final String ACTION = "com.jeremykenedy.firetv.homeredirect.GUARD";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!ACTION.equals(action)) {
            GuardEnforcer.enforce(context);
            GuardEnforcer.schedule(context);
            return;
        }
        String cmd = intent.getStringExtra("cmd");
        if ("lock".equals(cmd)) {
            GuardEnforcer.lock(context);
            setResultData("locked");
        } else if ("unlock".equals(cmd)) {
            GuardEnforcer.unlock(context);
            setResultData("unlocked");
        } else if ("remember".equals(cmd)) {
            GuardEnforcer.remember(context, intent.getStringExtra("setting"),
                    valueOf(intent.getStringExtra("value")));
            setResultData("remembered");
        } else if ("check".equals(cmd)) {
            String state = GuardEnforcer.isLocked(context) ? "on" : "off";
            setResultData("guard=" + state + " restored="
                    + Guard.describe(GuardEnforcer.enforce(context)));
        } else {
            setResultData("unknown");
        }
    }

    private static String valueOf(String value) {
        return value == null || "null".equals(value) ? Guard.ABSENT : value;
    }
}
