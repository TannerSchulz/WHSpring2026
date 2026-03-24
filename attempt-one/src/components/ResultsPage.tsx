import type { AssessmentResult } from '../types';

interface ResultsPageProps {
  result: AssessmentResult;
  onStartOver: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; ring: string }> = {
    'Excellent Fit': { bg: 'bg-green-light', text: 'text-green-700', ring: 'ring-green/20' },
    'Good Fit': { bg: 'bg-green-light', text: 'text-green-700', ring: 'ring-green/20' },
    'Moderate Fit': { bg: 'bg-yellow-light', text: 'text-yellow-700', ring: 'ring-yellow/20' },
    'Needs Work': { bg: 'bg-red-light', text: 'text-red-700', ring: 'ring-red/20' },
  };
  const style = config[status] || config['Moderate Fit'];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold ring-2 ${style.bg} ${style.text} ${style.ring}`}
    >
      {status === 'Excellent Fit' || status === 'Good Fit' ? '✅' : status === 'Moderate Fit' ? '⚠️' : '🔴'}
      {status}
    </span>
  );
}

export default function ResultsPage({ result, onStartOver }: ResultsPageProps) {
  return (
    <div className="min-h-screen bg-bg pb-12">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <span className="text-xs font-bold tracking-widest text-navy uppercase">
            Mortgage Check
          </span>
          <div className="w-full bg-green/20 rounded-full h-2 mt-2 overflow-hidden">
            <div className="h-full bg-green rounded-full w-full" />
          </div>
          <div className="mt-2 text-xs text-gray-400 font-medium">
            Complete
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-8">
        {/* Party Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <span className="text-5xl mb-4 block">🎉</span>
          <h1 className="text-3xl font-bold text-navy mb-3">
            Your Mortgage Assessment
          </h1>
          <StatusBadge status={result.eligibilityStatus} />
        </div>

        {/* Price Range Card */}
        <div
          className="bg-navy rounded-2xl p-6 md:p-8 text-white mb-6 shadow-xl animate-fade-in-up"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="text-sm text-gray-300 uppercase tracking-wider font-semibold mb-2">
            Estimated Price Range
          </div>
          <div className="text-3xl md:text-4xl font-bold mb-1">
            {formatCurrency(result.estimatedPriceMin)} – {formatCurrency(result.estimatedPriceMax)}
          </div>
          <div className="text-gold-light text-sm font-medium mt-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-gold rounded-full inline-block" />
            Estimated monthly payment: {formatCurrency(result.estimatedMonthlyPayment)}/mo
          </div>
        </div>

        {/* Rate & Location Cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 animate-fade-in-up"
          style={{ animationDelay: '0.2s' }}
        >
          {/* Current Rate */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-3">
              Current Rate
            </div>
            <div className="text-3xl font-bold text-navy mb-1">
              {result.currentRate}%
            </div>
            <div className="text-sm text-gray-500">{result.loanType}</div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-3">
              Location
            </div>
            <div className="text-sm text-gray-600 mb-2 leading-relaxed">
              {result.locationInsight}
            </div>
            {result.locationLearnMoreUrl && (
              <a
                href={result.locationLearnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gold-dark font-semibold hover:underline"
              >
                Learn more →
              </a>
            )}
          </div>
        </div>

        {/* Key Factors */}
        <div
          className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6 animate-fade-in-up"
          style={{ animationDelay: '0.3s' }}
        >
          <h3 className="text-lg font-bold text-navy mb-4 flex items-center gap-2">
            <span>📊</span> Key Factors
          </h3>
          <div className="space-y-4">
            {result.keyFactors.map((factor, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className={`w-3 h-3 rounded-full mt-1.5 flex-shrink-0 ${
                    factor.positive ? 'bg-green' : 'bg-gold'
                  }`}
                />
                <div>
                  <div className="font-semibold text-navy text-sm">
                    {factor.name}
                  </div>
                  <div className="text-gray-500 text-sm">{factor.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div
          className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6 animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <h3 className="text-lg font-bold text-navy mb-4 flex items-center gap-2">
            <span>💡</span> Recommendations
          </h3>
          <div className="space-y-3">
            {result.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-gold-dark font-bold mt-0.5">→</span>
                <span className="text-gray-600 text-sm leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div
          className="bg-navy/5 rounded-2xl p-6 md:p-8 mb-8 animate-fade-in-up"
          style={{ animationDelay: '0.5s' }}
        >
          <h3 className="text-lg font-bold text-navy mb-3 flex items-center gap-2">
            <span>📝</span> Summary
          </h3>
          <p className="text-gray-600 text-sm leading-relaxed">{result.summary}</p>
        </div>

        {/* Start Over */}
        <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <button
            onClick={onStartOver}
            className="bg-white text-navy font-semibold px-8 py-3 rounded-xl border-2 border-gray-200 hover:border-navy hover:shadow-sm transition-all cursor-pointer active:scale-[0.98]"
          >
            Start Over
          </button>
        </div>

        {/* Disclaimer */}
        <p className="mt-10 text-xs text-gray-400 text-center leading-relaxed pb-4">
          This is an estimate for informational purposes only. It is not a loan
          offer or pre-approval. Consult with a licensed mortgage professional for
          personalized advice.
        </p>
      </div>
    </div>
  );
}
