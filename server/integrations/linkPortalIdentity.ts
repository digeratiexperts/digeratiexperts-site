import { logger } from "../logger";
import { enqueueWebsiteCommand } from "./enqueueWebsiteCommand";
import { markOutboxDelivered } from "./deSyncStore";
import { deliverEnvelopeToHub, persistHubAccountId } from "./techSalesClient";

export async function queuePortalIdentityLink(input: {
  portalClientId: string;
  companyName: string;
  email: string;
  name: string;
}): Promise<void> {
  const envelope = await enqueueWebsiteCommand(
    {
      id: input.portalClientId,
      name: input.name,
      email: input.email,
      company: input.companyName,
      source: "portal_register",
      portalClientId: input.portalClientId,
    },
    "lead.created",
  );

  try {
    const result = await deliverEnvelopeToHub(envelope, "hub");
    if (result.canonicalAccountId) {
      await persistHubAccountId(input.portalClientId, result.canonicalAccountId);
    }
    await markOutboxDelivered(envelope.eventId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("portal identity link queued for retry", {
      portalClientId: input.portalClientId,
      eventId: envelope.eventId,
      message,
    });
  }
}
