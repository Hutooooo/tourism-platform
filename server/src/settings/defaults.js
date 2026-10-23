'use strict';

/**
 * Default business settings.
 *
 * Only values actually supplied by the business owner are hard-coded here:
 * the email, the telephone/WhatsApp number, and a neutral placeholder brand.
 * Everything else the brief forbids inventing (address, registration number,
 * company history, social accounts) is deliberately absent — the admin
 * dashboard can add those later if the owner provides them.
 */
const DEFAULT_SETTINGS = {
  brand_name: 'Sri Lanka ↔ Italy Tourism',
  tagline: 'Curated journeys between Sri Lanka and Italy, in both directions.',

  contact_email: 'nuwanmalinda1978@gmail.com',
  contact_phone: '+39 389 102 2909',
  contact_whatsapp: '+39 389 102 2909',

  directions: ['SL_TO_IT', 'IT_TO_SL'],

  hero_title: 'Two islands of wonder, one journey',
  hero_subtitle:
    'From the hill country of Sri Lanka to the coastlines of Italy — and back the other way. Tailored tours, honest guidance, and support at every step.',

  about_title: 'Travel between Sri Lanka and Italy',
  about_body:
    'We arrange tourism services between Sri Lanka and Italy in both directions, whether you are planning a holiday, a family visit, or a longer stay. Tell us what you have in mind and we will shape the trip around it.',

  seo: {
    title_suffix: 'Sri Lanka ↔ Italy Tourism',
    description:
      'Tourism services between Sri Lanka and Italy in both directions. Custom tours, packages, and travel planning.',
    keywords: ['Sri Lanka', 'Italy', 'tourism', 'tours', 'travel', 'Sri Lanka to Italy', 'Italy to Sri Lanka'],
  },

  currency: 'EUR',
  booking_enabled: true,
  inquiry_enabled: true,

  pricing_disclaimer:
    'Prices are indicative estimates and may change according to travel dates, seasonality, accommodation availability, airline fares, exchange rates, group size, transport costs, taxes, supplier rates, and itinerary changes. Unless expressly listed as included, international flights, visa or travel authorization fees, travel insurance, personal expenses, optional excursions, and unspecified services are excluded. A final quotation and availability must be confirmed before booking. A booking is not confirmed until the itinerary, price, payment terms, and cancellation conditions have been agreed.',

  footer_note: 'Tourism services between Sri Lanka and Italy.',
};

module.exports = { DEFAULT_SETTINGS };
