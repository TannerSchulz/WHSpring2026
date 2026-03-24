import type { UserProfile, AssessmentResult } from './types';

// Utah-specific mortgage market data — update these values as needed
const UTAH_MARKET = {
  medianHomePrice: 450000,
  medianPriceByArea: {
    'salt lake city': 485000,
    'provo': 445000,
    'orem': 445000,
    'ogden': 410000,
    'clearfield': 410000,
    'st. george': 475000,
    'st george': 475000,
    'logan': 365000,
    'park city': 1200000,
    'cedar city': 350000,
    'heber city': 650000,
    'lehi': 470000,
    'draper': 550000,
    'sandy': 500000,
    'layton': 420000,
    'bountiful': 440000,
    'murray': 450000,
    'west jordan': 430000,
    'south jordan': 520000,
    'herriman': 460000,
    'eagle mountain': 410000,
    'saratoga springs': 450000,
    'spanish fork': 410000,
    'springville': 400000,
    'payson': 380000,
    'tooele': 370000,
  } as Record<string, number>,
  conformingLoanLimit: 806500,
  propertyTaxRate: 0.0058,
  annualInsurance: 1200,
  rates: {
    conventional30: 6.75,
    conventional15: 5.95,
    fha30: 6.50,
    va30: 6.25,
    usda30: 6.50,
  },
  pmiRate: 0.005, // annual PMI as fraction of loan
  dtiLimits: {
    conventional: 0.45,
    fha: 0.50,
    va: 0.41,
    usda: 0.41,
  } as Record<string, number>,
  firstTimeBuyerPrograms: [
    'Utah Housing Corporation (UHC) FirstHome Loan — up to 6% down payment assistance',
    'Score Loan Program — for borrowers with credit scores 620+, includes DPA',
    'HomeAgain Loan — competitive rates for repeat buyers',
    'FHA, VA, and USDA options available through UHC',
  ],
};

function getLoanConfig(mortgageType: string) {
  switch (mortgageType) {
    case 'FHA Loan':
      return { rate: UTAH_MARKET.rates.fha30, type: 'FHA 30-Year Fixed', dtiKey: 'fha', minDown: 0.035 };
    case 'VA Loan':
      return { rate: UTAH_MARKET.rates.va30, type: 'VA 30-Year Fixed', dtiKey: 'va', minDown: 0 };
    case 'USDA Loan':
      return { rate: UTAH_MARKET.rates.usda30, type: 'USDA 30-Year Fixed', dtiKey: 'usda', minDown: 0 };
    default:
      return { rate: UTAH_MARKET.rates.conventional30, type: 'Conventional 30-Year Fixed', dtiKey: 'conventional', minDown: 0.05 };
  }
}

function calcMonthlyPayment(principal: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

function calcMaxLoanFromPayment(maxPayment: number, annualRate: number, years: number): number {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (maxPayment <= 0) return 0;
  if (r === 0) return maxPayment * n;
  return maxPayment * ((1 - Math.pow(1 + r, -n)) / r);
}

function roundTo(value: number, nearest: number): number {
  return Math.round(value / nearest) * nearest;
}

export function generateAssessment(profile: UserProfile): AssessmentResult {
  const income = parseInt(profile.annualIncome) || 0;
  const coBorrowerIncome = profile.hasCoBorrower === 'Yes' ? (parseInt(profile.coBorrowerIncome) || 0) : 0;
  const totalIncome = income + coBorrowerIncome;
  const monthlyIncome = totalIncome / 12;
  const downPayment = parseInt(profile.downPayment) || 0;
  const monthlyDebt = parseInt(profile.monthlyDebt) || 0;

  const loan = getLoanConfig(profile.mortgageType);
  const dtiLimit = UTAH_MARKET.dtiLimits[loan.dtiKey];

  // Max housing payment based on DTI
  const maxHousingPayment = monthlyIncome * dtiLimit - monthlyDebt;

  // Back out max loan from max PI payment (subtract estimated taxes/insurance first)
  const estimatedTaxInsurance = (UTAH_MARKET.medianHomePrice * UTAH_MARKET.propertyTaxRate / 12) + (UTAH_MARKET.annualInsurance / 12);
  const maxPI = Math.max(maxHousingPayment - estimatedTaxInsurance, 0);
  const maxLoan = calcMaxLoanFromPayment(maxPI, loan.rate, 30);
  const maxPrice = maxLoan + downPayment;

  // Price range: 75%-100% of max
  const priceMax = roundTo(Math.max(maxPrice, 100000), 5000);
  const priceMin = roundTo(Math.max(maxPrice * 0.75, 80000), 5000);

  // Monthly payment at midpoint
  const midPrice = (priceMin + priceMax) / 2;
  const loanAmount = Math.max(midPrice - downPayment, 0);
  const monthlyPI = calcMonthlyPayment(loanAmount, loan.rate, 30);
  const monthlyTax = (midPrice * UTAH_MARKET.propertyTaxRate) / 12;
  const monthlyInsurance = UTAH_MARKET.annualInsurance / 12;
  const downPct = midPrice > 0 ? (downPayment / midPrice) * 100 : 0;
  const monthlyPMI = downPct < 20 && loan.dtiKey === 'conventional'
    ? (loanAmount * UTAH_MARKET.pmiRate) / 12
    : 0;
  const totalMonthly = Math.round(monthlyPI + monthlyTax + monthlyInsurance + monthlyPMI);

  // DTI at midpoint
  const dti = monthlyIncome > 0 ? (monthlyDebt + totalMonthly) / monthlyIncome : 1;

  // Credit assessment
  const creditExcellent = profile.creditScore === 'Excellent (750+)';
  const creditGood = creditExcellent || profile.creditScore === 'Good (700–749)';
  const creditFair = profile.creditScore === 'Fair (650–699)';
  const noBankruptcy = profile.bankruptcyForeclosure === 'No';
  const stableJob = ['2–5 years', '5+ years'].includes(profile.employmentLength);
  const employed = profile.employmentStatus !== 'Currently not employed';

  // Eligibility
  let eligibilityStatus: AssessmentResult['eligibilityStatus'];
  if (creditGood && dti < 0.36 && noBankruptcy && stableJob && employed) {
    eligibilityStatus = 'Excellent Fit';
  } else if ((creditGood || creditFair) && dti < dtiLimit && noBankruptcy && employed) {
    eligibilityStatus = 'Good Fit';
  } else if (dti < dtiLimit + 0.05 && employed) {
    eligibilityStatus = 'Moderate Fit';
  } else {
    eligibilityStatus = 'Needs Work';
  }

  // Key Factors
  const keyFactors: AssessmentResult['keyFactors'] = [];

  // Employment
  if (!employed) {
    keyFactors.push({
      name: 'Employment Status',
      description: 'Most lenders require active employment or verifiable income to qualify for a mortgage.',
      positive: false,
    });
  } else if (stableJob) {
    keyFactors.push({
      name: 'Employment Stability',
      description: `${profile.employmentLength} in your current position demonstrates strong job stability, which lenders value highly.`,
      positive: true,
    });
  } else {
    keyFactors.push({
      name: 'Employment History',
      description: `${profile.employmentLength || 'Limited time'} in your current role — most lenders prefer at least 2 years of consistent employment.`,
      positive: false,
    });
  }

  // Credit
  if (creditExcellent) {
    keyFactors.push({
      name: 'Excellent Credit',
      description: 'A 750+ score qualifies you for the best available rates and terms.',
      positive: true,
    });
  } else if (creditGood) {
    keyFactors.push({
      name: 'Good Credit',
      description: 'A 700–749 score qualifies you for competitive rates across most loan types.',
      positive: true,
    });
  } else if (creditFair) {
    keyFactors.push({
      name: 'Fair Credit',
      description: 'A 650–699 score limits some options and may result in higher rates. FHA loans may be a good fit.',
      positive: false,
    });
  } else {
    keyFactors.push({
      name: 'Credit Score',
      description: profile.creditScore === "I'm not sure"
        ? 'Check your credit score for free at annualcreditreport.com — it heavily impacts your rate and options.'
        : 'A score below 650 significantly limits options. Focus on building credit before applying.',
      positive: false,
    });
  }

  // Down payment
  const actualDownPct = priceMax > 0 ? (downPayment / priceMax) * 100 : 0;
  if (actualDownPct >= 20) {
    keyFactors.push({
      name: 'Strong Down Payment',
      description: `$${downPayment.toLocaleString()} (${Math.round(actualDownPct)}%) eliminates PMI and shows financial strength to lenders.`,
      positive: true,
    });
  } else if (actualDownPct >= 10) {
    keyFactors.push({
      name: 'Solid Down Payment',
      description: `$${downPayment.toLocaleString()} (${Math.round(actualDownPct)}%) is solid. You'll pay PMI until you reach 20% equity, adding ~$${Math.round(monthlyPMI)}/mo.`,
      positive: true,
    });
  } else if (actualDownPct >= 3.5) {
    keyFactors.push({
      name: 'Down Payment',
      description: `$${downPayment.toLocaleString()} (${Math.round(actualDownPct)}%) meets FHA minimums. Utah Housing Corporation may offer additional assistance.`,
      positive: false,
    });
  } else {
    keyFactors.push({
      name: 'Low Down Payment',
      description: `$${downPayment.toLocaleString()} may be below minimums for most loan types. Consider down payment assistance programs.`,
      positive: false,
    });
  }

  // DTI
  if (dti < 0.28) {
    keyFactors.push({
      name: 'Low Debt-to-Income',
      description: `Your estimated DTI of ${Math.round(dti * 100)}% is excellent — well below the ${Math.round(dtiLimit * 100)}% maximum.`,
      positive: true,
    });
  } else if (dti < 0.36) {
    keyFactors.push({
      name: 'Healthy Debt-to-Income',
      description: `Your estimated DTI of ${Math.round(dti * 100)}% is within the ideal range for most lenders.`,
      positive: true,
    });
  } else if (dti < dtiLimit) {
    keyFactors.push({
      name: 'Elevated Debt-to-Income',
      description: `Your estimated DTI of ${Math.round(dti * 100)}% is within the ${Math.round(dtiLimit * 100)}% limit but on the higher side. Reducing debt would strengthen your application.`,
      positive: false,
    });
  } else {
    keyFactors.push({
      name: 'High Debt-to-Income',
      description: `Your estimated DTI of ${Math.round(dti * 100)}% exceeds the typical ${Math.round(dtiLimit * 100)}% limit. Paying down debt is essential before applying.`,
      positive: false,
    });
  }

  // Bankruptcy/Foreclosure
  if (noBankruptcy) {
    keyFactors.push({
      name: 'Clean Financial History',
      description: 'No bankruptcy or foreclosure in the last 7 years — a strong positive for your application.',
      positive: true,
    });
  } else {
    const event = profile.bankruptcyForeclosure.toLowerCase();
    keyFactors.push({
      name: 'Prior Financial Event',
      description: `A prior ${event} typically requires a 2–4 year waiting period (varies by loan type) before you can qualify again.`,
      positive: false,
    });
  }

  // Recommendations
  const recommendations: string[] = [];

  if (profile.firstTimeBuyer === 'Yes, first-time buyer') {
    recommendations.push(
      "Look into Utah Housing Corporation's FirstHome Loan — you may qualify for up to 6% down payment assistance, significantly reducing your out-of-pocket costs."
    );
  }

  if (actualDownPct < 20 && actualDownPct >= 3.5) {
    recommendations.push(
      `Saving an additional $${(priceMax * 0.2 - downPayment > 0 ? Math.round(priceMax * 0.2 - downPayment).toLocaleString() : '0')} to reach 20% down would eliminate PMI and save you ~$${Math.round(monthlyPMI * 12)}/year.`
    );
  } else if (actualDownPct < 3.5) {
    recommendations.push(
      'Focus on building your down payment. FHA loans require 3.5% minimum, while conventional loans typically need 5%. Utah Housing Corporation offers assistance programs.'
    );
  }

  if (!creditGood) {
    recommendations.push(
      'Prioritize improving your credit score before applying. Pay down credit card balances below 30% utilization, dispute any errors on your report, and avoid opening new accounts.'
    );
  }

  if (dti > 0.36 && monthlyDebt > 0) {
    recommendations.push(
      `Paying off $${monthlyDebt.toLocaleString()}/mo in existing debt would dramatically improve your DTI and could increase your buying power by $${roundTo(monthlyDebt * 200, 5000).toLocaleString()}+.`
    );
  } else if (monthlyDebt > 300) {
    recommendations.push(
      `Reducing your $${monthlyDebt.toLocaleString()}/mo debt load before applying would improve your DTI ratio and increase your purchasing power.`
    );
  }

  recommendations.push(
    'Get pre-approved with 2–3 Utah lenders to compare rates. Even a 0.25% rate difference saves thousands over the life of your loan.'
  );

  if (profile.state?.toLowerCase().includes('utah') || !profile.state) {
    recommendations.push(
      'Utah has no state transfer tax and property taxes average just 0.58% — among the lowest nationally. Factor these savings into your budget.'
    );
  }

  if (profile.timeline === 'Just exploring') {
    recommendations.push(
      "Since you're just exploring, use this time to optimize your credit, save for a down payment, and research Utah neighborhoods that fit your budget."
    );
  }

  // Location insight
  const stateInput = (profile.state || 'Utah').toLowerCase().trim();
  const cityMatch = Object.entries(UTAH_MARKET.medianPriceByArea).find(
    ([city]) => stateInput.includes(city) || city.includes(stateInput)
  );

  let locationInsight: string;
  if (cityMatch) {
    const [cityName, cityPrice] = cityMatch;
    const displayName = cityName.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
    locationInsight = `The ${displayName} area has a median home price around $${cityPrice.toLocaleString()}. Utah property taxes are among the lowest nationally at ~0.58%, and there's no state transfer tax.`;
  } else {
    locationInsight = `Utah's statewide median home price is ~$${UTAH_MARKET.medianHomePrice.toLocaleString()}. The Wasatch Front (SLC, Provo, Ogden) has the most inventory. Property taxes average just 0.58% — among the lowest in the nation.`;
  }

  // Summary
  const incomeStr = `$${totalIncome.toLocaleString()}`;
  const downStr = `$${downPayment.toLocaleString()}`;
  const positionWord = eligibilityStatus === 'Excellent Fit' || eligibilityStatus === 'Good Fit'
    ? 'well-positioned' : 'on the path toward';
  let summary = `With ${incomeStr} in annual income and ${downStr} saved for a down payment, you're ${positionWord} homeownership in Utah's current market.`;
  if (profile.firstTimeBuyer === 'Yes, first-time buyer') {
    summary += " As a first-time buyer, you may qualify for Utah Housing Corporation down payment assistance programs that could cover up to 6% of the purchase price.";
  }
  if (dti > dtiLimit) {
    summary += " Your current debt level is the primary factor to address — reducing monthly obligations will significantly expand your options.";
  }

  return {
    eligibilityStatus,
    estimatedPriceMin: Math.max(priceMin, 100000),
    estimatedPriceMax: Math.max(priceMax, 150000),
    estimatedMonthlyPayment: Math.max(totalMonthly, 800),
    currentRate: loan.rate,
    loanType: loan.type,
    locationInsight,
    locationLearnMoreUrl: 'https://utahhousingcorp.org',
    keyFactors,
    recommendations: recommendations.slice(0, 5),
    summary,
  };
}
