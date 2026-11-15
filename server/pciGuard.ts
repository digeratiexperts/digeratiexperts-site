import type { Response } from "express";
import {
  CARD_DATA_REJECTED_CODE,
  CARD_DATA_REJECTED_MESSAGE,
  CARD_DATA_REJECTED_STATUS,
  CardDataRejectedError,
  assertNoCardData,
  isCardDataRejection,
  looksLikeCardData,
  rejectCardData,
} from "@shared/pciGuard";

export {
  CARD_DATA_REJECTED_CODE,
  CARD_DATA_REJECTED_MESSAGE,
  CARD_DATA_REJECTED_STATUS,
  CardDataRejectedError,
  assertNoCardData,
  isCardDataRejection,
  looksLikeCardData,
  rejectCardData,
};

/** Send a 422 refusal and return true when any value looks like card data. */
export function sendCardDataRejected(res: Response, ...texts: Array<string | null | undefined>): boolean {
  const refusal = rejectCardData(...texts);
  if (!refusal) return false;
  res.status(CARD_DATA_REJECTED_STATUS).json(refusal);
  return true;
}

/** Map a thrown CardDataRejectedError to the standard 422 body. Never logs the value. */
export function sendCardDataRejectedError(res: Response, error: unknown): boolean {
  if (!isCardDataRejection(error)) return false;
  res.status(CARD_DATA_REJECTED_STATUS).json({
    code: CARD_DATA_REJECTED_CODE,
    error: CARD_DATA_REJECTED_MESSAGE,
  });
  return true;
}
