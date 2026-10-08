// Runs ui.js prompts in a child process so tests can answer them over piped
// stdin, including the keys that end the process. Started through drive().
import { promptYN, promptYesDefaultOrQuit, menu } from '../../src/ui.js';
import { print } from '../../src/output.js';

const [mode, ...flags] = process.argv.slice(2);

// Piped stdin has no setRawMode; --raw adds a stand-in so the TTY path runs too.
if (flags.includes('--raw')) {
  const calls = [];
  process.stdin.setRawMode = (on) => {
    calls.push(on);
    process.stdin.isRaw = on;
    return process.stdin;
  };
  process.on('exit', () => print(`raw calls: ${calls.join(',')}`));
}

if (mode === 'keys') {
  print(`first=${await promptYN('First?')}`);
  print(`second=${await promptYN('Second?')}`);
  print(`third=${await promptYesDefaultOrQuit('Third?')}`);
  print(`fourth=${await promptYesDefaultOrQuit('Fourth?')}`);
} else if (mode === 'one') {
  print(`answer=${await promptYN('Sure?')}`);
} else if (mode === 'menu') {
  const choices = [{ name: 'One', value: 'one' }];
  print(`picked=${await menu({ message: 'Pick one', choices })}`);
  print(`picked=${await menu({ message: 'Pick again', choices })}`);
}
