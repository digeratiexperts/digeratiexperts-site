import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { isQuizRoomPath } from "@/lib/quizRoom";

export function ScrollProgress() {
  const [location] = useLocation();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const scrollProgress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
          
          setProgress(Math.min(100, Math.max(0, scrollProgress)));
          setIsVisible(scrollTop > 100);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // The quiz room has its own stage progress; a second bar would compete with it (issue 449).
  if (!isVisible || isQuizRoomPath(location)) return null;

  return (
    <div 
      className="scroll-progress"
      style={{ transform: `scaleX(${progress / 100})` }}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Page scroll progress"
    />
  );
}
