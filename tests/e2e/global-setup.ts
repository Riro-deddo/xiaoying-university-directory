import { preview } from 'astro';
import { cwd, env } from 'node:process';

export default async function globalSetup() {
  env.ASTRO_TELEMETRY_DISABLED = '1';
  const server = await preview({
    root: cwd(),
    server: {
      host: '127.0.0.1',
      port: 4321,
    },
  });

  return async () => {
    await server.stop();
  };
}
