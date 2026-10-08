import { getSetting, putSetting, deleteSetting, getAppOp, setAppOp, listPackages } from '../adb.js';
import { readEnvFile, writeEnvFile } from '../device-config.js';
import { SCREENSAVERS, BUILT_IN_SCREENSAVERS, AMAZON_DEFAULT, DEFAULT_SCREENSAVER_ID, sameComponent } from '../screensaver-registry.js';

const AERIAL = SCREENSAVERS.find((s) => s.id === DEFAULT_SCREENSAVER_ID);
const AD_FREE = [...SCREENSAVERS, ...BUILT_IN_SCREENSAVERS];
const OVERLAY = 'SYSTEM_ALERT_WINDOW';

// Five minutes: the shortest screensaver timeout Fire TV Settings offers.
const SCREENSAVER_MS = 300000;

/**
 * Everything the optimizer may change, keyed by id. The id also names the
 * .env line that keeps the value from before the first change, so a revert
 * knows exactly where to put it back.
 */
export const TARGETS = {
  'screensaver-enabled': { namespace: 'secure', key: 'screensaver_enabled', label: 'Turn the screensaver on' },
  'activate-on-sleep': { namespace: 'secure', key: 'screensaver_activate_on_sleep', label: 'Start the screensaver when the TV is idle' },
  'activate-on-dock': { namespace: 'secure', key: 'screensaver_activate_on_dock', label: "Turn on Android's start-when-docked screensaver switch" },
  'timeout-order': { namespace: 'system', key: 'screen_off_timeout', label: 'Start the screensaver before the TV goes to sleep' },
  'alexa-fix': { namespace: 'secure', key: 'str.auto_wake_up_enabled', label: 'Turn on the Alexa deep-sleep fix' },
  active: { namespace: 'secure', key: 'screensaver_components', label: `Make ${AERIAL.name} the active screensaver` },
  'default-component': { namespace: 'secure', key: 'screensaver_default_component', label: "Make the active screensaver the TV's fallback screensaver" },
  'ambient-off': { namespace: 'secure', key: 'amazon_ambient_enabled', label: "Turn off Amazon's Ambient Experience (needs a restart of the TV)" },
  'aerial-overlay': { pkg: AERIAL.pkg, op: OVERLAY, label: `Let ${AERIAL.name} match the video frame rate (its overlay permission)` },
};

const SETTING_IDS = Object.keys(TARGETS).filter((id) => TARGETS[id].namespace);

/**
 * Reads everything the plan depends on. A setting the TV does not have reads
 * as null, and nothing is ever planned for it.
 * @param {string} ip
 * @returns {Promise<{settings: Object<string, string | null>, installed: string[], aerialOverlay: string | null}>}
 */
export async function readOptimizeState(ip) {
  const settings = {};
  for (const id of SETTING_IDS) {
    const { namespace, key } = TARGETS[id];
    const value = await getSetting(ip, namespace, key);
    settings[id] = value === null || value === 'null' ? null : value;
  }
  settings.sleep = await getSetting(ip, 'secure', 'sleep_timeout');
  const installed = await listPackages(ip);
  const aerialOverlay = installed.includes(AERIAL.pkg) ? await getAppOp(ip, AERIAL.pkg, OVERLAY) : null;
  return { settings, installed, aerialOverlay };
}

/**
 * Pure: the screensaver timeout to use when it does not come before sleep.
 * @param {number} sleepMs
 * @returns {number}
 */
export function screensaverTimeoutBefore(sleepMs) {
  return sleepMs > SCREENSAVER_MS ? SCREENSAVER_MS : Math.floor(sleepMs / 2);
}

/**
 * Pure: the changes this TV needs, given what was read from it. Only settings
 * the TV has are touched, and only when they are not already right.
 * @param {{settings: Object<string, string | null>, installed: string[], aerialOverlay: string | null}} state
 * @returns {Array<{id: string, label: string, from: string | null, to: string}>}
 */
export function planOptimizations({ settings, installed, aerialOverlay }) {
  const changes = [];
  const change = (id, to) => changes.push({ id, label: TARGETS[id].label, from: settings[id] ?? null, to: String(to) });
  const wants = (id, to) => {
    if (settings[id] !== null && settings[id] !== String(to)) {
      change(id, to);
    }
  };

  wants('screensaver-enabled', 1);
  wants('activate-on-sleep', 1);
  wants('activate-on-dock', 1);

  const sleepMs = Number(settings.sleep);
  const screensaverMs = Number(settings['timeout-order']);
  if (settings['timeout-order'] !== null && sleepMs > 0 && screensaverMs >= sleepMs) {
    change('timeout-order', screensaverTimeoutBefore(sleepMs));
  }

  wants('alexa-fix', 1);

  const adFreeInstalled = (component) => AD_FREE.some((s) => sameComponent(s.dreamComponent, component) && installed.includes(s.pkg));
  let active = settings.active;
  if (!adFreeInstalled(active) && installed.includes(AERIAL.pkg)) {
    active = AERIAL.dreamComponent;
    change('active', active);
  }
  const fallback = settings['default-component'];
  if (fallback !== null && adFreeInstalled(active) && !sameComponent(fallback, active)) {
    change('default-component', active);
  }

  wants('ambient-off', 0);

  if (aerialOverlay !== null && aerialOverlay !== 'allow') {
    changes.push({ id: 'aerial-overlay', label: TARGETS['aerial-overlay'].label, from: aerialOverlay, to: 'allow' });
  }
  return changes;
}

/**
 * Pure: a setting's value the way a person reads it: on or off, minutes, a
 * screensaver's name, or whether a permission is allowed.
 * @param {string} id
 * @param {string | null} value
 * @returns {string}
 */
export function displayValue(id, value) {
  if (value === null) {
    return 'not set';
  }
  if (TARGETS[id].op) {
    return value === 'allow' ? 'allowed' : 'not allowed';
  }
  if (id === 'timeout-order') {
    return `${Number((Number(value) / 60000).toFixed(1))} min`;
  }
  if (id === 'active' || id === 'default-component') {
    return [...AD_FREE, AMAZON_DEFAULT].find((s) => sameComponent(s.dreamComponent, value))?.name ?? value;
  }
  return value === '1' ? 'on' : 'off';
}

/**
 * Pure: the .env key that keeps a target's value from before the first change.
 * @param {string} id
 * @returns {string}
 */
function envKeyFor(id) {
  return `FIRE_TV_OPTIMIZE_${id.toUpperCase().replaceAll('-', '_')}`;
}

/**
 * Pure: the saved original values, by target id. "null" means the TV had no
 * value for that setting.
 * @param {string | null} raw
 * @returns {Object<string, string>}
 */
export function parseOriginals(raw) {
  const originals = {};
  for (const id of Object.keys(TARGETS)) {
    const match = new RegExp(`^${envKeyFor(id)}=(.*)$`, 'm').exec(raw || '');
    if (match) {
      originals[id] = match[1].trim();
    }
  }
  return originals;
}

/**
 * Pure: adds a target's original value, keeping one that was saved earlier
 * so a second run never overwrites what the TV started with.
 * @param {string | null} raw
 * @param {string} id
 * @param {string | null} value
 * @returns {string}
 */
export function mergeOriginal(raw, id, value) {
  const base = raw || '';
  if (id in parseOriginals(base)) {
    return base;
  }
  const line = `${envKeyFor(id)}=${value ?? 'null'}`;
  return base.trim() === '' ? `${line}\n` : `${base.trimEnd()}\n${line}\n`;
}

/**
 * Pure: drops a target's saved original once it has been put back.
 * @param {string | null} raw
 * @param {string} id
 * @returns {string}
 */
export function dropOriginal(raw, id) {
  return (raw || '').replace(new RegExp(`^${envKeyFor(id)}=.*\\n?`, 'm'), '');
}

/** @returns {Object<string, string>} */
export function savedOriginals() {
  return parseOriginals(readEnvFile());
}

async function readTarget(ip, id) {
  const t = TARGETS[id];
  if (t.op) {
    return getAppOp(ip, t.pkg, t.op);
  }
  const value = await getSetting(ip, t.namespace, t.key);
  return value === 'null' ? null : value;
}

async function writeTarget(ip, id, value) {
  const t = TARGETS[id];
  if (t.op) {
    await setAppOp(ip, t.pkg, t.op, value);
  } else if (value === null || value === 'null') {
    await deleteSetting(ip, t.namespace, t.key);
  } else {
    await putSetting(ip, t.namespace, t.key, value);
  }
}

/**
 * Saves each original value, makes the change, and reads it back.
 * @param {string} ip
 * @param {Array<{id: string, from: string | null, to: string}>} changes
 * @returns {Promise<Array<{change: object, ok: boolean, readBack: string | null}>>}
 */
export async function applyOptimizations(ip, changes) {
  const results = [];
  for (const change of changes) {
    writeEnvFile(mergeOriginal(readEnvFile(), change.id, change.from));
    await writeTarget(ip, change.id, change.to);
    const readBack = await readTarget(ip, change.id);
    results.push({ change, ok: readBack === change.to, readBack });
  }
  return results;
}

/**
 * Puts every saved original back and forgets the ones that took.
 * @param {string} ip
 * @returns {Promise<Array<{id: string, label: string, ok: boolean}>>}
 */
export async function revertOptimizations(ip) {
  const results = [];
  for (const [id, original] of Object.entries(savedOriginals())) {
    await writeTarget(ip, id, original);
    const readBack = await readTarget(ip, id);
    const ok = TARGETS[id].op ? readBack === original : (readBack ?? 'null') === original;
    if (ok) {
      writeEnvFile(dropOriginal(readEnvFile(), id));
    }
    results.push({ id, label: TARGETS[id].label, ok });
  }
  return results;
}
