import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'https://vaeloom.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/workspace/*/admin/', '/workspace/*/developer/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
