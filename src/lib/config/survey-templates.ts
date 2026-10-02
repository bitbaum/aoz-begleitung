/**
 * Survey templates — SSOT for what a survey can ask.
 *
 * A survey is created FROM a template and snapshots its questions, so editing
 * a template changes future surveys only. Adding a template is one entry in
 * `SURVEY_TEMPLATES`; `survey-templates.test.ts` checks every text exists in
 * every language the portal offers.
 *
 * ORIGIN. "Leben in der Wohnung" is modelled on the questionnaire AOZ's own
 * project Wohnen+ sent residents ("Leben in der AOZ Wohnung", SurveyMonkey),
 * question for question. Wording is kept at B1 — short sentences, everyday
 * words — because many respondents read it in their second or third language.
 * Like the original, and like the whole portal, it addresses the respondent
 * formally (Sie / vous / Ви / Вы) — AOZ's register with its clients, gated by
 * `src/lib/i18n/__tests__/formal-register.test.ts`.
 *
 * What a template must never ask: anything a client fact holds (insurance,
 * health contacts, permit), a diagnosis, religion, politics or asylum case
 * details (CLAUDE.md, "What We NEVER Track"). The health questions here ask
 * how someone feels and what help they need — never what is wrong with them —
 * and the answers are anonymous aggregates that no decision can read.
 *
 * Translations (en, fr, uk, ru, ar) were written without a native reviewer,
 * like the unvouched portal dictionaries — see `LOCALES[*].reviewed`.
 */

import type { LocalizedText, SurveyQuestion } from '@/lib/surveys/questions'

export interface SurveyTemplate {
  id: string
  title: LocalizedText
  intro: LocalizedText
  questions: SurveyQuestion[]
}

type Step = { id: string; label: LocalizedText }

/** Reused answer scales — one translation each, not one per question. */
const FREQUENCY: Step[] = [
  {
    id: 'never',
    label: { de: 'Nie', en: 'Never', fr: 'Jamais', uk: 'Ніколи', ru: 'Никогда', ar: 'أبداً' },
  },
  {
    id: 'rarely',
    label: { de: 'Selten', en: 'Rarely', fr: 'Rarement', uk: 'Рідко', ru: 'Редко', ar: 'نادراً' },
  },
  {
    id: 'sometimes',
    label: {
      de: 'Manchmal',
      en: 'Sometimes',
      fr: 'Parfois',
      uk: 'Іноді',
      ru: 'Иногда',
      ar: 'أحياناً',
    },
  },
  {
    id: 'often',
    label: { de: 'Oft', en: 'Often', fr: 'Souvent', uk: 'Часто', ru: 'Часто', ar: 'كثيراً' },
  },
  {
    id: 'very_often',
    label: {
      de: 'Sehr oft',
      en: 'Very often',
      fr: 'Très souvent',
      uk: 'Дуже часто',
      ru: 'Очень часто',
      ar: 'كثيراً جداً',
    },
  },
]

const SAFETY: Step[] = [
  {
    id: 'very_unsafe',
    label: {
      de: 'Sehr unsicher',
      en: 'Very unsafe',
      fr: 'Pas du tout en sécurité',
      uk: 'Зовсім небезпечно',
      ru: 'Совсем небезопасно',
      ar: 'غير آمن أبداً',
    },
  },
  {
    id: 'rather_unsafe',
    label: {
      de: 'Eher unsicher',
      en: 'Rather unsafe',
      fr: 'Plutôt pas en sécurité',
      uk: 'Скоріше небезпечно',
      ru: 'Скорее небезопасно',
      ar: 'غير آمن إلى حد ما',
    },
  },
  {
    id: 'in_between',
    label: {
      de: 'Teils-teils',
      en: 'In between',
      fr: 'Moyennement',
      uk: 'Посередньо',
      ru: 'Средне',
      ar: 'بين بين',
    },
  },
  {
    id: 'rather_safe',
    label: {
      de: 'Eher sicher',
      en: 'Rather safe',
      fr: 'Plutôt en sécurité',
      uk: 'Скоріше безпечно',
      ru: 'Скорее безопасно',
      ar: 'آمن إلى حد ما',
    },
  },
  {
    id: 'very_safe',
    label: {
      de: 'Sehr sicher',
      en: 'Very safe',
      fr: 'Tout à fait en sécurité',
      uk: 'Дуже безпечно',
      ru: 'Очень безопасно',
      ar: 'آمن جداً',
    },
  },
]

/** Bad → good. `de`/`en` differ per use (wohl vs. gut), the rest read the same. */
function badToGood(de: [string, string, string, string, string], en: typeof de): Step[] {
  const fr = ['Très mal', 'Plutôt mal', 'Moyennement', 'Plutôt bien', 'Très bien']
  const uk = ['Дуже погано', 'Скоріше погано', 'Посередньо', 'Скоріше добре', 'Дуже добре']
  const ru = ['Очень плохо', 'Скорее плохо', 'Средне', 'Скорее хорошо', 'Очень хорошо']
  const ar = ['سيء جداً', 'سيء إلى حد ما', 'بين بين', 'جيد إلى حد ما', 'جيد جداً']
  const ids = ['very_bad', 'rather_bad', 'in_between', 'rather_good', 'very_good']
  return ids.map((id, i) => ({
    id,
    label: { de: de[i], en: en[i], fr: fr[i], uk: uk[i], ru: ru[i], ar: ar[i] },
  }))
}

const WELLBEING = badToGood(
  ['Sehr unwohl', 'Eher unwohl', 'Teils-teils', 'Eher wohl', 'Sehr wohl'],
  [
    'Very uncomfortable',
    'Rather uncomfortable',
    'In between',
    'Rather comfortable',
    'Very comfortable',
  ],
)

const HEALTH = badToGood(
  ['Sehr schlecht', 'Eher schlecht', 'Teils-teils', 'Eher gut', 'Sehr gut'],
  ['Very bad', 'Rather bad', 'In between', 'Rather good', 'Very good'],
)

/** Answers to "are you satisfied…?" — phrased as no/yes so no language needs a gendered adjective. */
const SATISFACTION: Step[] = [
  {
    id: 'not_at_all',
    label: {
      de: 'Sehr unzufrieden',
      en: 'Very dissatisfied',
      fr: 'Pas du tout',
      uk: 'Зовсім ні',
      ru: 'Совсем нет',
      ar: 'لا أبداً',
    },
  },
  {
    id: 'rather_not',
    label: {
      de: 'Eher unzufrieden',
      en: 'Rather dissatisfied',
      fr: 'Plutôt non',
      uk: 'Скоріше ні',
      ru: 'Скорее нет',
      ar: 'لا إلى حد ما',
    },
  },
  {
    id: 'in_between',
    label: {
      de: 'Teils-teils',
      en: 'In between',
      fr: 'Moyennement',
      uk: 'Посередньо',
      ru: 'Средне',
      ar: 'بين بين',
    },
  },
  {
    id: 'rather_yes',
    label: {
      de: 'Eher zufrieden',
      en: 'Rather satisfied',
      fr: 'Plutôt oui',
      uk: 'Скоріше так',
      ru: 'Скорее да',
      ar: 'نعم إلى حد ما',
    },
  },
  {
    id: 'fully',
    label: {
      de: 'Sehr zufrieden',
      en: 'Very satisfied',
      fr: 'Tout à fait',
      uk: 'Повністю так',
      ru: 'Полностью да',
      ar: 'نعم تماماً',
    },
  },
]

const OTHER: LocalizedText = {
  de: 'Sonstiges',
  en: 'Something else',
  fr: 'Autre chose',
  uk: 'Інше',
  ru: 'Другое',
  ar: 'شيء آخر',
}

const LEBEN_IN_DER_WOHNUNG: SurveyTemplate = {
  id: 'leben-in-der-wohnung',
  title: {
    de: 'Leben in der Wohnung',
    en: 'Living in the flat',
    fr: 'Vivre dans l’appartement',
    uk: 'Життя у квартирі',
    ru: 'Жизнь в квартире',
    ar: 'الحياة في الشقة',
  },
  intro: {
    de: 'Wir möchten wissen, wie es Ihnen in Ihrer Wohnung geht. Die Umfrage dauert etwa 10 Minuten. Sie können jede Frage auslassen.',
    en: 'We would like to know how you are doing in your flat. The survey takes about 10 minutes. You can skip any question.',
    fr: 'Nous aimerions savoir comment vous allez dans votre appartement. Le questionnaire dure environ 10 minutes. Vous pouvez sauter chaque question.',
    uk: 'Ми хочемо знати, як Вам живеться у Вашій квартирі. Опитування триває приблизно 10 хвилин. Ви можете пропустити будь-яке питання.',
    ru: 'Мы хотим знать, как Вам живётся в Вашей квартире. Опрос занимает около 10 минут. Вы можете пропустить любой вопрос.',
    ar: 'نريد أن نعرف كيف حالك في شقتك. يستغرق الاستبيان حوالي 10 دقائق. يمكنك تخطي أي سؤال.',
  },
  questions: [
    {
      id: 'ageGroup',
      type: 'single',
      prompt: {
        de: 'Wie alt sind Sie?',
        en: 'How old are you?',
        fr: 'Quel âge avez-vous ?',
        uk: 'Скільки Вам років?',
        ru: 'Сколько Вам лет?',
        ar: 'كم عمرك؟',
      },
      options: [
        {
          id: 'age_18_25',
          label: { de: '18–25', en: '18–25', fr: '18–25', uk: '18–25', ru: '18–25', ar: '18–25' },
        },
        {
          id: 'age_26_35',
          label: { de: '26–35', en: '26–35', fr: '26–35', uk: '26–35', ru: '26–35', ar: '26–35' },
        },
        {
          id: 'age_36_50',
          label: { de: '36–50', en: '36–50', fr: '36–50', uk: '36–50', ru: '36–50', ar: '36–50' },
        },
        {
          id: 'age_51_65',
          label: { de: '51–65', en: '51–65', fr: '51–65', uk: '51–65', ru: '51–65', ar: '51–65' },
        },
        {
          id: 'age_over_65',
          label: {
            de: 'Über 65',
            en: 'Over 65',
            fr: 'Plus de 65',
            uk: 'Понад 65',
            ru: 'Старше 65',
            ar: 'أكثر من 65',
          },
        },
      ],
    },
    {
      id: 'household',
      type: 'single',
      prompt: {
        de: 'Wohnen Sie allein oder mit anderen Personen?',
        en: 'Do you live alone or with other people?',
        fr: 'Vivez-vous seul·e ou avec d’autres personnes ?',
        uk: 'Ви живете самі чи з іншими людьми?',
        ru: 'Вы живёте одни или с другими людьми?',
        ar: 'هل تعيش وحدك أم مع أشخاص آخرين؟',
      },
      options: [
        {
          id: 'alone',
          label: {
            de: 'Allein',
            en: 'Alone',
            fr: 'Seul·e',
            uk: 'Сам / сама',
            ru: 'Один / одна',
            ar: 'وحدي',
          },
        },
        {
          id: 'family',
          label: {
            de: 'Mit meiner Familie',
            en: 'With my family',
            fr: 'Avec ma famille',
            uk: 'З моєю сім’єю',
            ru: 'С моей семьёй',
            ar: 'مع عائلتي',
          },
        },
        {
          id: 'others',
          label: {
            de: 'Mit anderen Personen (nicht Familie)',
            en: 'With other people (not family)',
            fr: 'Avec d’autres personnes (pas la famille)',
            uk: 'З іншими людьми (не сім’я)',
            ru: 'С другими людьми (не семья)',
            ar: 'مع أشخاص آخرين (ليسوا من العائلة)',
          },
        },
      ],
    },
    {
      id: 'duration',
      type: 'single',
      prompt: {
        de: 'Wie lange wohnen Sie schon in dieser Wohnung?',
        en: 'How long have you lived in this flat?',
        fr: 'Depuis combien de temps habitez-vous dans cet appartement ?',
        uk: 'Як довго Ви вже живете в цій квартирі?',
        ru: 'Как давно Вы живёте в этой квартире?',
        ar: 'منذ متى تسكن في هذه الشقة؟',
      },
      options: [
        {
          id: 'under_6_months',
          label: {
            de: 'Weniger als 6 Monate',
            en: 'Less than 6 months',
            fr: 'Moins de 6 mois',
            uk: 'Менше 6 місяців',
            ru: 'Меньше 6 месяцев',
            ar: 'أقل من 6 أشهر',
          },
        },
        {
          id: 'months_6_12',
          label: {
            de: '6 bis 12 Monate',
            en: '6 to 12 months',
            fr: '6 à 12 mois',
            uk: 'Від 6 до 12 місяців',
            ru: 'От 6 до 12 месяцев',
            ar: 'من 6 إلى 12 شهراً',
          },
        },
        {
          id: 'years_1_2',
          label: {
            de: '1 bis 2 Jahre',
            en: '1 to 2 years',
            fr: '1 à 2 ans',
            uk: 'Від 1 до 2 років',
            ru: 'От 1 до 2 лет',
            ar: 'من سنة إلى سنتين',
          },
        },
        {
          id: 'over_2_years',
          label: {
            de: 'Mehr als 2 Jahre',
            en: 'More than 2 years',
            fr: 'Plus de 2 ans',
            uk: 'Понад 2 роки',
            ru: 'Больше 2 лет',
            ar: 'أكثر من سنتين',
          },
        },
      ],
    },
    {
      id: 'wellbeing',
      type: 'scale',
      prompt: {
        de: 'Wie wohl fühlen Sie sich in Ihrer Wohnung?',
        en: 'How comfortable do you feel in your flat?',
        fr: 'Comment vous sentez-vous dans votre appartement ?',
        uk: 'Як Ви почуваєтеся у своїй квартирі?',
        ru: 'Как Вы себя чувствуете в своей квартире?',
        ar: 'كيف تشعر في شقتك؟',
      },
      steps: WELLBEING,
    },
    {
      id: 'noise',
      type: 'scale',
      prompt: {
        de: 'Wie oft stört Sie Lärm in der Wohnung oder im Haus?',
        en: 'How often does noise in the flat or the building bother you?',
        fr: 'À quelle fréquence le bruit dans l’appartement ou l’immeuble vous dérange-t-il ?',
        uk: 'Як часто Вам заважає шум у квартирі або в будинку?',
        ru: 'Как часто Вам мешает шум в квартире или в доме?',
        ar: 'كم مرة يزعجك الضجيج في الشقة أو في المبنى؟',
      },
      steps: FREQUENCY,
    },
    {
      id: 'safetyNeighbourhood',
      type: 'scale',
      prompt: {
        de: 'Wie sicher fühlen Sie sich in der Nachbarschaft?',
        en: 'How safe do you feel in the neighbourhood?',
        fr: 'Vous sentez-vous en sécurité dans le quartier ?',
        uk: 'Наскільки безпечно Ви почуваєтеся в районі?',
        ru: 'Насколько безопасно Вы чувствуете себя в районе?',
        ar: 'ما مدى شعورك بالأمان في الحي؟',
      },
      steps: SAFETY,
    },
    {
      id: 'safetyFlat',
      type: 'scale',
      prompt: {
        de: 'Wie sicher fühlen Sie sich in der Wohnung?',
        en: 'How safe do you feel in the flat?',
        fr: 'Vous sentez-vous en sécurité dans l’appartement ?',
        uk: 'Наскільки безпечно Ви почуваєтеся у квартирі?',
        ru: 'Насколько безопасно Вы чувствуете себя в квартире?',
        ar: 'ما مدى شعورك بالأمان في الشقة؟',
      },
      steps: SAFETY,
    },
    {
      id: 'missing',
      type: 'multi',
      prompt: {
        de: 'Was fehlt Ihnen in der Wohnung? (mehrere Antworten möglich)',
        en: 'What is missing in your flat? (you can choose more than one)',
        fr: 'Que manque-t-il dans votre appartement ? (plusieurs réponses possibles)',
        uk: 'Чого Вам не вистачає у квартирі? (можна вибрати кілька)',
        ru: 'Чего Вам не хватает в квартире? (можно выбрать несколько)',
        ar: 'ما الذي ينقصك في الشقة؟ (يمكنك اختيار أكثر من إجابة)',
      },
      options: [
        {
          id: 'furniture',
          label: {
            de: 'Möbel',
            en: 'Furniture',
            fr: 'Des meubles',
            uk: 'Меблі',
            ru: 'Мебель',
            ar: 'أثاث',
          },
        },
        {
          id: 'kitchen',
          label: {
            de: 'Küchengeräte oder Geschirr',
            en: 'Kitchen appliances or dishes',
            fr: 'Des appareils de cuisine ou de la vaisselle',
            uk: 'Кухонна техніка або посуд',
            ru: 'Кухонная техника или посуда',
            ar: 'أجهزة مطبخ أو أواني',
          },
        },
        {
          id: 'laundry',
          label: {
            de: 'Waschmaschine',
            en: 'Washing machine',
            fr: 'Une machine à laver',
            uk: 'Пральна машина',
            ru: 'Стиральная машина',
            ar: 'غسالة ملابس',
          },
        },
        {
          id: 'internet',
          label: {
            de: 'Internet / WLAN',
            en: 'Internet / Wi-Fi',
            fr: 'Internet / Wi-Fi',
            uk: 'Інтернет / Wi-Fi',
            ru: 'Интернет / Wi-Fi',
            ar: 'إنترنت / واي فاي',
          },
        },
        {
          id: 'privacy',
          label: {
            de: 'Ruhe und Privatsphäre',
            en: 'Quiet and privacy',
            fr: 'Du calme et de l’intimité',
            uk: 'Тиша та приватність',
            ru: 'Тишина и личное пространство',
            ar: 'الهدوء والخصوصية',
          },
        },
        {
          id: 'space',
          label: {
            de: 'Platz',
            en: 'Space',
            fr: 'De la place',
            uk: 'Місце',
            ru: 'Место',
            ar: 'مساحة',
          },
        },
        {
          id: 'nothing',
          label: {
            de: 'Es fehlt nichts',
            en: 'Nothing is missing',
            fr: 'Il ne manque rien',
            uk: 'Нічого не бракує',
            ru: 'Ничего не нужно',
            ar: 'لا ينقصني شيء',
          },
        },
      ],
      other: { label: OTHER },
    },
    {
      id: 'cooking',
      type: 'single',
      prompt: {
        de: 'Können Sie in der Wohnung gut kochen?',
        en: 'Can you cook well in the flat?',
        fr: 'Pouvez-vous bien cuisiner dans l’appartement ?',
        uk: 'Чи можете Ви добре готувати у квартирі?',
        ru: 'Можете ли Вы хорошо готовить в квартире?',
        ar: 'هل يمكنك الطبخ بشكل جيد في الشقة؟',
      },
      options: [
        {
          id: 'yes',
          label: {
            de: 'Ja, gut',
            en: 'Yes, well',
            fr: 'Oui, bien',
            uk: 'Так, добре',
            ru: 'Да, хорошо',
            ar: 'نعم، جيداً',
          },
        },
        {
          id: 'difficult',
          label: {
            de: 'Ja, aber es ist schwierig',
            en: 'Yes, but it is difficult',
            fr: 'Oui, mais c’est difficile',
            uk: 'Так, але це складно',
            ru: 'Да, но это трудно',
            ar: 'نعم، لكن ذلك صعب',
          },
        },
        {
          id: 'no',
          label: { de: 'Nein', en: 'No', fr: 'Non', uk: 'Ні', ru: 'Нет', ar: 'لا' },
        },
      ],
    },
    {
      id: 'everydayProblems',
      type: 'scale',
      prompt: {
        de: 'Wie oft haben Sie Probleme im Alltag (zum Beispiel mit Briefen, Terminen oder beim Einkaufen)?',
        en: 'How often do you have problems in everyday life (for example with letters, appointments or shopping)?',
        fr: 'À quelle fréquence avez-vous des problèmes au quotidien (par exemple avec des lettres, des rendez-vous ou les courses) ?',
        uk: 'Як часто у Вас бувають проблеми в повсякденному житті (наприклад, з листами, зустрічами або покупками)?',
        ru: 'Как часто у Вас бывают проблемы в повседневной жизни (например, с письмами, встречами или покупками)?',
        ar: 'كم مرة تواجه مشاكل في الحياة اليومية (مثلاً مع الرسائل أو المواعيد أو التسوق)؟',
      },
      steps: FREQUENCY,
    },
    {
      id: 'biggestProblems',
      type: 'text',
      prompt: {
        de: 'Was sind Ihre grössten Probleme im Alltag?',
        en: 'What are your biggest problems in everyday life?',
        fr: 'Quels sont vos plus grands problèmes au quotidien ?',
        uk: 'Які Ваші найбільші проблеми в повсякденному житті?',
        ru: 'Какие у Вас самые большие проблемы в повседневной жизни?',
        ar: 'ما هي أكبر مشاكلك في الحياة اليومية؟',
      },
    },
    {
      id: 'money',
      type: 'scale',
      prompt: {
        de: 'Wie oft reicht Ihr Geld nicht bis zum Ende des Monats?',
        en: 'How often does your money not last until the end of the month?',
        fr: 'À quelle fréquence votre argent ne suffit-il pas jusqu’à la fin du mois ?',
        uk: 'Як часто Вам не вистачає грошей до кінця місяця?',
        ru: 'Как часто Вам не хватает денег до конца месяца?',
        ar: 'كم مرة لا يكفيك المال حتى نهاية الشهر؟',
      },
      steps: FREQUENCY,
    },
    {
      id: 'moneyWishes',
      type: 'text',
      prompt: {
        de: 'Was wünschen Sie sich beim Thema Geld?',
        en: 'What would help you with money?',
        fr: 'Qu’est-ce qui vous aiderait pour l’argent ?',
        uk: 'Що б Вам допомогло з грошима?',
        ru: 'Что помогло бы Вам с деньгами?',
        ar: 'ما الذي قد يساعدك في موضوع المال؟',
      },
    },
    {
      id: 'socialContact',
      type: 'single',
      prompt: {
        de: 'Wie oft haben Sie Kontakt mit anderen Menschen (Freunde, Familie, Nachbarn)?',
        en: 'How often are you in contact with other people (friends, family, neighbours)?',
        fr: 'À quelle fréquence êtes-vous en contact avec d’autres personnes (amis, famille, voisins) ?',
        uk: 'Як часто Ви спілкуєтеся з іншими людьми (друзі, сім’я, сусіди)?',
        ru: 'Как часто Вы общаетесь с другими людьми (друзья, семья, соседи)?',
        ar: 'كم مرة تتواصل مع أشخاص آخرين (أصدقاء، عائلة، جيران)؟',
      },
      options: [
        {
          id: 'daily',
          label: {
            de: 'Jeden Tag',
            en: 'Every day',
            fr: 'Tous les jours',
            uk: 'Щодня',
            ru: 'Каждый день',
            ar: 'كل يوم',
          },
        },
        {
          id: 'weekly_several',
          label: {
            de: 'Mehrmals pro Woche',
            en: 'Several times a week',
            fr: 'Plusieurs fois par semaine',
            uk: 'Кілька разів на тиждень',
            ru: 'Несколько раз в неделю',
            ar: 'عدة مرات في الأسبوع',
          },
        },
        {
          id: 'weekly_once',
          label: {
            de: 'Einmal pro Woche',
            en: 'Once a week',
            fr: 'Une fois par semaine',
            uk: 'Раз на тиждень',
            ru: 'Раз в неделю',
            ar: 'مرة في الأسبوع',
          },
        },
        {
          id: 'less',
          label: {
            de: 'Seltener',
            en: 'Less often',
            fr: 'Moins souvent',
            uk: 'Рідше',
            ru: 'Реже',
            ar: 'أقل من ذلك',
          },
        },
        {
          id: 'never',
          label: { de: 'Nie', en: 'Never', fr: 'Jamais', uk: 'Ніколи', ru: 'Никогда', ar: 'أبداً' },
        },
      ],
    },
    {
      id: 'loneliness',
      type: 'scale',
      prompt: {
        de: 'Wie oft fühlen Sie sich einsam?',
        en: 'How often do you feel lonely?',
        fr: 'À quelle fréquence vous sentez-vous seul·e ?',
        uk: 'Як часто Ви почуваєтеся самотньо?',
        ru: 'Как часто Вы чувствуете себя одиноко?',
        ar: 'كم مرة تشعر بالوحدة؟',
      },
      steps: FREQUENCY,
    },
    {
      id: 'health',
      type: 'scale',
      prompt: {
        de: 'Wie geht es Ihnen gesundheitlich?',
        en: 'How is your health?',
        fr: 'Comment allez-vous côté santé ?',
        uk: 'Як Ваше здоров’я?',
        ru: 'Как Ваше здоровье?',
        ar: 'كيف حالتك الصحية؟',
      },
      steps: HEALTH,
    },
    {
      id: 'healthSupport',
      type: 'multi',
      prompt: {
        de: 'Brauchen Sie Hilfe für Ihre Gesundheit? (mehrere Antworten möglich)',
        en: 'Do you need help with your health? (you can choose more than one)',
        fr: 'Avez-vous besoin d’aide pour votre santé ? (plusieurs réponses possibles)',
        uk: 'Чи потрібна Вам допомога щодо здоров’я? (можна вибрати кілька)',
        ru: 'Нужна ли Вам помощь со здоровьем? (можно выбрать несколько)',
        ar: 'هل تحتاج إلى مساعدة بخصوص صحتك؟ (يمكنك اختيار أكثر من إجابة)',
      },
      options: [
        {
          id: 'medical',
          label: {
            de: 'Ärztliche Hilfe',
            en: 'Help from a doctor',
            fr: 'L’aide d’un médecin',
            uk: 'Допомога лікаря',
            ru: 'Помощь врача',
            ar: 'مساعدة من طبيب',
          },
        },
        {
          id: 'psychological',
          label: {
            de: 'Psychologische Hilfe',
            en: 'Psychological help',
            fr: 'Une aide psychologique',
            uk: 'Психологічна допомога',
            ru: 'Психологическая помощь',
            ar: 'مساعدة نفسية',
          },
        },
        {
          id: 'dentist',
          label: {
            de: 'Zahnärztin oder Zahnarzt',
            en: 'A dentist',
            fr: 'Un·e dentiste',
            uk: 'Стоматолог',
            ru: 'Стоматолог',
            ar: 'طبيب أسنان',
          },
        },
        {
          id: 'finding_care',
          label: {
            de: 'Hilfe, eine Ärztin oder einen Arzt zu finden',
            en: 'Help finding a doctor',
            fr: 'De l’aide pour trouver un médecin',
            uk: 'Допомога знайти лікаря',
            ru: 'Помощь в поиске врача',
            ar: 'مساعدة في إيجاد طبيب',
          },
        },
        {
          id: 'none',
          label: {
            de: 'Ich brauche keine Hilfe',
            en: 'I do not need help',
            fr: 'Je n’ai pas besoin d’aide',
            uk: 'Мені не потрібна допомога',
            ru: 'Мне не нужна помощь',
            ar: 'لا أحتاج إلى مساعدة',
          },
        },
      ],
      other: { label: OTHER },
    },
    {
      id: 'aozSatisfaction',
      type: 'scale',
      prompt: {
        de: 'Wie zufrieden sind Sie mit der Hilfe von der {org}?',
        en: 'How satisfied are you with the help from {org}?',
        fr: 'Êtes-vous satisfait·e de l’aide de l’{org} ?',
        uk: 'Чи задоволені Ви допомогою від {org}?',
        ru: 'Довольны ли Вы помощью от {org}?',
        ar: 'هل أنت راضٍ عن المساعدة من {org}؟',
      },
      steps: SATISFACTION,
    },
    {
      id: 'aozHelpGood',
      type: 'multi',
      prompt: {
        de: 'Welche Hilfe von der {org} ist gut für Sie? (mehrere Antworten möglich)',
        en: 'Which help from {org} is good for you? (you can choose more than one)',
        fr: 'Quelle aide de l’{org} est bonne pour vous ? (plusieurs réponses possibles)',
        uk: 'Яка допомога від {org} Вам підходить? (можна вибрати кілька)',
        ru: 'Какая помощь от {org} Вам подходит? (можно выбрать несколько)',
        ar: 'ما هي المساعدة من {org} التي تفيدك؟ (يمكنك اختيار أكثر من إجابة)',
      },
      options: [
        {
          id: 'letters',
          label: {
            de: 'Hilfe bei Briefen und Formularen',
            en: 'Help with letters and forms',
            fr: 'Aide pour les lettres et les formulaires',
            uk: 'Допомога з листами та формулярами',
            ru: 'Помощь с письмами и анкетами',
            ar: 'مساعدة في الرسائل والاستمارات',
          },
        },
        {
          id: 'money',
          label: {
            de: 'Hilfe bei Geld',
            en: 'Help with money',
            fr: 'Aide pour l’argent',
            uk: 'Допомога з грошима',
            ru: 'Помощь с деньгами',
            ar: 'مساعدة في المال',
          },
        },
        {
          id: 'housing',
          label: {
            de: 'Hilfe bei Problemen in der Wohnung',
            en: 'Help with problems in the flat',
            fr: 'Aide pour les problèmes dans l’appartement',
            uk: 'Допомога з проблемами у квартирі',
            ru: 'Помощь с проблемами в квартире',
            ar: 'مساعدة في مشاكل الشقة',
          },
        },
        {
          id: 'health',
          label: {
            de: 'Hilfe bei der Gesundheit',
            en: 'Help with health',
            fr: 'Aide pour la santé',
            uk: 'Допомога зі здоров’ям',
            ru: 'Помощь со здоровьем',
            ar: 'مساعدة في الصحة',
          },
        },
        {
          id: 'work',
          label: {
            de: 'Hilfe bei Arbeit und Ausbildung',
            en: 'Help with work and training',
            fr: 'Aide pour le travail et la formation',
            uk: 'Допомога з роботою та навчанням',
            ru: 'Помощь с работой и обучением',
            ar: 'مساعدة في العمل والتدريب',
          },
        },
        {
          id: 'language',
          label: {
            de: 'Hilfe bei Deutschkurs und Schule',
            en: 'Help with German classes and school',
            fr: 'Aide pour le cours d’allemand et l’école',
            uk: 'Допомога з курсом німецької та школою',
            ru: 'Помощь с курсом немецкого и школой',
            ar: 'مساعدة في دورة اللغة الألمانية والمدرسة',
          },
        },
        {
          id: 'talks',
          label: {
            de: 'Gespräche und Beratung',
            en: 'Talks and advice',
            fr: 'Des discussions et des conseils',
            uk: 'Розмови та консультації',
            ru: 'Беседы и консультации',
            ar: 'محادثات واستشارات',
          },
        },
      ],
      other: { label: OTHER },
    },
    {
      id: 'aozMissing',
      type: 'text',
      prompt: {
        de: 'Welche Hilfe von der {org} fehlt Ihnen?',
        en: 'What help from {org} is missing for you?',
        fr: 'Quelle aide de l’{org} vous manque ?',
        uk: 'Якої допомоги від {org} Вам не вистачає?',
        ru: 'Какой помощи от {org} Вам не хватает?',
        ar: 'ما المساعدة التي تنقصك من {org}؟',
      },
    },
    {
      id: 'anythingElse',
      type: 'text',
      prompt: {
        de: 'Möchten Sie uns noch etwas sagen?',
        en: 'Is there anything else you would like to tell us?',
        fr: 'Voulez-vous nous dire autre chose ?',
        uk: 'Чи хочете Ви нам ще щось сказати?',
        ru: 'Хотите ли Вы нам ещё что-то сказать?',
        ar: 'هل تريد أن تخبرنا بشيء آخر؟',
      },
    },
  ],
}

export const SURVEY_TEMPLATES: readonly SurveyTemplate[] = [LEBEN_IN_DER_WOHNUNG]

export function surveyTemplate(id: string): SurveyTemplate | undefined {
  return SURVEY_TEMPLATES.find((template) => template.id === id)
}

/** k — results stay hidden below this many responses. */
export const SURVEY_MIN_RESPONSES = { default: 5, min: 3, max: 50 } as const
