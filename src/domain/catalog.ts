/**
 * Labels and icons (Lucide, Halo « Icônes ») of the categories of tasks, shopping aisles, goals and habits, and the
 * guess of the aisle from an item's name.
 */
import {
  Apple,
  BookOpen,
  Brain,
  CalendarClock,
  CookingPot,
  Croissant,
  CupSoda,
  Droplets,
  Dumbbell,
  FileText,
  Fish,
  Footprints,
  Heart,
  House,
  ListTodo,
  Leaf,
  Milk,
  MoonStar,
  Mountain,
  PersonStanding,
  Pill,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Snowflake,
  Sparkles,
  SprayCan,
  Sprout,
  Sun,
  Target,
  Trophy,
  Wallet,
  WashingMachine,
  Wheat,
  Bath,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryId, GoalIcon, GoalSource, HabitIcon, RayonId } from './types';
import { normalize } from '../lib/format';

export const CATEGORIES: Record<CategoryId, { label: string; icon: LucideIcon }> = {
  perso: { label: 'Perso', icon: ListTodo },
  sport: { label: 'Salle de sport', icon: Dumbbell },
  running: { label: 'Running', icon: Footprints },
  menage: { label: 'Ménage', icon: Sparkles },
  courses: { label: 'Courses', icon: ShoppingCart },
  lessive: { label: 'Lessive', icon: WashingMachine },
  cuisine: { label: 'Cuisine', icon: CookingPot },
  admin: { label: 'Papiers', icon: FileText },
  rdv: { label: 'Rendez-vous', icon: CalendarClock },
  bienetre: { label: 'Bien-être', icon: Leaf },
};

export const CATEGORY_ORDER: CategoryId[] = ['sport', 'running', 'menage', 'courses', 'lessive', 'cuisine', 'admin', 'rdv', 'bienetre', 'perso'];

const CATEGORY_WORDS: [CategoryId, string[]][] = [
  ['sport', ['salle', 'muscu', 'seance', 'push', 'pull', 'jambes', 'crossfit', 'gym', 'fitness']],
  ['running', ['courir', 'course a pied', 'footing', 'run', 'jogging', 'fractionne', 'sortie longue', 'trail']],
  ['courses', ['courses', 'supermarche', 'marche', 'drive', 'acheter']],
  ['menage', ['menage', 'aspirateur', 'serpillere', 'poussiere', 'ranger', 'nettoyer', 'vitres', 'salle de bain', 'frigo']],
  ['lessive', ['lessive', 'linge', 'machine', 'repassage', 'draps', 'etendre']],
  ['cuisine', ['cuisine', 'cuisiner', 'batch', 'repas', 'recette', 'diner', 'meal prep']],
  ['admin', ['papier', 'impot', 'banque', 'facture', 'loyer', 'budget', 'mutuelle', 'caf', 'mail', 'administratif', 'payer']],
  ['rdv', ['rdv', 'rendez-vous', 'medecin', 'dentiste', 'kine', 'coiffeur', 'reunion', 'anniversaire', 'diner chez']],
  ['bienetre', ['meditation', 'mediter', 'lecture', 'lire', 'yoga', 'sieste', 'balade', 'promenade', 'bain', 'etirement']],
];

/** Category guessed from a task title typed quickly (« Aspirateur salon » → Ménage). */
export function guessCategory(title: string): CategoryId {
  const n = normalize(title);
  for (const [cat, words] of CATEGORY_WORDS) if (words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(n))) return cat;
  return 'perso';
}

/** Aisles in the order of a walk through the shop. */
export const RAYONS: Record<RayonId, { label: string; icon: LucideIcon }> = {
  fruits: { label: 'Fruits et légumes', icon: Apple },
  boulangerie: { label: 'Boulangerie', icon: Croissant },
  frais: { label: 'Frais', icon: Milk },
  viandes: { label: 'Viandes et poissons', icon: Fish },
  epicerie: { label: 'Épicerie', icon: Wheat },
  surgeles: { label: 'Surgelés', icon: Snowflake },
  boissons: { label: 'Boissons', icon: CupSoda },
  hygiene: { label: 'Hygiène', icon: Bath },
  maison: { label: 'Maison', icon: SprayCan },
  autre: { label: 'Autre', icon: ShoppingBasket },
};

export const RAYON_ORDER: RayonId[] = ['fruits', 'boulangerie', 'frais', 'viandes', 'epicerie', 'surgeles', 'boissons', 'hygiene', 'maison', 'autre'];

const RAYON_WORDS: Record<Exclude<RayonId, 'autre'>, string[]> = {
  fruits: ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'framboise', 'myrtille', 'tomate', 'salade', 'laitue', 'carotte', 'courgette', 'oignon', 'echalote', 'ail', 'poivron', 'avocat', 'brocoli', 'epinard', 'champignon', 'pomme de terre', 'patate', 'concombre', 'kiwi', 'raisin', 'legume', 'fruit', 'persil', 'basilic', 'coriandre', 'herbe', 'mangue', 'ananas', 'clementine', 'mandarine', 'chou', 'poireau', 'haricot vert', 'aubergine', 'courge', 'potiron', 'butternut', 'gingembre', 'radis', 'betterave', 'patate douce', 'melon', 'pasteque', 'peche', 'abricot', 'prune', 'cerise'],
  boulangerie: ['pain', 'baguette', 'croissant', 'brioche', 'viennoiserie', 'pain de mie', 'tortilla', 'wrap'],
  frais: ['lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'oeuf', 'skyr', 'jambon', 'emmental', 'mozzarella', 'feta', 'comte', 'parmesan', 'chevre', 'fromage blanc', 'compote', 'houmous', 'tofu', 'pate fraiche', 'gnocchi'],
  viandes: ['poulet', 'boeuf', 'steak', 'viande', 'poisson', 'saumon', 'cabillaud', 'dinde', 'porc', 'lardon', 'saucisse', 'crevette', 'hache', 'escalope', 'filet', 'merguez', 'canard', 'agneau', 'colin', 'truite'],
  epicerie: ['pates', 'pate', 'riz', 'farine', 'sucre', 'huile', 'vinaigre', 'sel', 'poivre', 'cafe', 'the', 'cereale', 'flocon', 'avoine', 'conserve', 'thon', 'sauce', 'chocolat', 'biscuit', 'miel', 'confiture', 'lentille', 'pois chiche', 'quinoa', 'epice', 'moutarde', 'ketchup', 'mayonnaise', 'whey', 'proteine', 'barre', 'amande', 'noix', 'cacahuete', 'beurre de cacahuete', 'semoule', 'boulgour', 'bouillon', 'levure', 'muesli', 'granola', 'puree', 'chips', 'olive', 'sardine', 'mais', 'haricot rouge'],
  surgeles: ['surgele', 'glace', 'frite', 'pizza', 'poelee', 'nugget', 'petits pois surgeles'],
  boissons: ['eau', 'jus', 'soda', 'biere', 'vin', 'sirop', 'coca', 'limonade', 'lait d avoine', 'lait d amande', 'boisson', 'kombucha'],
  hygiene: ['dentifrice', 'shampo', 'gel douche', 'savon', 'deodorant', 'rasoir', 'coton', 'mouchoir', 'brosse a dent', 'creme solaire', 'apres-shampo', 'gel', 'mousse a raser', 'serviette hygienique', 'tampon', 'lingette', 'magnesium', 'vitamine', 'pansement', 'doliprane', 'paracetamol'],
  maison: ['lessive', 'liquide vaisselle', 'eponge', 'sac poubelle', 'essuie-tout', 'sopalin', 'papier toilette', 'nettoyant', 'javel', 'ampoule', 'pile', 'adoucissant', 'pastille lave-vaisselle', 'tablette lave-vaisselle', 'film', 'aluminium', 'papier cuisson', 'allumette', 'bougie'],
};

/** Aisle guessed from the name (longest keyword wins: « lait d'avoine » → Boissons, « lait » → Frais). */
export function guessRayon(name: string): RayonId {
  const n = normalize(name).replace(/'/g, ' ');
  let best: { rayon: RayonId; len: number } = { rayon: 'autre', len: 0 };
  for (const [rayon, words] of Object.entries(RAYON_WORDS) as [RayonId, string[]][]) {
    for (const w of words) {
      const re = new RegExp(`(^|[^a-z])${w.replace(/[-]/g, '[- ]?')}`);
      if (w.length > best.len && re.test(n)) best = { rayon, len: w.length };
    }
  }
  return best.rayon;
}

export const GOAL_ICONS: Record<GoalIcon, LucideIcon> = {
  target: Target,
  dumbbell: Dumbbell,
  footprints: Footprints,
  book: BookOpen,
  home: House,
  trophy: Trophy,
  heart: Heart,
  wallet: Wallet,
  sprout: Sprout,
  mountain: Mountain,
};

export const GOAL_SOURCES: Record<GoalSource, { label: string; unit: (n: number) => string }> = {
  seances: { label: 'Séances de salle', unit: (n) => (n > 1 ? 'séances' : 'séance') },
  km: { label: 'Kilomètres courus', unit: () => 'km' },
  sorties: { label: 'Sorties running', unit: (n) => (n > 1 ? 'sorties' : 'sortie') },
  taches: { label: "Tâches cochées dans l'agenda", unit: (n) => (n > 1 ? 'tâches' : 'tâche') },
};

export const HABIT_ICONS: Record<HabitIcon, { icon: LucideIcon; label: string }> = {
  droplets: { icon: Droplets, label: 'Eau' },
  stretch: { icon: PersonStanding, label: 'Étirements' },
  moon: { icon: MoonStar, label: 'Sommeil' },
  leaf: { icon: Leaf, label: 'Nature' },
  book: { icon: BookOpen, label: 'Lecture' },
  brain: { icon: Brain, label: 'Méditation' },
  sun: { icon: Sun, label: 'Matin' },
  pill: { icon: Pill, label: 'Compléments' },
  phone: { icon: Smartphone, label: 'Écrans' },
  walk: { icon: Footprints, label: 'Marche' },
};

export const PERIOD_LABEL = { semaine: 'Semaine', mois: 'Mois', annee: 'Année' } as const;
