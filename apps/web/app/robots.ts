import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: "https://threadly.frpboy.in/sitemap.xml",
    host: "https://threadly.frpboy.in",
  };
}
