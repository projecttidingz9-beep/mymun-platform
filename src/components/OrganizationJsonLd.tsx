/**
 * Site-wide Organization JSON-LD for search engines.
 */
import { getSiteUrl } from "@/lib/site-url";

export default function OrganizationJsonLd() {
  const base = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tidingz",
    url: base,
    logo: `${base}/brand/logo-horizontal-light.png`,
    image: `${base}/brand/logo-horizontal-light.png`,
    description:
      "Model UN platform for delegates and organizers — marketplace, registration, and conference management.",
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
