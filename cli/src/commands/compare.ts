/**
 * Compare Command
 *
 * mt compare "prompt" --models gpt-5,claude-sonnet-4-5
 *
 * Runs a prompt through multiple models and shows side-by-side results.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { sendPrompt, ApiError } from "../api.js";
import { getApiKey } from "../config.js";

export function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description("Compare responses from multiple models")
    .argument("<prompt>", "The prompt to compare across models")
    .requiredOption(
      "-m, --models <models>",
      "Comma-separated list of models to compare"
    )
    .option("-t, --temperature <n>", "Temperature (0-2)", parseFloat)
    .option("--max-tokens <n>", "Maximum response tokens", parseInt)
    .option("--json", "Output raw JSON")
    .action(
      async (
        prompt: string,
        opts: {
          models: string;
          temperature?: number;
          maxTokens?: number;
          json?: boolean;
        }
      ) => {
        if (!getApiKey()) {
          console.log(
            chalk.red("Not authenticated.") +
              " Run " +
              chalk.bold("mt auth login") +
              " first."
          );
          process.exit(1);
        }

        const models = opts.models.split(",").map((m) => m.trim());
        if (models.length < 2) {
          console.log(
            chalk.red("Compare mode requires at least 2 models.")
          );
          console.log(
            chalk.dim("Example: mt compare 'hello' --models gpt-5,claude-sonnet-4-5")
          );
          process.exit(1);
        }

        const spinner = ora({
          text: `Querying ${models.length} models...`,
          color: "blue",
        }).start();

        try {
          const data = await sendPrompt({
            prompt,
            models,
            temperature: opts.temperature,
            maxTokens: opts.maxTokens,
          });

          spinner.stop();

          if (opts.json) {
            console.log(JSON.stringify(data, null, 2));
            return;
          }

          // Display side-by-side results
          console.log();
          console.log(
            chalk.blue("▸") +
              " Comparison: " +
              chalk.bold(models.join(" vs "))
          );
          console.log();

          for (const result of data.results) {
            const header = result.success
              ? chalk.green("✓") + " " + chalk.bold(result.modelId)
              : chalk.red("✗") + " " + chalk.bold(result.modelId);

            const latency = result.latencyMs
              ? chalk.dim(` (${result.latencyMs}ms)`)
              : "";

            console.log(header + latency);
            console.log(chalk.dim("─".repeat(60)));

            if (result.success) {
              console.log(result.text);
            } else {
              console.log(chalk.red(`Error: ${result.error || "Unknown error"}`));
            }

            console.log();
          }
        } catch (err) {
          spinner.stop();
          if (err instanceof ApiError) {
            console.log(chalk.red(`Error (${err.status}): ${err.message}`));
          } else if (err instanceof Error) {
            console.log(chalk.red("Error: " + err.message));
          }
          process.exit(1);
        }
      }
    );
}
