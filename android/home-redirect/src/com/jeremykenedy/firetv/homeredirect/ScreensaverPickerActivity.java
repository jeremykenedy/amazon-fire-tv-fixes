package com.jeremykenedy.firetv.homeredirect;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.PackageInfo;
import android.content.pm.ServiceInfo;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import java.util.ArrayList;
import java.util.List;

/**
 * Lists every screensaver installed on the TV and makes the one you pick
 * active. Fire OS Settings only offers Amazon's own screensaver, so this is
 * the on-TV way to switch. Writing the setting needs WRITE_SECURE_SETTINGS,
 * which the fire-tv-toolkit CLI grants over adb when it installs this app.
 */
public class ScreensaverPickerActivity extends Activity {
    static final String ACTIVE_SETTING = "screensaver_components";

    static final String ENABLED_SETTING = "screensaver_enabled";

    private static final String FIRE_TV_UI_PACKAGE = "com.jeremykenedy.firetv.ui";

    private static final String FIRE_TV_UI_ACTION =
            FIRE_TV_UI_PACKAGE + ".SELECT_SCREENSAVER";

    private interface SettingCallback {
        void run();
    }

    private List<Screensavers.Choice> choices = new ArrayList<>();

    private ListView list;

    private TextView status;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int pad = Math.round(48 * getResources().getDisplayMetrics().density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText(R.string.picker_title);
        title.setTextSize(32);
        root.addView(title);

        status = new TextView(this);
        status.setTextSize(18);
        status.setPadding(0, pad / 4, 0, pad / 2);
        root.addView(status);

        list = new ListView(this);
        list.setChoiceMode(ListView.CHOICE_MODE_SINGLE);
        list.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> parent, View view,
                    int position, long id) {
                choose(position);
            }
        });
        root.addView(list, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        load();
    }

    private void load() {
        PackageManager pm = getPackageManager();
        List<Screensavers.Choice> found = new ArrayList<>();
        // Some screensavers keep their service unexported so only the system
        // can start it, which hides them from an intent query. Reading each
        // app's declared services finds those too.
        for (PackageInfo pkg : pm.getInstalledPackages(0)) {
            if (Screensavers.isHidden(pkg.packageName)) {
                continue;
            }
            addScreensavers(pm, pkg.packageName, found);
        }
        choices = Screensavers.sorted(found);

        List<String> labels = new ArrayList<>();
        for (Screensavers.Choice choice : choices) {
            labels.add(choice.label);
        }
        list.setAdapter(new ArrayAdapter<>(this,
                android.R.layout.simple_list_item_single_choice, labels));

        String current = Settings.Secure.getString(getContentResolver(),
                ACTIVE_SETTING);
        int active = Screensavers.indexOfActive(choices, current);
        if (active >= 0) {
            list.setItemChecked(active, true);
            list.setSelection(active);
            status.setText(getString(R.string.picker_active,
                    choices.get(active).label));
        } else {
            status.setText(R.string.picker_pick);
        }
        status.setGravity(Gravity.START);
    }

    private static void addScreensavers(PackageManager pm,
            String packageName, List<Screensavers.Choice> found) {
        PackageInfo info;
        try {
            info = pm.getPackageInfo(packageName, PackageManager.GET_SERVICES);
        } catch (PackageManager.NameNotFoundException e) {
            return;
        }
        if (info.services == null) {
            return;
        }
        for (ServiceInfo service : info.services) {
            if (Screensavers.isScreensaver(service.permission)) {
                String component = new ComponentName(service.packageName,
                        service.name).flattenToShortString();
                String label = Screensavers.displayName(service.packageName,
                        service.loadLabel(pm).toString());
                found.add(new Screensavers.Choice(component, label));
            }
        }
    }

    private void choose(int position) {
        Screensavers.Choice choice = choices.get(position);
        String previous = Settings.Secure.getString(getContentResolver(),
                ACTIVE_SETTING);
        String wasEnabled = Settings.Secure.getString(getContentResolver(),
                ENABLED_SETTING);
        if (hasFireTvUi()) {
            if (!hasFireTvUiSelector()) {
                load();
                status.setText(R.string.picker_update_ui);
                return;
            }
            setFireTvUiSelection(choice.component,
                    new SettingCallback() {
                        @Override
                        public void run() {
                            remember(choice.component);
                            load();
                        }
                    }, new SettingCallback() {
                        @Override
                        public void run() {
                            showSaveFailure();
                        }
                    });
            return;
        }

        ContentResolver resolver = getContentResolver();
        try {
            boolean componentSaved = Settings.Secure.putString(resolver,
                    ACTIVE_SETTING, choice.component);
            boolean enabledSaved = Settings.Secure.putInt(resolver,
                    ENABLED_SETTING, 1);
            String current = Settings.Secure.getString(resolver,
                    ACTIVE_SETTING);
            if (!componentSaved || !enabledSaved
                    || !Screensavers.fullComponent(choice.component).equals(
                            Screensavers.fullComponent(current))) {
                Settings.Secure.putString(resolver, ACTIVE_SETTING, previous);
                restoreEnabled(wasEnabled);
                showSaveFailure();
                return;
            }
            remember(choice.component);
            load();
        } catch (SecurityException e) {
            showPermissionFailure();
        }
    }

    private boolean hasFireTvUi() {
        try {
            getPackageManager().getPackageInfo(FIRE_TV_UI_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException missing) {
            return false;
        }
    }

    private boolean hasFireTvUiSelector() {
        try {
            getPackageManager().getReceiverInfo(new ComponentName(
                    FIRE_TV_UI_PACKAGE,
                    FIRE_TV_UI_PACKAGE + ".ScreensaverSelectionReceiver"), 0);
            return true;
        } catch (PackageManager.NameNotFoundException missing) {
            return false;
        }
    }

    private void setFireTvUiSelection(String component,
            SettingCallback success, SettingCallback failure) {
        Intent request = new Intent(FIRE_TV_UI_ACTION);
        request.setComponent(new ComponentName(FIRE_TV_UI_PACKAGE,
                FIRE_TV_UI_PACKAGE + ".ScreensaverSelectionReceiver"));
        request.putExtra("component", component);
        try {
            sendOrderedBroadcast(request, null, new BroadcastReceiver() {
                @Override
                public void onReceive(android.content.Context context,
                        Intent intent) {
                    String current = Settings.Secure.getString(getContentResolver(),
                            ACTIVE_SETTING);
                    String actualEnabled = Settings.Secure.getString(
                            getContentResolver(), ENABLED_SETTING);
                    boolean componentMatches = Screensavers.fullComponent(component).equals(
                            Screensavers.fullComponent(current));
                    boolean enabledMatches = "1".equals(actualEnabled);
                    if (getResultCode() != 0 || !"ok".equals(getResultData())
                            || !componentMatches || !enabledMatches) {
                        failure.run();
                        return;
                    }
                    success.run();
                }
            }, null, 0, null, null);
        } catch (SecurityException denied) {
            failure.run();
        }
    }

    private void restoreEnabled(String enabled) {
        if ("0".equals(enabled) || "1".equals(enabled)) {
            Settings.Secure.putString(getContentResolver(), ENABLED_SETTING,
                    enabled);
        } else {
            getContentResolver().delete(Settings.Secure.CONTENT_URI,
                    "name=?", new String[] {ENABLED_SETTING});
        }
    }

    private void remember(String component) {
        GuardEnforcer.remember(this, "secure/" + ACTIVE_SETTING, component);
        GuardEnforcer.remember(this, "secure/" + ENABLED_SETTING, "1");
    }

    private void showPermissionFailure() {
        load();
        status.setText(R.string.picker_needs_permission);
    }

    private void showSaveFailure() {
        load();
        status.setText(R.string.picker_save_failed);
    }
}
