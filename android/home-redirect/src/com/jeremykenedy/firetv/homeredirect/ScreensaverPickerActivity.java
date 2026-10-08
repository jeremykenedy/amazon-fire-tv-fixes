package com.jeremykenedy.firetv.homeredirect;

import android.app.Activity;
import android.content.ComponentName;
import android.content.ContentResolver;
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
            public void onItemClick(AdapterView<?> parent, View view, int position, long id) {
                choose(position);
            }
        });
        root.addView(list, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));

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
        // Some screensavers keep their service unexported so only the system can
        // start it, which hides them from an intent query. Reading each app's
        // declared services finds those too.
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
        list.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_list_item_single_choice, labels));

        int active = Screensavers.indexOfActive(choices, Settings.Secure.getString(getContentResolver(), ACTIVE_SETTING));
        if (active >= 0) {
            list.setItemChecked(active, true);
            list.setSelection(active);
            status.setText(getString(R.string.picker_active, choices.get(active).label));
        } else {
            status.setText(R.string.picker_pick);
        }
        status.setGravity(Gravity.START);
    }

    private static void addScreensavers(PackageManager pm, String packageName, List<Screensavers.Choice> found) {
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
                String component = new ComponentName(service.packageName, service.name).flattenToShortString();
                String label = Screensavers.displayName(service.packageName, service.loadLabel(pm).toString());
                found.add(new Screensavers.Choice(component, label));
            }
        }
    }

    private void choose(int position) {
        Screensavers.Choice choice = choices.get(position);
        ContentResolver resolver = getContentResolver();
        try {
            Settings.Secure.putString(resolver, ACTIVE_SETTING, choice.component);
            Settings.Secure.putInt(resolver, ENABLED_SETTING, 1);
            status.setText(getString(R.string.picker_active, choice.label));
        } catch (SecurityException e) {
            list.setItemChecked(position, false);
            status.setText(R.string.picker_needs_permission);
        }
    }
}
