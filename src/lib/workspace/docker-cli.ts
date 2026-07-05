import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type DockerResult = {
  stdout: string;
  stderr: string;
};

export async function runDocker(args: string[]): Promise<DockerResult> {
  const result = await execFileAsync("docker", args, {
    windowsHide: true,
    timeout: 60_000,
    maxBuffer: 1024 * 1024,
  });

  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

export async function removeContainer(name: string) {
  try {
    await runDocker(["rm", "-f", name]);
  } catch {
    // Container already gone or Docker unavailable. Stop remains best-effort.
  }
}

export async function inspectContainerRunning(name: string) {
  try {
    const result = await runDocker(["inspect", "-f", "{{.State.Running}}", name]);
    return result.stdout === "true";
  } catch {
    return false;
  }
}

export async function readContainerFile(name: string, filePath: string, tailLines = 300) {
  try {
    const result = await runDocker(["exec", name, "sh", "-lc", `tail -n ${tailLines} ${JSON.stringify(filePath)} 2>/dev/null || true`]);
    return result.stdout;
  } catch {
    return "";
  }
}
