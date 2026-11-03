import type { IconKey, SocialKey } from "@/lib/store/homepage";

/** Line icons for service cards, drawn on a 24 px grid in the current color. */
const SERVICE_PATHS: Record<IconKey, React.ReactNode> = {
  shirt: <path d="M8 3 4 5.5 2 10l3 1.5V21h14v-9.5l3-1.5-2-4.5L16 3c-.5 1.7-2 3-4 3s-3.5-1.3-4-3Z" />,
  print: (
    <>
      <path d="M6 9V3h12v6" />
      <rect x="3" y="9" width="18" height="8" rx="2" />
      <path d="M7 14h10v7H7z" />
    </>
  ),
  needle: (
    <>
      <path d="m4 20 14-14" />
      <path d="M18 6a2 2 0 1 0-2-2" />
      <path d="M8 16c-3-1-5 1-4 3s4 1 3-2" />
      <path d="M13 11c2 2 5 2 7 0" />
    </>
  ),
  press: (
    <>
      <path d="M4 7h16v4H4z" />
      <path d="M12 3v4M7 11v3M17 11v3" />
      <path d="M3 17h18v4H3z" />
    </>
  ),
  store: (
    <>
      <path d="M3 9 5 4h14l2 5" />
      <path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3" />
      <path d="M5 12v9h14v-9M10 21v-5h4v5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4c2.5 0 4.6-2 4.6-4.6C22 6.4 17.5 3 12 3Z" />
      <circle cx="7.5" cy="11" r="1" />
      <circle cx="10" cy="7" r="1" />
      <circle cx="15" cy="7" r="1" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M8 21h8M9 17h6v4H9z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13" />
      <path d="M12 8C10 4 7 4 7 6s3 2 5 2c2 0 5 0 5-2s-3-2-5 2" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h12v10H2zM14 10h4l4 4v2h-8" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z" />,
  hoodie: (
    <>
      <path d="M9 3c-3 1-5 3-6 6l-1 5 3 1v6h14v-6l3-1-1-5c-1-3-3-5-6-6" />
      <path d="M9 3c0 3 1.5 5 3 5s3-2 3-5" />
      <path d="M9 21v-5h6v5M10 8l-.5 4M14 8l.5 4" />
    </>
  ),
  hat: (
    <>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M2 15h14c3 0 5 1 6 3H4c-1.1 0-2-.9-2-2v-1Z" />
      <path d="M12 7V5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </>
  ),
  sticker: (
    <>
      <path d="M20 12a8 8 0 1 1-8-8h3l5 5v3Z" />
      <path d="M15 4v3a2 2 0 0 0 2 2h3" />
      <path d="M9 14c1 1.3 2 2 3 2s2-.7 3-2" />
    </>
  ),
  spark: (
    <>
      <path d="M12 2v5M12 17v5M2 12h5M17 12h5" />
      <path d="m5 5 3 3M16 16l3 3M19 5l-3 3M8 16l-3 3" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  ruler: (
    <>
      <path d="m3 16 13-13 5 5L8 21l-5-5Z" />
      <path d="m7 12 2 2M10 9l2 2M13 6l2 2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 9 4.5v9L12 21l-9-4.5v-9L12 3Z" />
      <path d="m3 7.5 9 4.5 9-4.5M12 12v9" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.5 2.5 2.5L16 9.5" />
    </>
  ),
  chat: <path d="M4 5h16v11H9l-5 4V5Z M8 9.5h8M8 12.5h5" />,
  team: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2a5 5 0 0 1 5 5.8" />
    </>
  ),
  school: (
    <>
      <path d="m2 9 10-5 10 5-10 5L2 9Z" />
      <path d="M6 11v5c2 2 10 2 12 0v-5M22 9v6" />
    </>
  ),
  tag: (
    <>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="8.5" r="1.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19C5 10 10 5 20 4c0 10-5 15-14 15" />
      <path d="M5 19c3-4 6-7 10-9" />
    </>
  ),
  heart: <path d="M12 20s-8-4.6-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.4 12 20 12 20Z" />,
};

export function ServiceIcon({ icon, className = "h-6 w-6" }: { icon: IconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {SERVICE_PATHS[icon] ?? SERVICE_PATHS.star}
    </svg>
  );
}

/** Simple marks for social networks, filled in the current color. */
const SOCIAL_PATHS: Record<SocialKey, React.ReactNode> = {
  instagram: (
    <>
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3c1.2-.1 1.6-.1 4.8-.1ZM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.2-4.4-2.6-6.8-7-7C15.7 0 15.3 0 12 0Z" />
      <path d="M12 5.8a6.2 6.2 0 1 0 0 12.4 6.2 6.2 0 0 0 0-12.4ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
      <circle cx="18.4" cy="5.6" r="1.4" />
    </>
  ),
  facebook: <path d="M24 12a12 12 0 1 0-13.9 11.9v-8.4h-3V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12Z" />,
  tiktok: <path d="M17.6 0h-4v16.4a3.4 3.4 0 1 1-3.4-3.4c.3 0 .7 0 1 .1V9a7.5 7.5 0 1 0 6.4 7.4V8.1a9.5 9.5 0 0 0 5.4 1.7V5.8A5.5 5.5 0 0 1 17.6 0Z" />,
  x: <path d="M18.2 2h3.4l-7.4 8.5L23 22h-6.8l-5.3-7-6.1 7H1.4l7.9-9L1 2h7l4.8 6.4L18.2 2Zm-1.2 18h1.9L7.1 3.9H5.1L17 20Z" />,
  youtube: <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />,
  linkedin: <path d="M20.4 20.5h-3.6v-5.6c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9v5.7H9.4V9h3.4v1.6c.5-.9 1.6-1.8 3.4-1.8 3.6 0 4.3 2.4 4.3 5.5v6.2ZM5.3 7.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm1.8 13.1H3.6V9h3.5v11.5ZM22.2 0H1.8C.8 0 0 .8 0 1.7v20.6c0 .9.8 1.7 1.8 1.7h20.4c1 0 1.8-.8 1.8-1.7V1.7C24 .8 23.2 0 22.2 0Z" />,
  pinterest: <path d="M12 0a12 12 0 0 0-4.4 23.2c-.1-.9-.2-2.4 0-3.4l1.4-6s-.4-.7-.4-1.8c0-1.7 1-2.9 2.2-2.9 1 0 1.5.8 1.5 1.7 0 1-.7 2.6-1 4-.3 1.2.6 2.2 1.8 2.2 2.1 0 3.8-2.2 3.8-5.5 0-2.9-2.1-4.9-5-4.9-3.4 0-5.4 2.6-5.4 5.2 0 1 .4 2.1.9 2.7.1.1.1.2.1.4l-.3 1.4c-.1.2-.2.3-.4.2-1.5-.7-2.4-2.9-2.4-4.6 0-3.8 2.7-7.2 7.9-7.2 4.1 0 7.3 2.9 7.3 6.9 0 4.1-2.6 7.4-6.2 7.4-1.2 0-2.4-.6-2.7-1.4l-.8 2.8c-.3 1.1-1 2.4-1.5 3.2A12 12 0 1 0 12 0Z" />,
  google: <path d="M12.2 10.3v3.6h5.1c-.2 1.3-1.6 3.8-5.1 3.8a5.7 5.7 0 0 1 0-11.4c1.8 0 3 .8 3.6 1.4l2.5-2.4A9 9 0 0 0 12.2 3a9 9 0 1 0 0 18c5.2 0 8.6-3.6 8.6-8.8 0-.6 0-1-.1-1.5h-8.5Z" />,
};

export function SocialIcon({ network, className = "h-5 w-5" }: { network: SocialKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {SOCIAL_PATHS[network]}
    </svg>
  );
}
