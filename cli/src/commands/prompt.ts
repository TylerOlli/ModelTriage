/**
 * Prompt Command
 *
 * mt ask "your prompt here"
 *
 * Sends a prompt to ModelTriage with streaming output.
 * Supports file attachments, model overrides, and output control.
 */

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import * as fs from "fs";
import * as path from "path";
import { streamPrompt, parseRateLimitHeaders, ApiError } from "../api.js";
import { getApiKey } from "../config.js";

export function registerPromptCommand(program: Command): void {
  program
    .command("ask")
    .description("Send a prompt to ModelTriage")
    .argument("<prompt>", "The prompt to send")
    .option("-m, --model <model>", "Override model selection (can be repeated)", collect, [])
    .option("-f, --file <path>", "Attach a file (can be repeated)", collect, [])
    .option("-t, --temperature <n>", "Temperature (0-2)", parseFloat)
    .option("--max-tokens <n>", "Maximum response tokens", parseInt)
    .option("--json", "Output raw JSON instead of formatted text")
    .option("--no-color", "Disable colored output")
    .action(async (prompt: string, opts: {
      model: string[];
      file: string[];
      temperature?: number;
      maxTokens?: number;
      json?: boolean;
      color?: boolean;
    }) => {
      // Verify auth
      if (!getApiKey()) {
        console.log(chalk.red("Not authenticated.") + " Run " + chalk.bold("mt auth login") + " first.");
        process.exit(1);
      }

      // Read files if provided
      const files: Array<{ name: string; content: string; type: string }> = [];
      for (const filePath of opts.file) {
        try {
          const absPath = path.resolve(filePath);
          const content = fs.readFileSync(absPath, "utf-8");
          const ext = path.extname(filePath).toLowerCase();
          files.push({
            name: path.basename(filePath),
            content,
            type: getMimeType(ext),
          });
        } catch (err) {
          console.log(chalk.red(`Cannot read file: ${filePath}`));
          console.log(chalk.dim((err as Error).message));
          process.exit(1);
        }
      }

      // Handle stdin pipe (e.g. cat file.txt | mt ask "explain this")
      let stdinContent = "";
      if (!process.stdin.isTTY) {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk as Buffer);
        }
        stdinContent = Buffer.concat(chunks).toString();
        if (stdinContent.trim()) {
          files.push({
            name: "stdin",
            content: stdinContent,
            type: "text/plain",
          });
        }
      }

      const spinner = ora({
        text: "Routing prompt...",
        color: "blue",
      }).start();

      try {
        const response = await streamPrompt({
          prompt,
          models: opts.model.length > 0 ? opts.model : undefined,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          files: files.length > 0 ? files : undefined,
        });

        spinner.stop();

        if (opts.json) {
          // Collect full response and output as JSON
          await outputJson(response);
        } else {
          // Stream to terminal
          await streamToTerminal(response);
        }

        // Show rate limit info
        const rateLimit = parseRateLimitHeaders(response);
        if (rateLimit) {
          console.log();
          console.log(
            chalk.dim(`${rateLimit.remaining}/${rateLimit.limit} requests remaining today`)
          );
        }
      } catch (err) {
        spinner.stop();
        handleError(err);
      }
    });

  // Also support `mt "prompt"` as shorthand
  program
    .argument("[prompt]", "Shorthand for `mt ask <prompt>`")
    .action(async (prompt: string | undefined) => {
      if (!prompt) return; // Let commander show help
      // Re-dispatch to the ask command
      await program.parseAsync(["", "", "ask", prompt]);
    });
}

/**
 * Stream SSE response to terminal with formatting.
 */
async function streamToTerminal(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    console.log(chalk.red("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let currentModel = "";
  let buffer = "";
  let headerShown = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.substring(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          if (event.type === "routing") {
            const mode = event.mode || "auto";
            const model = event.selectedModel || event.models?.[0] || "unknown";
            currentModel = model;
            if (!headerShown) {
              console.log(
                chalk.blue("▸") +
                  " " +
                  chalk.bold(model) +
                  chalk.dim(` (${mode})`)
              );
              console.log();
              headerShown = true;
            }
          } else if (event.type === "token") {
            process.stdout.write(event.text || "");
          } else if (event.type === "done") {
            console.log();
            if (event.latencyMs) {
              console.log(
                chalk.dim(`\n${currentModel} · ${event.latencyMs}ms`)
              );
            }
          } else if (event.type === "error") {
            console.log(chalk.red(`\nError: ${event.error || event.message}`));
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }
}

/**
 * Collect full streamed response and output as JSON.
 */
async function outputJson(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";
  const tokens: string[] = [];
  let routing: Record<string, unknown> = {};
  let model = "";
  let latencyMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.substring(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);
          if (event.type === "routing") {
            routing = event;
            model = event.selectedModel || event.models?.[0] || "";
          } else if (event.type === "token") {
            tokens.push(event.text || "");
          } else if (event.type === "done") {
            latencyMs = event.latencyMs || 0;
          }
        } catch {
          // Ignore malformed SSE lines
        }
      }
    }
  }

  const output = {
    model,
    text: tokens.join(""),
    latencyMs,
    routing,
  };

  console.log(JSON.stringify(output, null, 2));
}

function handleError(err: unknown): void {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      console.log(chalk.red("Authentication failed.") + " Run " + chalk.bold("mt auth login") + " to update your key.");
    } else if (err.status === 429) {
      console.log(chalk.yellow("Rate limit exceeded.") + " You've reached your daily request limit.");
      if (err.body?.remaining !== undefined) {
        console.log(chalk.dim(`  ${err.body.remaining}/${err.body.limit} remaining`));
      }
    } else {
      console.log(chalk.red(`Error (${err.status}): ${err.message}`));
    }
  } else if (err instanceof Error) {
    if (err.message.includes("fetch failed") || err.message.includes("ECONNREFUSED")) {
      console.log(chalk.red("Cannot connect to ModelTriage server."));
      console.log(chalk.dim("Check your connection or run `mt auth set-url` to update the server URL."));
    } else {
      console.log(chalk.red("Error: " + err.message));
    }
  } else {
    console.log(chalk.red("An unexpected error occurred."));
  }
  process.exit(1);
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".py": "text/x-python",
    ".json": "application/json",
    ".html": "text/html",
    ".css": "text/css",
    ".csv": "text/csv",
    ".xml": "application/xml",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".sh": "text/x-shellscript",
    ".sql": "text/x-sql",
    ".rs": "text/x-rust",
    ".go": "text/x-go",
    ".java": "text/x-java",
    ".rb": "text/x-ruby",
    ".c": "text/x-c",
    ".cpp": "text/x-c++",
    ".h": "text/x-c",
    ".swift": "text/x-swift",
    ".kt": "text/x-kotlin",
  };
  return mimeTypes[ext] || "text/plain";
}

function collect(val: string, memo: string[]): string[] {
  memo.push(val);
  return memo;
}
