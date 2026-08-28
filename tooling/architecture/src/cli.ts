import path from "node:path";
import { checkArchitecture } from "./index";
import { exitCodeForReport, formatReport } from "./cli-format";

interface CliOptions {
  readonly root: string;
  readonly json: boolean;
}

function parseArgs(args: readonly string[]): CliOptions {
  let root = process.cwd();
  let json = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--json") {
      json = true;
      continue;
    }
    if (argument === "--root") {
      const value = args[index + 1];
      if (!value) throw new Error("--root requires a path argument.");
      root = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown architecture-check argument: ${argument}`);
  }

  return { root, json };
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await checkArchitecture(options.root);
  const output = options.json
    ? JSON.stringify(report, null, 2)
    : formatReport(report);
  process.stdout.write(`${output}\n`);
  process.exitCode = exitCodeForReport(report);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Architecture checker failed to execute: ${message}\n`);
  process.exitCode = 2;
});
