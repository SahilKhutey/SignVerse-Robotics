import { useEffect, useState, useRef } from 'react';

/**
 * Hook to animate updates to a number using requestAnimationFrame and cubic easing.
 * 
 * @param targetValue The number to animate to.
 * @param duration The animation duration in milliseconds.
 * @returns The current animated value as an integer.
 */
export function useAnimatedNumber(targetValue: number, duration: number = 250): number {
  const [currentValue, setCurrentValue] = useState(targetValue);
  const startValueRef = useRef(targetValue);
  const targetValueRef = useRef(targetValue);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    startValueRef.current = currentValue;
    targetValueRef.current = targetValue;
    startTimeRef.current = null;

    let animFrameId: number;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: easeOutCubic (spring-like deceleration)
      const ease = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValueRef.current + (targetValueRef.current - startValueRef.current) * ease;

      setCurrentValue(Math.round(nextValue));

      if (progress < 1) {
        animFrameId = requestAnimationFrame(animate);
      }
    };

    animFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animFrameId);
  }, [targetValue, duration]);

  return currentValue;
}
