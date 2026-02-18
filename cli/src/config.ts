/**
 * CLI Configuration Store
 *
 * Persists API key and server URL using `conf` (XDG-compliant).
 * Config is stored at ~/.config/modeltriage-cli/config.json
 */

import Conf from "conf";

interface CliConfig {
  apiKey?: string;
  serverUrl: string;
}

const config = new Conf<CliConfig>({
  projectName: "modeltriage-cli",
  defaults: {
    serverUrl: "https://modeltriage.com",
  },
});

export function getApiKey(): string | undefined {
  return config.get("apiKey");
}

export function setApiKey(key: string): void {
  config.set("apiKey", key);
}

export function clearApiKey(): void {
  config.delete("apiKey");
}

export function getServerUrl(): string {
  return config.get("serverUrl");
}

export function setServerUrl(url: string): void {
  config.set("serverUrl", url);
}

export function getConfigPath(): string {
  return config.path;
}
