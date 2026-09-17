import { task } from '@trigger.dev/sdk';

export const exampleTask = task({
  id: 'example-task',
  run: async (payload: { message?: string } = {}) => {
    const message = payload.message ?? 'Hello from Trigger.dev in Vaeloom!';
    console.log(`[exampleTask] running: ${message}`);

    return {
      message,
      timestamp: new Date().toISOString(),
      status: 'success',
    };
  },
});
