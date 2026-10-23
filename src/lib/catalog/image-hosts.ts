// Supplier photo servers whose images the app resizes and caches (through
// next/image) for thumbnails and catalog cards. Kept to known hosts so the
// resizer can't be used to fetch arbitrary URLs. Links to anywhere else are
// shown as they are.
export const IMAGE_HOSTS = ["cdnm.sanmar.com", "www.ssactivewear.com", "cdn.ssactivewear.com"];

export function canResize(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
