import { LegalDocumentView } from "@/components/legal/LegalDocumentView";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { privacyPolicyEn } from "@/content/legal/privacy-policy";

export function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title={privacyPolicyEn.title}>
      <LegalDocumentView doc={privacyPolicyEn} />
    </LegalPageLayout>
  );
}
