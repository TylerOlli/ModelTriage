#!/usr/bin/env node

/**
 * ModelTriage CLI
 *
 * Intelligent LLM routing from your terminal.
 *
 * Usage:
 *   mt auth login <api-key>     Save your API key
 *   mt ask "your prompt"        Send a prompt (auto-selects best model)
 *   mt ask "prompt" -f code.ts  Attach files for context
 *   mt compare "prompt" -m gpt-5,claude-sonnet-4-5
 *   mt usage                    Check today's request count
 *   mt models                   List available models
 */

import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPromptCommand } from "./commands/prompt.js";
import { registerCompareCommand } from "./commands/compare.js";
import { registerUsageCommand } from "./commands/usage.js";
import { registerModelsCommand } from "./commands/models.js";

const program = new Command();

program
  .name("mt")
  .description("ModelTriage CLI — intelligent LLM routing from your terminal")
  .version("0.1.0");

// Register all commands
registerAuthCommands(program);
registerPromptCommand(program);
registerCompareCommand(program);
registerUsageCommand(program);
registerModelsCommand(program);

program.parse();
