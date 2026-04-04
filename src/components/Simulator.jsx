import { useState } from 'react';
import {
  Home,
  TrendingUp,
  DollarSign,
  Building2,
  AlertTriangle,
  Info,
  Calculator,
  Users,
  Landmark,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './Card';
import { Progress } from './Progress';
import {
  calculateUnits,
  calculateCombinationTrack,
  calculateCostPlusTrack,
  calculateRevenueSharing,
  calculateCashExit,
  getRecommendedStrategy,
  formatCurrency,
  formatNumber,
  CONSTANTS,
} from '../utils/calculations';

const PRESET_SIZES = [167, 334, 501];

export function Simulator() {
  const [landArea, setLandArea] = useState(167);

  const units = calculateUnits(landArea);
  const combination = calculateCombinationTrack(units);
  const costPlus = calculateCostPlusTrack(units);
  const revenueSharing = calculateRevenueSharing(units);
  const cashExit = calculateCashExit(units);
  const recommended = getRecommendedStrategy(landArea, units);

  const progressToWholeUnit = (units % 1) * 100;

  const comparisonData = [
    {
      name: 'שילוב (35%)',
      profit: combination.profit / 1000000,
      equity: combination.equityRequired / 1000000,
    },
    {
      name: 'עלות+',
      profit: costPlus.profit / 1000000,
      equity: costPlus.totalEquityRequired / 1000000,
    },
    {
      name: 'תמורות',
      profit: revenueSharing.profit / 1000000,
      equity: revenueSharing.equityRequired / 1000000,
    },
    {
      name: 'מזומן',
      profit: cashExit.profit / 1000000,
      equity: cashExit.equityRequired / 1000000,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="w-12 h-12 text-primary-600" />
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800">
              סימולטור לחלקה 33
            </h1>
          </div>
          <p className="text-xl text-slate-600">
            ניתוח זכויות לבעלי קרקע - תב״ע 10027
          </p>
        </div>

        {/* Input Section */}
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

        {/* Rights Display */}
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
                ({Math.floor(units)} יחידות שלמות + {formatNumber((units % 1) * 100, 0)}%)
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

        {/* Recommended Strategy */}
        {recommended && (
          <Card className="mb-8 shadow-xl border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="bg-gradient-to-l from-green-100 to-emerald-100 rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <TrendingUp className="w-6 h-6" />
                {recommended.title}
              </CardTitle>
              <CardDescription className="text-green-700 text-base font-medium">
                {recommended.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recommended.strategy === 'mixed' && (
                  <>
                    <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                      <div className="text-sm text-slate-600 mb-1">עלות ההון הנדרשת</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {formatCurrency(recommended.details.netEquityNeeded)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                      <div className="text-sm text-slate-600 mb-1">שווי סופי</div>
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(recommended.details.finalValue)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border-2 border-gold-200">
                      <div className="text-sm text-slate-600 mb-1">מזומן ממכירת זכויות</div>
                      <div className="text-2xl font-bold text-gold-700">
                        {formatCurrency(recommended.details.cashReceived)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border-2 border-purple-200">
                      <div className="text-sm text-slate-600 mb-1">רווח משוער</div>
                      <div className="text-2xl font-bold text-purple-700">
                        {formatCurrency(recommended.details.totalProfit)}
                      </div>
                    </div>
                  </>
                )}

                {recommended.strategy === 'combination-cash' && (
                  <>
                    <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                      <div className="text-sm text-slate-600 mb-1">דירות בשילוב</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {recommended.details.combinationUnits} דירות
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {formatCurrency(recommended.details.combinationValue)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                      <div className="text-sm text-slate-600 mb-1">מזומן</div>
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(recommended.details.cashReceived)}
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border-2 border-purple-200 md:col-span-2">
                      <div className="text-sm text-slate-600 mb-1">סה״כ שווי</div>
                      <div className="text-3xl font-bold text-purple-700">
                        {formatCurrency(recommended.details.totalValue)}
                      </div>
                    </div>
                  </>
                )}

                {recommended.strategy === 'combination' && (
                  <>
                    <div className="bg-white p-4 rounded-lg border-2 border-blue-200">
                      <div className="text-sm text-slate-600 mb-1">דירות שלמות</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {recommended.details.wholeUnits} דירות
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border-2 border-green-200">
                      <div className="text-sm text-slate-600 mb-1">שווי כולל</div>
                      <div className="text-2xl font-bold text-green-700">
                        {formatCurrency(recommended.details.totalValue)}
                      </div>
                    </div>
                    {recommended.details.warning && (
                      <div className="md:col-span-2 bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <span className="text-yellow-800 font-medium">
                          {recommended.details.warning}
                        </span>
                      </div>
                    )}
                  </>
                )}

                {recommended.strategy === 'cash' && (
                  <div className="md:col-span-2 bg-white p-6 rounded-lg border-2 border-green-200">
                    <div className="text-sm text-slate-600 mb-1">מזומן מיידי</div>
                    <div className="text-4xl font-bold text-green-700">
                      {formatCurrency(recommended.details.cashReceived)}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Comparison Chart */}
        <Card className="mb-8 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              השוואת מסלולים
            </CardTitle>
            <CardDescription>
              השוואה בין רווח והון עצמי נדרש (במיליוני ₪)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  formatter={(value) => `${formatNumber(value, 2)}M ₪`}
                  labelStyle={{ direction: 'rtl' }}
                />
                <Legend />
                <Bar dataKey="profit" fill="#10b981" name="רווח" />
                <Bar dataKey="equity" fill="#ef4444" name="הון נדרש" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Track Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Combination Track */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-primary-200">
            <CardHeader className="bg-gradient-to-l from-primary-50 to-blue-50">
              <CardTitle className="flex items-center gap-2 text-primary-800">
                <Building2 className="w-5 h-5" />
                שילוב (35%)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">דירות מוגמרות:</span>
                <span className="font-bold text-lg">{formatNumber(combination.finishedUnits, 2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי כולל:</span>
                <span className="font-bold text-green-600">{formatCurrency(combination.totalValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">הון עצמי נדרש:</span>
                <span className="font-bold text-blue-600">{formatCurrency(combination.equityRequired)}</span>
              </div>

              {combination.hasMushaProblem && (
                <div className="bg-yellow-50 border border-yellow-300 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <div className="font-semibold text-yellow-800 mb-1">⚠️ אזהרת מושע</div>
                    <div className="text-yellow-700">
                      תהיה שותפות במושע עבור {formatNumber(combination.fractionalPart * 100, 0)}% מדירה
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <strong>מס רווח הון:</strong> חל רק על החלק הנמכר.
                  <strong className="mr-2">היטל השבחה:</strong> לרוב מכוסה/ממומן על ידי היזם.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Plus Track */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-green-200">
            <CardHeader className="bg-gradient-to-l from-green-50 to-emerald-50">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Landmark className="w-5 h-5" />
                עלות+ (שירותי בנייה)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">דירות מוגמרות:</span>
                <span className="font-bold text-lg">{formatNumber(costPlus.finishedUnits, 2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">הון נדרש ליחידה:</span>
                <span className="font-bold text-red-600">{formatCurrency(costPlus.equityRequiredPerUnit)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">סה״כ הון נדרש:</span>
                <span className="font-bold text-red-600">{formatCurrency(costPlus.totalEquityRequired)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי שוק:</span>
                <span className="font-bold text-green-600">{formatCurrency(costPlus.totalMarketValue)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-slate-600">רווח משוער:</span>
                <span className="font-bold text-lg text-purple-600">{formatCurrency(costPlus.profit)}</span>
              </div>

              <div className="bg-green-50 border border-green-200 p-3 rounded-lg flex items-start gap-2">
                <Info className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-700">
                  עלות בנייה: {formatCurrency(costPlus.constructionCost)} +
                  דמי יזם ({formatNumber(CONSTANTS.ENTREPRENEUR_FEE_COST_PLUS * 100, 1)}%): {formatCurrency(costPlus.entrepreneurFee)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Sharing */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-gold-200">
            <CardHeader className="bg-gradient-to-l from-gold-50 to-yellow-50">
              <CardTitle className="flex items-center gap-2 text-gold-800">
                <Users className="w-5 h-5" />
                תמורות (שיתוף הכנסות)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">דירות:</span>
                <span className="font-bold text-lg">{formatNumber(revenueSharing.finishedUnits, 2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי כולל:</span>
                <span className="font-bold">{formatCurrency(revenueSharing.totalMarketValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">אחוז שיתוף:</span>
                <span className="font-bold text-gold-600">{formatNumber(revenueSharing.revenueSharePercent * 100, 0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">חלקך:</span>
                <span className="font-bold text-green-600">{formatCurrency(revenueSharing.yourShare)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">הון עצמי נדרש:</span>
                <span className="font-bold text-blue-600">{formatCurrency(revenueSharing.equityRequired)}</span>
              </div>

              <div className="bg-gold-50 border border-gold-200 p-3 rounded-lg flex items-start gap-2">
                <Info className="w-5 h-5 text-gold-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-gold-700">
                  היזם בונה ואתה משתף בהכנסות. אחוזים משתנים לפי הסכם.
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Exit */}
          <Card className="shadow-lg hover:shadow-xl transition-shadow border-emerald-200">
            <CardHeader className="bg-gradient-to-l from-emerald-50 to-green-50">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <DollarSign className="w-5 h-5" />
                יציאה במזומן
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">שווי קרקע גולמי:</span>
                <span className="font-bold">{formatCurrency(cashExit.grossLandValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">היטל השבחה:</span>
                <span className="font-bold text-red-600">-{formatCurrency(cashExit.bettermentLevy)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">רווח יזמי ({formatNumber(CONSTANTS.CASH_EXIT_DISCOUNT * 100, 0)}%):</span>
                <span className="font-bold text-red-600">-{formatCurrency(cashExit.entrepreneurProfit)}</span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-slate-600 font-semibold">מזומן נטו:</span>
                <span className="font-bold text-2xl text-green-600">{formatCurrency(cashExit.netCashAmount)}</span>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-start gap-2">
                <Info className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-emerald-700">
                  מזומן מיידי וליקוידי - ללא סיכון שותפות או צורך בהון.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm mt-12 pb-8">
          <p>
            הנתונים המוצגים הם אומדנים בלבד ואינם מהווים ייעוץ משפטי או פינסי.
          </p>
          <p className="mt-2">
            יש להתייעץ עם יועץ מקצועי לפני קבלת החלטות.
          </p>
        </div>
      </div>
    </div>
  );
}
