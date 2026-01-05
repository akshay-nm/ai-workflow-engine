const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';

async function request(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== AI Workflow Engine Test ===\n');

  // 1. Create workflow
  console.log('1. Creating workflow...');
  const workflow = await request('POST', '/workflows', {
    name: 'Test HTTP Workflow',
    description: 'Fetches a post from JSONPlaceholder API',
  });
  console.log(`   Created workflow: ${workflow.id}`);

  // 2. Activate workflow
  console.log('2. Activating workflow...');
  await request('PUT', `/workflows/${workflow.id}`, { status: 'ACTIVE' });
  console.log('   Workflow activated');

  // 3. Add HTTP fetch step
  console.log('3. Adding HTTP fetch step...');
  const step = await request('POST', `/workflows/${workflow.id}/steps`, {
    name: 'fetch-post',
    type: 'HTTP',
    toolName: 'http-fetch',
    config: {},
    order: 1,
    inputMapping: {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
    },
  });
  console.log(`   Created step: ${step.id}`);

  // 4. Trigger workflow run
  console.log('4. Triggering workflow run...');
  const run = await request('POST', `/workflows/${workflow.id}/runs`, {});
  console.log(`   Created run: ${run.id}`);

  // 5. Poll for completion
  console.log('5. Waiting for completion...');
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const status = await request('GET', `/runs/${run.id}`);
    console.log(`   Status: ${status.status}`);

    if (status.status === 'COMPLETED') {
      console.log('\n=== Workflow completed successfully! ===\n');
      console.log('Run details:');
      console.log(JSON.stringify(status, null, 2));
      process.exit(0);
    } else if (status.status === 'FAILED') {
      console.log('\n=== Workflow failed ===');
      console.log(JSON.stringify(status, null, 2));
      process.exit(1);
    }
  }

  console.log('Timeout waiting for workflow to complete');
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
