import { isDoor2Path } from "./isDoor2Path";
import { STORE_ADVISOR_SEED, type OpenMspAdvisorDetail } from "./openMspAdvisor";

/**
 * The message the Desk drafts when it opens. An explicit seed wins; otherwise
 * a store open (context "store", or any Door 2 page, /solutions/request
 * included) gets the store advisor seed. The old check was
 * pathname.includes("/store"), which missed /solutions/request and
 * /solutions/business-needs and matched unrelated paths containing "/store".
 */
export function deskOpenSeed(detail: OpenMspAdvisorDetail, pathname: string): string | undefined {
  if (detail.seedMessage) return detail.seedMessage;
  if (detail.context === "store" || isDoor2Path(pathname)) return STORE_ADVISOR_SEED;
  return undefined;
}
