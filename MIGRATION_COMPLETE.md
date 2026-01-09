# Quick Start Guide - Notion to Astro Migration

## ✅ Migration Complete!

Your blog has been successfully migrated from Decap CMS to Notion. Here's what changed:

### What Was Removed
- ❌ `/admin` route and Decap CMS interface
- ❌ `/api/auth` and `/api/callback` OAuth endpoints
- ❌ `public/admin/` directory
- ❌ GitHub OAuth client credentials

### What Was Added
- ✅ Notion API integration via `@notionhq/client`
- ✅ Automated sync script: `scripts/sync-notion.mjs`
- ✅ GitHub Actions workflow: `.github/workflows/sync-notion.yml`
- ✅ Comprehensive setup guide: `NOTION_SETUP.md`
- ✅ New npm command: `npm run sync:notion`

## 🚀 Next Steps

### 1. Set Up Notion (Required)
Follow the complete guide in [NOTION_SETUP.md](./NOTION_SETUP.md):

1. Create two Notion databases (Posts & Recipes)
2. Create a Notion integration
3. Connect databases to the integration
4. Get database IDs
5. Configure GitHub Secrets

### 2. Local Testing (Optional but Recommended)
```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your credentials
# NOTION_API_KEY=secret_xxxxx
# NOTION_POSTS_DATABASE_ID=xxxxx
# NOTION_RECIPES_DATABASE_ID=xxxxx

# Test the sync
npm run sync:notion
```

### 3. Deploy
Once GitHub Secrets are configured, the workflow will automatically:
- Sync content every 6 hours
- Sync on every push to main/master
- Allow manual triggers from Actions tab

## 📚 Documentation

- **[NOTION_SETUP.md](./NOTION_SETUP.md)** - Complete Notion setup guide
- **[README.md](./README.md)** - Project overview and commands

## 💡 Tips

### Publishing Content
1. Write in Notion
2. Check the "Publish" checkbox
3. Wait for next sync or trigger manually

### Images
- Cover images: Use Notion's cover image feature
- Inline images: Paste directly in Notion
- All images auto-download to `public/images/notion/`

### Manual Sync
```bash
# Locally
npm run sync:notion

# On GitHub
Actions tab → Sync Content from Notion → Run workflow
```

### Troubleshooting
- Check GitHub Actions logs for errors
- Verify all required Notion properties exist
- Ensure integration has access to databases
- Confirm database IDs are correct (32 characters, no hyphens)

## 🎉 You're Ready!

Your blog is now powered by Notion with automatic syncing. No more CMS headaches!

---

Questions? Check [NOTION_SETUP.md](./NOTION_SETUP.md) for detailed instructions and troubleshooting.
