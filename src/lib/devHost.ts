/** The live site. Anywhere else (localhost, a LAN address, a test tunnel) is a development copy. */
const PRODUCTION_HOST = 'irticalen.yasinozmeen.me';

/**
 * True on a development copy of the site — shows helpers that only make sense while building it
 * (e.g. ending a speech early instead of waiting out the full minute). Never true on the live site.
 */
export function isDevHost(hostname: string = typeof location === 'undefined' ? PRODUCTION_HOST : location.hostname): boolean {
  return hostname !== PRODUCTION_HOST;
}
