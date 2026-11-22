/** Tiny sitemap and RSS reader for tests. Not a general XML parser. */
export class XMLParser {
  parse(xml: string): { urlset?: { url: { loc: string; lastmod: string }[] }; rss?: { channel: { item: { title: string; link: string; guid: string }[] } } } {
    if (xml.includes('<rss')) {
      if (!xml.includes('<channel>')) throw new Error('missing channel');
      const item = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
        const title = m[1].match(/<title>([^<]*)<\/title>/)?.[1];
        const link = m[1].match(/<link>([^<]*)<\/link>/)?.[1];
        const guid = m[1].match(/<guid\b[^>]*>([^<]*)<\/guid>/)?.[1];
        if (!title || !link || !guid) throw new Error('item missing title, link, or guid');
        return { title, link, guid: guid.replace(/&amp;/g, '&') };
      });
      return { rss: { channel: { item } } };
    }
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
