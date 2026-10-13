import type { MetadataRoute } from "next";

const domain = process.env.NEXT_PUBLIC_BCAUTOLOAN_DOMAIN;

export default function sitemap(): MetadataRoute.Sitemap {
  if (!domain) {
    // Return empty sitemap if domain not configured
    return [];
  }

  const baseUrl = domain;

  return [
    {
      url: `${baseUrl}/bcautoloan`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/bcautoloan/pre-approved`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/bcautoloan/sell-your-car`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/bcautoloan/how-it-works`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/bcautoloan/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/bcautoloan/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/bcautoloan/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/bcautoloan/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
