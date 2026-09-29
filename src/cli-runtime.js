import chalk from 'chalk';

let installed = false;

function handleFatal(err) {
  // Ctrl-C at an @inquirer prompt rejects with ExitPromptError.
  if (err && err.name === 'ExitPromptError') {
    console.log(chalk.gray('\nCancelled.\n'));
    process.exit(130);
  }

  // Esc at a prompt aborts it (see prompts.js); that is a deliberate cancel.
  if (err && err.name === 'AbortPromptError') {
    console.log(chalk.gray('\nCancelled.\n'));
    process.exit(0);
  }

  console.error(chalk.red(`\nSomething went wrong: ${err?.message || err}`));
  if (process.env.DEBUG && err?.stack) {
    console.error(err.stack);
  } else {
    console.error(chalk.gray('Run again with DEBUG=1 for the full error.\n'));
  }
  process.exit(1);
}

/**
 * Turns Ctrl-C and unexpected errors into a short message instead of a raw
 * stack trace. Called once by renderBanner(), which every real command runs
 * first, so tests that import modules never get these handlers.
 */
export function installCliRuntime() {
  if (installed) return;
  installed = true;
  process.on('uncaughtException', handleFatal);
  process.on('unhandledRejection', handleFatal);
}
