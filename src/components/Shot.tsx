/** A device screenshot. Real app output, not a mockup — these come from the
 *  UI-test screenshot walk that also generates the App Store sets. 780px wide,
 *  2× for the widest slot on the page.
 *
 *  The corner is the phone's own: an iPhone's display radius is about 13% of
 *  its width, so the figure is a container and the radius follows its width
 *  down to the two-up pair on a phone, capped where a 360px slot would read as
 *  a real device. */
export function Shot({
  src,
  alt,
  caption,
  eager,
  crop,
}: {
  src: string
  alt: string
  caption?: string
  /** The hero shot is above the fold; everything else waits its turn. */
  eager?: boolean
  crop?: boolean
}) {
  const image = (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'high' : undefined}
      width={780}
      height={1695}
      className="w-full rounded-[min(3rem,13cqw)] shadow-2xl shadow-sw-shadow ring-1 ring-sw-rule"
    />
  )

  return (
    <figure className="@container m-0">
      {crop ? (
        <div className="h-[178cqw] max-h-[640px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_65%,transparent)]">
          {image}
        </div>
      ) : image}
      {caption && (
        <figcaption className="mt-4 text-sm leading-relaxed text-sw-steel">{caption}</figcaption>
      )}
    </figure>
  )
}
