# Notion to Astro Sync Setup Guide

This guide will help you set up the automated Notion → Astro content sync for your blog.

## 📋 Prerequisites

- A Notion account with a workspace
- A GitHub account
- Your repository deployed on Vercel

## 🎯 Step 1: Create Notion Databases

You need to create two databases in Notion: one for blog posts and one for recipes.

### Blog Posts Database

Create a database with these properties:

| Property Name | Type | Required | Description |
|--------------|------|----------|-------------|
| Title | Title | ✅ Yes | Post title |
| Description | Text | No | Short description/excerpt |
| Date | Date | No | Publication date (defaults to creation date) |
| Tags | Multi-select | No | Tags for the post |
| Slug | Text | No | URL slug (auto-generated from title if empty) |
| Publish | Checkbox | ✅ Yes | Must be checked to sync |

### Recipes Database

Create a database with these properties:

| Property Name | Type | Required | Description |
|--------------|------|----------|-------------|
| Title | Title | ✅ Yes | Recipe name |
| Description | Text | No | Short description |
| Date | Date | No | Publication date |
| Tags | Multi-select | No | Recipe tags |
| Slug | Text | No | URL slug |
| Publish | Checkbox | ✅ Yes | Must be checked to sync |
| Yield | Text | No | Serving size (e.g., "4 servings") |
| Prep Time | Text | No | Prep time in ISO8601 format (e.g., "PT30M" for 30 minutes) |
| Cook Time | Text | No | Cook time in ISO8601 format |
| Total Time | Text | No | Total time in ISO8601 format |

### Content Structure

For recipes, structure your Notion page content like this:

```
## Ingredients

- 2 cups flour
- 1 tsp salt
- 1 cup water

## Instructions

1. Mix dry ingredients
2. Add water slowly
3. Knead until smooth

## (Rest of your content)
```

The sync script will automatically extract ingredients and instructions from these sections.

## 🔑 Step 2: Create Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click **"+ New integration"**
3. Give it a name (e.g., "Astro Blog Sync")
4. Select your workspace
5. Under **Capabilities**, ensure these are enabled:
   - ✅ Read content
   - ✅ Read user information (optional)
6. Click **"Submit"**
7. **Copy the "Internal Integration Token"** (starts with `secret_`)

## 🔗 Step 3: Connect Databases to Integration

For each database (posts and recipes):

1. Open the database in Notion
2. Click the **⋯** menu (top right)
3. Scroll down and click **"+ Add connections"**
4. Find and select your integration
5. Click **"Confirm"**

## 🆔 Step 4: Get Database IDs

For each database:

1. Open the database in Notion
2. Look at the URL in your browser:
   ```
   https://www.notion.so/{workspace}/{database_id}?v={view_id}
   ```
3. Copy the `database_id` part (32 characters, no hyphens)
   - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

## 🔐 Step 5: Configure GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add these three secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `NOTION_API_KEY` | Your integration token | `secret_abc123...` |
| `NOTION_POSTS_DATABASE_ID` | Posts database ID | `a1b2c3d4e5f6...` |
| `NOTION_RECIPES_DATABASE_ID` | Recipes database ID | `x9y8z7w6v5u4...` |

## ⚙️ Step 6: Local Development Setup

1. Clone your repository
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and add your credentials:
   ```env
   NOTION_API_KEY=secret_your_token_here
   NOTION_POSTS_DATABASE_ID=your_posts_db_id_here
   NOTION_RECIPES_DATABASE_ID=your_recipes_db_id_here
   ```
4. Install dependencies:
   ```bash
   npm install
   ```

## 🧪 Step 7: Test the Sync

Run a manual sync to test everything works:

```bash
npm run sync:notion
```

You should see output like:

```
Starting Notion sync...

Fetching blog posts from Notion...
Found 3 published posts

Fetching recipes from Notion...
Found 5 published recipes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 SYNC REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Blog Posts:
  ✅ Added: 3
     - my-first-post
     - another-great-post
     - latest-update
  🔄 Updated: 0
  ⏭️  Skipped: 0
  🗑️  Removed: 0

🍳 Recipes:
  ✅ Added: 5
  🔄 Updated: 0
  ⏭️  Skipped: 0
  🗑️  Removed: 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ Sync complete! 8 changes made.
```

Check the `src/content/blog/` and `src/content/recipes/` folders to see your synced content!

## 🚀 Step 8: Deploy and Automate

The GitHub Actions workflow is already set up and will:

- **Run automatically every 6 hours**
- **Run when you push to main/master**
- **Can be triggered manually** from the Actions tab

### Manual Trigger

1. Go to your repository on GitHub
2. Click **Actions** tab
3. Click **"Sync Content from Notion"** workflow
4. Click **"Run workflow"** → **"Run workflow"**

## 📝 Writing Content in Notion

### Publishing Content

1. Create a new page in your Posts or Recipes database
2. Write your content using Notion blocks
3. Add a cover image (optional)
4. Fill in all required fields
5. **Check the "Publish" checkbox**
6. Wait for the next sync (or trigger manually)

### Unpublishing Content

Simply uncheck the "Publish" checkbox. On the next sync, the file will be removed from your repository.

### Updating Content

1. Edit your page in Notion
2. Save changes (Notion auto-saves)
3. Wait for the next sync
4. The script detects changes via content hash and only updates changed files

### Images

- **Cover images**: Set using Notion's cover image feature
- **Inline images**: Paste or upload images directly in Notion
- All images are automatically downloaded and saved to `public/images/notion/`
- Image URLs in content are rewritten to local paths

## 🔍 Understanding the Sync

### What Gets Synced?

- ✅ Pages with `Publish` checkbox = true
- ✅ All page properties (title, date, tags, etc.)
- ✅ Page content (converted from Notion blocks to Markdown)
- ✅ Cover images and inline images
- ✅ Frontmatter metadata for Astro

### What Doesn't Get Synced?

- ❌ Pages with `Publish` = false
- ❌ Pages without a Title
- ❌ Notion comments
- ❌ Database views and filters

### Content Hash

Each synced file includes a `content_hash` in the frontmatter. This hash is used to detect changes:

- If content hasn't changed → file is skipped (no unnecessary updates)
- If content has changed → file is updated
- If page is unpublished → file is removed

### Frontmatter Metadata

Every synced file includes:

```yaml
---
title: "My Post Title"
description: "A short description"
pubDate: "2026-01-09T00:00:00.000Z"
tags:
  - tutorial
  - astro
heroImage:
  src: /images/notion/my-post-cover.jpg
  alt: My Post Title
notion_page_id: "abc123..."
last_synced_at: "2026-01-09T12:30:45.000Z"
content_hash: "a1b2c3..."
---
```

## 🐛 Troubleshooting

### "Missing required fields" error

Make sure your Notion database has all required properties:
- Title (Title type)
- Publish (Checkbox type)

### "Notion API error" or "Unauthorized"

- Check your `NOTION_API_KEY` is correct
- Ensure the integration is connected to your databases
- Verify the database IDs are correct (32 characters)

### Images not downloading

- Check image URLs are accessible
- Ensure `public/images/notion/` directory has write permissions
- Look for error messages in sync output

### No changes detected

This is normal! The script uses content hashing to avoid unnecessary updates.

### Workflow not running

- Check GitHub Actions is enabled for your repository
- Verify secrets are set correctly
- Look at the Actions tab for error logs

## 📚 Advanced Usage

### Custom Sync Schedule

Edit `.github/workflows/sync-notion.yml`:

```yaml
schedule:
  # Run every 2 hours instead of 6
  - cron: '0 */2 * * *'
```

Cron syntax:
- `0 */6 * * *` = Every 6 hours
- `0 */2 * * *` = Every 2 hours
- `0 0 * * *` = Daily at midnight
- `0 9,17 * * 1-5` = 9 AM and 5 PM, Monday-Friday

### Skip CI on Manual Commits

The workflow includes `[skip ci]` in commit messages to prevent infinite loops. If you need to modify this behavior, edit the workflow file.

### Add More Content Types

To add a new content type (e.g., "Tutorials"):

1. Create a new Notion database with required properties
2. Add the database ID to GitHub Secrets
3. Modify `scripts/sync-notion.mjs` to add sync logic
4. Create a new content collection in Astro

## 🎉 You're All Set!

Your blog now has a fully automated Notion → GitHub → Vercel pipeline:

1. ✍️ Viktoria writes in Notion
2. ✅ Checks "Publish" when ready
3. 🤖 GitHub Actions syncs content every 6 hours
4. 🚀 Vercel auto-deploys the updated site
5. 🌐 Content goes live!

**No more dual editors, no more manual deployments, no more headaches!**

## 📖 Resources

- [Notion API Documentation](https://developers.notion.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [Vercel Documentation](https://vercel.com/docs)

---

Need help? Check the sync logs in the GitHub Actions tab or review the script output when running `npm run sync:notion` locally.
