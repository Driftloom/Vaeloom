import { NextResponse } from 'next/server';

/**
 * Frontend liveness probe.
 *
 * Responds with 200 OK to indicate that the Next.js App Router server process
 * is responsive. Does not egress to backend or public internet, ensuring that
 * backend outages do not erroneously trigger frontend pod restarts.
 */
export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      service: 'vaeloom-web',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
