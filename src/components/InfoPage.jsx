import {
  X,
  ArrowRight,
  DollarSign,
  Receipt,
  TrendingUp,
  Home,
  Building2,
  Users,
  Landmark,
  AlertCircle,
  FileText,
  Calculator,
  PieChart,
  Shield,
  CheckCircle,
  XCircle,
  Info,
  Coins,
  Percent,
  Scale
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { SOURCES_SECTION, DISCLAIMER_SHORT } from '../content/sourcesAndDisclaimer';

export function InfoPage({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 bg-opacity-95 overflow-y-auto overscroll-contain">
      <div className="min-h-screen pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-l from-primary-600 to-blue-700 text-white rounded-t-2xl p-4 sm:p-6 sticky top-0 z-10 shadow-2xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <Info className="w-7 h-7 sm:w-8 sm:h-8 shrink-0 mt-0.5" aria-hidden />
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-balance">
                    מדריך מקיף למסלולי ההתקשרות
                  </h1>
                  <p className="text-sm sm:text-base text-blue-100 mt-1 leading-relaxed">
                    הכל שצריך לדעת על מיסוי, עלויות ושיקולים — {DISCLAIMER_SHORT}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded-full border-2 border-white/80 bg-white/25 text-white shadow-md hover:bg-white/40 hover:border-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600 transition-colors"
                aria-label="סגור את המדריך"
              >
                <X className="w-7 h-7 stroke-[2.5]" aria-hidden />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-b-2xl shadow-2xl p-4 sm:p-8 space-y-6 sm:space-y-8 overflow-x-hidden">
            <section
              className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6"
              aria-labelledby="sources-heading"
            >
              <h2
                id="sources-heading"
                className="text-xl font-bold text-amber-900 mb-3 flex items-center gap-2"
              >
                <Shield className="w-6 h-6" />
                {SOURCES_SECTION.title}
              </h2>
              <p className="text-sm text-amber-950 mb-4">{SOURCES_SECTION.intro}</p>
              <ul className="list-disc list-inside text-sm text-amber-950 space-y-2">
                {SOURCES_SECTION.bullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>

            {/* Quick Navigation */}
            <nav className="bg-slate-50 rounded-xl p-6 border-2 border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                ניווט מהיר
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <a href="#combination" className="bg-blue-100 hover:bg-blue-200 p-3 rounded-lg text-center transition-colors">
                  <Building2 className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                  <div className="text-sm font-semibold text-blue-800">עסקת קומבינציה</div>
                </a>
                <a href="#cost-plus" className="bg-green-100 hover:bg-green-200 p-3 rounded-lg text-center transition-colors">
                  <Landmark className="w-6 h-6 mx-auto mb-2 text-green-600" />
                  <div className="text-sm font-semibold text-green-800">שירותי בנייה</div>
                </a>
                <a href="#revenue" className="bg-yellow-100 hover:bg-yellow-200 p-3 rounded-lg text-center transition-colors">
                  <Users className="w-6 h-6 mx-auto mb-2 text-yellow-600" />
                  <div className="text-sm font-semibold text-yellow-800">עסקת תמורות</div>
                </a>
                <a href="#cash" className="bg-emerald-100 hover:bg-emerald-200 p-3 rounded-lg text-center transition-colors">
                  <DollarSign className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                  <div className="text-sm font-semibold text-emerald-800">עסקת מזומן</div>
                </a>
              </div>
            </nav>

            {/* Key Terms Section */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b-2 pb-3">
                <FileText className="w-6 h-6 text-primary-600" />
                מושגי יסוד
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <TermCard
                  icon={<Receipt className="w-8 h-8 text-red-600" />}
                  title="מע״מ (מס ערך מוסף)"
                  percentage="18%"
                  color="red"
                >
                  <p className="mb-2">מס המוטל על מכירת מוצרים ושירותים.</p>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="font-semibold text-red-800 mb-2">איפה משולם:</div>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>✓ <strong>שירותי בנייה:</strong> משולם ע״י הבעלים על כל חשבונית</li>
                      <li>✗ <strong>קומבינציה/תמורות:</strong> אין תשלום מע״מ לבעלים</li>
                    </ul>
                  </div>
                </TermCard>

                <TermCard
                  icon={<Scale className="w-8 h-8 text-orange-600" />}
                  title="מס שבח (מס רווח הון)"
                  percentage="25%"
                  color="orange"
                >
                  <p className="mb-2">מס על רווח ממכירת נדל״ן/קרקע.</p>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="font-semibold text-orange-800 mb-2">איפה משולם:</div>
                    <ul className="text-sm text-orange-700 space-y-1">
                      <li>✓ <strong>קומבינציה:</strong> על החלק שנמכר ליזם (65%)</li>
                      <li>✓ <strong>מזומן:</strong> על כל הסכום</li>
                      <li>✗ <strong>שירותי בנייה:</strong> פטור (אין מכר)</li>
                      <li>✗ <strong>תמורות:</strong> פטור (אין מכר)</li>
                    </ul>
                  </div>
                </TermCard>

                <TermCard
                  icon={<Coins className="w-8 h-8 text-purple-600" />}
                  title="היטל השבחה"
                  percentage="~160K ₪/יח״ד"
                  color="purple"
                >
                  <p className="mb-2">מס על עליית ערך קרקע עקב תב״ע.</p>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="font-semibold text-purple-800 mb-2">מי משלם:</div>
                    <ul className="text-sm text-purple-700 space-y-1">
                      <li>✓ <strong>קומבינציה:</strong> היזם משלם</li>
                      <li>✓ <strong>שירותי בנייה:</strong> הבעלים משלמים (חלק מהעלות)</li>
                      <li>✓ <strong>מזומן:</strong> מנוכה מהתמורה</li>
                      <li>✓ <strong>תמורות:</strong> היזם משלם</li>
                    </ul>
                  </div>
                </TermCard>

                <TermCard
                  icon={<TrendingUp className="w-8 h-8 text-blue-600" />}
                  title="רווח יזמי"
                  percentage="14.5%-18%"
                  color="blue"
                >
                  <p className="mb-2">האחוז שהיזם לוקח כרווח.</p>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="font-semibold text-blue-800 mb-2">לפי מסלול:</div>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>שירותי בנייה:</strong> 14.5%-15.5% מעלות הבנייה</li>
                      <li>• <strong>קומבינציה:</strong> 17-19% מסך העלויות</li>
                      <li>• <strong>מזומן:</strong> 18% מערך הקרקע</li>
                    </ul>
                  </div>
                </TermCard>
              </div>
            </section>

            {/* Track Details */}
            <section id="combination">
                <TrackDetailCard
                icon={<Building2 className="w-10 h-10" />}
                title="עסקת קומבינציה"
                subtitle="אחוז מהזכויות כדירות מוגמרות (ברירת מחדל 35% — ניתן לשינוי בסימולטור)"
                color="blue"
              >
                <div className="space-y-4">
                  <div className="bg-blue-50 border-r-4 border-blue-400 p-4 rounded-lg">
                    <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      איך זה עובד?
                    </h4>
                    <p className="text-blue-800">
                      אתה מוכר ליזם את רוב הזכויות (למשל 65% כשהקומבינציה 35%), והיזם בונה ונותן לך את אחוז הקומבינציה כדירות מוגמרות.
                      <strong className="block mt-2">
                        לדירה שלמה אחת בקומבינציה של 35%: ~314 מ״ר קרקע (110 ÷ 0.35)
                      </strong>
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="font-bold text-green-900">יתרונות</h4>
                      </div>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• אין צורך בהון עצמי</li>
                        <li>• היזם מכסה את היטל ההשבחה</li>
                        <li>• אין מע״מ לשלם</li>
                        <li>• דירה מוגמרת ללא מאמץ</li>
                      </ul>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-red-900">חסרונות</h4>
                      </div>
                      <ul className="text-sm text-red-800 space-y-1">
                        <li>• מס שבח 25% על החלק שנמכר</li>
                        <li>• סכנת "מושע" (שותפות בדירה)</li>
                        <li>• מקבלים רק 35% מהזכויות</li>
                        <li>• תלוי באיכות בנייה של היזם</li>
                      </ul>
                    </div>
                  </div>

                  <CostBreakdown
                    title="פירוט עלויות - דוגמה: 167 מ״ר (1.52 יח״ד)"
                    items={[
                      { label: 'דירות מוגמרות (35%)', value: '0.532 דירות', color: 'green' },
                      { label: 'זכויות שנמכרו (65%)', value: '0.988 יח״ד', color: 'slate' },
                      { label: 'מס שבח (25%)', value: '-187,720 ₪', color: 'red' },
                      { label: 'היטל השבחה', value: 'מכוסה ע״י יזם', color: 'green' },
                      { label: 'רווח נטו', value: '1,142,280 ₪', color: 'purple', bold: true },
                    ]}
                  />
                </div>
              </TrackDetailCard>
            </section>

            <section id="cost-plus">
              <TrackDetailCard
                icon={<Landmark className="w-10 h-10" />}
                title="שירותי בנייה (עלות+)"
                subtitle="תשלום עלות הבנייה + עמלה, שמירה על 100% מהזכויות"
                color="green"
              >
                <div className="space-y-4">
                  <div className="bg-green-50 border-r-4 border-green-400 p-4 rounded-lg">
                    <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      איך זה עובד?
                    </h4>
                    <p className="text-green-800">
                      אתה משלם ליזם את עלות הבנייה בפועל + עמלה (14.5%-15.5%) + מע״מ + היטל השבחה.
                      <strong className="block mt-2">הרווח היזמי נשאר אצלך במלואו!</strong>
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="font-bold text-green-900">יתרונות</h4>
                      </div>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• שומר על 100% מהזכויות</li>
                        <li>• אין מס שבח (אין מכר)</li>
                        <li>• הרווח היזמי אצלך</li>
                        <li>• עמלה נמוכה (14.5%)</li>
                      </ul>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-red-900">חסרונות</h4>
                      </div>
                      <ul className="text-sm text-red-800 space-y-1">
                        <li>• דורש הון עצמי גבוה (~1.63M ₪)</li>
                        <li>• צריך לשלם מע״מ 18%</li>
                        <li>• משלמים היטל השבחה</li>
                        <li>• מיקום בהגרלה פנימית</li>
                      </ul>
                    </div>
                  </div>

                  <CostBreakdown
                    title="פירוט עלויות - דירת 100 מ״ר"
                    items={[
                      { label: 'עלות בנייה (11,000 ₪/מ״ר)', value: '1,100,000 ₪', color: 'slate' },
                      { label: 'עמלת יזם (14.5%)', value: '+159,500 ₪', color: 'slate' },
                      { label: 'סכום ביניים', value: '1,259,500 ₪', color: 'blue' },
                      { label: 'מע״מ (18%)', value: '+226,710 ₪', color: 'red' },
                      { label: 'היטל השבחה', value: '+160,000 ₪', color: 'red' },
                      { label: 'סה״כ השקעה', value: '1,646,210 ₪', color: 'purple', bold: true },
                    ]}
                  />

                  <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <h4 className="font-bold text-amber-900">הערה חשובה</h4>
                    </div>
                    <p className="text-sm text-amber-800">
                      מספר הדירות שיהיו זמינות ייקבע רק לאחר אישור טבלאות האיזון ומגרשי התמורה.
                      מיקום הדירה ייקבע בהגרלה פנימית בין בעלי הקרקע.
                    </p>
                  </div>
                </div>
              </TrackDetailCard>
            </section>

            <section id="revenue">
              <TrackDetailCard
                icon={<Users className="w-10 h-10" />}
                title="עסקת תמורות"
                subtitle="חלק בעל הקרקע מההכנסות (ברירת מחדל 45% בסימולטור; בפועל לפי הסכם)"
                color="yellow"
              >
                <div className="space-y-4">
                  <div className="bg-yellow-50 border-r-4 border-yellow-400 p-4 rounded-lg">
                    <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      איך זה עובד?
                    </h4>
                    <p className="text-yellow-800">
                      היזם בונה את הפרויקט על חשבונו, ואתם מתחלקים בהכנסות בפועל ממכירת הדירות.
                      <strong className="block mt-2">תמורה במזומן, אין שותפות בדירות!</strong>
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="font-bold text-green-900">יתרונות</h4>
                      </div>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• אין צורך בהון עצמי</li>
                        <li>• אין מס שבח (אין מכר)</li>
                        <li>• מונע "מושע" (תמורה במזומן)</li>
                        <li>• שקיפות - חלוקה לפי מכירות בפועל</li>
                      </ul>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-red-900">חסרונות</h4>
                      </div>
                      <ul className="text-sm text-red-800 space-y-1">
                        <li>
                          • חלקכם בהכנסות נקבע בהסכם (בסימולטור: 45% כברירת מחדל)
                        </li>
                        <li>• תלוי בהצלחת מכירות היזם</li>
                        <li>• תשלום נדחה (עד למכירה)</li>
                        <li>• אין שליטה על תהליך המכירה</li>
                      </ul>
                    </div>
                  </div>

                  <CostBreakdown
                    title="דוגמה: 167 מ״ר (1.52 יח״ד), חלק 45% מההכנסות (כברירת מחדל בסימולטור)"
                    items={[
                      { label: 'שווי כולל (1.52 × 2.5M)', value: '3,800,000 ₪', color: 'slate' },
                      { label: 'חלקך (45%)', value: '1,710,000 ₪', color: 'green' },
                      { label: 'מס שבח', value: 'פטור', color: 'green' },
                      { label: 'היטל השבחה', value: 'היזם משלם', color: 'green' },
                      { label: 'רווח נטו (לפני מיסוי אחר / עיתוי מכירות)', value: '1,710,000 ₪', color: 'purple', bold: true },
                    ]}
                  />
                </div>
              </TrackDetailCard>
            </section>

            <section id="cash">
              <TrackDetailCard
                icon={<DollarSign className="w-10 h-10" />}
                title="עסקת מזומן"
                subtitle="מכירה מיידית של כל הזכויות"
                color="emerald"
              >
                <div className="space-y-4">
                  <div className="bg-emerald-50 border-r-4 border-emerald-400 p-4 rounded-lg">
                    <h4 className="font-bold text-emerald-900 mb-2 flex items-center gap-2">
                      <Calculator className="w-5 h-5" />
                      איך זה עובד?
                    </h4>
                    <p className="text-emerald-800">
                      מכירה ישירה של כל הזכויות ליזם תמורת תשלום במזומן.
                      <strong className="block mt-2">נזילות מיידית - קבלת כסף מיד!</strong>
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <h4 className="font-bold text-green-900">יתרונות</h4>
                      </div>
                      <ul className="text-sm text-green-800 space-y-1">
                        <li>• מזומן מיידי</li>
                        <li>• אין סיכון פרויקט</li>
                        <li>• אין צורך במעורבות</li>
                        <li>• שימושי למימון צולב</li>
                      </ul>
                    </div>

                    <div className="bg-red-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <XCircle className="w-5 h-5 text-red-600" />
                        <h4 className="font-bold text-red-900">חסרונות</h4>
                      </div>
                      <ul className="text-sm text-red-800 space-y-1">
                        <li>• רווח נמוך יותר</li>
                        <li>• מס שבח 25%</li>
                        <li>• ניכוי רווח יזמי 18%</li>
                        <li>• ניכוי היטל השבחה</li>
                      </ul>
                    </div>
                  </div>

                  <CostBreakdown
                    title="דוגמה: 167 מ״ר (1.52 יח״ד)"
                    items={[
                      { label: 'שווי קרקע (1.52 × 760K)', value: '1,155,200 ₪', color: 'slate' },
                      { label: 'היטל השבחה', value: '-243,200 ₪', color: 'red' },
                      { label: 'רווח יזמי (18%)', value: '-207,936 ₪', color: 'red' },
                      { label: 'סכום לפני מס', value: '704,064 ₪', color: 'blue' },
                      { label: 'מס שבח (25%)', value: '-176,016 ₪', color: 'red' },
                      { label: 'מזומן נטו', value: '528,048 ₪', color: 'purple', bold: true },
                    ]}
                  />

                  <div className="bg-blue-50 border-2 border-blue-300 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Info className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-blue-900">שימוש אסטרטגי</h4>
                    </div>
                    <p className="text-sm text-blue-800">
                      קרדן נדל״ן מאפשרת מכירה של עד 20% מהזכויות. שימושי למימון צולב:
                      מוכרים את שבר הדירה (0.52) ומשתמשים בכסף כהון עצמי לבניית דירה שלמה בשירותי בנייה!
                    </p>
                  </div>
                </div>
              </TrackDetailCard>
            </section>

            {/* Comparison Table */}
            <section>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2 border-b-2 pb-3">
                <Scale className="w-6 h-6 text-primary-600" />
                טבלת השוואה מקיפה
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="p-3 text-right">פרמטר</th>
                      <th className="p-3 text-center">קומבינציה</th>
                      <th className="p-3 text-center">שירותי בנייה</th>
                      <th className="p-3 text-center">תמורות</th>
                      <th className="p-3 text-center">מזומן</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ComparisonRow label="הון עצמי נדרש" values={['0 ₪', '~1.65M ₪', '0 ₪', '0 ₪']} />
                    <ComparisonRow label="מע״מ" values={['לא', 'כן - 18%', 'לא', 'לא']} />
                    <ComparisonRow
                      label="מס שבח (דוגמה)"
                      values={['על חלק שנמכר ליזם', 'פטור', 'פטור', 'על התמורה']}
                    />
                    <ComparisonRow label="היטל השבחה" values={['יזם משלם', 'בעלים משלמים', 'יזם משלם', 'מנוכה']} />
                    <ComparisonRow
                      label="מה מקבלים (תמצית)"
                      values={[
                        '~35% זכויות כדירות',
                        '100% זכויות',
                        'חלק בהכנסות (דוגמה 45%)',
                        'מזומן על כל הזכויות',
                      ]}
                    />
                    <ComparisonRow label="נזילות" values={['דירה', 'דירה', 'מזומן', 'מזומן מיידי']} />
                    <ComparisonRow label="סיכון" values={['בינוני', 'נמוך', 'בינוני', 'אפס']} />
                  </tbody>
                </table>
              </div>
            </section>

            {/* Back Button */}
            <div className="flex justify-center pt-8">
              <button
                type="button"
                onClick={onClose}
                className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-xl font-bold text-lg flex items-center gap-3 shadow-xl transition-all hover:scale-105"
              >
                <ArrowRight className="w-6 h-6" />
                חזרה לסימולטור
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function TermCard({ icon, title, percentage, color, children }) {
  const colors = {
    red: 'border-red-200 bg-gradient-to-br from-red-50 to-white',
    orange: 'border-orange-200 bg-gradient-to-br from-orange-50 to-white',
    purple: 'border-purple-200 bg-gradient-to-br from-purple-50 to-white',
    blue: 'border-blue-200 bg-gradient-to-br from-blue-50 to-white',
  };

  return (
    <Card className={`border-2 ${colors[color]}`}>
      <CardHeader>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <div className="text-2xl font-bold text-primary-600">{percentage}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function TrackDetailCard({ icon, title, subtitle, color, children }) {
  const colors = {
    blue: 'from-blue-600 to-blue-700',
    green: 'from-green-600 to-green-700',
    yellow: 'from-yellow-600 to-yellow-700',
    emerald: 'from-emerald-600 to-emerald-700',
  };

  return (
    <Card className="border-2 shadow-xl">
      <CardHeader className={`bg-gradient-to-l ${colors[color]} text-white rounded-t-xl`}>
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <CardTitle className="text-2xl text-white">{title}</CardTitle>
            <p className="text-white text-opacity-90">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}

function CostBreakdown({ title, items }) {
  return (
    <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
      <h4 className="font-bold text-slate-800 mb-3">{title}</h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex justify-between items-center p-2 rounded ${
              item.bold ? 'bg-purple-100 font-bold border-2 border-purple-300' : ''
            }`}
          >
            <span className={`text-${item.color}-800`}>{item.label}:</span>
            <span className={`text-${item.color}-800 ${item.bold ? 'text-lg' : ''}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonRow({ label, values }) {
  return (
    <tr className="border-b hover:bg-slate-50">
      <td className="p-3 font-semibold text-slate-700">{label}</td>
      {values.map((value, idx) => (
        <td key={idx} className="p-3 text-center text-slate-600">
          {value}
        </td>
      ))}
    </tr>
  );
}
