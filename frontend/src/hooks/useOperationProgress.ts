import { useState, useCallback, useRef } from 'react';

export interface OperationStep {
  id: string;
  name: string;
  durationMs?: number; // estimated duration
}

export interface UseOperationProgressOptions {
  steps: OperationStep[];
  title?: string;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

export function useOperationProgress(options: UseOperationProgressOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progressPercentage, setProgressPercentage] = useState(0);

  const stepsRef = useRef(options.steps);
  stepsRef.current = options.steps;

  const runWithProgress = useCallback(
    async <T = any>(
      operation: (updateStep: (stepId: string, message?: string) => void) => Promise<T>
    ): Promise<T> => {
      setIsRunning(true);
      setError(null);
      setIsCompleted(false);
      setCompletedSteps([]);
      setCurrentStepIndex(0);
      setProgressPercentage(5);

      const totalSteps = stepsRef.current.length || 1;

      const updateStep = (stepId: string) => {
        const idx = stepsRef.current.findIndex((s) => s.id === stepId);
        if (idx !== -1) {
          setCurrentStepIndex(idx);
          setCompletedSteps((prev) => {
            const completed = stepsRef.current.slice(0, idx).map((s) => s.id);
            return completed;
          });
          const percent = Math.min(95, Math.round(((idx + 0.5) / totalSteps) * 100));
          setProgressPercentage(percent);
        }
      };

      try {
        const result = await operation(updateStep);

        // Mark all completed
        setCompletedSteps(stepsRef.current.map((s) => s.id));
        setCurrentStepIndex(stepsRef.current.length);
        setProgressPercentage(100);
        setIsCompleted(true);
        options.onComplete?.(result);

        return result;
      } catch (err: any) {
        setError(err.message || 'Operation failed');
        options.onError?.(err);
        throw err;
      } finally {
        setIsRunning(false);
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setIsRunning(false);
    setCurrentStepIndex(0);
    setCompletedSteps([]);
    setError(null);
    setIsCompleted(false);
    setProgressPercentage(0);
  }, []);

  return {
    isRunning,
    isCompleted,
    currentStepIndex,
    currentStep: stepsRef.current[currentStepIndex] || null,
    completedSteps,
    progressPercentage,
    error,
    runWithProgress,
    reset,
  };
}
