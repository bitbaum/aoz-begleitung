import {
  FACTOR_COUNT,
  SOURCE_COUNT,
  type MarketingCopy,
  type MarketingRegisters,
} from './marketing-types'

/**
 * French — a Swiss national language, and the one a reader in Romandie will
 * look for before English.
 *
 * Translated from `marketing.de.ts` under the same restraint: no number this
 * product has not measured, and no claim stronger than the German page makes.
 *
 * ON INCLUSIVE FORMS. The German copy writes `Klient*innen` and
 * `Bewohner*innen`. French does not carry the gender star well — the accepted
 * Swiss administrative register is the doublet (`les client·e·s`) or, better,
 * a genuinely neutral noun. Where a neutral noun exists (`les personnes
 * accompagnées`, `les équipes`) it is used, because it reads as French rather
 * than as German with punctuation borrowed into it. This is a translation
 * decision, not an omission.
 *
 * NOT VOUCHED FOR by a native speaker yet — see `PUBLIC_LOCALES` in
 * `marketing.ts` for what that does and does not gate.
 */

const PLACEMENT_COPY: MarketingCopy = {
  eyebrow: 'Pour les équipes et les personnes accompagnées',
  headline: 'Tout l’accompagnement au même endroit.',
  subline:
    'Logement, quotidien de la maison, vie collective et intégration dans un seul parcours — les équipes et les personnes accompagnées voient la même situation.',
  ctaPrimary: 'Voir le produit',
  ctaSecondary: 'Se connecter',
  ctaNote: 'Aucun compte nécessaire. Vous voyez le vrai produit avec des données d’exemple.',

  problemEyebrow: 'Le problème',
  problemTitle: 'L’intégration échoue souvent par fragmentation, pas par manque de volonté.',
  problems: [
    {
      title: 'La stabilité et les progrès avancent séparément',
      body: 'Logement, langue, travail, participation et étapes d’accompagnement se trouvent dans des listes, des têtes et des boîtes mail différentes. Personne ne voit assez vite ce qui compte ensuite.',
    },
    {
      title: 'L’instabilité mange le temps d’accompagnement',
      body: 'Conflits, transferts en suspens, réponses manquées et suivis ouverts mobilisent les équipes précisément là où elles devraient accompagner.',
    },
    {
      title: 'Les preuves restent trop souvent sans suite',
      body: 'Cours, tests de langue, qualifications ou engagement bénévole sont documentés, mais pas traduits systématiquement en priorités, en tableaux de bord et en prochaines étapes.',
    },
  ],

  howEyebrow: 'Comment cela fonctionne',
  howTitle: 'Quatre domaines de travail, un parcours commun.',
  steps: [
    {
      title: 'Assurer la stabilité',
      body: 'Logement, sécurité, incidents, transferts et règles forment la base qui doit tenir. Sans stabilité, aucune intégration ne porte.',
    },
    {
      title: 'Rendre les compétences visibles',
      body: 'Langue, cours, qualifications et étapes vers le marché du travail sont saisis comme un parcours attesté, non comme des notes éparses.',
    },
    {
      title: 'Favoriser la participation',
      body: 'Bénévolat, activités et repères du quotidien deviennent des signaux de progrès réels.',
    },
    {
      title: 'Mener l’accompagnement à son terme',
      body: 'Tableaux, suivis, messages et prochaines étapes ramènent les équipes vers une action claire plutôt que vers des boucles ouvertes.',
    },
  ],

  featuresEyebrow: 'Dans le produit',
  featuresTitle: 'Ce que le produit permet aux équipes et aux personnes accompagnées.',
  features: [
    {
      icon: 'building',
      title: 'Stabilité du logement',
      body: 'Hébergements, placements, transferts, maintenance et incidents dans un seul parcours — avec un appariement qui explique pourquoi il propose cette combinaison.',
    },
    {
      icon: 'vote',
      title: 'La maison organise son quotidien',
      body: 'Règles de la maison versionnées et confirmées, tâches avec bilan d’équité et un chemin pour les demandes qui aboutit à une réponse.',
    },
    {
      icon: 'shop',
      title: 'Un voisinage qui soutient',
      body: 'Une bourse aux objets et aux coups de main, des événements dans la maison avec inscriptions, et un répertoire des offres du quartier.',
    },
    {
      icon: 'learning',
      title: 'Aller de l’avant',
      body: 'Langue, cours et qualifications comme parcours attesté, avec les places d’engagement et le bénévolat et l’état des candidatures.',
    },
    {
      icon: 'message',
      title: 'Des réponses qui arrivent',
      body: 'Les signalements vont au service qui peut agir, et la réponse revient. Care team, messages et suivis gardent la responsabilité visible.',
    },
    {
      icon: 'chart',
      title: 'Vérifiable par toutes et tous',
      body: 'Chaque placement est journalisé, chaque score décomposable, chaque résultat de vote explicable au regard de la règle alors en vigueur.',
    },
  ],

  scienceEyebrow: 'Base scientifique',
  scienceTitle: `Une méthode, pas une opinion : ${FACTOR_COUNT} facteurs d’appariement — et une mécanique du quotidien fondée sur des résultats documentés.`,
  scienceBody: `Les facteurs de compatibilité sont tirés de la recherche publiée — études suisses d’abord, internationales pour la mise en contexte, ${SOURCE_COUNT} sources au total — et la solidité des preuves est indiquée pour chaque facteur : certains résultats proviennent d’autres formes de logement et constituent, pour l’hébergement collectif, une hypothèse argumentée que le pilote vérifie. Et la mécanique au-delà de l’appariement suit les mêmes exigences : du biais d’auto-évaluation dans le plan de nettoyage à la règle selon laquelle la sécurité ne se met jamais au vote. La méthodologie complète et la liste des sources sont consultables dans le produit par toutes les équipes — et dans la démo, par vous.`,
  science: [
    {
      title: 'La propreté est une direction, pas une moyenne',
      body: 'Ce qui est mesuré, c’est l’attente envers les autres qui reste insatisfaite — pas l’écart entre deux chiffres. Ordonné mais tolérant à côté de désordonné ne produit aucun conflit ; deux personnes aussi désordonnées l’une que l’autre, dont l’une attend beaucoup, oui.',
    },
    {
      title: 'C’est la paire la plus difficile qui détermine l’évaluation',
      body: 'Un ménage est évalué d’après sa paire la plus conflictuelle, jamais d’après la moyenne — la moyenne masque précisément la paire qui produira les incidents.',
    },
    {
      title: 'Les exigences fermes ne se compensent pas',
      body: 'Accès en fauteuil roulant, tabac, besoin de protection en chambre individuelle : ce qui ne peut pas être satisfait n’est pas rattrapé par de bons scores partiels, cela bloque le placement.',
    },
    {
      title: 'Chaque chiffre est explicable',
      body: 'Chaque score se décompose en facteurs nommés, avec un poids et une force de preuve, et les avertissements disent qui sera gêné par quoi. La décision reste aux équipes — et reste justifiable devant l’équipe et devant les personnes concernées.',
    },
    {
      title: 'L’équité est un bilan, pas un classement',
      body: 'Celles et ceux qui rangent surestiment leur propre part — un biais documenté, pas un défaut de caractère. Le plan des tâches montre donc ce que chacune et chacun a réellement porté, au lieu d’opposer des souvenirs.',
    },
    {
      title: 'La sécurité ne se met jamais au vote',
      body: 'Les ménages décident eux-mêmes de leur quotidien — mais une majorité ne peut pas voter la suppression de la sécurité d’une minorité. Ces sujets vont toujours aux équipes, et chaque résultat de vote reste explicable au regard de la règle alors en vigueur.',
    },
  ],

  ethicsEyebrow: 'Limites',
  ethicsTitle: 'Ce que ce logiciel refuse de savoir sur les personnes.',
  ethicsBody:
    'Le système sert des personnes en situation de vulnérabilité. Il n’enregistre que ce dont l’accompagnement a réellement besoin. Les client*es saisissent elles-mêmes le type de permis et sa date d’expiration si elles le souhaitent — ces informations leur appartiennent, servent à rappeler une échéance et n’alimentent jamais une attribution, une évaluation ou une statistique. Ce qui n’est pas enregistré ne peut pas non plus être utilisé contre quelqu’un.',
  neverTracked: [
    'Diagnostics médicaux',
    'Détails du dossier : procédure, étape, décision',
    'Religion et conviction politique',
    'Histoire personnelle sans lien avec le logement',
  ],

  blogEyebrow: 'Blog et documents produit',
  blogTitle: 'Pourquoi le produit est construit ainsi et comment il évolue.',
  blogLink: 'Lire tous les articles',

  surfaceEyebrow: 'Compris dans le produit',
  surfaceTitle: 'Les deux côtés, au complet — tels qu’ils figurent dans le menu.',
  surfaceBody:
    'Cette liste n’est pas recopiée : c’est la navigation du produit elle-même. Si un domaine s’ajoute, il apparaît ici. S’il disparaît, il disparaît ici aussi.',
  surfaceStaffNote:
    'Le menu des équipes est affiché en allemand parce que l’interface professionnelle est en allemand. C’est le portail des résidentes et résidents qui est traduit, et il est présenté ici en français.',

  docsEyebrow: 'Traçabilité',
  docsTitle: 'La réflexion produit, l’avancement et la base scientifique sont publics.',
  docs: [
    {
      title: 'Roadmap',
      body: 'Vers où le produit évolue et quels principes en fixent la direction.',
    },
    {
      title: 'Changelog',
      body: 'Ce qui est déjà arrivé dans le produit et comment la plateforme change concrètement.',
    },
    {
      title: 'Blog',
      body: 'Le contexte des décisions, la recherche, la logique produit et la mise en œuvre technique.',
    },
  ],

  closingTitle: 'Jetez-y un œil.',
  closingBody:
    'La démo est le vrai produit avec des données d’exemple — administration, accompagnement et portail des résidentes et résidents. Le blog, la roadmap et le changelog rendent les décisions produit traçables.',
}

const HOUSEHOLD_COPY: MarketingCopy = {
  eyebrow: 'Vivre ensemble',
  headline: 'La colocation sur laquelle vous pouvez vous entendre.',
  subline:
    'Qui a sorti les poubelles, qui a payé le papier de toilette, et à partir de quand est-ce trop bruyant ? Tout au même endroit — pour ne pas tout renégocier à chaque fois.',
  ctaPrimary: 'Essayer',
  ctaSecondary: 'Se connecter',
  ctaNote: 'Aucun compte nécessaire. Tu vois le vrai produit avec des données d’exemple.',

  problemEyebrow: 'Pourquoi',
  problemTitle: 'En colocation, une dispute porte rarement sur le sujet de la dispute.',
  problems: [
    {
      title: 'Chacune et chacun croit en faire plus',
      body: 'On se souvient mieux de son propre travail que de celui des autres. C’est normal — et cela suffit pour que tout le monde se sente lésé.',
    },
    {
      title: 'Les accords disparaissent',
      body: 'Ce qui a été convenu dans le couloir tient exactement jusqu’au moment où deux personnes s’en souviennent différemment.',
    },
    {
      title: 'L’argent rend les choses personnelles',
      body: 'De petits montants que personne ne note deviennent un sentiment sur la manière dont chacune et chacun se comporte.',
    },
  ],

  howEyebrow: 'Comment ça se passe',
  howTitle: 'Noter, convenir, vérifier.',
  steps: [
    {
      title: 'Consigner les tâches',
      body: 'Ménage, poubelles, courses. Qui l’a fait est inscrit — pas seulement à qui c’était le tour.',
    },
    {
      title: 'Partager les dépenses',
      body: 'On saisit une dépense, les parts sont calculées. Le solde dit qui doit quoi à qui.',
    },
    {
      title: 'Décider ensemble',
      body: 'On dépose une proposition, tout le monde vote, le résultat devient la règle de la maison. Relisible, avec une date.',
    },
    {
      title: 'Signaler ce qui est cassé',
      body: 'Le robinet qui fuit part à la gérance, le conflit part à l’accompagnement. Vous voyez la réponse.',
    },
  ],

  featuresEyebrow: 'Dedans',
  featuresTitle: 'Ce que vous pouvez utiliser.',
  features: [
    {
      icon: 'wallet',
      title: 'Dépenses partagées',
      body: 'Qui a payé quoi, qui doit quoi à qui. Au centime près, avec le chemin de remboursement le plus court.',
    },
    {
      icon: 'calendar',
      title: 'Tâches et équité',
      body: 'Le plan de nettoyage comme bilan plutôt que comme classement : on voit ce que chacune et chacun a porté.',
    },
    {
      icon: 'scroll',
      title: 'Règles de la maison',
      body: 'Ce qui vaut dans cet appartement, au même endroit — et chaque modification est resoumise à tout le monde.',
    },
    {
      icon: 'vote',
      title: 'Voter',
      body: 'Propositions, délais, résultat motivé. La sécurité ne se met jamais au vote.',
    },
    {
      icon: 'building',
      title: 'Votre appartement',
      body: 'Un nom que vous choisissez, les chambres et qui habite ici. Avec une photo, si vous voulez.',
    },
    {
      icon: 'alert',
      title: 'Signaler',
      body: 'Dégât ou conflit — cela arrive au service qui peut agir, et la réponse revient.',
    },
  ],

  scienceEyebrow: 'Pourquoi cela fonctionne',
  scienceTitle: 'Derrière les règles il y a de la recherche, pas une intuition.',
  scienceBody:
    'Les conflits en colocation sont bien étudiés : celles et ceux qui rangent surestiment leur propre part ; les accords sans date se délitent ; les disputes sur la propreté naissent d’attentes déçues, pas des différences en soi. L’application est construite autour de ces résultats.',
  science: [
    {
      title: 'Chacune et chacun croit en faire plus — et cela se mesure',
      body: 'Le biais d’auto-évaluation documenté est la raison pour laquelle le plan des tâches est un bilan : on voit ce que chacune et chacun a porté, au lieu d’opposer des souvenirs.',
    },
    {
      title: 'La propreté est une direction',
      body: 'Ce qui compte, c’est l’attente qui reste insatisfaite — pas qui est « plus ordonné ». L’application demande donc votre propre standard, votre attente envers les autres et votre tolérance, pas une note.',
    },
    {
      title: 'Les accords ont besoin d’une date',
      body: 'Ce qui a été convenu dans le couloir tient jusqu’au prochain trou de mémoire. Des décisions avec délai, résultat et motif tiennent — et la sécurité ne se met jamais au vote.',
    },
  ],

  ethicsEyebrow: 'Sphère privée',
  ethicsTitle: 'Ce que l’application refuse de savoir sur vous.',
  ethicsBody:
    'Par défaut, vous n’avez même pas de nom dans l’application — votre code suffit. Nom, photo et texte sont facultatifs, et les photos ne sont visibles que par vous et par les personnes avec qui vous vivez.',
  neverTracked: [
    'Diagnostics médicaux',
    'Détails du dossier : procédure, étape, décision',
    'Religion et conviction politique',
    'Histoire personnelle sans lien avec le logement',
  ],

  blogEyebrow: 'Blog technique',
  blogTitle: 'Pourquoi le produit est construit comme il l’est.',
  blogLink: 'Lire tous les articles',

  surfaceEyebrow: 'Tout y est',
  surfaceTitle: 'Ce que vous trouverez dans l’application — exactement comme dans le menu.',
  surfaceBody:
    'Cette liste n’est pas recopiée : c’est le menu de l’application lui-même. Si quelque chose s’ajoute, cela apparaît ici.',
  surfaceStaffNote:
    'Le menu des équipes est affiché en allemand parce que l’interface professionnelle est en allemand. C’est le portail des résidentes et résidents qui est traduit, et il est présenté ici en français.',

  docsEyebrow: 'À lire',
  docsTitle: 'Comment l’application est née et ce qui vient ensuite.',
  docs: [
    {
      title: 'Roadmap',
      body: 'Ce sur quoi on travaille en ce moment et ce qui arrive ensuite.',
    },
    {
      title: 'Changelog',
      body: 'Ce qui a changé en dernier, avec les dates.',
    },
    {
      title: 'Blog',
      body: 'Pourquoi l’application fonctionne comme elle fonctionne.',
    },
  ],

  closingTitle: 'Regardez par vous-même.',
  closingBody:
    'La démo est le vrai produit avec des données d’exemple — vous voyez exactement ce que voient les personnes qui y habitent.',
}

export const marketingFr: MarketingRegisters = {
  placement: PLACEMENT_COPY,
  household: HOUSEHOLD_COPY,
}
