/** A device screenshot. Real app output, not a mockup — these come from the
 *  UI-test screenshot walk that also generates the App Store sets. */
export function Shot({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="m-0">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width={390}
        height={846}
        className="w-full rounded-xl border border-white/10"
      />
      <figcaption className="mt-3 text-sm leading-relaxed text-sw-steel">{caption}</figcaption>
    </figure>
  )
}
