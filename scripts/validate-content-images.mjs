import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';

const projectRoot = process.cwd();
const contentRoot = path.join(projectRoot, 'src', 'content');
const publicImagesRoot = path.join(projectRoot, 'public', 'images');

function isRemoteUrl(url) {
	return /^(https?:)?\/\//i.test(url) || url.startsWith('data:');
}

function normalizeUrl(raw) {
	let url = raw.trim();
	if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
		url = url.slice(1, -1).trim();
	}
	if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1).trim();
	return url;
}

function validateUrl({ filePath, url, failures }) {
	const normalized = normalizeUrl(url);
	if (!normalized) return;
	if (isRemoteUrl(normalized)) return;
	
	if (normalized.startsWith('./') || normalized.startsWith('../')) {
		failures.push({
			filePath,
			message: `Relative image path not allowed: ${normalized}. Use /images/<filename> and upload via Decap media library.`,
		});
		return;
	}

	if (normalized.startsWith('/images/')) {
		const rel = normalized.replace(/^\/images\//, '');
		const diskPath = path.join(publicImagesRoot, rel);
		return fs
			.access(diskPath)
			.catch(() => {
				failures.push({
					filePath,
					message: `Missing image file for ${normalized}. Expected at public/images/${rel}.`,
				});
			});
	}
}

async function* walk(dir) {
	for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			yield* walk(fullPath);
			continue;
		}
		if (entry.isFile() && (fullPath.endsWith('.md') || fullPath.endsWith('.mdx'))) {
			yield fullPath;
		}
	}
}

function extractMarkdownImageUrls(markdown) {
	// Avoid false positives from Markdown examples.
	const withoutFences = markdown.replace(/(^|\n)(```|~~~)[\s\S]*?\n\2\n?/g, '$1');
	const urls = [];
	// Markdown images: ![alt](url "title")
	const mdImg = /!\[[^\]]*\]\(([^)]+)\)/g;
	for (const match of withoutFences.matchAll(mdImg)) {
		const inside = match[1] ?? '';
		// Take first token as URL; allow URLs with spaces if wrapped in <>
		const token = inside.trim().startsWith('<') ? inside.trim() : inside.trim().split(/\s+/)[0] ?? '';
		urls.push(token);
	}
	// HTML images: <img ... src="..."> or src='...'
	const htmlImg = /<img\b[^>]*\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>/gi;
	for (const match of withoutFences.matchAll(htmlImg)) {
		urls.push(match[1] ?? '');
	}
	return urls;
}

function extractFrontmatterImageUrls(data) {
	const urls = [];
	const maybePush = (value) => {
		if (typeof value === 'string') urls.push(value);
	};

	if (data && typeof data === 'object') {
		maybePush(data.image);
		if (data.heroImage && typeof data.heroImage === 'object') maybePush(data.heroImage.src);
		if (data.coverImage && typeof data.coverImage === 'object') maybePush(data.coverImage.src);
	}

	return urls;
}

async function main() {
	const failures = [];
	const pending = [];

	for await (const filePath of walk(contentRoot)) {
		const raw = await fs.readFile(filePath, 'utf8');
		const parsed = matter(raw);

		for (const url of extractFrontmatterImageUrls(parsed.data)) {
			pending.push(validateUrl({ filePath, url, failures }));
		}

		for (const url of extractMarkdownImageUrls(parsed.content)) {
			pending.push(validateUrl({ filePath, url, failures }));
		}
	}

	await Promise.all(pending);

	if (failures.length) {
		const rel = (p) => path.relative(projectRoot, p);
		console.error('\nContent image validation failed:\n');
		for (const f of failures) {
			console.error(`- ${rel(f.filePath)}: ${f.message}`);
		}
		console.error('\nFix: upload images in Decap (media library) and reference them as /images/<filename>.');
		process.exit(1);
	}

	console.log('Content image validation passed.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
