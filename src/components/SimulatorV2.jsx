import { useState } from 'react';
import {
  Home,
  DollarSign,
  Building2,
  AlertTriangle,
  Info,
  Calculator,
  Users,
  Landmark,
  LineChart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Progress } from './Progress';
import { AdvancedSettings } from './AdvancedSettings';
import { InfoPage } from './InfoPage';
import { Tooltip } from './Tooltip';
import { TOOLTIPS } from '../content/tooltips';
import { useSimulation } from '../hooks/useSimulation';
import { formatCurrency, formatNumber } from '../utils/calculations';
import {
  HEADER_SUBTITLE,
  DISCLAIMER_SHORT,
  CHART_HELP_STRIP,
} from '../content/sourcesAndDisclaimer';

const PRESET_SIZES = [167, 334, 501];

export function SimulatorV2() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const simulation = useSimulation(167);
  const {
    landArea,
    setLandArea,
    units,
    marketValuePerApartment,
    combination,
    costPlus,
    revenueSharing,
    cashExit,
    config,
  } = simulation;

  const soldToDeveloperPct = Math.round(100 - config.combinationPct);
  const progressToWholeUnit = (units % 1) * 100;

  const comparisonData = [
    {
      name: 'עסקת קומבינציה',
      profit: combination.profit / 1000000,
      equity: combination.equityRequired / 1000000,
    },
    {
      name: 'שירותי בנייה',
      profit: costPlus.profit / 1000000,
      equity: costPlus.totalEquityRequired / 1000000,
    },
    {
      name: 'עסקת תמורות',
      profit: revenueSharing.profit / 1000000,
      equity: revenueSharing.equityRequired / 1000000,
    },
    {
      name: 'עסקת מזומן',
      profit: cashExit.profit / 1000000,
      equity: cashExit.equityRequired / 1000000,
    },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-6 sm:py-8 px-3 sm:px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-x-hidden">
      <div className="fixed z-50 flex flex-col gap-2 sm:flex-row sm:items-center top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))]">
        <AdvancedSettings simulation={simulation} />
        <button
          type="button"
          onClick={() => setIsInfoOpen(true)}
          className="bg-blue-600 text-white min-h-12 min-w-12 p-3 sm:p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all hover:scale-110 border-2 border-blue-500 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2"
          aria-label="מידע, מקורות ומושגים"
        >
          <Info className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>

      <InfoPage isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />

      <div className="max-w-7xl mx-auto pt-[calc(5.5rem+env(safe-area-inset-top))] sm:pt-4">
        <div className="text-center mb-8 sm:mb-10">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-4">
            <Building2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary-600 shrink-0" />
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-slate-800 text-balance px-1">
              סימולטור לחלקה 33
            </h1>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed px-1">
            {HEADER_SUBTITLE}
          </p>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mt-4 max-w-3xl mx-auto">
            {DISCLAIMER_SHORT}
          </p>
          <p className="text-sm text-slate-500 mt-3">
            פתחו את ההגדרות המתקדמות כדי לשנות הנחות; המספרים בכרטיסים ובגרף מתעדכנים מיד.
          </p>
        </div>

        <Card className="mb-8 shadow-lg border-primary-200">
          <CardHeader className="bg-gradient-to-l from-primary-50 to-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2">
              <Calculator className="w-6 h-6" />
              שטח הקרקע שלך
            </CardTitle>
            <CardDescription>הזן את שטח הקרקע שלך במ״ר</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  שטח במ״ר
                </label>
                <input
                  type="number"
                  value={landArea}
                  onChange={(e) => setLandArea(Math.max(0, Number(e.target.value)))}
                  className="w-full px-4 py-3 text-2xl font-bold text-center border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  placeholder="167"
                />
              </div>

              <div className="flex gap-3 flex-wrap justify-center">
                {PRESET_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setLandArea(size)}
                    className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                      landArea === size
                        ? 'bg-primary-600 text-white shadow-lg scale-105'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {size} מ״ר
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 shadow-lg border-gold-300 bg-gradient-to-bl from-gold-50 to-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gold-800">
              <Home className="w-6 h-6" />
              סה״כ זכויות שלך
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-5xl font-bold text-gold-700 mb-2">
                {formatNumber(units, 2)} יחידות
              </div>
              <div className="text-slate-600 mb-4">
                ({Math.floor(units)} יחידות שלמות + {formatNumber((units % 1) * 100, 0)}% מיחידה
                נוספת)
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>התקדמות ליחידה שלמה הבאה</span>
                  <span>{formatNumber(progressToWholeUnit, 0)}%</span>
                </div>
                <Progress
                  value={progressToWholeUnit}
                  className="h-6"
                  indicatorClassName="bg-gradient-to-l from-gold-500 to-gold-600"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-6 h-6" />
              השוואת מסלולים
            </CardTitle>
            <CardDescription>
              רווח והון נדרש לכל מסלול (במיליוני ₪). שני צירים — רווח (ימין) והון (שמאל) — לקריאה
              ברורה יותר.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-600 mb-3">{CHART_HELP_STRIP}</p>
            <div className="w-full min-w-0 h-[min(20rem,50vh)] sm:h-[min(24rem,55vh)] min-h-[200px] sm:min-h-[220px] -mx-1 px-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonData}
                  margin={{ top: 8, right: 4, left: 4, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    height={72}
                    tickMargin={6}
                  />
                  <YAxis
                    yAxisId="equity"
                    orientation="left"
                    width={40}
                    tickFormatter={(v) => formatNumber(v, 1)}
                  />
                  <YAxis
                    yAxisId="profit"
                    orientation="right"
                    width={40}
                    tickFormatter={(v) => formatNumber(v, 1)}
                  />
                  <RechartsTooltip
                    formatter={(value) => `${formatNumber(value, 2)}M ₪`}
                    labelStyle={{ direction: 'rtl' }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="profit"
                    dataKey="profit"
                    fill="#10b981"
                    name="רווח (M₪)"
                  />
                  <Bar
                    yAxisId="equity"
                    dataKey="equity"
                    fill="#ef4444"
                    name="הון נדרש (M₪)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-primary-200">
            <CardHeader className="bg-gradient-to-l from-primary-50 to-blue-50">
              <CardTitle className="flex flex-wrap items-center gap-2 text-primary-800">
                <Building2 className="w-5 h-5" />
                עסקת קומבינציה ({config.combinationPct}%)
                <Tooltip content={TOOLTIPS.combination} />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm">
                <div className="font-semibold text-blue-800 mb-2">גורמים משפיעים:</div>
                <ul className="text-blue-700 space-y-1">
                  <li>• אחוז הקומבינציה ({config.combinationPct}%)</li>
                  <li>• שווי שוק של דירה מוגמרת ({formatCurrency(marketValuePerApartment)})</li>
                  <li>
                    • מס שבח על החלק שנמכר ({config.capitalGainsTax}%)
                  </li>
                  <li>• שטח הקרקע ({landArea} מ״ר)</li>
                </ul>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">דירות מוגמרות:</span>
                <span className="font-bold text-lg">{formatNumber(combination.finishedUnits, 2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי דירות מוגמרות:</span>
                <span className="font-bold text-green-600">{formatCurrency(combination.totalValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">זכויות שנמכרו ליזם:</span>
                <span className="font-bold text-slate-600">
                  {formatNumber(combination.soldUnits, 2)} יח״ד ({soldToDeveloperPct}%)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 flex items-center gap-1">
                  מס שבח ({config.capitalGainsTax}%):
                  <Tooltip
                    content={`מס שבח חל על החלק שנמכר ליזם — כ-${soldToDeveloperPct}% מהזכויות לפי ההגדרות`}
                  />
                </span>
                <span className="font-bold text-red-600">-{formatCurrency(combination.capitalGainsTax)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 flex items-center gap-1">
                  היטל השבחה:
                  <Tooltip content="מכוסה על ידי היזם" />
                </span>
                <span className="font-bold text-green-600">מכוסה ע״י יזם</span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-slate-700 font-semibold">רווח נטו:</span>
                <span className="font-bold text-xl text-purple-600">{formatCurrency(combination.profit)}</span>
              </div>

              {combination.hasMushaProblem && (
                <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-yellow-800 mb-1 flex items-center gap-1">
                      אזהרת מושע
                      <Tooltip content={TOOLTIPS.musha} />
                    </div>
                    <div className="text-yellow-700">
                      תהיה שותפות במושע עבור {formatNumber(combination.fractionalPart * 100, 0)}% מדירה
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow border-green-200">
            <CardHeader className="bg-gradient-to-l from-green-50 to-emerald-50">
              <CardTitle className="flex flex-wrap items-center gap-2 text-green-800">
                <Landmark className="w-5 h-5" />
                שירותי בנייה (עלות+)
                <Tooltip content={TOOLTIPS.costPlus} />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">
                הסכום משקף עלות <strong>סטילית</strong> לפי מספר יחידות הזכות (כולל שברים). בפועל לעיתים
                בונים דירה אחת שלמה ומממשים שאר הזכויות במזומן — פירוט רעיוני במדריך המידע.
              </p>
              <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm">
                <div className="font-semibold text-green-800 mb-2">גורמים משפיעים:</div>
                <ul className="text-green-700 space-y-1">
                  <li>• עלות בנייה למ״ר ({formatCurrency(config.costPerSqm)})</li>
                  <li>• אחוז עמלת יזם ({config.entrepreneurMarkup}%)</li>
                  <li>• מע״מ ({config.vatRate}%)</li>
                  <li>• היטל השבחה ({formatCurrency(config.bettermentLevyPerUnit)})</li>
                  <li>• גודל דירה ({config.apartmentSizeSqm} מ״ר)</li>
                  <li>
                    • סף הון ({config.requiredEquityPct}% מסך העלות):{' '}
                    {formatCurrency(costPlus.equityBarrier)}
                  </li>
                </ul>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">דירות מוגמרות:</span>
                <span className="font-bold text-lg">{formatNumber(costPlus.finishedUnits, 2)}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                <div className="text-sm font-semibold text-slate-700 mb-2">פירוט עלויות ליחידה:</div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">עלות בנייה ({config.apartmentSizeSqm} מ״ר):</span>
                  <span>{formatCurrency(costPlus.constructionCostPerApartment)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">עמלת יזם ({config.entrepreneurMarkup}%):</span>
                  <span>{formatCurrency(costPlus.entrepreneurFee)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t pt-1">
                  <span className="text-slate-600">סכום ביניים:</span>
                  <span>{formatCurrency(costPlus.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">מע״מ ({config.vatRate}%):</span>
                  <span>{formatCurrency(costPlus.vat)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 flex items-center gap-1">
                    היטל השבחה:
                    <Tooltip content={TOOLTIPS.bettermentLevy} />
                  </span>
                  <span>{formatCurrency(costPlus.bettermentLevy)}</span>
                </div>
                <div className="flex justify-between items-center text-sm border-t pt-1 font-bold">
                  <span className="text-slate-700">סה״כ ליחידה:</span>
                  <span className="text-red-600">{formatCurrency(costPlus.costPerUnit)}</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-slate-600">סה״כ השקעה נדרשת:</span>
                <span className="font-bold text-2xl text-red-600">{formatCurrency(costPlus.totalEquityRequired)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי שוק:</span>
                <span className="font-bold text-green-600">{formatCurrency(costPlus.totalMarketValue)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                <span className="text-slate-700 font-semibold">רווח נטו:</span>
                <span className="font-bold text-xl text-purple-600">{formatCurrency(costPlus.profit)}</span>
              </div>

              <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-lg">
                <div className="text-sm font-semibold text-amber-800 flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <strong>הערה חשובה:</strong>
                </div>
                <div className="text-sm text-amber-700 space-y-1">
                  <p>• מספר הדירות שיהיו זמינות במסלול זה ייקבע רק לאחר אישור טבלאות האיזון ומגרשי התמורה (שעדיין לא אושרו)</p>
                  <p>• מיקום הדירה בבניין ייקבע בהגרלה פנימית בין בעלי הקרקע</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                <div className="text-sm text-green-700 flex items-center gap-1 mb-1">
                  <Info className="w-4 h-4" />
                  <strong>נקודת איזון:</strong>
                  <Tooltip content={TOOLTIPS.breakEven} />
                </div>
                <div className="text-sm text-green-700">
                  מחיר מינימלי למכירה: {formatCurrency(costPlus.breakEvenPriceSqm)}/מ״ר
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow border-gold-200">
            <CardHeader className="bg-gradient-to-l from-gold-50 to-yellow-50">
              <CardTitle className="flex flex-wrap items-center gap-2 text-gold-800">
                <Users className="w-5 h-5" />
                עסקת תמורות ({config.revenueSharePct}%)
                <Tooltip content={TOOLTIPS.revenueSharing} />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-gold-50 border border-gold-200 p-3 rounded-lg text-sm">
                <div className="font-semibold text-gold-800 mb-2">גורמים משפיעים:</div>
                <ul className="text-gold-700 space-y-1">
                  <li>• אחוז חלוקת ההכנסות ({config.revenueSharePct}%)</li>
                  <li>• שווי שוק של דירה מוגמרת ({formatCurrency(marketValuePerApartment)})</li>
                  <li>• מספר הזכויות שלך ({formatNumber(units, 2)} יח״ד)</li>
                </ul>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">דירות:</span>
                <span className="font-bold text-lg">{formatNumber(revenueSharing.finishedUnits, 2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי כולל:</span>
                <span className="font-bold">{formatCurrency(revenueSharing.totalMarketValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">חלקך:</span>
                <span className="font-bold text-green-600">{formatCurrency(revenueSharing.yourShare)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">הון עצמי נדרש:</span>
                <span className="font-bold text-blue-600">{formatCurrency(revenueSharing.equityRequired)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-slate-700 font-semibold">רווח:</span>
                <span className="font-bold text-xl text-purple-600">{formatCurrency(revenueSharing.profit)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg hover:shadow-xl transition-shadow border-emerald-200">
            <CardHeader className="bg-gradient-to-l from-emerald-50 to-green-50">
              <CardTitle className="flex flex-wrap items-center gap-2 text-emerald-800">
                <DollarSign className="w-5 h-5" />
                עסקת מזומן
                <Tooltip content={TOOLTIPS.cashExit} />
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-sm">
                <div className="font-semibold text-emerald-800 mb-2">גורמים משפיעים:</div>
                <ul className="text-emerald-700 space-y-1">
                  <li>• שווי קרקע ליחידה ({formatCurrency(config.landValuePerUnit)}) — ברוטו; היטל מנוכה בנפרד</li>
                  <li>• אחוז רווח יזמי ({config.entrepreneurProfitMargin}%)</li>
                  <li>• היטל השבחה ({formatCurrency(config.bettermentLevyPerUnit)})</li>
                  <li>• מס שבח ({config.capitalGainsTax}%)</li>
                </ul>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי קרקע גולמי:</span>
                <span className="font-bold">{formatCurrency(cashExit.grossLandValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 flex items-center gap-1">
                  היטל השבחה:
                  <Tooltip content={TOOLTIPS.bettermentLevy} />
                </span>
                <span className="font-bold text-red-600">-{formatCurrency(cashExit.bettermentLevy)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 flex items-center gap-1">
                  רווח יזמי ({config.entrepreneurProfitMargin}%):
                  <Tooltip content={TOOLTIPS.entrepreneurialProfit} />
                </span>
                <span className="font-bold text-red-600">-{formatCurrency(cashExit.entrepreneurProfit)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="text-slate-600">סכום לפני מס:</span>
                <span className="font-bold">{formatCurrency(cashExit.amountBeforeTax)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 flex items-center gap-1">
                  מס שבח ({config.capitalGainsTax}%):
                  <Tooltip content="מס רווח הון על מכירת הקרקע" />
                </span>
                <span className="font-bold text-red-600">-{formatCurrency(cashExit.capitalGainsTax)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-slate-700 font-semibold">מזומן נטו (אחרי כל המיסים):</span>
                <span className="font-bold text-2xl text-green-600">{formatCurrency(cashExit.netCashAmount)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center text-slate-500 text-sm mt-12 pb-8 space-y-2">
          <p>{DISCLAIMER_SHORT}</p>
          <p>הנתונים אינם מהווים ייעוץ משפטי, מס או פיננסי. יש להתייעץ עם יועץ מקצועי לפני קבלת החלטות.</p>
        </div>
      </div>
    </div>
  );
}
