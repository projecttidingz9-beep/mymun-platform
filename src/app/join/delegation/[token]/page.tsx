import { getDelegationInviteByToken } from "@/lib/server/delegation-invite";
import JoinDelegationClient from "./JoinDelegationClient";

export default async function JoinDelegationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { info, error } = await getDelegationInviteByToken(token);
  return <JoinDelegationClient token={token} initialInfo={info} initialError={error} />;
}
