import { select as inquirerSelect, checkbox as inquirerCheckbox, input as inquirerInput } from '@inquirer/prompts';

/**
 * Wraps an @inquirer prompt so pressing Esc aborts it (the prompt rejects
 * with AbortPromptError, which cli-runtime turns into a clean "Cancelled."
 * exit). The listener only exists while that prompt is waiting for an
 * answer, so Esc does nothing during an action that is already running.
 * @template T
 * @param {(config: any, context?: any) => Promise<T>} prompt
 * @returns {(config: any, context?: any) => Promise<T>}
 */
export function cancellableOnEsc(prompt) {
  return (config, context = {}) => {
    const controller = new AbortController();
    const onKeypress = (_chunk, key) => {
      if (key && key.name === 'escape') controller.abort();
    };
    process.stdin.on('keypress', onKeypress);
    return prompt(config, { ...context, signal: controller.signal }).finally(() => {
      process.stdin.off('keypress', onKeypress);
    });
  };
}

export const select = cancellableOnEsc(inquirerSelect);
export const checkbox = cancellableOnEsc(inquirerCheckbox);
export const input = cancellableOnEsc(inquirerInput);
