/**
 * Models Command
 *
 * mt models — List available models.
 */

import { Command } from "commander";
import chalk from "chalk";

const AVAILABLE_MODELS = [
  { id: "gpt-5", provider: "OpenAI", description: "GPT-5 — versatile, strong at coding" },
  { id: "gpt-5-mini", provider: "OpenAI", description: "GPT-5 Mini — fast, cost-efficient" },
  { id: "gpt-5.2", provider: "OpenAI", description: "GPT-5.2 — latest, vision-capable" },
  { id: "claude-sonnet-4-5", provider: "Anthropic", description: "Claude Sonnet 4.5 — balanced, vision-capable" },
  { id: "claude-opus-4-5", provider: "Anthropic", description: "Claude Opus 4.5 — strongest reasoning, vision" },
  { id: "gemini-3-flash", provider: "Google", description: "Gemini 3 Flash — fastest, vision-capable" },
  { id: "gemini-3-pro", provider: "Google", description: "Gemini 3 Pro — high quality, vision-capable" },
];

export function registerModelsCommand(program: Command): void {
  program
    .command("models")
    .description("List available models")
    .option("--json", "Output raw JSON")
    .action((opts: { json?: boolean }) => {
      if (opts.json) {
        console.log(JSON.stringify(AVAILABLE_MODELS, null, 2));
        return;
      }

      console.log();
      console.log(chalk.bold("Available Models"));
      console.log();

      let currentProvider = "";
      for (const model of AVAILABLE_MODELS) {
        if (model.provider !== currentProvider) {
          if (currentProvider) console.log();
          console.log("  " + chalk.dim(model.provider));
          currentProvider = model.provider;
        }
        console.log(
          "    " +
            chalk.bold(model.id.padEnd(22)) +
            chalk.dim(model.description.replace(`${model.id} — `, ""))
        );
      }
      console.log();
    });
}
