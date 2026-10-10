package com.jeremykenedy.firetv.homeredirect;

/**
 * Plain-Java rules for which launcher the Home button opens, kept free of
 * Android classes so they can be tested on a normal JVM.
 */
final class HomeTarget {
    static final String AT4K = "at4k";

    static final String LTV = "ltv";

    /** AT4K, the launcher Home Redirect has always opened. */
    static final String DEFAULT = AT4K;

    private HomeTarget() {
    }

    /** Whether a name is a launcher Home Redirect can open. */
    static boolean isKnown(String target) {
        return AT4K.equals(target) || LTV.equals(target);
    }

    /** The package for a launcher name; anything unknown opens AT4K. */
    static String packageFor(String target) {
        return LTV.equals(target) ? "com.leanbitlab.ltvL" : "com.overdevs.at4k";
    }
}
