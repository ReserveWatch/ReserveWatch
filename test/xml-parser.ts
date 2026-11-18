/** Tiny sitemap reader for tests. Not a general XML parser. */
export class XMLParser {
  parse(xml: string): { urlset: { url: { loc: string; lastmod: string }[] } } {
    if (!xml.includes('<urlset')) throw new Error('missing urlset');
    const urls = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(m => {
      const loc = m[1].match(/<loc>([^<]*)<\/loc>/)?.[1];
      const lastmod = m[1].match(/<lastmod>([^<]*)<\/lastmod>/)?.[1];
      if (!loc || !lastmod) throw new Error('url missing loc or lastmod');
      return { loc: loc.replace(/&amp;/g, '&'), lastmod };
    });
    if (!urls.length) throw new Error('no urls');
    return { urlset: { url: urls } };
  }
}
