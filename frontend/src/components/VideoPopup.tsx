import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Play, Pause, Volume2, VolumeX, Bot } from "lucide-react";

interface VideoPopupProps {
  isOpen: boolean;
  onClose: () => void;
  videoType: string;
  title: string;
  description: string;
}

const VideoPopup = ({ isOpen, onClose, videoType, title, description }: VideoPopupProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isOpen && isPlaying) {
      const interval = setInterval(() => {
        setProgress(prev => (prev >= 100 ? 0 : prev + 0.5));
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isOpen, isPlaying]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (videoType) {
      case "invoice": return "📄";
      case "batch":   return "💊";
      case "return":  return "🔄";
      default:        return "🤖";
    }
  };

  const getPhase = () => {
    if (progress < 30)  return "Extracting data with AI...";
    if (progress < 70)  return "Cryptographically signing...";
    return "Generating QR code...";
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl border overflow-hidden" style={{ background: "var(--color-bg-card)", borderColor: "var(--color-border)", borderRadius: 3 }}>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 flex items-center justify-center" style={{ background: "var(--color-accent)", borderRadius: 2 }}>
              <Bot className="h-4 w-4" style={{ color: "var(--color-accent-fg)" }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}
            className="transition-colors duration-150" style={{ color: "var(--color-muted)" }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Video Content */}
        <div className="relative h-80 overflow-hidden" style={{ background: "var(--color-bg)" }}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-6">{getIcon()}</div>
              <div className="flex items-center justify-center gap-2 mb-5">
                <Bot className="h-5 w-5 text-primary" />
                <span className="text-base font-semibold text-foreground">AgenticAI Processing</span>
              </div>

              {/* Progress bar */}
              <div className="w-56 h-1.5 mx-auto mb-4 overflow-hidden" style={{ background: "var(--color-border)", borderRadius: 2 }}>
                <div
                  className="h-full transition-all duration-100"
                  style={{ width: `${progress}%`, background: "var(--color-accent)", borderRadius: 2 }}
                />
              </div>

              <p className="text-sm font-mono text-muted-foreground">{getPhase()}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-3 border-t" style={{ background: "var(--color-bg)", borderColor: "var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsPlaying(!isPlaying)}
              style={{ color: "var(--color-muted)" }} className="hover:text-foreground transition-colors duration-150">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsMuted(!isMuted)}
              style={{ color: "var(--color-muted)" }} className="hover:text-foreground transition-colors duration-150">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
          <span className="text-xs text-muted-foreground font-mono">AgenticAI Demo v2.4</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPopup;
