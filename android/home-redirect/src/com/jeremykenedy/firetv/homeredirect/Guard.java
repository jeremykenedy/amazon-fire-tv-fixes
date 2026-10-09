package com.jeremykenedy.firetv.homeredirect;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Plain-Java rules for the guard, kept free of Android classes so they can be
 * tested on a normal JVM. A guarded setting is named "namespace/key".
 */
final class Guard {
    /** Stands for a setting the TV has no value for. */
    static final String ABSENT = "\u0000";

    /** Every setting the guard keeps the way it was locked. */
    static final String[] SETTINGS = {
        "secure/screensaver_components",
        "secure/screensaver_default_component",
        "secure/screensaver_enabled",
        "secure/screensaver_activate_on_sleep",
        "secure/screensaver_activate_on_dock",
        "secure/str.auto_wake_up_enabled",
        "secure/sleep_timeout",
        "secure/enabled_accessibility_services",
        "secure/amazon_ambient_enabled",
        "system/screen_off_timeout",
    };

    private Guard() {
    }

    static String namespace(String setting) {
        return setting.substring(0, setting.indexOf('/'));
    }

    static String key(String setting) {
        return setting.substring(setting.indexOf('/') + 1);
    }

    /** Whether a name is one of the guarded settings. */
    static boolean isGuarded(String setting) {
        for (String s : SETTINGS) {
            if (s.equals(setting)) {
                return true;
            }
        }
        return false;
    }

    /**
     * The guarded settings whose current value differs from the locked one.
     * A setting that was never locked is left alone.
     */
    static List<String> drift(Map<String, String> locked,
            Map<String, String> current) {
        List<String> changed = new ArrayList<>();
        for (String setting : SETTINGS) {
            String want = locked.get(setting);
            if (want == null) {
                continue;
            }
            String have = current.get(setting);
            if (!want.equals(have == null ? ABSENT : have)) {
                changed.add(setting);
            }
        }
        return changed;
    }

    /**
     * Whether putting a setting back also needs accessibility switched on:
     * Android only runs the listed services while accessibility_enabled is 1,
     * and it manages that flag itself, so it is set rather than saved.
     */
    static boolean needsAccessibilityOn(String setting, String value) {
        return "secure/enabled_accessibility_services".equals(setting)
                && !ABSENT.equals(value) && !value.isEmpty();
    }

    /** Joins setting names for a broadcast result, "none" when empty. */
    static String describe(List<String> settings) {
        if (settings.isEmpty()) {
            return "none";
        }
        StringBuilder out = new StringBuilder();
        for (String s : settings) {
            if (out.length() > 0) {
                out.append(',');
            }
            out.append(s);
        }
        return out.toString();
    }
}
