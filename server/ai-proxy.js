import http from 'node:http';
import https from 'node:https';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

const _require = createRequire(import.meta.url);
const Busboy = (await import('busboy')).default;
const { createClient } = await import('@supabase/supabase-js');

const CLIENT_DOCS_ROOT = process.env.CLIENT_DOCS_ROOT ?? '/home/admin/timesheet-data/client-docs';

const PORT = process.env.AI_PROXY_PORT ?? 3579;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? '';
const DEPLOY_TOKEN = process.env.DEPLOY_TOKEN ?? '';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const DEPLOY_ACTIONS = {
  deploy_dev: `sudo -u admin -H bash -lc '/home/admin/update-timesheet.sh'`,
  deploy_prod: `sudo -u admin -H bash -lc 'cd /home/admin/timesheet && ./deploy-prod.sh'`,
};

function runDeploy(action) {
  return new Promise((resolve, reject) => {
    const cmd = DEPLOY_ACTIONS[action];
    if (!cmd) return reject(new Error('Unknown action'));
    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

const PROMPTS = {
  correct_fr: "Corrige l'orthographe, la grammaire et la ponctuation du texte suivant en français. Retourne uniquement le texte corrigé, sans explication.",
  rewrite_fr: "Réécris le texte suivant dans un style professionnel en français, adapté à un rapport technique d'événement. Retourne uniquement le texte réécrit, sans explication.",
  translate_en: "Translate the following French text to professional English. Return only the translated text, no explanation.",
  polish_incident_fr: `Tu reçois un objet JSON représentant un incident dans un rapport technique d'événement en français. Améliore le style, l'orthographe, la grammaire et la ponctuation de chaque champ fourni. Retourne UNIQUEMENT un objet JSON valide avec exactement les mêmes clés, sans aucune explication ni texte supplémentaire.`,
  polish_incident_en: `You receive a JSON object representing an incident in a technical event report in English. Improve the style, spelling, grammar, and punctuation of each provided field. Return ONLY a valid JSON object with exactly the same keys, no explanation or extra text.`,
};

const SCREENSHOT_SYSTEM_PROMPT = `You are analyzing a network monitoring screenshot from an event report. Extract data for the LAST FULLY VISIBLE hour block shown in the graph — not a partial/cut-off hour, not an average.

Rules:
- Identify the last complete hour interval visible (e.g. "14:00" if the range shown ends at 15:00).
- Extract the download value (bandwidth out) and upload value (bandwidth in) for that hour only.
- Values are typically in GB or MB — include the unit if visible.
- If the hour label is ambiguous or not clearly readable, set "uncertain": true.
- If a value is not readable, set it to null.

Return ONLY a valid JSON object with this exact shape:
{
  "hour_label": "HH:MM or null",
  "bandwidth_out": <number in GB or null>,
  "bandwidth_in": <number in GB or null>,
  "uncertain": <true or false>
}

No explanation. No extra text. Just the JSON object.`;

function makeScreenshotForHourPrompt(targetHour) {
  return `You are analyzing a network monitoring screenshot from an event report. The user has selected the hour "${targetHour}" as the target. Extract values FOR THAT SPECIFIC HOUR ONLY.

Rules:
- The target hour is explicitly "${targetHour}". Do NOT pick a different hour.
- Extract the download value (bandwidth out) and upload value (bandwidth in) for that hour only.
- Values are typically in GB or MB. Convert to GB if needed (e.g. 512 MB = 0.512 GB). Return a plain number.
- If the graph is unclear or the target hour is not readable, set "uncertain": true and return null for values you cannot read.
- Do NOT invent values. If unsure, prefer null over a guess.
- wifi_users: if clearly visible as a labeled user count for that hour, include it as an integer; otherwise return null.

Return ONLY a valid JSON object with this exact shape:
{
  "hour_label": "${targetHour}",
  "bandwidth_out": <number in GB or null>,
  "bandwidth_in": <number in GB or null>,
  "wifi_users": <integer or null>,
  "uncertain": <true or false>
}

No explanation. No extra text. Just the JSON object.`;
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function text(res, status, str) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(str);
}

function addCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function callOpenAI(systemPrompt, userText) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 1024,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText.slice(0, 4000) },
      ],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`OpenAI error ${res.statusCode}: ${data}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content?.trim() ?? '');
          } catch {
            reject(new Error('Failed to parse OpenAI response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy(new Error('OpenAI request timed out'));
    });
    req.write(body);
    req.end();
  });
}

function callOpenAIVision(imageUrl) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SCREENSHOT_SYSTEM_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`OpenAI error ${res.statusCode}: ${data}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content?.trim() ?? '');
          } catch {
            reject(new Error('Failed to parse OpenAI response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('OpenAI vision request timed out'));
    });
    req.write(body);
    req.end();
  });
}

function callOpenAIVisionBase64(base64DataUri, targetHour) {
  const prompt = makeScreenshotForHourPrompt(targetHour);
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 512,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: base64DataUri, detail: 'high' } },
          ],
        },
      ],
    });

    const req = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`OpenAI error ${res.statusCode}: ${data}`));
          }
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.choices?.[0]?.message?.content?.trim() ?? '');
          } catch {
            reject(new Error('Failed to parse OpenAI response'));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error('OpenAI vision request timed out'));
    });
    req.write(body);
    req.end();
  });
}

// ─── Client Docs helpers ─────────────────────────────────────────────────────

function slugify(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function clientIdToSlug(clientId) {
  if (!clientId) return '';
  return clientId.replace(/-/g, '').slice(0, 12).toLowerCase();
}

function safeFilename(original) {
  const base = path.basename(original);
  return base.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 200) || 'file';
}

function resolveDocsPath(...parts) {
  const resolved = path.resolve(CLIENT_DOCS_ROOT, ...parts);
  if (!resolved.startsWith(path.resolve(CLIENT_DOCS_ROOT))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

function getTypeLabel(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') return 'PDF';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'].includes(ext)) return 'Image';
  if (['.doc', '.docx', '.odt', '.rtf', '.txt'].includes(ext)) return 'DOC';
  if (['.xls', '.xlsx', '.ods', '.csv'].includes(ext)) return 'XLSX';
  return 'Autre';
}

function getMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
  };
  return map[ext] || 'application/octet-stream';
}

function uniqueFilename(dir, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let candidate = filename;
  let counter = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${base}-${counter}${ext}`;
    counter++;
  }
  return candidate;
}

function parseQuery(url) {
  const u = new URL(url, 'http://localhost');
  return Object.fromEntries(u.searchParams.entries());
}

// ─── Metadata sidecar helpers ────────────────────────────────────────────────
// Metadata is stored in a hidden JSON sidecar: ._meta_<filename>.json
// It holds user-editable fields (title, category display name) without
// renaming the physical file or touching the directory structure.

function metaPath(fileDir, filename) {
  return path.join(fileDir, `._meta_${filename}.json`);
}

function readMeta(fileDir, filename) {
  const mp = metaPath(fileDir, filename);
  try {
    return JSON.parse(fs.readFileSync(mp, 'utf8'));
  } catch {
    return {};
  }
}

function writeMeta(fileDir, filename, meta) {
  fs.writeFileSync(metaPath(fileDir, filename), JSON.stringify(meta), 'utf8');
}

function deleteMeta(fileDir, filename) {
  try { fs.unlinkSync(metaPath(fileDir, filename)); } catch {}
}

function buildFileEntry(fileDir, filename, clientSlug, categorySlug) {
  const stat = fs.statSync(path.join(fileDir, filename));
  const meta = readMeta(fileDir, filename);
  const encodedName = encodeURIComponent(filename);
  const encodedClient = encodeURIComponent(clientSlug);
  const encodedCat = encodeURIComponent(categorySlug);
  return {
    name: filename,
    title: meta.title || filename,
    size: stat.size,
    modifiedAt: stat.mtime.toISOString(),
    type: getTypeLabel(filename),
    mime: getMime(filename),
    url: `/client-docs/file?client=${encodedClient}&category=${encodedCat}&name=${encodedName}`,
    downloadUrl: `/client-docs/download?client=${encodedClient}&category=${encodedCat}&name=${encodedName}`,
    clientSlug,
    categorySlug,
  };
}

// ─── Category helpers ─────────────────────────────────────────────────────────

// Read the canonical display name for a category directory.
// If a ._catname file exists (written on category creation), use it.
// Otherwise fall back to the slug itself.
function readCatDisplayName(clientSlug, catSlug) {
  const namePath = resolveDocsPath(clientSlug, catSlug, '._catname');
  try { return fs.readFileSync(namePath, 'utf8').trim(); } catch { return catSlug; }
}

function writeCatDisplayName(clientSlug, catSlug, displayName) {
  const namePath = resolveDocsPath(clientSlug, catSlug, '._catname');
  fs.writeFileSync(namePath, displayName, 'utf8');
}

// Find an existing category directory by case-insensitive display name or slug.
// Returns { slug, name } or null.
function findExistingCategory(clientDir, clientSlug, nameOrSlug) {
  if (!fs.existsSync(clientDir)) return null;
  const candidateSlug = slugify(nameOrSlug);
  const entries = fs.readdirSync(clientDir, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    // Exact slug match
    if (e.name === candidateSlug) {
      return { slug: e.name, name: readCatDisplayName(clientSlug, e.name) };
    }
    // Case-insensitive display name match
    const displayName = readCatDisplayName(clientSlug, e.name);
    if (displayName.toLowerCase() === nameOrSlug.trim().toLowerCase()) {
      return { slug: e.name, name: displayName };
    }
  }
  return null;
}

async function readBodyJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

async function handleClientDocs(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const pathname = u.pathname;
  const q = parseQuery(req.url);

  // ── GET /client-docs/clients ─────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/client-docs/clients') {
    try {
      if (!supabase) return json(res, 503, { error: 'Supabase not configured' });
      const { data: dbClients, error: err } = await supabase
        .from('doc_clients')
        .select('id, name')
        .order('name');
      if (err) throw err;
      const clients = (dbClients || []).map(c => ({
        id: c.id,
        name: c.name,
        slug: clientIdToSlug(c.id),
      }));
      return json(res, 200, clients);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── GET /client-docs/categories ──────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/client-docs/categories') {
    const { client } = q;
    if (!client) return json(res, 400, { error: 'client required' });
    try {
      const clientDir = resolveDocsPath(client);
      if (!fs.existsSync(clientDir)) return json(res, 200, []);
      const entries = fs.readdirSync(clientDir, { withFileTypes: true });
      const categories = entries
        .filter(e => e.isDirectory())
        .map(e => ({
          slug: e.name,
          name: readCatDisplayName(client, e.name),
          clientSlug: client,
        }));
      return json(res, 200, categories);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── GET /client-docs/list ────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/client-docs/list') {
    const { client, category } = q;
    if (!client || !category) return json(res, 400, { error: 'client and category required' });
    try {
      const catDir = resolveDocsPath(client, category);
      if (!fs.existsSync(catDir)) return json(res, 200, []);
      const entries = fs.readdirSync(catDir, { withFileTypes: true });
      const files = entries
        .filter(e => e.isFile() && !e.name.startsWith('._'))
        .map(e => buildFileEntry(catDir, e.name, client, category));
      return json(res, 200, files);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── POST /client-docs/category ───────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/client-docs/category') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const { clientSlug, categoryName } = JSON.parse(body);
        if (!clientSlug || !categoryName) return json(res, 400, { error: 'clientSlug and categoryName required' });

        const clientDir = resolveDocsPath(clientSlug);
        // Case-insensitive deduplication
        const existing = findExistingCategory(clientDir, clientSlug, categoryName);
        if (existing) {
          return json(res, 200, { slug: existing.slug, name: existing.name, clientSlug });
        }

        const catSlug = slugify(categoryName);
        const catDir = resolveDocsPath(clientSlug, catSlug);
        fs.mkdirSync(catDir, { recursive: true });
        // Persist the user-supplied display name (preserves original casing)
        writeCatDisplayName(clientSlug, catSlug, categoryName.trim());
        return json(res, 200, { slug: catSlug, name: categoryName.trim(), clientSlug });
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    });
    return;
  }

  // ── POST /client-docs/upload ─────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/client-docs/upload') {
    const bb = Busboy({ headers: req.headers, limits: { fileSize: 100 * 1024 * 1024 } });
    const fields = {};
    const uploads = [];
    const errors = [];

    bb.on('field', (name, val) => { fields[name] = val; });

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename } = info;

      const doUpload = () => {
        const clientSlug = fields.clientSlug;
        const categorySlug = fields.categorySlug;

        if (!clientSlug || !categorySlug) {
          fileStream.resume();
          errors.push(`Missing clientSlug or categorySlug for file ${filename}`);
          return;
        }

        try {
          const targetDir = resolveDocsPath(clientSlug, categorySlug);
          fs.mkdirSync(targetDir, { recursive: true });
          const safe = safeFilename(filename);
          const finalName = uniqueFilename(targetDir, safe);
          const filePath = path.join(targetDir, finalName);
          const writeStream = fs.createWriteStream(filePath);

          const p = new Promise((resolve, reject) => {
            fileStream.pipe(writeStream);
            writeStream.on('finish', () => {
              // title defaults to filename, stored in sidecar
              writeMeta(targetDir, finalName, { title: finalName });
              uploads.push(buildFileEntry(targetDir, finalName, clientSlug, categorySlug));
              resolve();
            });
            writeStream.on('error', reject);
            fileStream.on('error', reject);
          });
          uploads._promises = uploads._promises || [];
          uploads._promises.push(p);
        } catch (e) {
          fileStream.resume();
          errors.push(e.message);
        }
      };

      if (fields.clientSlug && fields.categorySlug) {
        doUpload();
      } else {
        setImmediate(doUpload);
      }
    });

    bb.on('finish', async () => {
      try {
        await Promise.all(uploads._promises || []);
        if (errors.length && uploads.length === 0) {
          return json(res, 400, { error: errors.join('; ') });
        }
        return json(res, 200, { uploaded: uploads, errors });
      } catch (e) {
        return json(res, 500, { error: e.message });
      }
    });

    bb.on('error', (e) => json(res, 500, { error: e.message }));
    req.pipe(bb);
    return;
  }

  // ── PATCH /client-docs/meta — edit title (and optionally move category) ──
  if (req.method === 'PATCH' && pathname === '/client-docs/meta') {
    try {
      const { clientSlug, categorySlug, filename, title, newCategoryName } = await readBodyJson(req);
      if (!clientSlug || !categorySlug || !filename) {
        return json(res, 400, { error: 'clientSlug, categorySlug, filename required' });
      }

      const srcDir = resolveDocsPath(clientSlug, categorySlug);
      const srcFile = path.join(srcDir, filename);
      if (!fs.existsSync(srcFile)) return json(res, 404, { error: 'File not found' });

      // Update title in sidecar
      const meta = readMeta(srcDir, filename);
      if (title !== undefined) meta.title = title.trim() || filename;

      let targetCategorySlug = categorySlug;

      if (newCategoryName && newCategoryName.trim()) {
        const clientDir = resolveDocsPath(clientSlug);
        // Find or create the target category (case-insensitive dedup)
        let targetCat = findExistingCategory(clientDir, clientSlug, newCategoryName);
        if (!targetCat) {
          const newSlug = slugify(newCategoryName);
          const newCatDir = resolveDocsPath(clientSlug, newSlug);
          fs.mkdirSync(newCatDir, { recursive: true });
          writeCatDisplayName(clientSlug, newSlug, newCategoryName.trim());
          targetCat = { slug: newSlug, name: newCategoryName.trim() };
        }

        if (targetCat.slug !== categorySlug) {
          // Move the physical file
          const dstDir = resolveDocsPath(clientSlug, targetCat.slug);
          const dstName = uniqueFilename(dstDir, filename);
          fs.renameSync(srcFile, path.join(dstDir, dstName));
          // Move sidecar
          deleteMeta(srcDir, filename);
          writeMeta(dstDir, dstName, { ...meta, title: meta.title || dstName });
          const entry = buildFileEntry(dstDir, dstName, clientSlug, targetCat.slug);
          return json(res, 200, { file: entry, movedTo: targetCat.slug });
        }
      }

      writeMeta(srcDir, filename, meta);
      const entry = buildFileEntry(srcDir, filename, clientSlug, targetCategorySlug);
      return json(res, 200, { file: entry });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── DELETE /client-docs/file ─────────────────────────────────────────────
  if (req.method === 'DELETE' && pathname === '/client-docs/file') {
    const { client, category, name } = q;
    if (!client || !category || !name) return json(res, 400, { error: 'client, category, name required' });
    try {
      const fileDir = resolveDocsPath(client, category);
      const filePath = path.join(fileDir, name);
      if (!fs.existsSync(filePath)) return json(res, 404, { error: 'File not found' });
      fs.unlinkSync(filePath);
      deleteMeta(fileDir, name);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
  }

  // ── GET /client-docs/file  +  /client-docs/download ─────────────────────
  if (req.method === 'GET' && (pathname === '/client-docs/file' || pathname === '/client-docs/download')) {
    const { client, category, name } = q;
    if (!client || !category || !name) return json(res, 400, { error: 'client, category, name required' });
    try {
      const filePath = resolveDocsPath(client, category, name);
      if (!fs.existsSync(filePath)) return json(res, 404, { error: 'File not found' });
      const stat = fs.statSync(filePath);
      const mime = getMime(name);
      const headers = {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Cache-Control': 'private, max-age=3600',
      };
      if (pathname === '/client-docs/download') {
        headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(name)}"`;
      } else {
        headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(name)}"`;
      }
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    } catch (e) {
      return json(res, 500, { error: e.message });
    }
    return;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  addCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const u = new URL(req.url, 'http://localhost');
  if (u.pathname.startsWith('/client-docs/')) {
    const handled = await handleClientDocs(req, res);
    if (handled !== null) return;
  }

  if (req.method === 'POST' && (u.pathname === '/deploy/dev' || u.pathname === '/deploy/prod')) {
    const token = req.headers['x-deploy-token'];
    if (!DEPLOY_TOKEN || token !== DEPLOY_TOKEN) {
      return json(res, 403, { error: 'Forbidden' });
    }
    const action = u.pathname === '/deploy/dev' ? 'deploy_dev' : 'deploy_prod';
    try {
      const output = await runDeploy(action);
      return json(res, 200, { ok: true, output });
    } catch (e) {
      return json(res, 500, { error: e instanceof Error ? e.message : 'Deploy failed' });
    }
  }

  if (req.method !== 'POST' || u.pathname !== '/ai-assist') {
    return text(res, 404, 'Not found');
  }

  if (!OPENAI_API_KEY) {
    return text(res, 500, 'OPENAI_API_KEY not set');
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return text(res, 400, 'Invalid JSON');
    }

    const { text: inputText, action, imageUrl, base64Image, targetHour } = parsed;

    if (action === 'analyze_screenshot_for_hour') {
      if (!base64Image?.trim()) return text(res, 400, 'base64Image is required');
      if (!targetHour?.trim()) return text(res, 400, 'targetHour is required');
      try {
        const result = await callOpenAIVisionBase64(base64Image, targetHour);
        const stripped = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return json(res, 200, JSON.parse(stripped));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return text(res, 502, msg);
      }
    }

    if (action === 'analyze_screenshot') {
      if (!imageUrl?.trim()) return text(res, 400, 'imageUrl is required');
      try {
        const result = await callOpenAIVision(imageUrl);
        const stripped = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return json(res, 200, JSON.parse(stripped));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return text(res, 502, msg);
      }
    }

    if (!inputText?.trim()) return text(res, 400, 'text is required');

    const systemPrompt = PROMPTS[action];
    if (!systemPrompt) return text(res, 400, 'invalid action');

    const isJsonAction = action === 'polish_incident_fr' || action === 'polish_incident_en';

    try {
      const result = await callOpenAI(systemPrompt, inputText);
      if (isJsonAction) {
        const stripped = result.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
        return json(res, 200, JSON.parse(stripped));
      }
      return text(res, 200, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      return text(res, 502, msg);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI proxy listening on http://0.0.0.0:${PORT}`);
});
