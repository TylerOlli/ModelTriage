/**
 * Usage Command
 *
 * mt usage — Show current usage stats and remaining requests.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getUsage, ApiError } from "../api.js";
import { getApiKey } from "../config.js";

export function registerUsageCommand(program: Command): void {
  program
    .command("usage")
    .description("Show your usage stats for today")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      if (!getApiKey()) {
        console.log(
          chalk.red("Not authenticated.") +
            " Run " +
            chalk.bold("mt auth login") +
            " first."
        );
        process.exit(1);
      }

      const spinner = ora({
        text: "Fetching usage...",
        color: "blue",
      }).start();

      try {
        const usage = await getUsage();
        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(usage, null, 2));
          return;
        }

        const pct = Math.round((usage.used / usage.limit) * 100);
        const barWidth = 30;
        const filled = Math.round((pct / 100) * barWidth);
        const empty = barWidth - filled;

        const barColor =
          pct >= 90 ? chalk.red : pct >= 70 ? chalk.yellow : chalk.blue;

        const bar =
          barColor("█".repeat(filled)) + chalk.dim("░".repeat(empty));

        console.log();
        console.log(chalk.bold("Today's Usage"));
        console.log();
        console.log(`  ${bar}  ${usage.used}/${usage.limit} (${pct}%)`);
        console.log();
        console.log(
          `  Remaining: ${chalk.bold(String(usage.remaining))} requests`
        );
        console.log(
          chalk.dim("  Resets at midnight UTC")
        );
        console.log();
      } catch (err) {
        spinner.stop();
        if (err instanceof ApiError) {
          console.log(chalk.red(`Error (${err.status}): ${err.message}`));
        } else if (err instanceof Error) {
          console.log(chalk.red("Error: " + err.message));
        }
        process.exit(1);
      }
    });
}
