export interface LocalResource {
  label: string
  description: string
  url: string
}

export interface StateResources {
  stateCode: string
  stateName: string
  housingAuthority: { name: string; url: string; description: string }
  firstTimeBuyerPrograms: LocalResource[]
  hudCounselingUrl: string
  downPaymentAssistance: LocalResource[]
  additionalResources: LocalResource[]
}

// HUD counseling search pre-filtered by state
const hudUrl = (state: string) =>
  `https://apps.hud.gov/offices/hsg/sfh/hcc/hcs.cfm?webListAction=search&searchstate=${state}`

export const STATE_RESOURCES: Record<string, StateResources> = {
  AL: {
    stateCode: 'AL', stateName: 'Alabama',
    housingAuthority: { name: 'Alabama Housing Finance Authority', url: 'https://www.ahfa.com', description: 'Offers Step Up and Mortgage Credit Certificate programs for Alabama buyers.' },
    firstTimeBuyerPrograms: [
      { label: 'Step Up Program', description: 'Down payment assistance of up to 4% for first-time buyers with income under $130,000.', url: 'https://www.ahfa.com/homebuyers/step-up' },
    ],
    hudCounselingUrl: hudUrl('AL'),
    downPaymentAssistance: [
      { label: 'AHFA Down Payment Assistance', description: 'Combines with FHA/conventional loans to cover your down payment.', url: 'https://www.ahfa.com' },
    ],
    additionalResources: [
      { label: 'Alabama Realtors Association', description: 'Find a local buyer\'s agent who knows Alabama housing programs.', url: 'https://www.alabamarealtors.com' },
    ],
  },
  AK: {
    stateCode: 'AK', stateName: 'Alaska',
    housingAuthority: { name: 'Alaska Housing Finance Corporation', url: 'https://www.ahfc.us', description: 'State agency offering below-market interest rates and closing cost assistance for Alaskans.' },
    firstTimeBuyerPrograms: [
      { label: 'First Home Program', description: 'Below-market interest rates for first-time buyers in Alaska.', url: 'https://www.ahfc.us/buy/loan-information/first-home-program' },
      { label: 'Closing Cost Assistance Loan', description: 'Up to 4% of purchase price for closing costs.', url: 'https://www.ahfc.us' },
    ],
    hudCounselingUrl: hudUrl('AK'),
    downPaymentAssistance: [
      { label: 'AHFC DPA Program', description: 'Down payment and closing cost assistance combined with first mortgage.', url: 'https://www.ahfc.us' },
    ],
    additionalResources: [],
  },
  AZ: {
    stateCode: 'AZ', stateName: 'Arizona',
    housingAuthority: { name: 'Arizona Department of Housing', url: 'https://housing.az.gov', description: 'Administers HOME Plus, Arizona\'s primary down payment assistance program.' },
    firstTimeBuyerPrograms: [
      { label: 'HOME Plus Program', description: 'Up to 5% down payment assistance combined with a 30-year fixed mortgage.', url: 'https://housing.az.gov/general-public/home-plus-program' },
      { label: 'Pathway to Purchase', description: 'Down payment assistance for buyers in specific Arizona zip codes.', url: 'https://housing.az.gov' },
    ],
    hudCounselingUrl: hudUrl('AZ'),
    downPaymentAssistance: [
      { label: 'HOME Plus DPA', description: 'Forgivable assistance — no repayment required if you stay in the home.', url: 'https://housing.az.gov/general-public/home-plus-program' },
    ],
    additionalResources: [
      { label: 'Arizona Realtors', description: 'Connect with local agents familiar with AZ assistance programs.', url: 'https://www.aaronline.com' },
    ],
  },
  AR: {
    stateCode: 'AR', stateName: 'Arkansas',
    housingAuthority: { name: 'Arkansas Development Finance Authority', url: 'https://www.adfa.state.ar.us', description: 'Provides below-market mortgage rates and down payment assistance for Arkansas buyers.' },
    firstTimeBuyerPrograms: [
      { label: 'ADFA Move-Up Program', description: 'Competitive interest rates for first-time and repeat buyers.', url: 'https://www.adfa.state.ar.us/programs/single-family-programs' },
      { label: 'Down Payment Assistance', description: 'Up to $15,000 in down payment and closing cost assistance.', url: 'https://www.adfa.state.ar.us' },
    ],
    hudCounselingUrl: hudUrl('AR'),
    downPaymentAssistance: [
      { label: 'ADFA DPA', description: 'Forgivable second mortgage for qualifying Arkansas buyers.', url: 'https://www.adfa.state.ar.us' },
    ],
    additionalResources: [],
  },
  CA: {
    stateCode: 'CA', stateName: 'California',
    housingAuthority: { name: 'California Housing Finance Agency (CalHFA)', url: 'https://www.calhfa.ca.gov', description: 'California\'s largest state housing agency — offers down payment assistance, low-rate mortgages, and first-time buyer programs.' },
    firstTimeBuyerPrograms: [
      { label: 'CalHFA MyHome Assistance', description: 'Deferred-payment junior loan up to 3.5% for down payment and closing costs.', url: 'https://www.calhfa.ca.gov/homebuyer/programs/myhome.htm' },
      { label: 'CalHFA Dream For All', description: 'Shared appreciation loan providing up to 20% down — check availability as funding opens periodically.', url: 'https://www.calhfa.ca.gov/homebuyer/programs/dream-for-all.htm' },
      { label: 'California Mortgage Relief', description: 'Assistance for homeowners who fell behind — not DPA, but useful context.', url: 'https://camortgagerelief.org' },
    ],
    hudCounselingUrl: hudUrl('CA'),
    downPaymentAssistance: [
      { label: 'CalHFA Zero Interest Program (ZIP)', description: 'Zero-interest loan to cover CalHFA loan closing costs.', url: 'https://www.calhfa.ca.gov' },
      { label: 'Local City/County DPA Programs', description: 'Many CA cities offer additional assistance — search your city name + "down payment assistance."', url: 'https://www.calhfa.ca.gov/homebuyer/programs' },
    ],
    additionalResources: [
      { label: 'California Association of Realtors', description: 'Find a Realtor and access CA housing market data.', url: 'https://www.car.org' },
    ],
  },
  CO: {
    stateCode: 'CO', stateName: 'Colorado',
    housingAuthority: { name: 'Colorado Housing and Finance Authority (CHFA)', url: 'https://www.chfainfo.com', description: 'Offers low-rate mortgages, down payment assistance, and homebuyer education for Colorado residents.' },
    firstTimeBuyerPrograms: [
      { label: 'CHFA SmartStep', description: 'Competitively priced 30-year fixed mortgage for first-time buyers.', url: 'https://www.chfainfo.com/homeownership/homebuyer-programs' },
      { label: 'CHFA SectionEight Homeownership', description: 'Helps Housing Choice Voucher holders become homeowners.', url: 'https://www.chfainfo.com' },
    ],
    hudCounselingUrl: hudUrl('CO'),
    downPaymentAssistance: [
      { label: 'CHFA Down Payment Assistance Grant', description: 'Up to 3% of first mortgage — does not need to be repaid.', url: 'https://www.chfainfo.com/homeownership/homebuyer-programs/down-payment-assistance' },
      { label: 'CHFA Second Mortgage', description: 'Up to 4% as a low-interest second mortgage for down payment.', url: 'https://www.chfainfo.com' },
    ],
    additionalResources: [
      { label: 'Colorado Realtors', description: 'Connect with local Colorado agents.', url: 'https://www.coloradorealtors.com' },
    ],
  },
  FL: {
    stateCode: 'FL', stateName: 'Florida',
    housingAuthority: { name: 'Florida Housing Finance Corporation', url: 'https://www.floridahousing.org', description: 'Florida\'s state housing agency — administers the Florida First, HFA Preferred, and PLUS Second Mortgage programs.' },
    firstTimeBuyerPrograms: [
      { label: 'Florida First Program', description: '30-year fixed FHA, VA, USDA or conventional mortgage at below-market rates.', url: 'https://www.floridahousing.org/programs/homebuyer-overview-page/florida-first' },
      { label: 'HFA Preferred Grant', description: '3% or 4% grant (no repayment) for down payment and closing costs.', url: 'https://www.floridahousing.org/programs/homebuyer-overview-page/hfa-preferred-grant' },
    ],
    hudCounselingUrl: hudUrl('FL'),
    downPaymentAssistance: [
      { label: 'Florida Assist (FL Assist)', description: 'Up to $10,000 in deferred down payment assistance at 0% interest.', url: 'https://www.floridahousing.org/programs/homebuyer-overview-page/florida-assist' },
      { label: 'Florida Homeownership Loan Program (FL HLP)', description: '$10,000 at 3% over 15 years for down payment.', url: 'https://www.floridahousing.org' },
    ],
    additionalResources: [
      { label: 'Florida Realtors', description: 'Florida market data and agent directory.', url: 'https://www.floridarealtors.org' },
    ],
  },
  TX: {
    stateCode: 'TX', stateName: 'Texas',
    housingAuthority: { name: 'Texas Department of Housing and Community Affairs (TDHCA)', url: 'https://www.tdhca.state.tx.us', description: 'Administers My First Texas Home and Texas Mortgage Credit Certificate programs.' },
    firstTimeBuyerPrograms: [
      { label: 'My First Texas Home', description: '30-year fixed mortgage at below-market rate + up to 5% DPA for first-time buyers.', url: 'https://www.tdhca.state.tx.us/homeownership/fthb/index.htm' },
      { label: 'Texas Mortgage Credit Certificate', description: 'Federal tax credit of up to $2,000/year on mortgage interest.', url: 'https://www.tdhca.state.tx.us/homeownership/mcc.htm' },
    ],
    hudCounselingUrl: hudUrl('TX'),
    downPaymentAssistance: [
      { label: 'My Choice Texas Home', description: 'Up to 5% DPA — available to both first-time and repeat buyers.', url: 'https://www.tdhca.state.tx.us/homeownership/mychoice/index.htm' },
      { label: 'TSAHC Programs', description: 'Texas State Affordable Housing Corporation offers grants and DPA statewide.', url: 'https://www.tsahc.org/homebuyers' },
    ],
    additionalResources: [
      { label: 'Texas Realtors', description: 'Find a local Texas Realtor.', url: 'https://www.texasrealestate.com' },
    ],
  },
  UT: {
    stateCode: 'UT', stateName: 'Utah',
    housingAuthority: { name: 'Utah Housing Corporation (UHC)', url: 'https://www.utahhousingcorp.org', description: 'Utah\'s primary state housing agency — offers low-rate mortgages, down payment loans, and Score Loan programs for Utah buyers.' },
    firstTimeBuyerPrograms: [
      { label: 'UHC FirstHome Loan', description: 'Low fixed interest rate for first-time buyers with income limits. One of Utah\'s most used first-time buyer programs.', url: 'https://www.utahhousingcorp.org/SF/firsthome.html' },
      { label: 'UHC HomeAgain Loan', description: 'For repeat buyers who don\'t qualify as first-time — same competitive rates.', url: 'https://www.utahhousingcorp.org/SF/homeagain.html' },
      { label: 'UHC Score Loan', description: 'For buyers with credit scores as low as 620 — great if you\'re working on improving credit.', url: 'https://www.utahhousingcorp.org/SF/score.html' },
    ],
    hudCounselingUrl: hudUrl('UT'),
    downPaymentAssistance: [
      { label: 'UHC Down Payment Assistance', description: 'Second mortgage covering down payment — combined with UHC first mortgage. Low interest, long term.', url: 'https://www.utahhousingcorp.org/SF/dpa.html' },
      { label: 'Olene Walker Housing Loan Fund', description: 'State fund that supports affordable housing — ask your lender if applicable.', url: 'https://housing.utah.gov' },
    ],
    additionalResources: [
      { label: 'Utah Association of Realtors', description: 'Find a local Utah Realtor familiar with UHC programs.', url: 'https://www.utahrealtors.com' },
      { label: 'Utah Division of Real Estate', description: 'Verify your agent\'s license and access Utah housing resources.', url: 'https://realestate.utah.gov' },
      { label: 'Utah Homebuyer Education (eHome America)', description: 'Required HUD-approved homebuyer education course for UHC loans — can be done online.', url: 'https://www.ehomeamerica.org' },
    ],
  },
  WA: {
    stateCode: 'WA', stateName: 'Washington',
    housingAuthority: { name: 'Washington State Housing Finance Commission (WSHFC)', url: 'https://www.wshfc.org', description: 'Offers low-rate mortgages, down payment assistance, and homebuyer education statewide.' },
    firstTimeBuyerPrograms: [
      { label: 'Home Advantage Program', description: 'Below-market rate 30-year fixed mortgage for first-time buyers in WA.', url: 'https://www.wshfc.org/buyers/homeadvantage.htm' },
      { label: 'House Key Opportunity Program', description: 'For buyers with lower incomes — even more competitive rates.', url: 'https://www.wshfc.org/buyers/housekeyopportunity.htm' },
    ],
    hudCounselingUrl: hudUrl('WA'),
    downPaymentAssistance: [
      { label: 'WSHFC Down Payment Assistance', description: 'Deferred second mortgage — no payments until you sell, refinance, or pay off.', url: 'https://www.wshfc.org/buyers/downpaymentassistance.htm' },
    ],
    additionalResources: [
      { label: 'Washington Realtors', description: 'WA market data and Realtor directory.', url: 'https://www.warealtor.org' },
    ],
  },
  NY: {
    stateCode: 'NY', stateName: 'New York',
    housingAuthority: { name: 'NYS Homes and Community Renewal (HCR)', url: 'https://hcr.ny.gov', description: 'New York\'s housing finance agency — administers the State of New York Mortgage Agency (SONYMA) low-rate loan programs.' },
    firstTimeBuyerPrograms: [
      { label: 'SONYMA Achieving the Dream', description: 'NY\'s lowest interest rate mortgage program for first-time buyers with low-to-moderate income.', url: 'https://hcr.ny.gov/sonyma-achieving-dream' },
      { label: 'SONYMA Low Interest Rate Program', description: 'Broader eligibility than Achieving the Dream, still below-market rates.', url: 'https://hcr.ny.gov/sonyma-low-interest-rate' },
    ],
    hudCounselingUrl: hudUrl('NY'),
    downPaymentAssistance: [
      { label: 'SONYMA Down Payment Assistance Loan (DPAL)', description: 'Up to $15,000 or 3% of purchase price — 0% interest, forgiven after 10 years.', url: 'https://hcr.ny.gov/sonyma-down-payment-assistance-loan' },
      { label: 'NYC HomeFirst', description: 'NYC residents only — up to $100,000 toward down payment/closing costs.', url: 'https://www.nyc.gov/site/hpd/services-and-information/homeownership-assistance.page' },
    ],
    additionalResources: [
      { label: 'New York State Association of Realtors', description: 'Find a NY Realtor.', url: 'https://www.nysar.com' },
    ],
  },
  OR: {
    stateCode: 'OR', stateName: 'Oregon',
    housingAuthority: { name: 'Oregon Housing and Community Services (OHCS)', url: 'https://www.oregon.gov/ohcs', description: 'Oregon\'s housing agency — administers Oregon Bond Residential Loan and down payment assistance programs.' },
    firstTimeBuyerPrograms: [
      { label: 'Oregon Bond Residential Loan', description: 'Below-market interest rate for first-time buyers in Oregon — no income limit in some counties.', url: 'https://www.oregon.gov/ohcs/homeownership/pages/oregon-bond-residential-loan-program.aspx' },
      { label: 'Oregon Individual Development Account', description: 'Matched savings program to help build your down payment.', url: 'https://www.oregon.gov/ohcs' },
    ],
    hudCounselingUrl: hudUrl('OR'),
    downPaymentAssistance: [
      { label: 'OHCS Down Payment Assistance', description: 'Second mortgage with low or no interest to cover down payment.', url: 'https://www.oregon.gov/ohcs/homeownership' },
    ],
    additionalResources: [
      { label: 'Oregon Realtors', description: 'Find a local Oregon agent.', url: 'https://www.oregonrealtors.org' },
    ],
  },
  WI: {
    stateCode: 'WI', stateName: 'Wisconsin',
    housingAuthority: { name: 'Wisconsin Housing and Economic Development Authority (WHEDA)', url: 'https://www.wheda.com', description: 'Offers low-rate mortgages and capital access programs for Wisconsin homebuyers.' },
    firstTimeBuyerPrograms: [
      { label: 'WHEDA Advantage Conventional', description: 'Low-rate 30-year conventional mortgage for WI first-time buyers.', url: 'https://www.wheda.com/homeownership/loan-products/wheda-advantage-conventional' },
      { label: 'WHEDA FHA Advantage', description: 'FHA version — lower credit requirement with competitive rates.', url: 'https://www.wheda.com/homeownership/loan-products/wheda-fha-advantage' },
    ],
    hudCounselingUrl: hudUrl('WI'),
    downPaymentAssistance: [
      { label: 'WHEDA Easy Close DPA', description: 'Up to 6% of purchase price in down payment assistance.', url: 'https://www.wheda.com/homeownership/loan-products/easy-close-dpa' },
    ],
    additionalResources: [
      { label: 'Realtors Association of Wisconsin', description: 'Find a WI Realtor.', url: 'https://www.wra.org' },
    ],
  },
  NC: {
    stateCode: 'NC', stateName: 'North Carolina',
    housingAuthority: { name: 'North Carolina Housing Finance Agency (NCHFA)', url: 'https://www.nchfa.com', description: 'Administers NC Home Advantage Mortgage and DPA programs for North Carolina buyers.' },
    firstTimeBuyerPrograms: [
      { label: 'NC Home Advantage Mortgage', description: 'Competitive rates for first-time and move-up buyers in NC.', url: 'https://www.nchfa.com/home-buyers/buy-home/nc-home-advantage-mortgage' },
      { label: 'NC 1st Home Advantage Down Payment', description: '$15,000 in DPA for first-time buyers and military veterans.', url: 'https://www.nchfa.com/home-buyers/buy-home/nc-1st-home-advantage-down-payment' },
    ],
    hudCounselingUrl: hudUrl('NC'),
    downPaymentAssistance: [
      { label: 'NC Home Advantage DPA', description: 'Up to 5% of loan amount — forgiven after year 11 if you stay in the home.', url: 'https://www.nchfa.com/home-buyers/buy-home/down-payment-assistance' },
    ],
    additionalResources: [
      { label: 'NC Realtors', description: 'Find a local North Carolina Realtor.', url: 'https://www.ncrealtors.org' },
    ],
  },
  GA: {
    stateCode: 'GA', stateName: 'Georgia',
    housingAuthority: { name: 'Georgia Department of Community Affairs (DCA)', url: 'https://www.dca.ga.gov', description: 'Administers Georgia Dream homeownership programs and DPA for eligible buyers.' },
    firstTimeBuyerPrograms: [
      { label: 'Georgia Dream Homeownership Program', description: 'Below-market 30-year fixed mortgage for first-time buyers in GA.', url: 'https://www.dca.ga.gov/safe-affordable-housing/homeownership/georgia-dream' },
    ],
    hudCounselingUrl: hudUrl('GA'),
    downPaymentAssistance: [
      { label: 'Georgia Dream DPA', description: 'Up to $10,000 in down payment assistance — 0% interest, deferred.', url: 'https://www.dca.ga.gov/safe-affordable-housing/homeownership/georgia-dream/down-payment-assistance' },
      { label: 'Georgia Dream PEN Loan', description: 'Extra $7,500 for public protectors, educators, and healthcare workers.', url: 'https://www.dca.ga.gov' },
    ],
    additionalResources: [
      { label: 'Georgia Realtors', description: 'Find a Georgia Realtor.', url: 'https://www.garealtor.com' },
    ],
  },
  MN: {
    stateCode: 'MN', stateName: 'Minnesota',
    housingAuthority: { name: 'Minnesota Housing Finance Agency', url: 'https://www.mnhousing.gov', description: 'Offers Start Up and Step Up programs for first-time and repeat buyers in Minnesota.' },
    firstTimeBuyerPrograms: [
      { label: 'Start Up Program', description: 'Below-market interest rate mortgage for first-time Minnesota buyers.', url: 'https://www.mnhousing.gov/homeownership/start-up-program.html' },
      { label: 'Monthly Payment Loan (MPL)', description: 'Down payment assistance repaid in small monthly payments alongside your mortgage.', url: 'https://www.mnhousing.gov/homeownership/start-up-program.html' },
    ],
    hudCounselingUrl: hudUrl('MN'),
    downPaymentAssistance: [
      { label: 'Deferred Payment Loan (DPL)', description: 'No monthly payment on DPA — repaid when you sell or refinance.', url: 'https://www.mnhousing.gov' },
    ],
    additionalResources: [
      { label: 'Minnesota Realtors', description: 'Find a local MN Realtor.', url: 'https://www.mnrealtor.com' },
    ],
  },
  IL: {
    stateCode: 'IL', stateName: 'Illinois',
    housingAuthority: { name: 'Illinois Housing Development Authority (IHDA)', url: 'https://www.ihda.org', description: 'Offers IHDAccess and SmartBuy programs with down payment assistance for Illinois buyers.' },
    firstTimeBuyerPrograms: [
      { label: 'IHDAccess Forgivable', description: '4% of purchase price (up to $6,000) — completely forgiven after 10 years.', url: 'https://www.ihda.org/homeowners/access-forgivable/' },
      { label: 'IHDAccess Deferred', description: '5% (up to $7,500) — no payment until you sell, refinance, or pay off the home.', url: 'https://www.ihda.org/homeowners/access-deferred/' },
    ],
    hudCounselingUrl: hudUrl('IL'),
    downPaymentAssistance: [
      { label: 'SmartBuy Program', description: 'Helps buyers with student loan debt — up to $40,000 toward student loans with $5,000 DPA.', url: 'https://www.ihda.org/homeowners/smartbuy/' },
    ],
    additionalResources: [
      { label: 'Illinois Realtors', description: 'Find an Illinois Realtor.', url: 'https://www.illinoisrealtors.org' },
    ],
  },
  OH: {
    stateCode: 'OH', stateName: 'Ohio',
    housingAuthority: { name: 'Ohio Housing Finance Agency (OHFA)', url: 'https://myohiohome.org', description: 'Offers Your Choice! and Ohio Heroes mortgage programs with down payment assistance.' },
    firstTimeBuyerPrograms: [
      { label: 'Your Choice! Down Payment Assistance', description: '2.5% or 5% of the home\'s purchase price as DPA for Ohio buyers.', url: 'https://myohiohome.org/yourchoice.aspx' },
      { label: 'Ohio Heroes', description: 'Discounted rate for teachers, medical workers, military, and first responders.', url: 'https://myohiohome.org/ohioheroes.aspx' },
    ],
    hudCounselingUrl: hudUrl('OH'),
    downPaymentAssistance: [
      { label: 'OHFA DPA', description: 'Forgivable after 7 years if you remain in the home.', url: 'https://myohiohome.org' },
    ],
    additionalResources: [
      { label: 'Ohio Realtors', description: 'Find an Ohio Realtor.', url: 'https://www.ohiorealtors.org' },
    ],
  },
  PA: {
    stateCode: 'PA', stateName: 'Pennsylvania',
    housingAuthority: { name: 'Pennsylvania Housing Finance Agency (PHFA)', url: 'https://www.phfa.org', description: 'Pennsylvania\'s state housing agency — offers HFA Preferred and Keystone programs with DPA.' },
    firstTimeBuyerPrograms: [
      { label: 'Keystone Home Loan', description: 'Below-market rate mortgage for first-time PA buyers with income/purchase price limits.', url: 'https://www.phfa.org/programs/homebuyers/mortgages/keystone-home-loan.aspx' },
      { label: 'HFA Preferred', description: 'Conventional loan with private mortgage insurance — lower monthly cost.', url: 'https://www.phfa.org' },
    ],
    hudCounselingUrl: hudUrl('PA'),
    downPaymentAssistance: [
      { label: 'Keystone Advantage Assistance Loan', description: 'Up to 4% of purchase price (max $6,000) as a second mortgage at 0% interest.', url: 'https://www.phfa.org/programs/homebuyers/assistance/keystone-advantage-assistance.aspx' },
    ],
    additionalResources: [
      { label: 'Pennsylvania Realtors', description: 'Find a Pennsylvania Realtor.', url: 'https://www.parealtors.org' },
    ],
  },
  MI: {
    stateCode: 'MI', stateName: 'Michigan',
    housingAuthority: { name: 'Michigan State Housing Development Authority (MSHDA)', url: 'https://www.michigan.gov/mshda', description: 'Offers MI Home Loan with DPA available across all of Michigan.' },
    firstTimeBuyerPrograms: [
      { label: 'MI Home Loan', description: 'Competitive rate mortgage paired with $10,000 down payment assistance.', url: 'https://www.michigan.gov/mshda/homeownership/mi-home-loan' },
      { label: 'MI Home Loan Flex', description: 'Broader eligibility — for buyers who don\'t meet standard MI Home Loan requirements.', url: 'https://www.michigan.gov/mshda/homeownership/mi-home-loan' },
    ],
    hudCounselingUrl: hudUrl('MI'),
    downPaymentAssistance: [
      { label: 'MSHDA $10,000 DPA', description: '$10,000 zero-interest deferred loan for MI buyers — repaid when you sell or refinance.', url: 'https://www.michigan.gov/mshda/homeownership/mi-home-loan' },
    ],
    additionalResources: [
      { label: 'Michigan Realtors', description: 'Find a Michigan Realtor.', url: 'https://www.mirealtors.com' },
    ],
  },
  NV: {
    stateCode: 'NV', stateName: 'Nevada',
    housingAuthority: { name: 'Nevada Housing Division', url: 'https://housing.nv.gov', description: 'Provides Home Is Possible mortgage and DPA programs for Nevada homebuyers.' },
    firstTimeBuyerPrograms: [
      { label: 'Home Is Possible (HIP)', description: 'Below-market rate 30-year mortgage for Nevada buyers — income and purchase limits apply.', url: 'https://housing.nv.gov/homebuyers/home-is-possible/' },
      { label: 'HIP for Heroes', description: 'Extra 1% rate reduction for teachers, military, first responders, and veterans.', url: 'https://housing.nv.gov/homebuyers/home-is-possible/' },
    ],
    hudCounselingUrl: hudUrl('NV'),
    downPaymentAssistance: [
      { label: 'HIP Down Payment Assistance', description: '4% of loan amount in DPA — forgiven after 3 years.', url: 'https://housing.nv.gov/homebuyers/home-is-possible/' },
    ],
    additionalResources: [
      { label: 'Nevada Realtors', description: 'Find a Nevada Realtor.', url: 'https://www.nevadarealtors.org' },
    ],
  },
  VA: {
    stateCode: 'VA', stateName: 'Virginia',
    housingAuthority: { name: 'Virginia Housing', url: 'https://www.virginiahousing.com', description: 'Offers Home Loans and down payment grants for Virginia buyers — one of the strongest state programs in the country.' },
    firstTimeBuyerPrograms: [
      { label: 'Virginia Housing Home Loan', description: 'Below-market fixed rate for first-time buyers in VA — works with FHA, VA, USDA, and conventional.', url: 'https://www.virginiahousing.com/for-home-buyers/home-loans' },
      { label: 'Virginia Housing Mortgage Credit Certificate', description: 'Federal tax credit on mortgage interest for first-time VA buyers.', url: 'https://www.virginiahousing.com/for-home-buyers/mortgage-credit-certificate' },
    ],
    hudCounselingUrl: hudUrl('VA'),
    downPaymentAssistance: [
      { label: 'Virginia Housing Down Payment Grant', description: 'Grant (no repayment) up to 2.5% of purchase price — one of the best DPA programs in the US.', url: 'https://www.virginiahousing.com/for-home-buyers/down-payment-assistance' },
    ],
    additionalResources: [
      { label: 'Virginia Realtors', description: 'Find a Virginia Realtor.', url: 'https://www.virginiarealtors.org' },
    ],
  },
}

// Fallback for states without specific data
export function getStateResources(stateCode: string): StateResources {
  if (STATE_RESOURCES[stateCode]) return STATE_RESOURCES[stateCode]

  // Generic fallback
  return {
    stateCode,
    stateName: stateCode,
    housingAuthority: {
      name: 'Your State Housing Finance Agency',
      url: `https://www.hud.gov/states/${stateCode.toLowerCase()}`,
      description: 'Your state housing agency offers below-market mortgages and down payment assistance. Search "[your state] housing finance agency" to find it.',
    },
    firstTimeBuyerPrograms: [
      { label: 'HUD State Resources', description: 'HUD maintains a directory of homebuying resources for every state.', url: `https://www.hud.gov/states/${stateCode.toLowerCase()}` },
    ],
    hudCounselingUrl: hudUrl(stateCode),
    downPaymentAssistance: [
      { label: 'Down Payment Resource', description: 'Search thousands of DPA programs by state and county.', url: 'https://downpaymentresource.com' },
    ],
    additionalResources: [
      { label: 'National Association of Realtors', description: 'Find a local Realtor in your area.', url: 'https://www.realtor.com/find-a-realtorr' },
    ],
  }
}

export const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington D.C.' },
]
