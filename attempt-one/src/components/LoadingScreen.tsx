import { useState, useEffect } from 'react';

const loadingSteps = [
  'Reviewing your financial profile...',
  'Calculating debt-to-income ratio...',
  'Checking Utah housing market data...',
  'Analyzing mortgage program eligibility...',
  'Estimating home price range...',
  'Generating personalized recommendations...',
];

export default function LoadingScreen() {
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleSteps((prev) => {
        if (prev >= loadingSteps.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="animate-fade-in-up text-center max-w-md w-full">
        {/* Spinner */}
        <div className="mb-8 relative inline-block">
          <div className="w-16 h-16 rounded-full border-4 border-gray-200" />
          <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-gold animate-spin-slow absolute inset-0" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🏠</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-navy mb-2">
          Analyzing Your Profile
        </h2>
        <p className="text-gray-400 mb-10">
          Our AI is crunching the numbers to give you a personalized assessment.
        </p>

        {/* Steps */}
        <div className="text-left space-y-3 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {loadingSteps.map((step, i) => (
            <div
              key={step}
              className={`flex items-center gap-3 transition-all duration-500 ${
                i < visibleSteps
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-2'
              }`}
            >
              {i < visibleSteps - 1 ? (
                <div className="w-5 h-5 rounded-full bg-green flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 rounded-full bg-gold animate-pulse-glow" />
                </div>
              )}
              <span
                className={`text-sm ${
                  i < visibleSteps - 1 ? 'text-gray-500' : 'text-navy font-medium'
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
