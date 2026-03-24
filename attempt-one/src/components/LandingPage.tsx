interface LandingPageProps {
  onStart: () => void;
}

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="animate-fade-in-up max-w-md w-full text-center">
        {/* App Icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-navy rounded-2xl shadow-lg animate-float">
            <span className="text-4xl">🏠</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-bold text-navy mb-3 tracking-tight">
          Ready for a Mortgage?
        </h1>
        <p className="text-gray-500 text-lg mb-10 leading-relaxed">
          Answer a few quick questions and we'll assess your mortgage
          eligibility and estimate your ideal home price range.
        </p>

        {/* CTA Button */}
        <button
          onClick={onStart}
          className="w-full max-w-xs mx-auto bg-navy text-white text-lg font-semibold py-4 px-8 rounded-xl hover:bg-navy-light active:scale-[0.98] transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer"
        >
          Get Started →
        </button>

        {/* Trust Badges */}
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Badge emoji="⏱" text="Takes 2 minutes" />
          <Badge emoji="🟡" text="No credit check" />
          <Badge emoji="✨" text="AI-powered analysis" />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function Badge({ emoji, text }: { emoji: string; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2.5 rounded-full text-sm text-gray-600 shadow-sm border border-gray-100">
      <span>{emoji}</span>
      <span className="font-medium">{text}</span>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="mt-12 max-w-md text-xs text-gray-400 text-center leading-relaxed px-4">
      This is an estimate for informational purposes only. It is not a loan
      offer or pre-approval. Consult with a licensed mortgage professional for
      personalized advice.
    </p>
  );
}
