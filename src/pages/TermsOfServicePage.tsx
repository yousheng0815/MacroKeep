import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { termsOfServiceEn } from "@/content/legal/terms-of-service";

export function TermsOfServicePage() {
  return (
    <LegalPageLayout title={termsOfServiceEn.title}>
      <LegalDocumentView doc={termsOfServiceEn} />
    </LegalPageLayout>
  );
}
