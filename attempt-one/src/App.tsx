import { useState, useCallback, useRef, useEffect } from 'react';
import type { AppScreen, UserProfile, AssessmentResult } from './types';
import { questions, initialProfile } from './questions';
import { generateAssessment } from './engine';
import LandingPage from './components/LandingPage';
import QuestionFlow from './components/QuestionFlow';
import LoadingScreen from './components/LoadingScreen';
import ResultsPage from './components/ResultsPage';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [profile, setProfile] = useState<UserProfile>({ ...initialProfile });
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const questionFlowMounted = useRef(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const handleAnswer = useCallback(
    (id: keyof UserProfile, value: string) => {
      setProfile((prev) => ({ ...prev, [id]: value }));
    },
    []
  );

  const handleComplete = useCallback(() => {
    setScreen('loading');

    // Run assessment after a short delay to let loading animation play
    setTimeout(() => {
      const assessment = generateAssessment(profile);
      setResult(assessment);
      // Show results after loading animation has had time
      setTimeout(() => setScreen('results'), 3500);
    }, 500);
  }, [profile]);

  const handleStartOver = useCallback(() => {
    setProfile({ ...initialProfile });
    setResult(null);
    questionFlowMounted.current = false;
    setScreen('landing');
  }, []);

  const showQuestions = screen === 'questions' || screen === 'loading';

  return (
    <>
      {screen === 'landing' && (
        <LandingPage
          onStart={() => {
            questionFlowMounted.current = true;
            setScreen('questions');
          }}
        />
      )}

      {(showQuestions || questionFlowMounted.current) && (
        <div className={screen !== 'questions' ? 'hidden' : ''}>
          <QuestionFlow
            questions={questions}
            profile={profile}
            onAnswer={handleAnswer}
            onComplete={handleComplete}
            onBack={() => {
              questionFlowMounted.current = false;
              setScreen('landing');
            }}
          />
        </div>
      )}

      {screen === 'loading' && <LoadingScreen />}

      {screen === 'results' && result && (
        <ResultsPage result={result} onStartOver={handleStartOver} />
      )}
    </>
  );
}
