import { dark } from '@clerk/ui/themes';

/**
 * Shared Clerk appearance configuration matched to Tiny Vercel's dark zinc UI.
 */
export const clerkAppearance = {
  theme: dark,
  variables: {
    colorPrimary: '#ffffff',
    colorPrimaryForeground: '#09090b',
    colorBackground: '#121214',
    colorForeground: '#fafafa',
    colorNeutral: '#ffffff',
    colorInput: '#09090b',
    colorInputForeground: '#fafafa',
    borderRadius: '0.625rem',
    fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  elements: {
    card: 'border border-zinc-800/90 shadow-2xl bg-[#121214]',
    headerTitle: 'text-white tracking-tight',
    headerSubtitle: 'text-zinc-400',
    socialButtonsBlockButton:
      'border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-100',
    formFieldInput:
      'bg-[#09090b] border border-zinc-800 text-zinc-100 focus:border-zinc-500',
    formButtonPrimary: 'bg-white text-black hover:bg-zinc-200 font-semibold',
    footerActionLink:
      'text-zinc-200 hover:text-white underline underline-offset-4',
  },
};

/**
 * Normalizes internal post-auth redirect paths to prevent open redirects.
 */
export function resolveRedirectPath(location, fallback = '/') {
  const candidate =
    new URLSearchParams(location?.search || '').get('redirect_url') ||
    location?.state?.redirectTo ||
    (location?.pathname && !location.pathname.startsWith('/sign-')
      ? `${location.pathname}${location.search || ''}`
      : '');

  if (typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//')) {
    return candidate;
  }
  return fallback;
}
