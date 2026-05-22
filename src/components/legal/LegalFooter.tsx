import { LegalPageFooterLinks } from "@/components/legal/LegalPageLayout";

/** Compact privacy / terms links for login and settings. */
export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={className}>
      <LegalPageFooterLinks />
    </footer>
  );
}
