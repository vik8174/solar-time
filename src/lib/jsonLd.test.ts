import { describe, expect, it } from 'vitest';

import {
  cityBreadcrumbJsonLd,
  homeJsonLd,
  SCHEMA_CONTEXT,
  serializeJsonLd,
  type JsonLdNode,
} from './jsonLd';

const ORIGIN = 'https://solar-time-prod.web.app';

const home = {
  origin: ORIGIN,
  name: 'Solar Drift',
  description: 'See how far your clock runs from true solar time.',
};

const prague = { origin: ORIGIN, cityName: 'Prague', slug: 'prague' };

/** The nodes are opaque to the type; read a field without an `any` cast. */
const field = (node: JsonLdNode, key: string): unknown => node[key];

describe('homeJsonLd', () => {
  it('emits a WebSite and a WebApplication node', () => {
    expect(homeJsonLd(home).map((node) => node['@type'])).toEqual(['WebSite', 'WebApplication']);
  });

  it('tags every node with the schema.org context', () => {
    for (const node of homeJsonLd(home)) {
      expect(node['@context']).toBe(SCHEMA_CONTEXT);
    }
  });

  it('names both nodes with the brand and carries the page description', () => {
    for (const node of homeJsonLd(home)) {
      expect(field(node, 'name')).toBe('Solar Drift');
      expect(field(node, 'description')).toBe(home.description);
    }
  });

  it('points both nodes at the absolute home URL', () => {
    for (const node of homeJsonLd(home)) {
      expect(field(node, 'url')).toBe('https://solar-time-prod.web.app/');
    }
  });

  it('links the application to the website by @id', () => {
    const [website, app] = homeJsonLd(home);
    expect(website?.['@id']).toBe('https://solar-time-prod.web.app/#website');
    expect(app?.['@id']).toBe('https://solar-time-prod.web.app/#webapp');
    expect(field(app as JsonLdNode, 'isPartOf')).toEqual({
      '@id': 'https://solar-time-prod.web.app/#website',
    });
  });

  it('describes the app as a free browser utility', () => {
    const app = homeJsonLd(home)[1] as JsonLdNode;
    expect(field(app, 'applicationCategory')).toBe('UtilitiesApplication');
    expect(field(app, 'operatingSystem')).toBe('Any');
    expect(field(app, 'isAccessibleForFree')).toBe(true);
  });

  it('claims no rating, review, offer, author, or search action', () => {
    const serialized = serializeJsonLd(homeJsonLd(home));
    for (const banned of ['aggregateRating', 'review', 'offers', 'author', 'potentialAction']) {
      expect(serialized).not.toContain(banned);
    }
  });

  it('tolerates an origin that already carries a trailing slash', () => {
    const [website] = homeJsonLd({ ...home, origin: `${ORIGIN}/` });
    expect(field(website as JsonLdNode, 'url')).toBe('https://solar-time-prod.web.app/');
  });
});

describe('cityBreadcrumbJsonLd', () => {
  it('emits a BreadcrumbList in the schema.org context', () => {
    const crumbs = cityBreadcrumbJsonLd(prague);
    expect(crumbs['@type']).toBe('BreadcrumbList');
    expect(crumbs['@context']).toBe(SCHEMA_CONTEXT);
  });

  it('walks Home → City with absolute item URLs and 1-based positions', () => {
    expect(field(cityBreadcrumbJsonLd(prague), 'itemListElement')).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://solar-time-prod.web.app/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Prague',
        item: 'https://solar-time-prod.web.app/prague',
      },
    ]);
  });

  it('invents no category tier between the home and the city', () => {
    const items = field(cityBreadcrumbJsonLd(prague), 'itemListElement');
    expect(items).toHaveLength(2);
  });

  it('percent-encodes a slug that needs it, keeping the item URL absolute', () => {
    const crumbs = cityBreadcrumbJsonLd({ ...prague, cityName: 'São Paulo', slug: 'são-paulo' });
    const items = field(crumbs, 'itemListElement') as { item: string }[];
    expect(items[1]?.item).toBe('https://solar-time-prod.web.app/s%C3%A3o-paulo');
  });
});

describe('serializeJsonLd', () => {
  it('serializes a single node to parseable JSON', () => {
    const parsed: unknown = JSON.parse(serializeJsonLd(cityBreadcrumbJsonLd(prague)));
    expect(parsed).toEqual(cityBreadcrumbJsonLd(prague));
  });

  it('serializes an array of nodes to parseable JSON', () => {
    const parsed: unknown = JSON.parse(serializeJsonLd(homeJsonLd(home)));
    expect(parsed).toEqual(homeJsonLd(home));
  });

  it('escapes "<" so a literal </script> cannot terminate the tag', () => {
    const hostile = cityBreadcrumbJsonLd({ ...prague, cityName: '</script><b>x' });
    const serialized = serializeJsonLd(hostile);
    expect(serialized).not.toContain('<');
    expect(serialized).toContain('\\u003c/script>');
  });

  it('round-trips the escaped "<" back to the original string', () => {
    const hostile = cityBreadcrumbJsonLd({ ...prague, cityName: '</script>' });
    const parsed = JSON.parse(serializeJsonLd(hostile)) as {
      itemListElement: { name: string }[];
    };
    expect(parsed.itemListElement[1]?.name).toBe('</script>');
  });

  it('leaves "&" untouched — the tag is written with set:html, not text', () => {
    const amp = cityBreadcrumbJsonLd({ ...prague, cityName: 'Bath & Wells' });
    expect(serializeJsonLd(amp)).toContain('Bath & Wells');
  });
});
