import { Leaf } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 font-bold tracking-tight ${className}`}>
      <span className="relative inline-flex text-lg text-white">
        <span className="relative">
          O
          <Leaf
            className="absolute -right-1 -top-1 size-3 text-emerald-400"
            aria-hidden
          />
        </span>
        <span>M</span>
      </span>
    </div>
  );
}
