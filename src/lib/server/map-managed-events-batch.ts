import type { OrganizerConference } from "@/lib/types";
import { mapManagedEventToOrganizerConference } from "@/lib/server/map-managed-event-to-organizer-conference";

const DEFAULT_CONCURRENCY = 5;

/** Map many events in parallel batches to avoid sequential N+1 latency and DB pool spikes. */
export async function mapManagedEventsInBatches(
  eventIds: string[],
  concurrency = DEFAULT_CONCURRENCY
): Promise<OrganizerConference[]> {
  const conferences: OrganizerConference[] = [];
  for (let i = 0; i < eventIds.length; i += concurrency) {
    const batchIds = eventIds.slice(i, i + concurrency);
    const batch = await Promise.all(batchIds.map((id) => mapManagedEventToOrganizerConference(id)));
    for (const mapped of batch) {
      if (mapped) conferences.push(mapped);
    }
  }
  return conferences;
}
