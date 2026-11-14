import { randomUUID } from 'node:crypto';
import { notificationService } from './notificationService';
import type { AutoRenewEmailTerms } from './autoRenewEmail';

export type AutoRenewEmailDeliveryStatus = 'pending' | 'sent' | 'failed';

export type AutoRenewEmailDeliveryRecord = {
  id: string;
  subscriptionId: string;
  to: string;
  status: AutoRenewEmailDeliveryStatus;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  updatedAt: string;
};

export type SubscriptionConfirmationPayload = {
  email: string;
  name: string;
  subscriptionId: string;
  status: string;
  renewsAt?: string | null;
  items: { name: string; sku?: string; price: number; quantity: number }[];
  totalCents: number;
  currency: string;
  frequency: AutoRenewEmailTerms['frequency'];
  termMonths: number;
  termsVersion: string;
  termsText: string;
  cancelPolicyText: string;
  confirmationUrl?: string;
};

export type SubscriptionConfirmationSender = (data: SubscriptionConfirmationPayload) => Promise<boolean>;

export const AUTORENEW_EMAIL_BACKOFF_MS = [250, 1000, 3000] as const;

const records = new Map<string, AutoRenewEmailDeliveryRecord>();
const inflight = new Set<Promise<AutoRenewEmailDeliveryRecord>>();

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getAutoRenewEmailDelivery(subscriptionId: string): AutoRenewEmailDeliveryRecord | undefined {
  for (const record of records.values()) {
    if (record.subscriptionId === subscriptionId) return record;
  }
  return undefined;
}

export function listAutoRenewEmailDeliveries(): AutoRenewEmailDeliveryRecord[] {
  return [...records.values()];
}

export function resetAutoRenewEmailDeliveries(): void {
  records.clear();
}

export async function waitForAutoRenewEmailDeliveries(): Promise<void> {
  await Promise.allSettled([...inflight]);
}

export type DeliverSubscriptionConfirmationOptions = {
  send?: SubscriptionConfirmationSender;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  backoffMs?: readonly number[];
  id?: string;
};

export async function deliverSubscriptionConfirmation(
  data: SubscriptionConfirmationPayload,
  options: DeliverSubscriptionConfirmationOptions = {},
): Promise<AutoRenewEmailDeliveryRecord> {
  const send = options.send ?? ((payload) => notificationService.sendSubscriptionConfirmation(payload));
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;
  const backoffMs = options.backoffMs ?? AUTORENEW_EMAIL_BACKOFF_MS;
  const maxAttempts = backoffMs.length + 1;
  const id = options.id || randomUUID();
  const stamp = () => now().toISOString();

  const record: AutoRenewEmailDeliveryRecord = {
    id,
    subscriptionId: data.subscriptionId,
    to: data.email,
    status: 'pending',
    attempts: 0,
    lastError: null,
    sentAt: null,
    updatedAt: stamp(),
  };
  records.set(id, record);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) await sleep(backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1]!);
    record.attempts = attempt + 1;
    record.updatedAt = stamp();
    try {
      const sent = await send(data);
      if (sent) {
        record.status = 'sent';
        record.sentAt = stamp();
        record.lastError = null;
        record.updatedAt = record.sentAt;
        return record;
      }
      record.lastError = 'Email was not sent';
      record.status = attempt === maxAttempts - 1 ? 'failed' : 'pending';
    } catch (error) {
      record.lastError = error instanceof Error && error.message ? error.message : 'Email was not sent';
      record.status = attempt === maxAttempts - 1 ? 'failed' : 'pending';
    }
  }
  return record;
}

export function queueSubscriptionConfirmation(
  data: SubscriptionConfirmationPayload,
  options: DeliverSubscriptionConfirmationOptions = {},
): Promise<AutoRenewEmailDeliveryRecord> {
  const pending = deliverSubscriptionConfirmation(data, options);
  inflight.add(pending);
  void pending.finally(() => inflight.delete(pending));
  void pending.catch((error) => {
    console.error('[AUTORENEW CONFIRMATION EMAIL ERROR]', error);
  });
  return pending;
}
