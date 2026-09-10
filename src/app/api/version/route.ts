import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

export const dynamic = 'force-dynamic';

/** Safe diagnostic endpoint — version/commit/environment only, never secrets or infra details. */
export function GET() {
  return NextResponse.json(
    {
      version: process.env.APP_VERSION ?? packageJson.version,
      commit: process.env.GIT_COMMIT ?? 'unknown',
      tag: process.env.GIT_TAG ?? 'unknown',
      environment: process.env.APP_ENV ?? 'local',
      buildTime: process.env.BUILD_TIME ?? 'unknown',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
