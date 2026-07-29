#!/usr/bin/env node

import { execFile as execFileCallback } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCallback);
const VERCEL_API_BASE = 'https://api.vercel.com';
const VERCEL_CLI_VERSION = '58.0.0';

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

async function parseJsonResponse(response, operation) {
  const text = await response.text();
  let body = {};
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${operation} returned invalid JSON with status ${response.status}.`);
    }
  }

  if (!response.ok) {
    const message = body?.error?.message ?? body?.message ?? 'Unknown Vercel API error.';
    throw new Error(`${operation} failed with status ${response.status}: ${message}`);
  }

  return body;
}

export async function readProjectLink(cwd, readFileImpl = readFile) {
  const projectJsonPath = join(cwd, '.vercel', 'project.json');
  let parsed;
  try {
    parsed = JSON.parse(await readFileImpl(projectJsonPath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read Vercel project link at ${projectJsonPath}.`, { cause: error });
  }

  const projectId = parsed?.projectId;
  const orgId = parsed?.orgId;
  if (
    typeof projectId !== 'string' ||
    projectId.length === 0 ||
    typeof orgId !== 'string' ||
    orgId.length === 0
  ) {
    throw new Error('Vercel project link must contain non-empty projectId and orgId values.');
  }

  return { orgId, projectId };
}

export async function configurePreviewProtection({
  fetchImpl = globalThis.fetch,
  projectId,
  token,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }
  const validatedProjectId = requireNonEmptyString(projectId, 'projectId');
  const validatedToken = requireNonEmptyString(token, 'token');
  const endpoint = `${VERCEL_API_BASE}/v9/projects/${encodeURIComponent(validatedProjectId)}`;
  const headers = {
    Authorization: `Bearer ${validatedToken}`,
    'Content-Type': 'application/json',
  };

  await parseJsonResponse(
    await fetchImpl(endpoint, {
      body: JSON.stringify({ ssoProtection: { deploymentType: 'preview' } }),
      headers,
      method: 'PATCH',
    }),
    'Configure Vercel Preview protection',
  );

  const project = await parseJsonResponse(
    await fetchImpl(endpoint, { headers, method: 'GET' }),
    'Verify Vercel Preview protection',
  );

  if (project?.ssoProtection?.deploymentType !== 'preview') {
    throw new Error('Preview protection verification failed: expected deploymentType "preview".');
  }

  return {
    name: requireNonEmptyString(project.name, 'project.name'),
    projectId: validatedProjectId,
    protection: 'preview',
  };
}

export async function bootstrapVercelProject({
  cwd = process.cwd(),
  execFileImpl = execFileAsync,
  fetchImpl = globalThis.fetch,
  projectName = 'web-three-city',
  token,
}) {
  const validatedProjectName = requireNonEmptyString(projectName, 'projectName');
  const validatedToken = requireNonEmptyString(token, 'token');

  await execFileImpl(
    'pnpm',
    [
      'dlx',
      `vercel@${VERCEL_CLI_VERSION}`,
      'link',
      '--yes',
      `--project=${validatedProjectName}`,
      `--token=${validatedToken}`,
    ],
    {
      cwd,
      env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' },
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  const link = await readProjectLink(cwd);
  const protection = await configurePreviewProtection({
    fetchImpl,
    projectId: link.projectId,
    token: validatedToken,
  });

  return { ...protection, orgId: link.orgId };
}

function parseArguments(argv) {
  const result = { projectName: 'web-three-city' };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--project') {
      result.projectName = argv[index + 1];
      index += 1;
    } else if (argument.startsWith('--project=')) {
      result.projectName = argument.slice('--project='.length);
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  return result;
}

async function main() {
  const { projectName } = parseArguments(process.argv.slice(2));
  const token = process.env.VERCEL_TOKEN;
  const result = await bootstrapVercelProject({ projectName, token });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
