/** Canonical deployed origin; localhost is only used when the actual request is local. */
export const PRODUCTION_ORIGIN = 'https://humorprojecthw1.vercel.app';

function publicHttpsOrigin(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    if (url.protocol !== 'https:' || url.username || url.password || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function oauthCallbackUrl(browserOrigin: string) {
  const url = new URL(browserOrigin);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password) throw new Error('Invalid sign-in origin.');
  // PKCE stores a verifier on this host. Do not send preview/local users to another host.
  return `${url.origin}/auth/callback`;
}

export function requestOrigin(requestUrl: string, forwardedHost: string | null, environment: {
  deployed?: boolean; siteUrl?: string; deploymentUrl?: string; productionUrl?: string;
} = {}) {
  const actual = new URL(requestUrl);
  if (!environment.deployed) return actual.origin;
  const canonical = publicHttpsOrigin(environment.siteUrl) || PRODUCTION_ORIGIN;
  const trusted = [canonical, PRODUCTION_ORIGIN, publicHttpsOrigin(environment.deploymentUrl), publicHttpsOrigin(environment.productionUrl)].filter(Boolean);
  const forwarded = forwardedHost && !/[\s,/@\\]/.test(forwardedHost) ? publicHttpsOrigin(`https://${forwardedHost}`) : null;
  if (forwarded && trusted.includes(forwarded)) return forwarded;
  // Prefer the real request host to preserve PKCE cookies on legitimate preview deployments.
  return publicHttpsOrigin(actual.origin) || canonical;
}
