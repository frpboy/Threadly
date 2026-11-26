import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://threadly.frpboy.in";
  const now = new Date();

  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/archive`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];
}
