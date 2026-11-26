/** Source registry: where each class of information should come from and how often to review it. */
import { MAVAT_URL } from './parcel33';

export interface SourceEntry {
  information: string;
  source: string;
  url?: string;
  review: string;
}

export const SOURCE_REGISTRY: SourceEntry[] = [
  { information: 'טבלאות איזון והקצאה', source: 'מבא״ת — תכנית 302-1306018', url: MAVAT_URL, review: 'בכל עדכון תכנוני' },
  { information: 'עסקאות קרקע', source: 'מאגר מידע נדל״ן — רשות המסים', url: 'https://www.gov.il/he/service/real_estate_information', review: 'חודשי' },
  { information: 'עסקאות דירות חדשות', source: 'רשות המסים, הלמ״ס', review: 'רבעוני' },
  { information: 'ריבית משכנתאות', source: 'בנק ישראל', url: 'https://boi.org.il/information/interestrates/mortgage', review: 'חודשי' },
  { information: 'מגבלות משכנתא', source: 'הוראה 329 של בנק ישראל', url: 'https://boi.org.il/roles/supervisionregulation/nbt/nbt329/', review: 'בשינוי רגולציה' },
  { information: 'מדד תשומות הבנייה', source: 'הלמ״ס', url: 'https://www.cbs.gov.il', review: 'חודשי' },
  { information: 'היטל השבחה', source: 'מינהל התכנון', url: 'https://www.gov.il/he/pages/bidguide?chapterIndex=2', review: 'בשינוי חקיקה' },
  { information: 'מע״מ', source: 'רשות המסים', url: 'https://www.gov.il/he/pages/vat-history', review: 'בשינוי חקיקה' },
  { information: 'מס רכישה ומס שבח', source: 'סימולטור רשות המסים', url: 'https://www.gov.il/he/service/real_eatate_taxsimulator', review: 'בשינוי חקיקה' },
  { information: 'מיסוי שכירות', source: 'רשות המסים', url: 'https://www.gov.il/he/pages/detail-tracks-payment-tax-relief-rental-apartments', review: 'שנתי' },
  { information: 'הצעות בנייה ורכישה', source: 'הצעות יזמים בכתב', review: 'בכל הצעה חדשה' },
];
