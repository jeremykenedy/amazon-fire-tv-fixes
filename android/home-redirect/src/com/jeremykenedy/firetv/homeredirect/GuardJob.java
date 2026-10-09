package com.jeremykenedy.firetv.homeredirect;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** The periodic check, for when nothing else noticed a change. */
public class GuardJob extends JobService {
    @Override
    public boolean onStartJob(JobParameters params) {
        AdbKeeper.keepOn(this);
        GuardEnforcer.enforce(this);
        return false;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
