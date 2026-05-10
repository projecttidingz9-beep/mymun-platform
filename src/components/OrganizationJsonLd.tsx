/**
 * Site-wide Organization JSON-LD for search engines.
 */
export default function OrganizationJsonLd() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tidingz",
    url: base,
    logo: `${base}/tidingz-logo.jpg`,
    image: `${base}/tidingz-logo.jpg`,
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
