// State-level averages for mortgage cost estimation
// Sources: Tax Foundation 2024, Insurance Information Institute 2024,
//          HOA-USA, EIA residential energy survey 2024
// These are statewide averages — actual values vary widely by city/neighborhood

export interface StateData {
  name: string
  propertyTaxRate: number     // annual effective rate as decimal (e.g. 0.0098 = 0.98%)
  avgInsuranceAnnual: number  // average annual homeowner's insurance in dollars
  avgHoaMonthly: number       // typical HOA for homes that have one (many homes have $0)
  avgUtilitiesMonthly: number // avg monthly utilities: electricity, gas, water, trash
}

export const STATE_DATA: Record<string, StateData> = {
  AL: { name: 'Alabama',        propertyTaxRate: 0.0041, avgInsuranceAnnual: 1866, avgHoaMonthly: 180, avgUtilitiesMonthly: 280 },
  AK: { name: 'Alaska',         propertyTaxRate: 0.0119, avgInsuranceAnnual: 1020, avgHoaMonthly: 200, avgUtilitiesMonthly: 420 },
  AZ: { name: 'Arizona',        propertyTaxRate: 0.0062, avgInsuranceAnnual: 1515, avgHoaMonthly: 320, avgUtilitiesMonthly: 300 },
  AR: { name: 'Arkansas',       propertyTaxRate: 0.0062, avgInsuranceAnnual: 1723, avgHoaMonthly: 170, avgUtilitiesMonthly: 260 },
  CA: { name: 'California',     propertyTaxRate: 0.0076, avgInsuranceAnnual: 1380, avgHoaMonthly: 520, avgUtilitiesMonthly: 220 },
  CO: { name: 'Colorado',       propertyTaxRate: 0.0051, avgInsuranceAnnual: 1534, avgHoaMonthly: 310, avgUtilitiesMonthly: 250 },
  CT: { name: 'Connecticut',    propertyTaxRate: 0.0191, avgInsuranceAnnual: 1540, avgHoaMonthly: 380, avgUtilitiesMonthly: 290 },
  DE: { name: 'Delaware',       propertyTaxRate: 0.0057, avgInsuranceAnnual: 980,  avgHoaMonthly: 240, avgUtilitiesMonthly: 240 },
  DC: { name: 'Washington D.C.',propertyTaxRate: 0.0056, avgInsuranceAnnual: 1196, avgHoaMonthly: 480, avgUtilitiesMonthly: 230 },
  FL: { name: 'Florida',        propertyTaxRate: 0.0098, avgInsuranceAnnual: 3600, avgHoaMonthly: 390, avgUtilitiesMonthly: 320 },
  GA: { name: 'Georgia',        propertyTaxRate: 0.0092, avgInsuranceAnnual: 1712, avgHoaMonthly: 230, avgUtilitiesMonthly: 280 },
  HI: { name: 'Hawaii',         propertyTaxRate: 0.0028, avgInsuranceAnnual: 499,  avgHoaMonthly: 590, avgUtilitiesMonthly: 380 },
  ID: { name: 'Idaho',          propertyTaxRate: 0.0069, avgInsuranceAnnual: 964,  avgHoaMonthly: 200, avgUtilitiesMonthly: 230 },
  IL: { name: 'Illinois',       propertyTaxRate: 0.0227, avgInsuranceAnnual: 1395, avgHoaMonthly: 290, avgUtilitiesMonthly: 260 },
  IN: { name: 'Indiana',        propertyTaxRate: 0.0085, avgInsuranceAnnual: 1170, avgHoaMonthly: 190, avgUtilitiesMonthly: 250 },
  IA: { name: 'Iowa',           propertyTaxRate: 0.0153, avgInsuranceAnnual: 1214, avgHoaMonthly: 180, avgUtilitiesMonthly: 250 },
  KS: { name: 'Kansas',         propertyTaxRate: 0.0138, avgInsuranceAnnual: 2394, avgHoaMonthly: 175, avgUtilitiesMonthly: 265 },
  KY: { name: 'Kentucky',       propertyTaxRate: 0.0086, avgInsuranceAnnual: 1434, avgHoaMonthly: 175, avgUtilitiesMonthly: 270 },
  LA: { name: 'Louisiana',      propertyTaxRate: 0.0055, avgInsuranceAnnual: 2673, avgHoaMonthly: 200, avgUtilitiesMonthly: 310 },
  ME: { name: 'Maine',          propertyTaxRate: 0.0114, avgInsuranceAnnual: 900,  avgHoaMonthly: 190, avgUtilitiesMonthly: 310 },
  MD: { name: 'Maryland',       propertyTaxRate: 0.0099, avgInsuranceAnnual: 1060, avgHoaMonthly: 310, avgUtilitiesMonthly: 250 },
  MA: { name: 'Massachusetts',  propertyTaxRate: 0.0114, avgInsuranceAnnual: 1365, avgHoaMonthly: 400, avgUtilitiesMonthly: 280 },
  MI: { name: 'Michigan',       propertyTaxRate: 0.0154, avgInsuranceAnnual: 1040, avgHoaMonthly: 210, avgUtilitiesMonthly: 265 },
  MN: { name: 'Minnesota',      propertyTaxRate: 0.0108, avgInsuranceAnnual: 1482, avgHoaMonthly: 220, avgUtilitiesMonthly: 285 },
  MS: { name: 'Mississippi',    propertyTaxRate: 0.0065, avgInsuranceAnnual: 1878, avgHoaMonthly: 165, avgUtilitiesMonthly: 290 },
  MO: { name: 'Missouri',       propertyTaxRate: 0.0097, avgInsuranceAnnual: 1660, avgHoaMonthly: 190, avgUtilitiesMonthly: 265 },
  MT: { name: 'Montana',        propertyTaxRate: 0.0084, avgInsuranceAnnual: 964,  avgHoaMonthly: 185, avgUtilitiesMonthly: 260 },
  NE: { name: 'Nebraska',       propertyTaxRate: 0.0161, avgInsuranceAnnual: 1752, avgHoaMonthly: 185, avgUtilitiesMonthly: 260 },
  NV: { name: 'Nevada',         propertyTaxRate: 0.0060, avgInsuranceAnnual: 863,  avgHoaMonthly: 340, avgUtilitiesMonthly: 290 },
  NH: { name: 'New Hampshire',  propertyTaxRate: 0.0218, avgInsuranceAnnual: 1033, avgHoaMonthly: 230, avgUtilitiesMonthly: 290 },
  NJ: { name: 'New Jersey',     propertyTaxRate: 0.0247, avgInsuranceAnnual: 1295, avgHoaMonthly: 380, avgUtilitiesMonthly: 260 },
  NM: { name: 'New Mexico',     propertyTaxRate: 0.0080, avgInsuranceAnnual: 1193, avgHoaMonthly: 195, avgUtilitiesMonthly: 255 },
  NY: { name: 'New York',       propertyTaxRate: 0.0172, avgInsuranceAnnual: 1540, avgHoaMonthly: 490, avgUtilitiesMonthly: 270 },
  NC: { name: 'North Carolina', propertyTaxRate: 0.0084, avgInsuranceAnnual: 1381, avgHoaMonthly: 240, avgUtilitiesMonthly: 275 },
  ND: { name: 'North Dakota',   propertyTaxRate: 0.0099, avgInsuranceAnnual: 1198, avgHoaMonthly: 165, avgUtilitiesMonthly: 280 },
  OH: { name: 'Ohio',           propertyTaxRate: 0.0157, avgInsuranceAnnual: 1037, avgHoaMonthly: 200, avgUtilitiesMonthly: 255 },
  OK: { name: 'Oklahoma',       propertyTaxRate: 0.0090, avgInsuranceAnnual: 2474, avgHoaMonthly: 180, avgUtilitiesMonthly: 275 },
  OR: { name: 'Oregon',         propertyTaxRate: 0.0097, avgInsuranceAnnual: 808,  avgHoaMonthly: 265, avgUtilitiesMonthly: 210 },
  PA: { name: 'Pennsylvania',   propertyTaxRate: 0.0153, avgInsuranceAnnual: 1143, avgHoaMonthly: 260, avgUtilitiesMonthly: 255 },
  RI: { name: 'Rhode Island',   propertyTaxRate: 0.0153, avgInsuranceAnnual: 1328, avgHoaMonthly: 310, avgUtilitiesMonthly: 265 },
  SC: { name: 'South Carolina', propertyTaxRate: 0.0057, avgInsuranceAnnual: 1731, avgHoaMonthly: 230, avgUtilitiesMonthly: 290 },
  SD: { name: 'South Dakota',   propertyTaxRate: 0.0117, avgInsuranceAnnual: 1319, avgHoaMonthly: 170, avgUtilitiesMonthly: 265 },
  TN: { name: 'Tennessee',      propertyTaxRate: 0.0071, avgInsuranceAnnual: 1637, avgHoaMonthly: 210, avgUtilitiesMonthly: 285 },
  TX: { name: 'Texas',          propertyTaxRate: 0.0180, avgInsuranceAnnual: 3540, avgHoaMonthly: 250, avgUtilitiesMonthly: 350 },
  UT: { name: 'Utah',           propertyTaxRate: 0.0057, avgInsuranceAnnual: 796,  avgHoaMonthly: 235, avgUtilitiesMonthly: 240 },
  VT: { name: 'Vermont',        propertyTaxRate: 0.0191, avgInsuranceAnnual: 942,  avgHoaMonthly: 195, avgUtilitiesMonthly: 310 },
  VA: { name: 'Virginia',       propertyTaxRate: 0.0082, avgInsuranceAnnual: 1166, avgHoaMonthly: 265, avgUtilitiesMonthly: 250 },
  WA: { name: 'Washington',     propertyTaxRate: 0.0093, avgInsuranceAnnual: 978,  avgHoaMonthly: 275, avgUtilitiesMonthly: 210 },
  WV: { name: 'West Virginia',  propertyTaxRate: 0.0059, avgInsuranceAnnual: 840,  avgHoaMonthly: 155, avgUtilitiesMonthly: 265 },
  WI: { name: 'Wisconsin',      propertyTaxRate: 0.0185, avgInsuranceAnnual: 858,  avgHoaMonthly: 195, avgUtilitiesMonthly: 265 },
  WY: { name: 'Wyoming',        propertyTaxRate: 0.0061, avgInsuranceAnnual: 880,  avgHoaMonthly: 165, avgUtilitiesMonthly: 260 },
}

// National average mortgage rates (approximate, early 2026)
// Source: Freddie Mac Primary Mortgage Market Survey
export const CURRENT_RATES: Record<string, number> = {
  '30': 6.65,
  '20': 6.35,
  '15': 5.95,
  '10': 5.85,
}

export const RATE_DATA_DATE = 'Mar 2026'

// Mortgage insurance rates
export const MORTGAGE_INSURANCE = {
  // FHA annual MIP (as % of loan, for 30yr loans)
  fha_mip_annual: 0.0055,       // 0.55% for LTV 90–96.5%
  fha_mip_annual_high_ltv: 0.0055, // same for most cases as of 2023+
  fha_upfront_mip: 0.0175,      // 1.75% upfront (usually financed)

  // Conventional PMI (est. avg for 720 credit score)
  conventional_pmi_annual: 0.0075, // 0.75% — drops at 80% LTV

  // USDA annual guarantee fee
  usda_annual_fee: 0.0035,      // 0.35% of loan

  // VA: no monthly, but upfront funding fee (not modeled here)
}
