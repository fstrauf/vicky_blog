import crypto from 'node:crypto';

function base64UrlEncode(input) {
	return Buffer.from(input)
		.toString('base64')
		.replace(/=/g, '')
		.replace(/\+/g, '-')
		.replace(/\//g, '_');
}

function signState(statePayload, secret) {
	return crypto.createHmac('sha256', secret).update(statePayload).digest('hex');
}

export default function handler(req, res) {
	if (req.method !== 'GET') {
		res.statusCode = 405;
		res.setHeader('Allow', 'GET');
		return res.end('Method Not Allowed');
	}

	const githubClientId = process.env.GITHUB_CLIENT_ID;
	const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
	if (!githubClientId || !githubClientSecret) {
		res.statusCode = 500;
		return res.end('Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
	}

	const proto = req.headers['x-forwarded-proto'] ?? 'https';
	const host = req.headers['x-forwarded-host'] ?? req.headers.host;
	const baseUrl = `${proto}://${host}`;
	const callbackUrl = `${baseUrl}/api/callback`;

	const originCandidate =
		(req.query?.origin && String(req.query.origin)) ||
		(req.query?.site && String(req.query.site)) ||
		(req.headers.referer && String(req.headers.referer)) ||
		process.env.SITE ||
		baseUrl;

	let origin;
	try {
		origin = new URL(originCandidate).origin;
	} catch {
		origin = baseUrl;
	}

	const stateSecret = process.env.OAUTH_STATE_SECRET || githubClientSecret;
	const statePayload = base64UrlEncode(
		JSON.stringify({ origin, nonce: crypto.randomBytes(16).toString('hex') }),
	);
	const signature = signState(statePayload, stateSecret);
	const state = `${statePayload}.${signature}`;

	const scope = process.env.GITHUB_OAUTH_SCOPE || 'repo';
	const authorizeUrl = new URL('https://github.com/login/oauth/authorize');
	authorizeUrl.searchParams.set('client_id', githubClientId);
	authorizeUrl.searchParams.set('redirect_uri', callbackUrl);
	authorizeUrl.searchParams.set('scope', scope);
	authorizeUrl.searchParams.set('state', state);

	res.statusCode = 302;
	res.setHeader('Location', authorizeUrl.toString());
	return res.end();
}
