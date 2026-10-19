import { requestOrigin } from './auth-urls';
export function authOrigin(request: { url: string; headers: Headers }) {
  return requestOrigin(request.url, request.headers.get('x-forwarded-host'), {
    deployed: process.env.VERCEL === '1',
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    deploymentUrl: process.env.VERCEL_URL,
    productionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  });
}
