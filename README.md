# Vicky Blog

Astro site with automated Notion content sync:

- Blog posts (`/blog`) synced from Notion
- Recipes (`/recipes`) with Recipe JSON-LD and print-friendly output, synced from Notion
- Tailwind (utilities + Typography plugin)
- Automated GitHub Actions workflow for content sync
- Deployed on Vercel

## 📝 Content Management

Content is managed in **Notion** and automatically synced to the repository via GitHub Actions.

- ✍️ Write and edit content in Notion
- ✅ Check "Publish" to publish
- 🤖 Content syncs automatically every 6 hours
- 🚀 Vercel deploys changes automatically

**See [NOTION_SETUP.md](./NOTION_SETUP.md) for complete setup instructions.**

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
├── public/
│   └── images/
│       └── notion/          # Synced images from Notion
├── src/
│   ├── components/
│   ├── content/
│   │   ├── blog/            # Blog posts (synced from Notion)
│   │   └── recipes/         # Recipes (synced from Notion)
│   ├── layouts/
│   └── pages/
├── scripts/
│   └── sync-notion.mjs      # Notion sync script
├── .github/
│   └── workflows/
│       └── sync-notion.yml  # Automated sync workflow
├── astro.config.mjs
├── README.md
├── NOTION_SETUP.md          # Notion setup guide
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
| `npm run sync:notion`     | Manually sync content from Notion                |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## ⚙️ Configuration

Required environment variables:

```env
# Site URL (set in Vercel Environment Variables)
SITE=https://vicky-blog-ochre.vercel.app

# Notion API (add to GitHub Secrets and local .env)
NOTION_API_KEY=secret_xxxxx
NOTION_POSTS_DATABASE_ID=xxxxx
NOTION_RECIPES_DATABASE_ID=xxxxx
```

See `.env.example` for the template and [NOTION_SETUP.md](./NOTION_SETUP.md) for detailed setup instructions.

Note: local `.env` / `.env.local` files are not available in GitHub Actions — the workflow uses repository secrets.

## 🔄 Content Sync

Content is automatically synced from Notion:

- **Automatic**: Every 6 hours via GitHub Actions
- **Manual**: Run `npm run sync:notion` locally or trigger the workflow on GitHub
- **On Push**: Syncs when pushing to main/master branch

Only pages with the "Publish" checkbox enabled are synced. When you uncheck "Publish", the file is automatically removed.

## Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
