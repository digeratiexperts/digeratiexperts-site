-- Mobile & carrier service request numbering.
-- The request itself stays in the existing service_requests table; this adds
-- the MOB-###### sequence used by the canonical mobile_request family.

CREATE SEQUENCE IF NOT EXISTS service_request_mob_seq START 1;
