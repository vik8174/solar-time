// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { suppressHeroEntrance } from './heroEntrance';

/** Build a detached document whose body holds the given markup. */
const docWith = (bodyHtml: string): Document => {
  const doc = document.implementation.createHTMLDocument('t');
  doc.body.innerHTML = bodyHtml;
  return doc;
};

describe('suppressHeroEntrance', () => {
  it('removes the entrance class so the incoming hero does not replay `rise`', () => {
    const doc = docWith('<h1 class="hero entrance"><span>+68</span></h1>');

    suppressHeroEntrance(doc);

    const hero = doc.querySelector('.hero');
    expect(hero?.classList.contains('entrance')).toBe(false);
    // The hero itself is untouched otherwise — only the entrance opt-in is dropped.
    expect(hero?.classList.contains('hero')).toBe(true);
  });

  it('is a no-op when the incoming hero has no entrance (e.g. the landing `/`)', () => {
    const doc = docWith('<p class="hero synced"><span>In sync</span></p>');

    expect(() => {
      suppressHeroEntrance(doc);
    }).not.toThrow();
    expect(doc.querySelector('.hero')?.classList.contains('synced')).toBe(true);
  });

  it('is a no-op when the incoming document has no hero at all', () => {
    const doc = docWith('<main><p>no hero here</p></main>');

    expect(() => {
      suppressHeroEntrance(doc);
    }).not.toThrow();
  });
});
