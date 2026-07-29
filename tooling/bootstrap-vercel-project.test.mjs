import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  bootstrapVercelProject,
  configurePreviewProtection,
  readProjectLink,
} from './bootstrap-vercel-project.mjs';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    },
  };
}

async function withTempDirectory(run) {
  const directory = await mkdtemp(join(tmpdir(), 'web-three-city-vercel-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('readProjectLink returns validated project and owner identifiers', async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, '.vercel'), { recursive: true });
    await writeFile(
      join(directory, '.vercel', 'project.json'),
      JSON.stringify({ orgId: 'user_owner', projectId: 'prj_web_three_city' }),
    );

    assert.deepEqual(await readProjectLink(directory), {
      orgId: 'user_owner',
      projectId: 'prj_web_three_city',
    });
  });
});

test('readProjectLink rejects incomplete Vercel link state', async () => {
  await withTempDirectory(async (directory) => {
    await mkdir(join(directory, '.vercel'), { recursive: true });
    await writeFile(join(directory, '.vercel', 'project.json'), JSON.stringify({ projectId: '' }));

    await assert.rejects(readProjectLink(directory), /projectId and orgId/);
  });
});

test('configurePreviewProtection patches and verifies preview-only authentication', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (options.method === 'PATCH') {
      return jsonResponse({ id: 'prj_web_three_city' });
    }
    return jsonResponse({
      id: 'prj_web_three_city',
      name: 'web-three-city',
      ssoProtection: { deploymentType: 'preview' },
    });
  };

  const result = await configurePreviewProtection({
    fetchImpl,
    projectId: 'prj_web_three_city',
    token: 'secret-token',
  });

  assert.deepEqual(result, {
    name: 'web-three-city',
    projectId: 'prj_web_three_city',
    protection: 'preview',
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].url, 'https://api.vercel.com/v9/projects/prj_web_three_city');
  assert.equal(requests[0].options.method, 'PATCH');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    ssoProtection: { deploymentType: 'preview' },
  });
  assert.equal(requests[1].options.method, 'GET');
});

test('configurePreviewProtection fails closed when Vercel does not retain protection', async () => {
  const fetchImpl = async (_url, options = {}) =>
    jsonResponse(
      options.method === 'PATCH'
        ? { id: 'prj_web_three_city' }
        : { id: 'prj_web_three_city', name: 'web-three-city', ssoProtection: null },
    );

  await assert.rejects(
    configurePreviewProtection({
      fetchImpl,
      projectId: 'prj_web_three_city',
      token: 'secret-token',
    }),
    /Preview protection verification failed/,
  );
});

test('bootstrapVercelProject links idempotently and returns no token material', async () => {
  await withTempDirectory(async (directory) => {
    const commandCalls = [];
    const execFileImpl = async (command, args, options) => {
      commandCalls.push({ command, args, options });
      await mkdir(join(directory, '.vercel'), { recursive: true });
      await writeFile(
        join(directory, '.vercel', 'project.json'),
        JSON.stringify({ orgId: 'user_owner', projectId: 'prj_web_three_city' }),
      );
      return { stderr: '', stdout: '' };
    };
    const fetchImpl = async (_url, options = {}) =>
      jsonResponse(
        options.method === 'PATCH'
          ? { id: 'prj_web_three_city' }
          : {
              id: 'prj_web_three_city',
              name: 'web-three-city',
              ssoProtection: { deploymentType: 'preview' },
            },
      );

    const result = await bootstrapVercelProject({
      cwd: directory,
      execFileImpl,
      fetchImpl,
      projectName: 'web-three-city',
      token: 'secret-token',
    });

    assert.deepEqual(result, {
      name: 'web-three-city',
      orgId: 'user_owner',
      projectId: 'prj_web_three_city',
      protection: 'preview',
    });
    assert.equal(JSON.stringify(result).includes('secret-token'), false);
    assert.equal(commandCalls.length, 1);
    assert.equal(commandCalls[0].command, 'pnpm');
    assert.deepEqual(commandCalls[0].args, [
      'dlx',
      'vercel@58.0.0',
      'link',
      '--yes',
      '--project=web-three-city',
      '--token=secret-token',
    ]);
    assert.equal(commandCalls[0].options.cwd, directory);
    assert.equal(commandCalls[0].options.env.VERCEL_TELEMETRY_DISABLED, '1');
  });
});
