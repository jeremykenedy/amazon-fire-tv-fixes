import { readEnvFile, writeEnvFile } from './device-config.js';

/** Must match Guard.SETTINGS in the Home Redirect app. */
export const GUARDED_SETTINGS = [
  'secure/screensaver_components',
  'secure/screensaver_default_component',
  'secure/screensaver_enabled',
  'secure/screensaver_activate_on_sleep',
  'secure/screensaver_activate_on_dock',
  'secure/str.auto_wake_up_enabled',
  'secure/sleep_timeout',
  'secure/enabled_accessibility_services',
  'secure/amazon_ambient_enabled',
  'system/screen_off_timeout',
];

/** Settings that can be unlocked on their own, by group. */
export const GUARD_GROUPS = {
  screensaver: ['secure/screensaver_components', 'secure/screensaver_default_component'],
};

const ON = 'FIRE_TV_GUARD';
const FREE = 'FIRE_TV_GUARD_UNLOCKED';
const DISABLED = 'FIRE_TV_GUARD_DISABLED';
const BACKGROUND = 'FIRE_TV_GUARD_BACKGROUND';

/**
 * Pure: the guard's saved state. `disabled` lists only the packages the guard
 * itself disabled, and `background` the original background mode of each
 * package it restricted, so turning the guard off undoes exactly that.
 * `unlocked` lists the groups left free to change.
 * @param {string | null} raw
 * @returns {{on: boolean, disabled: string[], background: Object<string, string>, unlocked: string[]}}
 */
export function parseGuardEnv(raw) {
  const value = (key) => new RegExp(`^${key}=(.*)$`, 'm').exec(raw || '')?.[1].trim() ?? '';
  const list = (key) => value(key).split(',').filter(Boolean);
  return {
    on: value(ON) === 'on',
    disabled: list(DISABLED),
    background: Object.fromEntries(list(BACKGROUND).map((pair) => pair.split('='))),
    unlocked: list(FREE),
  };
}

/**
 * Pure: writes the guard's state into .env, or removes every guard line when
 * the guard is off.
 * @param {string | null} raw
 * @param {{on: boolean, disabled: string[], background: Object<string, string>, unlocked: string[]}} state
 * @returns {string}
 */
export function mergeGuardEnv(raw, state) {
  let out = (raw || '').replace(new RegExp(String.raw`^(${ON}|${DISABLED}|${BACKGROUND}|${FREE})=.*\n?`, 'gm'), '');
  if (state.on) {
    const lines = [
      `${ON}=on`,
      `${DISABLED}=${state.disabled.join(',')}`,
      `${BACKGROUND}=${Object.entries(state.background).map((pair) => pair.join('=')).join(',')}`,
      `${FREE}=${state.unlocked.join(',')}`,
    ];
    out = out.trim() === '' ? `${lines.join('\n')}\n` : `${out.trimEnd()}\n${lines.join('\n')}\n`;
  }
  return out;
}

export function guardState() {
  return parseGuardEnv(readEnvFile());
}

export function saveGuardState(state) {
  writeEnvFile(mergeGuardEnv(readEnvFile(), state));
}

/**
 * @param {string} namespace
 * @param {string} key
 * @returns {boolean} whether the guard is on and keeps this setting
 */
export function isGuardedNow(namespace, key) {
  return GUARDED_SETTINGS.includes(`${namespace}/${key}`) && guardState().on;
}
