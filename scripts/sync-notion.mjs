import dotenv from 'dotenv';
import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'path';
import crypto from 'crypto';
import https from 'node:https';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

// Load local env files if present (Astro commonly uses .env.local)
if (fs.existsSync(path.join(process.cwd(), '.env.local'))) {
  dotenv.config({ path: path.join(process.cwd(), '.env.local') });
}
if (fs.existsSync(path.join(process.cwd(), '.env'))) {
  dotenv.config({ path: path.join(process.cwd(), '.env') });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const n2m = new NotionToMarkdown({ notionClient: notion });

// Configuration
const POSTS_DATABASE_ID = process.env.NOTION_POSTS_DATABASE_ID;
const RECIPES_DATABASE_ID = process.env.NOTION_RECIPES_DATABASE_ID;
const POSTS_OUTPUT_DIR = path.join(__dirname, '..', 'src', 'content', 'blog');
const RECIPES_OUTPUT_DIR = path.join(__dirname, '..', 'src', 'content', 'recipes');
const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images', 'notion');

function firstPropertyNameOfType(database, type) {
  const entries = Object.entries(database?.properties ?? {});
  const match = entries.find(([, prop]) => prop?.type === type);
  return match ? match[0] : null;
}

async function getDatabaseSyncConfig({
  databaseId,
  type,
  titlePropEnv,
  tagsPropEnv,
  slugPropEnv,
  publishPropEnv,
  datePropEnv,
  descriptionPropEnv,
}) {
  const database = await notion.databases.retrieve({ database_id: databaseId });

  const desiredTitleProp = process.env[titlePropEnv];
  const desiredTagsProp = process.env[tagsPropEnv];
  const desiredSlugProp = process.env[slugPropEnv];
  const desiredPublishProp = process.env[publishPropEnv];
  const desiredDateProp = process.env[datePropEnv];
  const desiredDescriptionProp = process.env[descriptionPropEnv];

  const titleProp =
    (desiredTitleProp && database.properties?.[desiredTitleProp] ? desiredTitleProp : null) ??
    firstPropertyNameOfType(database, 'title') ??
    'Title';

  const tagsProp =
    (desiredTagsProp && database.properties?.[desiredTagsProp] ? desiredTagsProp : null) ??
    firstPropertyNameOfType(database, 'multi_select') ??
    'Tags';

  const slugProp = desiredSlugProp && database.properties?.[desiredSlugProp] ? desiredSlugProp : 'Slug';
  const descriptionProp =
    desiredDescriptionProp && database.properties?.[desiredDescriptionProp]
      ? desiredDescriptionProp
      : 'Description';
  const dateProp = desiredDateProp && database.properties?.[desiredDateProp] ? desiredDateProp : 'Date';

  const publishPropCandidate =
    desiredPublishProp && desiredPublishProp.trim().length > 0 ? desiredPublishProp.trim() : null;
  const publishProp =
    publishPropCandidate && database.properties?.[publishPropCandidate]?.type === 'checkbox'
      ? publishPropCandidate
      : null;

  return {
    type,
    databaseId,
    titleProp,
    tagsProp,
    slugProp,
    publishProp,
    dateProp,
    descriptionProp,
  };
}

// Sync report
const syncReport = {
  posts: { added: [], updated: [], skipped: [], removed: [] },
  recipes: { added: [], updated: [], skipped: [], removed: [] },
};

let postsConfig = null;
let recipesConfig = null;

/**
 * Slugify a string for URL-safe filenames
 */
function slugify(text) {
  if (!text) return 'untitled';
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Calculate content hash for change detection
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Download an image from URL and save it locally
 */
async function downloadImage(url, filename) {
  await fsp.mkdir(IMAGES_DIR, { recursive: true });

  const filepath = path.join(IMAGES_DIR, filename);

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(filepath);

    const cleanupAndReject = async (err) => {
      try {
        fileStream.destroy();
      } catch {
        // ignore
      }
      try {
        await fsp.unlink(filepath);
      } catch {
        // ignore
      }
      reject(err);
    };

    https
      .get(url, (response) => {
        // Follow a single redirect (Notion URLs occasionally redirect)
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          fileStream.close();
          downloadImage(response.headers.location, filename).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          response.resume();
          cleanupAndReject(
            new Error(`Failed to download image (${response.statusCode}) from ${url}`),
          );
          return;
        }

        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close(() => resolve(`/images/notion/${filename}`));
        });
      })
      .on('error', (err) => {
        cleanupAndReject(err);
      });

    fileStream.on('error', (err) => {
      cleanupAndReject(err);
    });
  });
}

/**
 * Process Notion cover image
 */
async function processCoverImage(page, slug) {
  const cover = page.cover;
  if (!cover) return null;

  try {
    let imageUrl;
    if (cover.type === 'external') {
      imageUrl = cover.external.url;
    } else if (cover.type === 'file') {
      imageUrl = cover.file.url;
    }

    if (imageUrl) {
      const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg';
      const filename = `${slug}-cover.${ext}`;
      const localPath = await downloadImage(imageUrl, filename);
      return localPath;
    }
  } catch (error) {
    console.error(`Error downloading cover image for ${slug}:`, error);
  }

  return null;
}

/**
 * Extract property value from Notion page
 */
function getPropertyValue(properties, propName) {
  const prop = properties[propName];
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
      return prop.title?.map((t) => t.plain_text).join('') || null;
    case 'rich_text':
      return prop.rich_text?.map((t) => t.plain_text).join('') || null;
    case 'date':
      return prop.date?.start || null;
    case 'checkbox':
      return prop.checkbox;
    case 'select':
      return prop.select?.name || null;
    case 'multi_select':
      return prop.multi_select?.map(item => item.name) || [];
    case 'number':
      return prop.number;
    case 'url':
      return prop.url;
    default:
      return null;
  }
}

/**
 * Parse ISO8601 duration to object
 */
function parseDuration(duration) {
  if (!duration) return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  return {
    hours: parseInt(match[1] || '0'),
    minutes: parseInt(match[2] || '0'),
  };
}

/**
 * Sync a single blog post
 */
async function syncBlogPost(page) {
  const properties = page.properties;
  
  // Extract properties
  const title = getPropertyValue(properties, postsConfig.titleProp);
  const published = postsConfig.publishProp ? getPropertyValue(properties, postsConfig.publishProp) : true;
  const slug = getPropertyValue(properties, postsConfig.slugProp) || slugify(title);
  const description = getPropertyValue(properties, postsConfig.descriptionProp) || '';
  const pubDate = getPropertyValue(properties, postsConfig.dateProp) || page.created_time;
  const tags = getPropertyValue(properties, postsConfig.tagsProp) || [];

  // Skip if not published or missing required fields
  if (!published || !title) {
    syncReport.posts.skipped.push(slug || 'untitled');
    return null;
  }

  // Get page content
  const mdblocks = await n2m.pageToMarkdown(page.id);
  const mdString = n2m.toMarkdownString(mdblocks);
  let content =
    typeof mdString === 'string'
      ? mdString
      : (mdString?.parent ?? mdString?.toString?.() ?? '');

  // Process images in content
  const imageRegex = /!\[([^\]]*)\]\((https:\/\/[^\)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    const [fullMatch, alt, imageUrl] = match;
    try {
      const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg';
      const filename = `${slug}-${Date.now()}.${ext}`;
      const localPath = await downloadImage(imageUrl, filename);
      content = content.replace(fullMatch, `![${alt}](${localPath})`);
    } catch (error) {
      console.error(`Error processing image in ${slug}:`, error);
    }
  }

  // Download cover image
  const coverImage = await processCoverImage(page, slug);

  // Build frontmatter
  const frontmatter = {
    title,
    description,
    pubDate: new Date(pubDate).toISOString(),
    tags,
    ...(coverImage && {
      heroImage: {
        src: coverImage,
        alt: title,
      },
    }),
    notion_page_id: page.id,
    last_synced_at: new Date().toISOString(),
  };

  // Generate MDX content
  const contentHash = calculateHash(JSON.stringify(frontmatter) + content);
  frontmatter.content_hash = contentHash;

  const mdxContent = matter.stringify(content, frontmatter);

  // Write to file
  const filepath = path.join(POSTS_OUTPUT_DIR, `${slug}.md`);
  
  try {
    // Check if file exists and has same content hash
    try {
      const existingContent = await fsp.readFile(filepath, 'utf-8');
      const hashMatch = existingContent.match(/content_hash: "([^"]+)"/);
      if (hashMatch && hashMatch[1] === contentHash) {
        syncReport.posts.skipped.push(slug);
        return null;
      }
      syncReport.posts.updated.push(slug);
    } catch {
      syncReport.posts.added.push(slug);
    }

    await fsp.writeFile(filepath, mdxContent);
    return slug;
  } catch (error) {
    console.error(`Error writing post ${slug}:`, error);
    return null;
  }
}

/**
 * Sync a single recipe
 */
async function syncRecipe(page) {
  const properties = page.properties;
  
  // Extract properties
  const title = getPropertyValue(properties, recipesConfig.titleProp);
  const published = recipesConfig.publishProp ? getPropertyValue(properties, recipesConfig.publishProp) : true;
  const slug = getPropertyValue(properties, recipesConfig.slugProp) || slugify(title);
  const description = getPropertyValue(properties, recipesConfig.descriptionProp) || '';
  const pubDate = getPropertyValue(properties, recipesConfig.dateProp) || page.created_time;
  const tags = getPropertyValue(properties, recipesConfig.tagsProp) || [];
  const yieldAmount = getPropertyValue(properties, 'Yield');
  
  // Time durations
  const prepTime = getPropertyValue(properties, 'Prep Time');
  const cookTime = getPropertyValue(properties, 'Cook Time');
  const totalTime = getPropertyValue(properties, 'Total Time');

  // Skip if not published or missing required fields
  if (!published || !title) {
    syncReport.recipes.skipped.push(slugify(title));
    return null;
  }

  // Get page content
  const mdblocks = await n2m.pageToMarkdown(page.id);
  const mdString = n2m.toMarkdownString(mdblocks);
  let content =
    typeof mdString === 'string'
      ? mdString
      : (mdString?.parent ?? mdString?.toString?.() ?? '');

  // Process images in content
  const imageRegex = /!\[([^\]]*)\]\((https:\/\/[^\)]+)\)/g;
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    const [fullMatch, alt, imageUrl] = match;
    try {
      const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg';
      const filename = `${slug}-${Date.now()}.${ext}`;
      const localPath = await downloadImage(imageUrl, filename);
      content = content.replace(fullMatch, `![${alt}](${localPath})`);
    } catch (error) {
      console.error(`Error processing image in ${slug}:`, error);
    }
  }

  // Download cover image
  const coverImage = await processCoverImage(page, slug);

  // Extract ingredients and instructions from content
  // This is a simple parser - you may need to adjust based on your Notion structure
  const ingredientsMatch = content.match(/## Ingredients\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  const instructionsMatch = content.match(/## Instructions\n([\s\S]*?)(?=\n## |\n---|\Z)/);
  
  const ingredientLines = ingredientsMatch
    ? ingredientsMatch[1]
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('-'))
        .map((line) => line.replace(/^-\s*/, '').trim())
        .filter(Boolean)
    : [];

  const ingredients = ingredientLines.map((line) => ({ item: line }));
  
  const instructions = instructionsMatch
    ? instructionsMatch[1].split('\n').filter(line => line.trim().match(/^\d+\./)).map(line => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  // Build frontmatter
  const frontmatter = {
    title,
    description,
    pubDate: new Date(pubDate).toISOString(),
    tags,
    ...(coverImage && {
      coverImage: {
        src: coverImage,
        alt: title,
      },
    }),
    ...(yieldAmount && { yield: yieldAmount }),
    ...((prepTime || cookTime || totalTime) && {
      times: {
        ...(prepTime && { prep: prepTime }),
        ...(cookTime && { cook: cookTime }),
        ...(totalTime && { total: totalTime }),
      },
    }),
    ingredients,
    instructions,
    notion_page_id: page.id,
    last_synced_at: new Date().toISOString(),
  };

  // Generate MDX content
  const contentHash = calculateHash(JSON.stringify(frontmatter) + content);
  frontmatter.content_hash = contentHash;

  const mdxContent = matter.stringify(content, frontmatter);

  // Write to file
  const filepath = path.join(RECIPES_OUTPUT_DIR, `${slug}.md`);
  
  try {
    // Check if file exists and has same content hash
    try {
      const existingContent = await fsp.readFile(filepath, 'utf-8');
      const hashMatch = existingContent.match(/content_hash: "([^"]+)"/);
      if (hashMatch && hashMatch[1] === contentHash) {
        syncReport.recipes.skipped.push(slug);
        return null;
      }
      syncReport.recipes.updated.push(slug);
    } catch {
      syncReport.recipes.added.push(slug);
    }

    await fsp.writeFile(filepath, mdxContent);
    return slug;
  } catch (error) {
    console.error(`Error writing recipe ${slug}:`, error);
    return null;
  }
}

/**
 * Remove unpublished files
 */
async function cleanupUnpublished(outputDir, syncedSlugs, reportType) {
  try {
    const files = await fsp.readdir(outputDir);
    
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
      
      const slug = file.replace(/\.(md|mdx)$/, '');
      
      // Check if this file was synced in this run
      if (!syncedSlugs.includes(slug)) {
        // Check if it has a notion_page_id (was previously synced from Notion)
        const filepath = path.join(outputDir, file);
        const content = await fsp.readFile(filepath, 'utf-8');
        
        if (content.includes('notion_page_id:')) {
          // This was from Notion but is no longer published
          await fsp.unlink(filepath);
          syncReport[reportType].removed.push(slug);
          console.log(`Removed unpublished ${reportType} file: ${slug}`);
        }
      }
    }
  } catch (error) {
    console.error(`Error cleaning up ${reportType}:`, error);
  }
}

/**
 * Main sync function
 */
async function sync() {
  console.log('Starting Notion sync...\n');

  try {
    if (!process.env.NOTION_API_KEY) {
      throw new Error('Missing NOTION_API_KEY');
    }

    // Sync blog posts
    if (POSTS_DATABASE_ID) {
      postsConfig = await getDatabaseSyncConfig({
        databaseId: POSTS_DATABASE_ID,
        type: 'posts',
        titlePropEnv: 'NOTION_POSTS_TITLE_PROP',
        tagsPropEnv: 'NOTION_POSTS_TAGS_PROP',
        slugPropEnv: 'NOTION_POSTS_SLUG_PROP',
        publishPropEnv: 'NOTION_POSTS_PUBLISH_PROP',
        datePropEnv: 'NOTION_POSTS_DATE_PROP',
        descriptionPropEnv: 'NOTION_POSTS_DESCRIPTION_PROP',
      });

      console.log('Fetching blog posts from Notion...');
      const postsResponse = await notion.databases.query(
        postsConfig.publishProp
          ? {
              database_id: POSTS_DATABASE_ID,
              filter: {
                property: postsConfig.publishProp,
                checkbox: { equals: true },
              },
            }
          : { database_id: POSTS_DATABASE_ID },
      );

      console.log(`Found ${postsResponse.results.length} published posts`);
      
      const syncedPostSlugs = [];
      for (const page of postsResponse.results) {
        const slug = await syncBlogPost(page);
        if (slug) syncedPostSlugs.push(slug);
      }

      // Cleanup unpublished posts
      await cleanupUnpublished(POSTS_OUTPUT_DIR, syncedPostSlugs, 'posts');
    }

    // Sync recipes
    if (RECIPES_DATABASE_ID) {
      recipesConfig = await getDatabaseSyncConfig({
        databaseId: RECIPES_DATABASE_ID,
        type: 'recipes',
        titlePropEnv: 'NOTION_RECIPES_TITLE_PROP',
        tagsPropEnv: 'NOTION_RECIPES_TAGS_PROP',
        slugPropEnv: 'NOTION_RECIPES_SLUG_PROP',
        publishPropEnv: 'NOTION_RECIPES_PUBLISH_PROP',
        datePropEnv: 'NOTION_RECIPES_DATE_PROP',
        descriptionPropEnv: 'NOTION_RECIPES_DESCRIPTION_PROP',
      });

      console.log('\nFetching recipes from Notion...');
      const recipesResponse = await notion.databases.query(
        recipesConfig.publishProp
          ? {
              database_id: RECIPES_DATABASE_ID,
              filter: {
                property: recipesConfig.publishProp,
                checkbox: { equals: true },
              },
            }
          : { database_id: RECIPES_DATABASE_ID },
      );

      console.log(`Found ${recipesResponse.results.length} published recipes`);
      
      const syncedRecipeSlugs = [];
      for (const page of recipesResponse.results) {
        const slug = await syncRecipe(page);
        if (slug) syncedRecipeSlugs.push(slug);
      }

      // Cleanup unpublished recipes
      await cleanupUnpublished(RECIPES_OUTPUT_DIR, syncedRecipeSlugs, 'recipes');
    }

    // Print sync report
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SYNC REPORT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('📝 Blog Posts:');
    console.log(`  ✅ Added: ${syncReport.posts.added.length}`);
    if (syncReport.posts.added.length > 0) {
      syncReport.posts.added.forEach(slug => console.log(`     - ${slug}`));
    }
    console.log(`  🔄 Updated: ${syncReport.posts.updated.length}`);
    if (syncReport.posts.updated.length > 0) {
      syncReport.posts.updated.forEach(slug => console.log(`     - ${slug}`));
    }
    console.log(`  ⏭️  Skipped: ${syncReport.posts.skipped.length}`);
    console.log(`  🗑️  Removed: ${syncReport.posts.removed.length}`);
    if (syncReport.posts.removed.length > 0) {
      syncReport.posts.removed.forEach(slug => console.log(`     - ${slug}`));
    }

    console.log('\n🍳 Recipes:');
    console.log(`  ✅ Added: ${syncReport.recipes.added.length}`);
    if (syncReport.recipes.added.length > 0) {
      syncReport.recipes.added.forEach(slug => console.log(`     - ${slug}`));
    }
    console.log(`  🔄 Updated: ${syncReport.recipes.updated.length}`);
    if (syncReport.recipes.updated.length > 0) {
      syncReport.recipes.updated.forEach(slug => console.log(`     - ${slug}`));
    }
    console.log(`  ⏭️  Skipped: ${syncReport.recipes.skipped.length}`);
    console.log(`  🗑️  Removed: ${syncReport.recipes.removed.length}`);
    if (syncReport.recipes.removed.length > 0) {
      syncReport.recipes.removed.forEach(slug => console.log(`     - ${slug}`));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const totalChanges = 
      syncReport.posts.added.length + 
      syncReport.posts.updated.length + 
      syncReport.posts.removed.length +
      syncReport.recipes.added.length + 
      syncReport.recipes.updated.length + 
      syncReport.recipes.removed.length;

    if (totalChanges === 0) {
      console.log('✨ No changes detected. Everything is up to date!');
      process.exit(0);
    } else {
      console.log(`✨ Sync complete! ${totalChanges} changes made.`);
      process.exit(0);
    }

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Run sync
sync();
