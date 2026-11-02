// src/app/sitemap.ts
// Next.js App Router MetadataRoute for dynamic sitemap.xml generation.

import { MetadataRoute } from 'next';
import { generateSitemapUrls } from '@/lib/seo/structured-data';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries = generateSitemapUrls();
  return entries.map((e) => ({
    url: e.url,
    lastModified: e.lastModified,
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
