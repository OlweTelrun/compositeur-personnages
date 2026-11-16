// Générateur 2D : un clic = un personnage au style du jeu (via le générateur d'images). Aucune logique de rendu ici : on TIRE une recette (segments.js),
// on la décrit en anglais (description.js), et le générateur dessine. Visage, corps et tenue se retirent séparément ; l'image précédente sert de
// RÉFÉRENCE pour que le reste du personnage ne change pas.
import { SEGMENTS, genererLot } from './segments.js';
import { promptPersonnage, descriptionAspect, nomCouleur } from './description.js';

const $ = (id) => document.getElementById(id);
const ASPECTS = {
  visage: { cible: 'face (head shape, hair, facial features, expression, skin tone)', champs: ['traits', 'teint'] },
  corps: { cible: 'body build (weight, belly, shoulders, muscles, limb proportions); keep the face and the clothes exactly the same', champs: ['morphologie', 'macros.corpulence', 'macros.musculature', 'macros.proportions'] },
  tenue: { cible: 'clothes, shoes and accessories (and the gesture they imply); keep the face and the body exactly the same', champs: ['tenuePieces', 'chaussures', 'attitude', 'pose'] },
};
// Segments générables (ados est bloqué). Les groupes (couple, famille) sont dessinés en UNE image ; les boutons agissent sur la personne choisie.
const SEGMENTS_SEULS = Object.keys(SEGMENTS).filter((s) => !SEGMENTS[s].bloque);
const estGroupe = (seg) => !!SEGMENTS[seg].groupe;
const membresDe = (r) => r.membres ?? [r];

let courant = null;          // { recette, segment, id, url }
const historique = [];       // { recette, segment, id, url }
let occupe = false;

function lire(o, chemin) { return chemin.split('.').reduce((a, k) => a?.[k], o); }
function ecrire(o, chemin, v) { const ks = chemin.split('.'); const d = ks.pop(); ks.reduce((a, k) => (a[k] ??= {}), o)[d] = v; }
const PEAUX = { '#f3d2b3': 'claire', '#e8bc99': 'plutôt claire', '#d9a07a': 'claire dorée', '#c68b64': 'bronzée', '#a8704a': 'brune', '#8a5a3c': 'brun foncé', '#6b422b': 'très foncée' };
const sexe = (r) => ((r.macros?.silhouette ?? 0) < 0 ? 'f' : 'h');

/** Tire une recette complète au hasard pour le segment. */
function nouvelleRecette(segment, graine = Math.floor(Math.random() * 1e9)) {
  const { lot } = genererLot(segment, 1, graine);
  return lot.items[0];
}
/** Retire UN aspect d'UNE personne : on cherche une autre recette (même sexe, même catégorie enfant/adulte) et on n'en copie que les champs de l'aspect. */
function retirer(recette, segment, aspect, indice = 0) {
  const groupe = !!recette.membres;
  const cible = groupe ? recette.membres[indice] : recette;
  for (let essai = 0; essai < 80; essai++) {
    const r = nouvelleRecette(segment);
    const m = groupe ? r.membres?.[indice] : r;
    if (!m || sexe(m) !== sexe(cible) || !!m.enfant !== !!cible.enfant) continue;   // les tenues (jupe…) dépendent du sexe, les enfants des adultes
    const copie = structuredClone(recette);
    const dest = groupe ? copie.membres[indice] : copie;
    for (const c of ASPECTS[aspect].champs) ecrire(dest, c, structuredClone(lire(m, c)));
    if (JSON.stringify(ASPECTS[aspect].champs.map((c) => lire(dest, c))) !== JSON.stringify(ASPECTS[aspect].champs.map((c) => lire(cible, c)))) return copie;
  }
  return recette;
}
const POSITION = (i, n) => (n === 1 ? 'character' : i === 0 ? 'leftmost person' : i === n - 1 ? 'rightmost person' : `person number ${i + 1} from the left`);

function decrire(r) {
  const ms = membresDe(r), n = ms.length, pre = (i) => (n > 1 ? `${i + 1}. ` : '');
  const ligne = (f) => ms.map((m, i) => pre(i) + f(m)).join('\n');
  $('d-visage').textContent = ligne((m) => `${m.traits || 'visage sans trait particulier'} · peau ${PEAUX[m.teint] ?? m.teint}`);
  $('d-corps').textContent = ligne((m) => `${m.enfant ? 'enfant · ' : ''}${m.morphologie ?? '—'} · corpulence ${(m.macros?.corpulence ?? 0).toFixed(2)} · muscles ${(m.macros?.musculature ?? 0).toFixed(2)}`);
  $('d-tenue').textContent = ligne((m) => (m.tenuePieces ?? []).map((p) => `${p.piece.replace(/@\d+$/, '').replace(/^[a-z]+\./, '')} ${nomCouleur(p.couleurs.corps)}`).join(', ') + (m.attitude ? ` · ${m.attitude}` : ''));
}
function afficher(entree) {
  const sc = $('scene'); sc.innerHTML = '';
  if (!entree) { sc.innerHTML = '<div class="vide">Choisis un segment puis clique sur « Nouveau personnage ».</div>'; return; }
  const img = new Image(); img.alt = `Personnage ${entree.id}`; img.src = entree.url; sc.append(img);
  $('reel').src = entree.url; $('reel').hidden = false;
  decrire(entree.recette);
  majPersonnes(entree.recette);
  for (const b of ['b-visage', 'b-corps', 'b-tenue']) $(b).disabled = occupe;
  rendreHistorique();
}
function majPersonnes(r) {
  const n = membresDe(r).length, sel = $('personne'), ancien = sel.value;
  $('ligne-personne').hidden = n < 2;
  sel.innerHTML = '';
  for (let i = 0; i < n; i++) { const o = document.createElement('option'); o.value = i; o.textContent = `${i + 1}${i === 0 ? ' (à gauche)' : i === n - 1 ? ' (à droite)' : ''}${membresDe(r)[i].enfant ? ' · enfant' : ''}`; sel.append(o); }
  if (ancien && Number(ancien) < n) sel.value = ancien;
}
function rendreHistorique() {
  const h = $('histo'); h.innerHTML = '';
  for (const e of [...historique].reverse()) {
    const b = document.createElement('button'); b.type = 'button'; b.title = `Personnage ${e.id}`; b.setAttribute('aria-label', `Revenir au personnage ${e.id}`);
    if (courant && e.id === courant.id) b.setAttribute('aria-current', 'true');
    const i = new Image(); i.src = e.url; i.alt = ''; b.append(i);
    b.addEventListener('click', () => { courant = e; afficher(e); });
    h.append(b);
  }
}
function bloquer(v) {
  occupe = v;
  for (const b of ['b-tout', 'b-visage', 'b-corps', 'b-tenue']) $(b).disabled = v || (b !== 'b-tout' && !courant);
  const sc = $('scene'); sc.querySelector('.attente')?.remove();
  if (v) { const a = document.createElement('div'); a.className = 'attente'; a.textContent = 'Le générateur dessine… (10 à 40 s)'; sc.append(a); }
}

async function urlEnDataUrl(url) {
  const blob = await (await fetch(url)).blob();
  return await new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(blob); });
}

async function produire(recette, segment, { aspect = null, indice = 0 } = {}) {
  $('erreur').textContent = ''; bloquer(true);
  try {
    const S = SEGMENTS[segment];
    const base = promptPersonnage(recette, { libelle: S.libelle, segmentAnglais: S.segmentAnglais, look: S.look, groupeMot: S.groupeMot });
    let prompt = base, referenceId;
    if (aspect && courant) {
      // Retouche « seulement ça » : on ne redécrit PAS tout le monde (le générateur redessinerait tout) ; on décrit seulement le nouvel aspect de la personne visée.
      referenceId = courant.id;
      const n = recette.membres?.length ?? 1, cibleM = recette.membres ? recette.membres[indice] : recette;
      const qui = n > 1 ? `the ${POSITION(indice, n)}` : 'the character';
      const autres = n > 1 ? `the other ${n - 1 > 1 ? 'people' : 'person'} must stay exactly identical, pixel for pixel (same faces, hair, clothes, colours, shoes, poses), and so must ${qui}'s other features` : `everything else must stay exactly identical, pixel for pixel (same ${aspect === 'visage' ? 'body, clothes' : aspect === 'corps' ? 'face, hair, clothes' : 'face, hair, body'} and pose)`;
      prompt = `Edit the reference image, which shows ${n > 1 ? `${n} people standing side by side` : 'one character'}. Change ONLY the ${ASPECTS[aspect].cible.split(';')[0]} of ${qui}: ${descriptionAspect(cibleM, aspect)}. Do NOT change anything else: ${autres}. Same positions, same framing, same art style and rendering, transparent background.`;
    }
    const r = await fetch('/api/generer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt, referenceId, qualite: $('qualite').value, paysage: !!recette.membres }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erreur ?? `erreur ${r.status}`);
    const entree = { recette, segment, id: j.id, url: j.url };
    historique.push(entree); courant = entree;
    $('info').textContent = `Coût : ${j.cout ? j.cout.toFixed(3) + ' $' : 'n/c'}${j.demo ? ' (mode démo : image factice)' : ''}`;
    bloquer(false); afficher(entree);
  } catch (e) {
    $('erreur').textContent = /credits/i.test(e.message) ? `Le générateur est refusé : plus de crédits OpenRouter.\n${e.message}` : e.message;
    bloquer(false); if (courant) afficher(courant);
  }
}

for (const s of SEGMENTS_SEULS) { const o = document.createElement('option'); o.value = s; o.textContent = SEGMENTS[s].libelle + (estGroupe(s) ? ' (groupe)' : ''); $('segment').append(o); }
$('b-tout').addEventListener('click', () => { const seg = $('segment').value; courant = null; produire(nouvelleRecette(seg), seg); });
for (const a of Object.keys(ASPECTS)) $('b-' + a).addEventListener('click', () => { if (!courant) return; { const i = Number($('personne').value) || 0; produire(retirer(courant.recette, courant.segment, a, i), courant.segment, { aspect: a, indice: i }); } });
$('segment').addEventListener('change', () => { $('erreur').textContent = ''; });
