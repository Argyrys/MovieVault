import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureIntroAudio } from '../lib/introAudio.js';
import './IntroSplash.css';

const LETTERS = 'MOVIEVAULT'.split('');

export default function IntroSplash({ onDone }) {
  const [phase, setPhase] = useState('in'); // in | out
  const doneRef = useRef(false);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setPhase('out');
    setTimeout(() => onDone?.(), 700);
  }, [onDone]);

  useEffect(() => {
    document.body.classList.add('intro-lock');

    // Play automatically — succeeds whenever the browser allows autoplay
    ensureIntroAudio();

    // Silent fallback: if the browser blocks autoplay, the first interaction
    // anywhere starts the score without showing any UI
    const onGesture = () => ensureIntroAudio();
    document.addEventListener('pointerdown', onGesture, { capture: true });
    document.addEventListener('keydown', onGesture, { capture: true });

    return () => {
      document.removeEventListener('pointerdown', onGesture, { capture: true });
      document.removeEventListener('keydown', onGesture, { capture: true });
      document.body.classList.remove('intro-lock');
    };
  }, []);

  useEffect(() => {
    const total = reduced ? 1200 : 3700;
    const timer = setTimeout(finish, total);
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [finish, reduced]);

  return (
    <div
      className={`intro ${phase === 'out' ? 'intro--out' : ''} ${reduced ? 'intro--reduced' : ''}`}
      onClick={finish}
      role="button"
      aria-label="Skip intro"
    >
      <div className="intro-stage">
        <div className="intro-word">
          {LETTERS.map((ch, i) => (
            <span key={i} className="intro-letter" style={{ animationDelay: `${0.25 + i * 0.08}s` }}>
              {ch}
            </span>
          ))}
          <span className="intro-sweep" />
        </div>
        <div className="intro-tag">WHERE MOVIES LIVE</div>
      </div>

      <div className="intro-skip">Click anywhere to skip</div>
    </div>
  );
}
