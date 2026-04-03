import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/about', '/terms', '/privacy', '/verify'],
        disallow: ['/portal/', '/admin/', '/api/'],
      },
    ],
    sitemap: 'https://logissign.com/sitemap.xml',
  }
}
