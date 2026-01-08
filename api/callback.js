function callbackScriptResponse(status, payload) {
	return {
		status: 200,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
		body: `<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Authorizing Decap…</title>
	</head>
	<body>
		<p>Authorizing Decap…</p>
		<script>
			(function () {
				var status = ${JSON.stringify(status)};
				var payload = ${JSON.stringify(payload ?? {})};
				var post = function (msg) {
					try {
						if (window.opener) window.opener.postMessage(msg, '*');
					} catch (e) {
						// ignore
					}
				};

				var receiveMessage = function () {
					post('authorization:github:' + status + ':' + JSON.stringify(payload));
					window.removeEventListener('message', receiveMessage, false);
					window.close();
				};

				window.addEventListener('message', receiveMessage, false);
				post('authorizing:github');
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

	const proto = req.headers['x-forwarded-proto'] ?? 'https';
	const host = req.headers['x-forwarded-host'] ?? req.headers.host;
	const baseUrl = `${proto}://${host}`;
	const callbackUrl = `${baseUrl}/api/callback`;

	if (!code) {
		const response = callbackScriptResponse('error', { error: 'Missing code' });
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
				redirect_uri: callbackUrl,
			}),
		});
		const tokenJson = await tokenRes.json();

		if (!tokenRes.ok || !tokenJson?.access_token) {
			const response = callbackScriptResponse('error', {
				error: tokenJson?.error || 'Token exchange failed',
			});
			res.writeHead(response.status, response.headers);
			return res.end(response.body);
		}

		const response = callbackScriptResponse('success', { token: tokenJson.access_token });
		res.writeHead(response.status, response.headers);
		return res.end(response.body);
	} catch (e) {
		const response = callbackScriptResponse('error', { error: e?.message || 'Unexpected error' });
		res.writeHead(response.status, response.headers);
		return res.end(response.body);
	}
}
