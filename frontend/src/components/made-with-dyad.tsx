import { ExternalLink } from "lucide-react";

export const MadeWithDyad = () => {
  return (
    <div className="p-4 text-center">
      <a
        href="https://snapdev.ai/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-xs text-white/60 hover:text-[#B5C45A] transition-colors duration-200"
      >
        Made with Snapdev
        <ExternalLink className="ml-1 h-3 w-3" />
      </a>
    </div>
  );
};
