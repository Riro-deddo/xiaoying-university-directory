export const PUBLIC_SITE_ROOT = new URL('https://riro-deddo.github.io/xiaoying-university-directory/');

export const PUBLIC_ROUTES = ['', 'methodology/'] as const;

export function publicUrl(path = ''): string {
  return new URL(path.replace(/^\/+/, ''), PUBLIC_SITE_ROOT).href;
}
