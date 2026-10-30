import { ActionButton } from "@/components/admin/action-button";
import { ActionForm } from "@/components/admin/action-form";
import { FilePicker } from "@/components/file-picker";
import { loadAdminStore } from "@/lib/store/admin";
import { BannerArt } from "@/components/store/banner-art";
import { ARTS, artsFor, DEFAULT_ART } from "@/lib/store/banner-art";
import { THEMES, type ThemeKey, themeOf, themeStyle } from "@/lib/store/themes";
import { removeHeroAction, removeLogoAction, saveLookAction, uploadHeroAction, uploadLogoAction } from "../../actions";

const ALL_FONTS = `https://fonts.googleapis.com/css2?${[...new Set(Object.values(THEMES).flatMap((t) => t.fonts))].map((f) => `family=${f}`).join("&")}&display=swap`;

/** The store's theme, colors, homepage banner and logo, with a live preview. */
export default async function LookPage({ params }: { params: Promise<{ id: string }> }) {
  const { store, url } = await loadAdminStore((await params).id);
  const current = themeOf(store.theme);
  return (
    <div className="space-y-6">
      <link rel="stylesheet" href={ALL_FONTS} precedence="default" />
      <ActionForm action={saveLookAction} className="space-y-6">
        <input type="hidden" name="storeId" value={store.id} />
        <section className="card space-y-3">
          <h2 className="font-semibold">Theme</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" data-testid="theme-picker">
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
              <label key={key} className="block cursor-pointer rounded-lg border-2 border-transparent p-1 has-[:checked]:border-brand-500">
                <input type="radio" name="theme" value={key} defaultChecked={key === current} className="sr-only" />
                <ThemePreview theme={key} accent={key === current ? store.accentColor : null} name={store.name} />
                <div className="mt-2 px-1">
                  <div className="text-sm font-semibold">{THEMES[key].label}</div>
                  <p className="text-xs text-gray-600">{THEMES[key].description}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        <section className="card grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <h2 className="font-semibold">Accent color</h2>
            <p className="text-sm text-gray-600">Buttons, links, the cart and (in the team theme) the header and banner. Use the team&apos;s or brand&apos;s main color.</p>
            <div className="flex items-center gap-3">
              <input type="color" name="accentColor" defaultValue={store.accentColor ?? THEMES[current].accent} className="h-10 w-16 cursor-pointer rounded border border-gray-300" aria-label="Accent color" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="themeAccent" defaultChecked={!store.accentColor} /> Use the theme&apos;s own color</label>
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold">Homepage banner</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="showHero" defaultChecked={store.showHero} /> Show a banner at the top of the homepage</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="heroHeadline">Headline</label>
                <input className="input" id="heroHeadline" name="heroHeadline" defaultValue={store.heroHeadline ?? ""} placeholder={store.name} maxLength={120} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="heroText">Text</label>
                <input className="input" id="heroText" name="heroText" defaultValue={store.heroText ?? ""} placeholder={store.tagline ?? "Official gear, printed locally. Orders close Friday."} maxLength={300} />
              </div>
              <div>
                <label className="label" htmlFor="heroButton">Button</label>
                <input className="input" id="heroButton" name="heroButton" defaultValue={store.heroButton ?? ""} placeholder="Shop now" maxLength={40} />
              </div>
            </div>
            <p className="text-xs text-gray-500">Left blank, the headline is the store name and the text its tagline (Settings).</p>
          </div>
        </section>

        <section className="card space-y-3">
          <div>
            <h2 className="font-semibold">Banner art</h2>
            <p className="text-sm text-gray-600">
              Drawn in this store&apos;s colors, so it suits any team or brand. {store.heroImageFileId ? "A banner photo is uploaded, so it's shown instead; remove it to use art." : "Upload a banner photo below to use that instead."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6" style={themeStyle(store.theme, store.accentColor)} data-testid="art-picker">
            {[null, ...artsFor(store.theme), "none" as const].map((key) => {
              const shown = key === null ? DEFAULT_ART[current] : key === "none" ? null : key;
              return (
                <label key={key ?? "theme"} className="block cursor-pointer rounded-lg border-2 border-transparent p-1 has-[:checked]:border-brand-500">
                  <input type="radio" name="heroArt" value={key ?? ""} defaultChecked={(store.heroArt ?? null) === key} className="sr-only" />
                  <div className="relative aspect-[5/2] overflow-hidden rounded border border-gray-200" style={{ background: "var(--st-subtle)" }}>
                    {shown ? <BannerArt art={shown} uid={`pick-${key ?? "theme"}`} /> : <span className="absolute inset-0 grid place-items-center text-xs text-gray-500">Plain</span>}
                  </div>
                  <div className="mt-1 px-1 text-xs font-medium">
                    {key === null ? <>Theme&apos;s pick <span className="font-normal text-gray-500">({ARTS[DEFAULT_ART[current]].label})</span></> : key === "none" ? "None" : ARTS[key].label}
                  </div>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-gray-500">&ldquo;Theme&apos;s pick&rdquo; follows the theme if you change it. Thumbnails use the saved theme and accent; save to see a new one.</p>
        </section>
      </ActionForm>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-semibold">Banner image</h2>
          <p className="text-sm text-gray-600">A wide photo (team photo, storefront, the field). It replaces the banner art.</p>
          {store.heroImageFileId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/admin/files/${store.heroImageFileId}`} alt="Banner" className="max-h-40 rounded border" />
          )}
          <ActionForm action={uploadHeroAction} submitLabel="Upload" resetOnSuccess className="max-w-md space-y-2">
            <input type="hidden" name="storeId" value={store.id} />
            <FilePicker id="hero-file" name="hero" accept="image/png,image/jpeg,image/gif,image/webp" required hint="At least 1600 px wide looks best" />
          </ActionForm>
          {store.heroImageFileId && <ActionButton action={removeHeroAction} fields={{ storeId: store.id }} label="Remove banner image" className="text-xs text-red-700 hover:underline" />}
        </section>
        <section className="card space-y-3">
          <h2 className="font-semibold">Logo</h2>
          {store.logoFileId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/admin/files/${store.logoFileId}`} alt="Logo" className="h-14 w-auto rounded border" />
          ) : (
            <p className="text-sm text-gray-500">No logo; the store name is shown in the theme&apos;s heading font instead.</p>
          )}
          <ActionForm action={uploadLogoAction} submitLabel="Upload" resetOnSuccess className="max-w-md space-y-2">
            <input type="hidden" name="storeId" value={store.id} />
            <FilePicker id="logo-file" name="logo" accept="image/png,image/jpeg,image/gif,image/webp" required hint="PNG with a transparent background works on every theme" />
          </ActionForm>
          {store.logoFileId && <ActionButton action={removeLogoAction} fields={{ storeId: store.id }} label="Remove logo" className="text-xs text-red-700 hover:underline" />}
        </section>
      </div>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Preview</h2>
          <a href={url} target="_blank" className="text-sm text-brand-700 hover:underline">Open the store ↗</a>
        </div>
        <iframe src={url} title="Store preview" className="h-[640px] w-full rounded border border-gray-200" data-testid="look-preview" />
      </section>
    </div>
  );
}

/** A small picture of a theme: its colors, fonts, header, button and product tiles. */
function ThemePreview({ theme, accent, name }: { theme: ThemeKey; accent: string | null; name: string }) {
  const t = THEMES[theme];
  const vars = themeStyle(theme, accent);
  const tile = { background: vars["--st-subtle"], borderRadius: vars["--st-radius"] };
  const art = DEFAULT_ART[theme];
  const onAccent = ARTS[art].tone === "accent";
  const center = t.hero === "glow" || t.hero === "cover";
  // Minimal and rustic put the art beside the text.
  const panel = t.hero === "split" || t.hero === "framed";
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 text-left" style={{ ...vars, background: vars["--st-bg"], color: vars["--st-text"], fontFamily: t.body }}>
      <div
        className="flex items-center justify-between px-2 py-1.5 text-[10px]"
        style={t.header === "bold" ? { background: vars["--accent"], color: vars["--accent-contrast"] } : { borderBottom: `1px solid ${vars["--st-border"]}`, background: vars["--st-surface"] }}
      >
        <span className="font-bold" style={{ fontFamily: t.heading, textTransform: vars["--st-heading-transform"] as "none" }}>{name.slice(0, 18)}</span>
        <span className="rounded px-1.5" style={{ background: t.header === "bold" ? vars["--accent-contrast"] : vars["--accent"], color: t.header === "bold" ? vars["--accent"] : vars["--accent-contrast"] }}>Cart</span>
      </div>
      <div className="relative space-y-1.5 overflow-hidden p-2" style={{ color: onAccent ? vars["--accent-contrast"] : vars["--st-text"] }}>
        {panel ? (
          <div className="absolute inset-y-1.5 right-1.5 w-[42%] overflow-hidden" style={{ borderRadius: vars["--st-radius"] }}>
            <BannerArt art={art} uid={`theme-${theme}`} anchor="right" />
          </div>
        ) : (
          <BannerArt art={art} uid={`theme-${theme}`} />
        )}
        <div className={`relative text-base leading-tight ${panel ? "w-[55%]" : ""}`} style={{ fontFamily: t.heading, fontWeight: Number(vars["--st-heading-weight"]), textTransform: vars["--st-heading-transform"] as "none", textAlign: center ? "center" : "left" }}>
          Gear up for the season
        </div>
        <div className={`relative ${center ? "flex justify-center" : ""}`}>
          <span className="inline-block px-2 py-0.5 text-[9px] font-semibold" style={{ background: onAccent ? vars["--accent-contrast"] : vars["--accent"], color: onAccent ? vars["--accent"] : vars["--accent-contrast"], borderRadius: vars["--st-radius"] }}>Shop now</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2">
        {[0, 1, 2].map((i) => <div key={i} className="aspect-square" style={tile} />)}
      </div>
    </div>
  );
}
