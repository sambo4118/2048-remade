const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const HOST = '0.0.0.0';
const SCOREBOARD_DIR = path.join(__dirname, '..', '..', 'data', 'scoreboards');
const DEFAULT_MAX_ENTRIES = 10;
const MAX_STORED_ENTRIES = 100;

if (!fs.existsSync(SCOREBOARD_DIR)) {
  fs.mkdirSync(SCOREBOARD_DIR, { recursive: true });
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function isValidGameId(gameId) {
  return typeof gameId === 'string' && /^[a-z0-9-]{1,64}$/i.test(gameId);
}

function getScoreboardFilePath(gameId) {
  return path.join(SCOREBOARD_DIR, `${gameId}.json`);
}

function readScoreboard(gameId) {
  const filePath = getScoreboardFilePath(gameId);
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeScoreboard(gameId, entries) {
  const filePath = getScoreboardFilePath(gameId);
  fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
}

function normalizeLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, MAX_STORED_ENTRIES);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function parseJsonBody(req, callback) {
  let body = '';

  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 2048) {
      callback(new Error('Body too large'));
      req.socket.destroy();
    }
  });

  req.on('end', () => {
    if (!body) {
      callback(null, {});
      return;
    }

    try {
      callback(null, JSON.parse(body));
    } catch {
      callback(new Error('Invalid JSON'));
    }
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const leaderboardMatch = pathname.match(/^\/api\/games\/([^/]+)\/leaderboard$/);
  if (leaderboardMatch) {
    const gameId = decodeURIComponent(leaderboardMatch[1]);
    if (!isValidGameId(gameId)) {
      sendJson(res, 400, { error: 'Invalid game id' });
      return;
    }

    if (req.method === 'GET') {
      const limit = normalizeLimit(url.searchParams.get('limit') || url.searchParams.get('max'), DEFAULT_MAX_ENTRIES);
      const entries = readScoreboard(gameId)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      sendJson(res, 200, { gameId, leaderboard: entries });
      return;
    }

    if (req.method === 'POST') {
      parseJsonBody(req, (error, payload) => {
        if (error) {
          sendJson(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        const body = payload || {};
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const score = body.score;

        if (!name || name.length > 24) {
          sendJson(res, 400, { error: 'Invalid name' });
          return;
        }

        if (!Number.isInteger(score) || score < 0 || score > 999999999) {
          sendJson(res, 400, { error: 'Invalid score' });
          return;
        }

        const nextEntry = {
          name: name.toUpperCase(),
          score,
          createdAt: new Date().toISOString()
        };

        const entries = readScoreboard(gameId);
        entries.push(nextEntry);
        entries.sort((a, b) => b.score - a.score);
        entries.splice(MAX_STORED_ENTRIES);
        writeScoreboard(gameId, entries);

        sendJson(res, 200, {
          ok: true,
          gameId,
          leaderboard: entries.slice(0, DEFAULT_MAX_ENTRIES)
        });
      });
      return;
    }

    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requestedPath).replace(/^\.\.(\/|\\|$)+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }

      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Internal server error');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
