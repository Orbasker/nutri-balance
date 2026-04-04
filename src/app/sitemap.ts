import type { MetadataRoute } from "next";

import { db } from "@/lib/db";
import { foods } from "@/lib/db/schema/foods";

const SITE_URL = "https://nutritionmasterbot.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allFoods = await db.select({ id: foods.id, updatedAt: foods.updatedAt }).from(foods);

  const foodEntries: MetadataRoute.Sitemap = allFoods.map((food) => ({
    url: `${SITE_URL}/food/${food.id}`,
    lastModified: food.updatedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/methodology`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  return [...staticPages, ...foodEntries];
}
