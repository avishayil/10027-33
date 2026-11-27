/**
 * Follow-up questions — asked only when the answer could change the recommendation.
 * Each optional unknown is tested by re-running the core analysis with plausible answers.
 */
import { hasKnownBasis } from '../domain/taxation';
import type { FollowUpQuestion, ProjectConfig, RightsInfo, UserProfile } from '../domain/types';

export function findMaterialUnknowns(
  profile: UserProfile,
  info: RightsInfo,
  changesOutcome: (p: UserProfile) => boolean,
  config: ProjectConfig,
): FollowUpQuestion[] {
  const qs: FollowUpQuestion[] = [];
  // Material = the recommended strategy, its affordability or its funding need changes — not just any number.
  const changes = (variants: Partial<UserProfile>[]) => variants.some((v) => changesOutcome({ ...profile, ...v }));

  if (profile.availableCapital === null) {
    // Without it nothing that needs money can be assessed — always ask.
    qs.push({
      id: 'capital',
      question: 'כמה כסף פנוי תוכלו להשקיע?',
      why: 'בלי הסכום הזה אי אפשר לדעת אילו מסלולים דורשים כסף שאין לכם (מסים והיטל משולמים במזומן).',
    });
    return qs;
  }

  if (profile.maxMonthlyRepayment === null && changes([{ maxMonthlyRepayment: 0 }, { maxMonthlyRepayment: 20000 }])) {
    qs.push({
      id: 'repayment',
      question: 'כמה תוכלו להחזיר בחודש על משכנתא חדשה?',
      why: 'התשובה יכולה לשנות את המסלול המומלץ: חלק מהמסלולים אפשריים רק עם משכנתא.',
    });
  }

  if (!hasKnownBasis(profile) && changes([{ acquisitionBasis: info.table.incomingValue }])) {
    qs.push({
      id: 'basis',
      question: 'מתי ובכמה נרכשה הקרקע (או התקבלה בירושה)?',
      why: 'מס השבח תלוי בעלות הרכישה, וההנחה השמרנית שלנו (עלות אפס) משנה כאן את המסלול המומלץ.',
    });
  }

  if (profile.soleHome == null && changes([{ soleHome: true }, { soleHome: false }])) {
    qs.push({
      id: 'soleHome',
      question: 'האם הדירה שתקבלו תהיה הדירה היחידה שלכם?',
      why: 'מס הרכישה על השלמה לדירה שלמה הוא 0% לדירה יחידה (בתוך מדרגת הפטור) ועד כ-8% לדירה נוספת — וזה משנה כאן את ההמלצה.',
    });
  }

  if (!profile.lotId && changes(config.rights.lotIds.map((lotId) => ({ lotId })))) {
    qs.push({
      id: 'lot',
      question: 'לאיזה מגרש הוקציתם בטבלה (149, 150 או 153)?',
      why: 'המגרש משנה את אומדן היטל ההשבחה, ובמקרה שלכם זה משנה את המסלול המומלץ.',
    });
  }
  return qs;
}
