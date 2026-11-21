import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { LegalMarkdown, type LegalSectionWrap } from "./LegalMarkdown";

export function LegalPolicyPage({
  title,
  subtitle,
  description,
  canonical,
  source,
  wrap,
  eyebrow,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  description: string;
  canonical: string;
  source: string;
  wrap?: LegalSectionWrap[];
  eyebrow?: string;
  breadcrumbs?: { label: string; href?: string }[];
}): JSX.Element {
  return (
    <LegalDocumentLayout
      title={title}
      subtitle={subtitle}
      description={description}
      canonical={canonical}
      eyebrow={eyebrow}
      breadcrumbs={breadcrumbs}
    >
      <LegalMarkdown source={source} wrap={wrap} />
    </LegalDocumentLayout>
  );
}
