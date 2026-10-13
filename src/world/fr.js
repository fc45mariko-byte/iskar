// Libellés français pour les attributs d'apparence et les événements de vie.

export const FR = {
  skin: {
    'very-light': 'Ivoire très clair / beige pâle',
    light: 'Beige clair / brun pêche',
    'light-olive': 'Olive clair / beige doré',
    medium: 'Beige moyen / miel / caramel',
    'medium-brown': 'Brun moyen / châtaigne chaud',
    deep: 'Brun profond / terre d’ombre / brun très foncé',
  },
  skinShort: { 'very-light': 'Très clair', light: 'Clair', 'light-olive': 'Olive clair', medium: 'Moyen', 'medium-brown': 'Brun moyen', deep: 'Profond' },
  undertone: { 'warm-golden': 'doré chaud', neutral: 'neutre', cool: 'froid', olive: 'olive', 'reddish-brown': 'brun rougeâtre' },
  texture: { straight: 'raides', wavy: 'ondulés', curly: 'bouclés', coily: 'frisés', 'tightly-coiled': 'crépus' },
  hairColor: { black: 'noirs', 'dark-brown': 'brun foncé', brown: 'bruns', chestnut: 'châtains', auburn: 'auburn', red: 'roux', 'dark-blonde': 'blond foncé', blonde: 'blonds', 'ash-blonde': 'blond cendré' },
  eyeColor: { 'dark-brown': 'brun foncé', brown: 'bruns', amber: 'ambre', hazel: 'noisette', green: 'verts', grey: 'gris', blue: 'bleus' },
  lid: { monolid: 'paupière sans pli', hooded: 'paupière tombante', double: 'double paupière', 'deep-set': 'yeux enfoncés' },
  face: { oval: 'ovale', round: 'rond', square: 'carré', heart: 'en cœur', long: 'allongé', diamond: 'en losange' },
  build: { slight: 'menue', lean: 'mince', average: 'moyenne', sturdy: 'robuste', broad: 'large', heavy: 'forte' },
  style: { shaved: 'rasés', 'close-crop': 'coupés ras', short: 'courts', shoulder: 'mi-longs', long: 'longs', bun: 'en chignon', topknot: 'en toupet noué', braids: 'en tresses', locs: 'en locks', afro: 'en afro', twists: 'en vanilles', headwrap: 'sous un foulard' },
  facialHair: { none: 'aucune', stubble: 'barbe de quelques jours', moustache: 'moustache', 'short-beard': 'barbe courte', 'full-beard': 'barbe fournie' },
  event: { scar: 'Cicatrice', haircut: 'Nouvelle coiffure', 'facial-hair': 'Pilosité faciale', tattoo: 'Tatouage', 'eye-injury': 'Blessure à l’œil', 'weight-change': 'Changement de poids', spectacles: 'Porte des lunettes' },
  side: { left: 'gauche', right: 'droite' },
  location: { cheek: 'joue', brow: 'sourcil', chin: 'menton', forehead: 'front' },
  presentation: { feminine: 'femme', masculine: 'homme', androgynous: 'personne androgyne' },
};

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
export const monthName = (m) => MONTHS[m];
export const monthShort = (m) => MONTHS_SHORT[m];

/** French elision: « de Orane » → « d’Orane ». */
export const de = (name) => (/^[aeiouyàâéèêëîïôûüœh]/i.test(name) ? `d’${name}` : `de ${name}`);

export const fmtInt = (n) => Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ');
export const fmtNum = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const fmtPct = (n, signed = true) => `${signed && n > 0 ? '+' : ''}${Math.round(n)} %`;
