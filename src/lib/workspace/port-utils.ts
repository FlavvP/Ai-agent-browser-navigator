import net from "node:net";
import { runDocker } from "@/lib/workspace/docker-cli";

export async function isPortFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findFreePort(start: number, end: number) {
  const dockerPorts = await getDockerPublishedPorts();
  for (let port = start; port <= end; port += 1) {
    if (dockerPorts.has(port)) continue;
    if (await isPortFree(port)) return port;
  }

  throw new Error(`No free workspace port in range ${start}-${end}`);
}

async function getDockerPublishedPorts() {
  const ports = new Set<number>();
  try {
    const result = await runDocker(["ps", "--format", "{{.Ports}}"]);
    for (const line of result.stdout.split(/\r?\n/)) {
      for (const match of line.matchAll(/(?:0\.0\.0\.0|\[::\]|::):(\d+)->/g)) {
        ports.add(Number(match[1]));
      }
    }
  } catch {
    // Docker may be unavailable during tests/build; the net check remains the fallback.
  }
  return ports;
}
