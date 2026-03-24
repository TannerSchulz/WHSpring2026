import { useState, useEffect, useRef, useMemo } from 'react';
import type { QuestionConfig, UserProfile } from '../types';

interface QuestionFlowProps {
  questions: QuestionConfig[];
  profile: UserProfile;
  onAnswer: (id: keyof UserProfile, value: string) => void;
  onComplete: () => void;
  onBack: () => void;
}

export default function QuestionFlow({
  questions,
  profile,
  onAnswer,
  onComplete,
  onBack,
}: QuestionFlowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter out skipped questions
  const activeQuestions = useMemo(
    () => questions.filter((q) => !q.skipIf || !q.skipIf(profile)),
    [questions, profile]
  );

  const totalQuestions = activeQuestions.length;
  const currentQuestion = activeQuestions[currentIndex];
  const progress = ((currentIndex) / totalQuestions) * 100;
  const questionNumber = currentIndex + 1;

  useEffect(() => {
    if (currentQuestion?.type === 'text' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [currentIndex, currentQuestion?.type]);

  const goNext = () => {
    if (currentIndex >= totalQuestions - 1) {
      onComplete();
      return;
    }
    setDirection('forward');
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i + 1);
      setAnimating(false);
    }, 250);
  };

  const goBack = () => {
    if (currentIndex === 0) {
      onBack();
      return;
    }
    setDirection('back');
    setAnimating(true);
    setTimeout(() => {
      setCurrentIndex((i) => i - 1);
      setAnimating(false);
    }, 250);
  };

  const handleChoiceSelect = (value: string) => {
    if (animating) return;
    onAnswer(currentQuestion.id, value);
    setTimeout(goNext, 350);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = profile[currentQuestion.id];
    if (value && value.trim()) {
      goNext();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    onAnswer(currentQuestion.id, raw);
  };

  if (!currentQuestion) return null;

  const currentValue = profile[currentQuestion.id];

  // Format number with commas for display
  const formatNumber = (val: string) => {
    if (!val) return '';
    return Number(val).toLocaleString('en-US');
  };

  const slideClass = animating
    ? direction === 'forward'
      ? 'opacity-0 translate-x-[-30px]'
      : 'opacity-0 translate-x-[30px]'
    : 'opacity-100 translate-x-0 animate-slide-in-right';

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold tracking-widest text-navy uppercase">
              Mortgage Check
            </span>
            <span className="text-xs font-semibold text-gray-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-gold-dark via-gold to-gold-light rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-gray-400 font-medium">
            Question {questionNumber} of {totalQuestions}
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div
          className={`max-w-xl w-full transition-all duration-300 ease-out ${slideClass}`}
          key={currentQuestion.id}
        >
          {/* Emoji */}
          <div className="text-center mb-6">
            <span className="text-5xl">{currentQuestion.emoji}</span>
          </div>

          {/* Question Title */}
          <h2 className="text-2xl md:text-3xl font-bold text-navy text-center mb-2 leading-tight">
            {currentQuestion.title}
          </h2>

          {/* Subtitle */}
          {currentQuestion.subtitle && (
            <p className="text-gray-400 text-center mb-8 text-sm">
              {currentQuestion.subtitle}
            </p>
          )}

          {/* Options or Input */}
          {currentQuestion.type === 'choice' && currentQuestion.options && (
            <div className="space-y-3 mt-6">
              {currentQuestion.options.map((option) => {
                const isSelected = currentValue === option.label;
                return (
                  <button
                    key={option.label}
                    onClick={() => handleChoiceSelect(option.label)}
                    disabled={animating}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer group ${
                      isSelected
                        ? 'border-gold bg-gold/5 shadow-md'
                        : 'border-gray-200 bg-white hover:border-gold/50 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div
                          className={`font-semibold text-base ${
                            isSelected ? 'text-navy' : 'text-gray-800'
                          }`}
                        >
                          {option.label}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">
                          {option.description}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 transition-all ${
                          isSelected
                            ? 'border-gold bg-gold'
                            : 'border-gray-300 group-hover:border-gold/50'
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white animate-check-appear"
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
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {currentQuestion.type === 'text' && (
            <form onSubmit={handleTextSubmit} className="mt-6">
              <div className="relative">
                {currentQuestion.prefix && (
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-medium pointer-events-none">
                    {currentQuestion.prefix}
                  </span>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  inputMode={currentQuestion.prefix === '$' ? 'numeric' : 'text'}
                  value={
                    currentQuestion.prefix === '$'
                      ? formatNumber(currentValue)
                      : currentValue
                  }
                  onChange={
                    currentQuestion.prefix === '$'
                      ? handleInputChange
                      : (e) => onAnswer(currentQuestion.id, e.target.value)
                  }
                  placeholder={currentQuestion.placeholder}
                  className={`w-full ${
                    currentQuestion.prefix ? 'pl-10' : 'pl-4'
                  } pr-4 py-4 text-xl rounded-xl border-2 border-gray-200 bg-white text-navy font-semibold placeholder:text-gray-300 placeholder:font-normal transition-all`}
                />
              </div>
              <button
                type="submit"
                disabled={!currentValue || !currentValue.trim()}
                className="mt-4 w-full bg-navy text-white text-lg font-semibold py-4 rounded-xl hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer active:scale-[0.98]"
              >
                Continue →
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Back Button */}
      <div className="px-4 pb-6">
        <div className="max-w-xl mx-auto">
          <button
            onClick={goBack}
            className="text-gray-400 hover:text-navy text-sm font-medium transition-colors cursor-pointer flex items-center gap-1"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="px-4 pb-4">
        <p className="text-xs text-gray-300 text-center max-w-md mx-auto">
          This is an estimate for informational purposes only. It is not a loan
          offer or pre-approval. Consult with a licensed mortgage professional
          for personalized advice.
        </p>
      </div>
    </div>
  );
}
