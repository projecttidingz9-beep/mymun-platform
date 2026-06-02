import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isSuperAdmin, validateSessionToken } from "@/lib/server/auth";
import { getAdminReviewEventDetail } from "@/lib/server/admin-conference-moderation";
import { mapManagedEventToOrganizerConference } from "@/lib/server/map-managed-event-to-organizer-conference";

export const metadata = {
  title: "Review preview — Admin — Tidingz",
  robots: { index: false, follow: false },
};

export default async function AdminReviewPreviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("mymun_session")?.value;
  if (!token) redirect("/");

  const actor = await validateSessionToken(token);
  if (!isSuperAdmin(actor)) redirect("/");

  const { eventId } = await params;
  const id = String(eventId || "").trim();
  if (!id) notFound();

  const detail = await getAdminReviewEventDetail(id);
  const conference = await mapManagedEventToOrganizerConference(id);
  if (!detail || !conference) notFound();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <header className="space-y-2">
        <Link
          href="/admin"
          className="inline-flex text-sm font-medium text-[var(--blue)] hover:underline"
        >
          Back to admin
        </Link>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--fg)]">{detail.event.title}</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Read-only preview · Status <strong>{detail.event.status}</strong>
        </p>
      </header>

      {detail.event.coverImageUrl && (
        <img
          src={detail.event.coverImageUrl}
          alt={`${detail.event.title} cover`}
          className="w-full max-h-64 object-cover rounded-2xl border border-[var(--border)]"
        />
      )}

      <div className="grid sm:grid-cols-2 gap-6">
        <section className="card p-6 rounded-2xl space-y-3">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Organizer</h2>
          <p className="text-sm">
            <span className="text-[var(--fg-muted)]">Name:</span> {detail.organizer.name}
          </p>
          <p className="text-sm">
            <span className="text-[var(--fg-muted)]">Email:</span> {detail.organizer.email ?? "—"}
          </p>
          {detail.organizer.contactDetail && (
            <p className="text-sm">
              <span className="text-[var(--fg-muted)]">Contact:</span> {detail.organizer.contactDetail}
            </p>
          )}
        </section>

        <section className="card p-6 rounded-2xl space-y-3">
          <h2 className="text-lg font-semibold text-[var(--fg)]">Conference</h2>
          <p className="text-sm">
            <span className="text-[var(--fg-muted)]">Location:</span>{" "}
            {[detail.summary.city, detail.summary.country].filter(Boolean).join(", ")}
          </p>
          {detail.summary.venue && (
            <p className="text-sm">
              <span className="text-[var(--fg-muted)]">Venue:</span> {detail.summary.venue}
            </p>
          )}
          <p className="text-sm">
            <span className="text-[var(--fg-muted)]">Dates:</span>{" "}
            {new Date(detail.event.startDate).toLocaleDateString()} –{" "}
            {new Date(detail.event.endDate).toLocaleDateString()}
          </p>
          <p className="text-sm">
            <span className="text-[var(--fg-muted)]">Level:</span> {detail.summary.level} · Capacity{" "}
            {detail.summary.capacity}
          </p>
          {detail.summary.registrationDeadline && (
            <p className="text-sm">
              <span className="text-[var(--fg-muted)]">Registration deadline:</span>{" "}
              {detail.summary.registrationDeadline}
            </p>
          )}
        </section>
      </div>

      {detail.summary.description && (
        <section className="card p-6 rounded-2xl">
          <h2 className="text-lg font-semibold text-[var(--fg)] mb-3">Description</h2>
          <p className="text-sm text-[var(--fg-muted)] whitespace-pre-wrap">{detail.summary.description}</p>
        </section>
      )}

      <section className="card p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-[var(--fg)] mb-4">
          Committees ({conference.committees.length})
        </h2>
        <ul className="space-y-3">
          {conference.committees.map((c) => (
            <li key={c.id} className="text-sm border-b border-[var(--border)] pb-3 last:border-0">
              <p className="font-medium text-[var(--fg)]">{c.name}</p>
              <p className="text-[var(--fg-muted)]">
                {c.type} · {c.seatCount} seats
              </p>
            </li>
          ))}
          {conference.committees.length === 0 && (
            <li className="text-sm text-[var(--fg-muted)]">No committees configured.</li>
          )}
        </ul>
      </section>

      <section className="card p-6 rounded-2xl">
        <h2 className="text-lg font-semibold text-[var(--fg)] mb-4">
          Registration categories ({conference.registrationCategories.length})
        </h2>
        <ul className="space-y-2">
          {conference.registrationCategories.map((cat) => (
            <li key={cat.id} className="text-sm flex justify-between gap-4">
              <span className="text-[var(--fg)]">{cat.name}</span>
              <span className="text-[var(--fg-muted)] tabular-nums">
                {conference.currency ?? "INR"} {cat.basePrice}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {detail.event.status === "REVIEW" && (
        <p className="text-sm text-[var(--fg-muted)]">
          Approve or reject this submission from the{" "}
          <Link href="/admin" className="text-[var(--blue)] hover:underline">
            review queue
          </Link>
          .
        </p>
      )}
    </div>
  );
}
