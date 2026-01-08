import crypto from 'node:crypto';

function base64UrlDecodeToString(input) {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
	return Buffer.from(padded, 'base64').toString('utf8');
}

function signState(statePayload, secret) {
	return crypto.createHmac('sha256', secret).update(statePayload).digest('hex');
}

function htmlResponse({ status, origin, messageType, payload }) {
	const safeOrigin = origin ? JSON.stringify(origin) : '"*"';
	const msg = `${messageType}:${JSON.stringify(payload ?? {})}`;
	return {
		status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
		body: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /></head>
  <body>
    <script>
      (function () {
        try {
          var origin = ${safeOrigin};
          var msg = ${JSON.stringify(msg)};
          if (window.opener) {
            window.opener.postMessage(msg, origin);
          }
        } finally {
          window.close();
        }
      })();
    </script>
  </body>
</html>`,
	};
}

export default async function handler(req, res) {
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

	const code = req.query?.code ? String(req.query.code) : '';
	const state = req.query?.state ? String(req.query.state) : '';

	let origin = process.env.SITE || 'https://vicky-blog-ochre.vercel.app';
	try {
		if (state) {
			const [payload, signature] = state.split('.');
			const stateSecret = process.env.OAUTH_STATE_SECRET || githubClientSecret;
			if (!payload || !signature || signState(payload, stateSecret) !== signature) {
				const response = htmlResponse({
					status: 400,
					origin,
					messageType: 'authorization:github:error',
					payload: { error: 'Invalid state' },
				});
				res.writeHead(response.status, response.headers);
				return res.end(response.body);
			}
			const decoded = JSON.parse(base64UrlDecodeToString(payload));
			if (decoded?.origin) origin = decoded.origin;
		}
	} catch {
		// ignore and keep default origin
	}

	if (!code) {
		const response = htmlResponse({
			status: 400,
			origin,
			messageType: 'authorization:github:error',
			payload: { error: 'Missing code' },
		});
		res.writeHead(response.status, response.headers);
		return res.end(response.body);
	}

	try {
		const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				client_id: githubClientId,
				client_secret: githubClientSecret,
				code,
			}),
		});
		const tokenJson = await tokenRes.json();

		if (!tokenRes.ok || !tokenJson?.access_token) {
			const response = htmlResponse({
				status: 400,
				origin,
				messageType: 'authorization:github:error',
				payload: { error: tokenJson?.error || 'Token exchange failed' },
			});
			res.writeHead(response.status, response.headers);
			return res.end(response.body);
		}

		const response = htmlResponse({
			status: 200,
			origin,
			messageType: 'authorization:github:success',
			payload: { token: tokenJson.access_token },
		});
		res.writeHead(response.status, response.headers);
		return res.end(response.body);
	} catch (e) {
		const response = htmlResponse({
			status: 500,
			origin,
			messageType: 'authorization:github:error',
			payload: { error: e?.message || 'Unexpected error' },
		});
		res.writeHead(response.status, response.headers);
		return res.end(response.body);
	}
}
