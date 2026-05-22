export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  effectiveDate: string;
  intro: string[];
  sections: LegalSection[];
};
