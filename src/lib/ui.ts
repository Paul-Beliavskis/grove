import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';

export { chalk, ora };

export function createTable(options: {
  head: string[];
  colWidths?: number[];
}): InstanceType<typeof Table> {
  const tableOpts: Record<string, unknown> = {
    head: options.head.map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  };
  if (options.colWidths) {
    tableOpts.colWidths = options.colWidths;
  }
  return new Table(tableOpts as any);
}

export function info(msg: string): void {
  console.log(chalk.cyan(msg));
}

export function success(msg: string): void {
  console.log(chalk.green(msg));
}

export function warn(msg: string): void {
  console.log(chalk.yellow(msg));
}

export function error(msg: string): void {
  console.error(chalk.red(msg));
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
