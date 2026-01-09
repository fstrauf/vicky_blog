import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const publicImage = z.object({
	src: z.string(),
	alt: z.string().optional(),
	width: z.number().int().positive().optional(),
	height: z.number().int().positive().optional(),
});

const iso8601Duration = z
	.string()
	.regex(/^P(T.*)$/i, 'Use an ISO-8601 duration like PT20M, PT1H, or PT1H30M');

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: 'src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			tags: z.array(z.string()).optional(),
			heroImage: publicImage.optional(),
		}),
});

const recipes = defineCollection({
	loader: glob({ base: 'src/content/recipes', pattern: '**/*.md' }),
	schema: () =>
		z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			tags: z.array(z.string()).optional(),
			coverImage: publicImage.optional(),
			yield: z.string().optional(),
			times: z
				.object({
					prep: iso8601Duration.optional(),
					cook: iso8601Duration.optional(),
					total: iso8601Duration.optional(),
				})
				.optional(),
			ingredients: z
				.array(
					z.object({
						amount: z.string().optional(),
						unit: z.string().optional(),
						item: z.string(),
						note: z.string().optional(),
					}),
				)
				.default([]),
			instructions: z.array(z.string()).default([]),
			nutrition: z
				.object({
					calories: z.string().optional(),
					protein: z.string().optional(),
					carbs: z.string().optional(),
					fat: z.string().optional(),
					fiber: z.string().optional(),
					sugar: z.string().optional(),
					sodium: z.string().optional(),
				})
				.optional(),
		}),
});

export const collections = { blog, recipes };
