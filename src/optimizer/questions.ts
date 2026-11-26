/** Follow-up questions — asked only when the answer could change the outcome materially. */
import { hasKnownBasis } from '../domain/taxation';
import type { FollowUpQuestion, StrategyResult, UserProfile } from '../domain/types';

export function findMaterialUnknowns(results: StrategyResult[], profile: UserProfile): FollowUpQuestion[] {
  const qs: FollowUpQuestion[] = [];
  const anyDebt = results.some((r) => r.mortgageRequired > 1);

  if (profile.availableCapital === null) {
    qs.push({
      id: 'capital',
      question: 'כמה כסף פנוי תוכלו להשקיע?',
      why: 'בלי הסכום הזה אי אפשר לדעת אילו מסלולים דורשים מימון שאין לכם.',
    });
  }
  if (profile.maxMonthlyRepayment === null && anyDebt) {
    qs.push({
      id: 'repayment',
      question: 'כמה תוכלו להחזיר בחודש על משכנתא חדשה?',
      why: 'חלק מהמסלולים דורשים משכנתא. כרגע הם מסומנים ״בתנאים מסוימים״ עד שנדע את יכולת ההחזר.',
    });
  }
  if (!hasKnownBasis(profile)) {
    const spread = results.reduce((m, r) => Math.max(m, r.capitalGainsRange.high - r.capitalGainsRange.low), 0);
    if (spread > 50000) {
      qs.push({
        id: 'basis',
        question: 'מתי ובכמה נרכשה הקרקע (או התקבלה בירושה)?',
        why: `מס השבח תלוי בעלות הרכישה. בלי הנתון הזה הפער באומדן המס מגיע לכ-${Math.round(spread / 1000)} אלף ₪, ואנחנו מניחים את הגבוה.`,
      });
    }
  }
  if (!profile.lotId) {
    qs.push({
      id: 'lot',
      question: 'לאיזה מגרש הוקציתם בטבלה (149, 150 או 153)?',
      why: 'המגרש משפיע מעט על אומדן היטל ההשבחה. אם לא ידוע, מחושב לפי מגרש 149.',
    });
  }
  return qs;
}
