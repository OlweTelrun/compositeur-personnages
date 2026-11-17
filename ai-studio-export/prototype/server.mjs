// Serveur statique minimal. Le port vient du registre (demarrerServer/projects.json → env PORT).
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cheminSortie } from './public/js/export.js';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const sortieDir = join(fileURLToPath(new URL('.', import.meta.url)), 'sortie');
const jeuDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', 'BeachlifeLike', 'prototype', 'public', 'assets', 'personnages'); // lecture seule
const port = Number(process.env.PORT) || 3000;
const GENERATEUR = process.env.GENERATEUR_URL ?? 'http://127.0.0.1:4319'; // générateur d'images (régie : id « image »)
const cadrer = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'outils', 'cadrer_sprites.py');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary' };

createServer(async (req, res) => {
  // Export de sprites : POST /api/export/<segment>/<n>.png → sortie/<segment>/<n>.png (PNG ≤ 1 Mo, nom contrôlé).
  const m = req.method === 'POST' && /^\/api\/export\/([^/]+)\/(\d+|feuille)\.png$/.exec(new URL(req.url, 'http://x').pathname);
  if (m) {
    const rel = m[2] === 'feuille' ? (cheminSortie(m[1], 0) && `${m[1]}/feuille.png`) : cheminSortie(m[1], m[2]); // feuille.png = planche d'animation
    if (!rel) { res.writeHead(400).end('nom hors contrat'); return; }
    const morceaux = []; let taille = 0;
    for await (const c of req) { taille += c.length; if (taille > 1_000_000) { res.writeHead(413).end('trop gros'); return; } morceaux.push(c); }
    const png = Buffer.concat(morceaux);
    if (png.length < 8 || !png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) { res.writeHead(400).end('pas un PNG'); return; }
    const dest = join(sortieDir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, png);
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ecrit: rel }));
    return;
  }
  // Générateur 2D : POST /api/generer {prompt, reference?, qualite?} → générateur d'images (:4319) → sprite 256×256 cadré comme ceux du jeu → sortie/generateur/<id>.png.
  if (req.method === 'POST' && new URL(req.url, 'http://x').pathname === '/api/generer') {
    const morceaux = []; let taille = 0;
    for await (const c of req) { taille += c.length; if (taille > 8_000_000) { res.writeHead(413).end('trop gros'); return; } morceaux.push(c); }
    let b; try { b = JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch { res.writeHead(400).end('pas du JSON'); return; }
    if (typeof b.prompt !== 'string' || !b.prompt.trim() || b.prompt.length > 4000) { res.writeHead(400).end('prompt invalide'); return; }
    const qualite = ['low', 'medium', 'high'].includes(b.qualite) ? b.qualite : 'medium';
    // Référence : de préférence le brut (haute résolution) du sprite précédent, retrouvé par son numéro ; sinon une data URL envoyée par la page.
    let reference = [];
    if (Number.isInteger(b.referenceId) && b.referenceId > 0) {
      try { reference = ['data:image/png;base64,' + (await readFile(join(sortieDir, 'generateur', 'brut', `${b.referenceId}.png`))).toString('base64')]; } catch { /* repli : pas de référence */ }
    } else if (typeof b.reference === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(b.reference)) reference = [b.reference];
    const paysage = b.paysage === true;   // groupes : image large
    try {
      const r = await fetch(`${GENERATEUR}/api/generate`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(170_000),
        body: JSON.stringify({ prompt: b.prompt, aspectRatio: paysage ? '4:3' : '2:3', referenceImages: reference, openai: { size: paysage ? '1536x1024' : '1024x1536', quality: qualite, background: 'transparent', outputFormat: 'png' } }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ erreur: j.error ?? `générateur : HTTP ${r.status}` })); return; }
      const m64 = /^data:image\/\w+;base64,(.+)$/.exec(j.images?.[0] ?? '');
      if (!m64) { res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ erreur: 'le générateur n\'a pas rendu d\'image' })); return; }
      const dossier = join(sortieDir, 'generateur'); await mkdir(join(dossier, 'brut'), { recursive: true });
      const existants = (await readdir(dossier)).map((f) => parseInt(f)).filter(Number.isFinite);
      const id = (existants.length ? Math.max(...existants) : 0) + 1;
      const brut = join(dossier, 'brut', `${id}.png`); await writeFile(brut, Buffer.from(m64[1], 'base64'));
      await promisify(execFile)('python3', [cadrer, 'generateur', `${id}=${brut}`]);
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ id, url: `/sortie/generateur/${id}.png`, cout: j.cost ?? 0, demo: !!j.demo }));
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ erreur: `générateur injoignable ou trop lent : ${e.message}` }));
    }
    return;
  }
  // Lecture des sprites produits par le générateur 2D : GET /sortie/generateur/<n>.png
  const sg = req.method === 'GET' && /^\/sortie\/generateur\/(\d{1,6})\.png$/.exec(new URL(req.url, 'http://x').pathname);
  if (sg) {
    try { res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }).end(await readFile(join(sortieDir, 'generateur', `${Number(sg[1])}.png`))); }
    catch { res.writeHead(404).end('introuvable'); }
    return;
  }
  // Lecture seule des sprites du jeu pour comparaison : GET /api/jeu/<segment>/<n>.png → BeachlifeLike/…/assets/personnages/<segment>/<n>.png.
  const gj = req.method === 'GET' && /^\/api\/jeu\/([a-z][a-z0-9-]{0,29})\/(\d{1,3})\.png$/.exec(new URL(req.url, 'http://x').pathname);
  if (gj) {
    try {
      const png = await readFile(join(jeuDir, gj[1], `${Number(gj[2])}.png`));
      res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' }).end(png);
    } catch { res.writeHead(404).end('introuvable'); }
    return;
  }
  // Manifeste ou atlas d'animation : POST /api/export/<segment>/(manifeste|atlas).json → sortie/<segment>/… (JSON ≤ 100 Ko).
  const mj = req.method === 'POST' && /^\/api\/export\/([a-z][a-z0-9-]{0,29})\/(manifeste|atlas)\.json$/.exec(new URL(req.url, 'http://x').pathname);
  if (mj) {
    const morceaux = []; let taille = 0;
    for await (const c of req) { taille += c.length; if (taille > 100_000) { res.writeHead(413).end('trop gros'); return; } morceaux.push(c); }
    try { JSON.parse(Buffer.concat(morceaux).toString('utf8')); } catch { res.writeHead(400).end('pas du JSON'); return; }
    const dest = join(sortieDir, mj[1], `${mj[2]}.json`);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, Buffer.concat(morceaux));
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ecrit: `${mj[1]}/${mj[2]}.json` }));
    return;
  }
  const chemin = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const fichier = join(racine, chemin === '/' ? 'index.html' : chemin);
  if (!fichier.startsWith(racine)) { res.writeHead(403).end(); return; }
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': types[extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(corps);
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(port, '0.0.0.0', () => console.log(`compositeur : http://0.0.0.0:${port}`));
