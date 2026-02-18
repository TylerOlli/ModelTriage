/**
 * Auth Commands
 *
 * mt auth login  — Store API key
 * mt auth logout — Clear stored API key
 * mt auth status — Show auth state and config path
 * mt auth set-url — Override the server URL (for development)
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  setApiKey,
  clearApiKey,
  getApiKey,
  getConfigPath,
  getServerUrl,
  setServerUrl,
} from "../config.js";

export function registerAuthCommands(program: Command): void {
  const auth = program
    .command("auth")
    .description("Manage API key authentication");

  auth
    .command("login")
    .description("Save your API key")
    .argument("[key]", "API key (mt_...)")
    .action(async (key?: string) => {
      let apiKey = key;

      if (!apiKey) {
        // Read from stdin if available
        if (!process.stdin.isTTY) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(chunk as Buffer);
          }
          apiKey = Buffer.concat(chunks).toString().trim();
        }
      }

      if (!apiKey) {
        console.log(chalk.yellow("Usage: mt auth login <your-api-key>"));
        console.log();
        console.log("Get your API key from: " + chalk.blue(getServerUrl() + "/account"));
        process.exit(1);
      }

      if (!apiKey.startsWith("mt_")) {
        console.log(chalk.red("Invalid API key format. Keys start with mt_"));
        process.exit(1);
      }

      setApiKey(apiKey);
      console.log(chalk.green("✓") + " API key saved");
      console.log(chalk.dim(`  Config: ${getConfigPath()}`));
    });

  auth
    .command("logout")
    .description("Remove stored API key")
    .action(() => {
      clearApiKey();
      console.log(chalk.green("✓") + " API key removed");
    });

  auth
    .command("status")
    .description("Show authentication status")
    .action(() => {
      const key = getApiKey();
      const url = getServerUrl();

      console.log();
      console.log(chalk.bold("ModelTriage CLI"));
      console.log();

      if (key) {
        console.log("  Auth:    " + chalk.green("authenticated"));
        console.log("  Key:     " + chalk.dim(key.substring(0, 11) + "..."));
      } else {
        console.log("  Auth:    " + chalk.yellow("not authenticated"));
      }

      console.log("  Server:  " + chalk.dim(url));
      console.log("  Config:  " + chalk.dim(getConfigPath()));
      console.log();
    });

  auth
    .command("set-url")
    .description("Override the server URL (for development)")
    .argument("<url>", "Server URL (e.g. http://localhost:3000)")
    .action((url: string) => {
      setServerUrl(url.replace(/\/+$/, "")); // trim trailing slashes
      console.log(chalk.green("✓") + " Server URL set to " + chalk.dim(url));
    });
}
