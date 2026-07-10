/**
 * jsonLd — pure builders + serializer for the pages' structured data (#86).
 *
 * Mirrors `seoMeta.ts`: no `Astro.site`, no config import, no I/O — the caller
 * hands in the absolute site origin, so the module stays unit-testable under
 * the D-012 coverage gate. `Base.astro` owns the guard: when `Astro.site` is
 * unset it never calls these, and the `<script>` drops cleanly.
 *
 * Schema must describe the *visible* page (issue #86): no ratings, no reviews,
 * no invented author, and no `potentialAction`/`SearchAction` — the site search
 * is a client island with no `?q=` URL to point a sitelinks searchbox at.
 * `FAQPage` is deliberately absent; it waits on the landing FAQ (#82).
 */

/** The one JSON-LD vocabulary this site emits. */
export const SCHEMA_CONTEXT = 'https://schema.org';

/** A top-level JSON-LD node, ready to be serialized into a `<script>`. */
export interface JsonLdNode {
  readonly '@context': typeof SCHEMA_CONTEXT;
  readonly '@type': string;
  readonly [key: string]: unknown;
}

/** Identity of the site itself — the brand, not the physics keyword phrase. */
export interface HomeJsonLdInput {
  /** Absolute site origin, e.g. `https://solar-time-prod.web.app`. */
  origin: string;
  /** Brand name, e.g. `Solar Drift`. */
  name: string;
  /** The home page's own meta description — kept in sync with what renders. */
  description: string;
}

/** The city a breadcrumb trail terminates at. */
export interface CityBreadcrumbInput {
  /** Absolute site origin. */
  origin: string;
  /** Display name, e.g. `Prague`. */
  cityName: string;
  /** URL slug, e.g. `prague`. */
  slug: string;
}

/** Resolves a site-relative path against the origin into an absolute URL. */
const absolute = (origin: string, path: string): string => new URL(path, origin).href;

/**
 * Structured data for the home page: the site entity plus the app it hosts.
 *
 * Two nodes rather than one, linked by `@id`, so a crawler can tell the
 * *website* apart from the *web application* it serves.
 *
 * @param input - Origin, brand name, and the page's meta description.
 * @returns The `WebSite` and `WebApplication` nodes, in that order.
 */
export const homeJsonLd = ({
  origin,
  name,
  description,
}: HomeJsonLdInput): readonly JsonLdNode[] => {
  const home = absolute(origin, '/');
  const websiteId = `${home}#website`;

  return [
    {
      '@context': SCHEMA_CONTEXT,
      '@type': 'WebSite',
      '@id': websiteId,
      url: home,
      name,
      description,
    },
    {
      '@context': SCHEMA_CONTEXT,
      '@type': 'WebApplication',
      '@id': `${home}#webapp`,
      url: home,
      name,
      description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires JavaScript.',
      isAccessibleForFree: true,
      isPartOf: { '@id': websiteId },
    },
  ];
};

/**
 * Breadcrumb trail for a city page: `Home → {City}`.
 *
 * Two levels only — the site has no category tier between them, and inventing
 * one would be schema that contradicts the page.
 *
 * @param input - Origin plus the city's display name and slug.
 * @returns A `BreadcrumbList` node with absolute `item` URLs.
 */
export const cityBreadcrumbJsonLd = ({
  origin,
  cityName,
  slug,
}: CityBreadcrumbInput): JsonLdNode => ({
  '@context': SCHEMA_CONTEXT,
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: absolute(origin, '/') },
    { '@type': 'ListItem', position: 2, name: cityName, item: absolute(origin, `/${slug}`) },
  ],
});

/**
 * Serializes JSON-LD for embedding in `<script type="application/ld+json">`.
 *
 * Every `<` is rewritten to its JSON unicode escape, so a literal `</script>`
 * inside any string can never terminate the tag early. The output stays valid
 * JSON — `JSON.parse` decodes the escape back to `<`.
 *
 * @param data - A single node or an array of nodes.
 * @returns The JSON text to hand to `set:html` (Astro would otherwise
 *   HTML-escape `&`, which corrupts the payload).
 */
export const serializeJsonLd = (data: JsonLdNode | readonly JsonLdNode[]): string =>
  JSON.stringify(data).replace(/</g, '\\u003c');
