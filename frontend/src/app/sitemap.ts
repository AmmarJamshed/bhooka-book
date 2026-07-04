import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://bhookabook.netlify.app";
  return [
    { url: base, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/concierge`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/profile`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/reservations`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/favorites`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.5 },
  ];
}
