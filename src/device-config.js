import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { input } from '@inquirer/prompts';

// Resolved relative to this file, not process.cwd(), so it always finds
// the project's own .env regardless of the directory the command was run
// from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');
export const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, '.env.example');

const IP_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function isValidIp(value) {
  const match = IP_RE.exec(value.trim());
  if (!match) return false;
  return match.slice(1).every((octet) => Number(octet) >= 0 && Number(octet) <= 255);
}

/**
 * Pure: pulls FIRE_TV_IP out of a raw .env file's contents, or null if
 * there isn't one. No filesystem access, so this is unit-testable on its
 * own.
 */
export function parseIpFromEnv(raw) {
  if (!raw) return null;
  const parsed = dotenv.parse(raw);
  return parsed.FIRE_TV_IP || null;
}

/**
 * Pure: returns the new contents of the .env file with FIRE_TV_IP set to
 * ip, given the file's current raw contents (or null if it does not exist
 * yet, in which case fallbackTemplate is used as the starting point). This
 * replaces the existing FIRE_TV_IP line in place if there is one, so any
 * other variables or comments survive, and appends the line otherwise.
 */
export function mergeIpIntoEnv(raw, ip, fallbackTemplate = 'FIRE_TV_IP=\n') {
  const base = raw === null ? fallbackTemplate : raw;
  const line = `FIRE_TV_IP=${ip}`;
  const hasKey = /^FIRE_TV_IP=.*$/m.test(base);
  return hasKey ? base.replace(/^FIRE_TV_IP=.*$/m, line) : `${base.trimEnd()}\n${line}\n`;
}

function readEnvFile() {
  try {
    return fs.readFileSync(ENV_PATH, 'utf8');
  } catch {
    return null;
  }
}

export function getSavedIp() {
  return parseIpFromEnv(readEnvFile());
}

export function saveIp(ip) {
  const raw = readEnvFile();
  const template = fs.existsSync(ENV_EXAMPLE_PATH) ? fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8') : undefined;
  const updated = mergeIpIntoEnv(raw, ip, template);
  fs.writeFileSync(ENV_PATH, updated);
}

export async function promptForIp(defaultValue) {
  const ip = await input({
    message: "What's your Fire TV's IP address?",
    default: defaultValue,
    validate: (value) => (isValidIp(value) ? true : 'Enter a valid IPv4 address, e.g. 192.168.1.49'),
  });
  return ip.trim();
}

