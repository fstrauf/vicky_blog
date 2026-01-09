# Vicky Blog

Astro site with:

- Blog posts (`/blog`)
- Recipes (`/recipes`) with Recipe JSON-LD and print-friendly output
- Tailwind (utilities + Typography plugin)
- Decap CMS at `/admin`

Required setup:

- Set the production site URL so canonical URLs + sitemap are correct.
	- Recommended: set `SITE=https://vicky-blog-ochre.vercel.app` in Vercel Environment Variables (see `.env.example`).
- Update the GitHub repo in `public/admin/config.yml` (`backend.repo: ...`) so Decap can commit content.

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
├── public/
├── src/
│   ├── components/
│   ├── content/
│   ├── layouts/
│   └── pages/
├── astro.config.mjs
├── README.md
├── package.json
└── tsconfig.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

There's nothing special about `src/components/`, but that's where we like to put any Astro/React/Vue/Svelte/Preact components.

The `src/content/` directory contains "collections" of related Markdown and MDX documents. Use `getCollection()` to retrieve posts from `src/content/blog/`, and type-check your frontmatter using an optional schema. See [Astro's Content Collections docs](https://docs.astro.build/en/guides/content-collections/) to learn more.

Any static assets, like images, can be placed in the `public/` directory.

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:3040`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## Decap CMS

- Admin UI: `/admin`
- Media uploads go to `public/images` and are served from `/images`.
- For GitHub login on Vercel/production, you’ll need an OAuth provider (see `CMS_SETUP.md`).

See `EDITOR_GUIDE.md` for the post/recipe field expectations.

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
