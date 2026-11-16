// Fabrique les textures de matière du compositeur à partir du moteur du projet voisin `materials` (../../materials).
// Les recettes de `materials` sont du JS pur (aucun DOM) : on les appelle ici sans navigateur, puis on écrit des PNG 256×256
// (albedo + normale) dans prototype/public/matieres/. Usage : node outils/matieres_depuis_materials.mjs
// Dépendance de voisinage assumée : ../materials doit rester à côté du compositeur.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const racineM = fileURLToPath(new URL('../../materials/public/', import.meta.url));
const sortie = fileURLToPath(new URL('../prototype/public/matieres/', import.meta.url));
const { buildMaps } = await import(join(racineM, 'engine/maps.js'));
const recettes = {
  fabric: (await import(join(racineM, 'recipes/fabric.js'))).default,
  leather: (await import(join(racineM, 'recipes/leather.js'))).default,
};

const N = 256;
// `teintable` : albedo gris clair multiplié par la couleur de la recette (le motif reste le relief du tissu).
// Sinon : motif imprimé gardé tel quel (la couleur de la recette est ignorée).
const NEUTRE = { color: '#c9c9c9', color2: '#e8e8e8', scratch: 0, dirt: 0 };
const MATIERES = [
  { id: 'tissu-denim', recette: 'fabric', variante: 'denim', params: { ...NEUTRE, wear: 0.3 }, teintable: true },
  { id: 'tissu-lin', recette: 'fabric', variante: 'linen', params: { ...NEUTRE }, teintable: true },
  { id: 'tissu-maille', recette: 'fabric', variante: 'knit', params: { color: '#d4d4d4', color2: '#d4d4d4', scratch: 0, dirt: 0 }, teintable: true },
  { id: 'tissu-tweed', recette: 'fabric', variante: 'tweed', params: { ...NEUTRE }, teintable: true },
  { id: 'cuir-grain', recette: 'leather', variante: 'pebble', params: { color: '#d2d2d2', under: '#ffffff', scratch: 0, dirt: 0, wear: 0.2 }, teintable: true },
  { id: 'tissu-vichy', recette: 'fabric', variante: 'gingham', params: { scratch: 0, dirt: 0 }, teintable: false },
  { id: 'tissu-rayures', recette: 'fabric', variante: 'stripes', params: { scratch: 0, dirt: 0 }, teintable: false },
  { id: 'tissu-tartan', recette: 'fabric', variante: 'tartan', params: { scratch: 0, dirt: 0 }, teintable: false },
];

// --- encodeur PNG minimal (RGBA 8 bits) ---
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const bloc = (type, data) => {
  const t = Buffer.from(type), l = Buffer.alloc(4), k = Buffer.alloc(4);
  l.writeUInt32BE(data.length); k.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, k]);
};
function png(rgba, n) {
  const brut = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) { brut[y * (n * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * n * 4, n * 4).copy(brut, y * (n * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloc('IHDR', ihdr), bloc('IDAT', deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
}

// Matière teintable : on ramène la luminosité moyenne à ~92 % pour que « albedo × couleur » reste proche de la couleur demandée
// (sans cela le gris de base assombrit toutes les teintes). Le contraste du tissage est conservé.
function eclaircir(rgba, n, cible = 0.92) {
  let somme = 0;
  for (let i = 0; i < n * n; i++) somme += (0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255;
  const k = cible / (somme / (n * n));
  for (let i = 0; i < n * n; i++) for (let c = 0; c < 3; c++) rgba[i * 4 + c] = Math.min(255, Math.round(rgba[i * 4 + c] * k));
}

mkdirSync(sortie, { recursive: true });
for (const m of MATIERES) {
  const r = recettes[m.recette];
  const v = r.variants.find((x) => x.id === m.variante);
  if (!v) throw new Error(`variante introuvable : ${m.recette}/${m.variante}`);
  // mêmes valeurs par défaut que defaultsFor() de materials/public/app.js
  const params = { seed: 7, scale: 4, wear: 0.3, scratch: 0.25, dirt: 0.25, normalStrength: 2, ...v.defaults, ...m.params, variant: v.id };
  const cartes = buildMaps(r.generate(N, params), N, { normalStrength: params.normalStrength });
  if (m.teintable) eclaircir(cartes.albedo, N);
  writeFileSync(join(sortie, `${m.id}.png`), png(cartes.albedo, N));
  writeFileSync(join(sortie, `${m.id}-n.png`), png(cartes.normal, N));
  console.log(`${m.id} ← ${m.recette}/${m.variante}${m.teintable ? ' (teintable)' : ' (imprimé)'}`);
}
