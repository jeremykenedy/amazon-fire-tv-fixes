package com.jeremykenedy.firetv.homeredirect;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Plain-Java rules for the screensaver picker, kept free of Android classes
 * so they can be tested on a normal JVM.
 */
final class Screensavers {
    static final String BIND_DREAM_SERVICE =
            "android.permission.BIND_DREAM_SERVICE";

    static final String AMAZON_PACKAGE = "com.amazon.ftv.screensaver";

    /**
     * Amazon's store-demo modes and Android's dessert easter egg are
     * screensavers in name only.
     */
    private static final String[] HIDDEN_PACKAGES = {
        "com.amazon.tv.quicksettings",
        "com.android.systemui",
    };

    private Screensavers() {
    }

    /**
     * One installed screensaver: its "package/class" component and its
     * display name.
     */
    static final class Choice {
        final String component;

        final String label;

        Choice(String component, String label) {
            this.component = component;
            this.label = label;
        }
    }

    /**
     * Expands the short component form ("pkg/.Cls") to the full one
     * ("pkg/pkg.Cls") so two spellings of the same screensaver compare equal.
     */
    static String fullComponent(String component) {
        if (component == null) {
            return "";
        }
        int slash = component.indexOf('/');
        if (slash <= 0 || slash == component.length() - 1) {
            return component;
        }
        String pkg = component.substring(0, slash);
        String cls = component.substring(slash + 1);
        return cls.startsWith(".") ? pkg + "/" + pkg + cls : component;
    }

    /**
     * Whether a service is a screensaver: the system only binds screensavers
     * through this permission.
     */
    static boolean isScreensaver(String permission) {
        return BIND_DREAM_SERVICE.equals(permission);
    }

    static boolean isHidden(String pkg) {
        for (String hidden : HIDDEN_PACKAGES) {
            if (hidden.equals(pkg)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Amazon's own screensaver only calls itself "Screensaver", which reads
     * like a heading.
     */
    static String displayName(String pkg, String label) {
        return AMAZON_PACKAGE.equals(pkg) ? "Amazon (factory default)" : label;
    }

    /** Sorted by name, ignoring case, so the list reads the same every time. */
    static List<Choice> sorted(List<Choice> choices) {
        List<Choice> copy = new ArrayList<>(choices);
        Collections.sort(copy, new Comparator<Choice>() {
            @Override
            public int compare(Choice a, Choice b) {
                String left = a.label.toLowerCase(Locale.ROOT);
                String right = b.label.toLowerCase(Locale.ROOT);
                return left.compareTo(right);
            }
        });
        return copy;
    }

    /**
     * Position of the active screensaver in the list, or -1 if it is not one
     * of them.
     */
    static int indexOfActive(List<Choice> choices, String active) {
        String wanted = fullComponent(active);
        for (int i = 0; i < choices.size(); i++) {
            if (fullComponent(choices.get(i).component).equals(wanted)) {
                return i;
            }
        }
        return -1;
    }
}
