import { useState, type FormEvent } from "react";
import { useToast } from "@/hooks/use-toast";
import { PhoneIcon } from "../icons";
import { EMAIL_ADDRESS, INTEREST_OPTIONS, PHONE_DISPLAY, PHONE_HREF, THIRD_LANE_NAME } from "../content";

type SubmitState = "idle" | "sending" | "sent";

/**
 * Posts the same payload the current homepage form posts to /api/assessment. The "Interested in"
 * and "Message" fields are shown per the approved layout, but the handler only reads
 * fullName, email, phone, company and source, so those two are not sent yet.
 */
function AssessmentForm(): JSX.Element {
  const { toast } = useToast();
  const [state, setState] = useState<SubmitState>("idle");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setState("sending");
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: String(data.get("fullName") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
          phone: String(data.get("phone") ?? "").trim(),
          company: String(data.get("company") ?? "").trim(),
          source: "lead_form",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Submission failed");
      form.reset();
      setState("sent");
    } catch (error) {
      setState("idle");
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <form className="card" id="lead" onSubmit={onSubmit}>
      <h3>Request your assessment</h3>
      <p>Tell us about the environment. No hard sell.</p>
      <div className="fields">
        <div><label htmlFor="hv2-name">Full name *</label><input id="hv2-name" name="fullName" required minLength={2} autoComplete="name" /></div>
        <div><label htmlFor="hv2-email">Work email *</label><input id="hv2-email" name="email" type="email" required autoComplete="email" /></div>
        <div><label htmlFor="hv2-phone">Phone</label><input id="hv2-phone" name="phone" type="tel" autoComplete="tel" /></div>
        <div><label htmlFor="hv2-company">Company</label><input id="hv2-company" name="company" autoComplete="organization" /></div>
        <div className="full">
          <label htmlFor="hv2-interest">Interested in</label>
          <select id="hv2-interest" name="interest" defaultValue={INTEREST_OPTIONS[0]}>
            {INTEREST_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="full">
          <label htmlFor="hv2-message">Message</label>
          <textarea id="hv2-message" name="message" placeholder="Users, locations, what's worrying you" />
        </div>
      </div>
      <button className="btn btn-cta" type="submit" disabled={state === "sending"}>
        Get My Cyber Risk Assessment
      </button>
      {state === "sent" && (
        <p className="small" role="status" style={{ marginTop: 12, color: "var(--accent)" }}>
          Request received — we respond within one business day.
        </p>
      )}
      <div className="assure">
        <span>Scope and fees confirmed before work begins</span>
        <span>No obligation</span>
        <span>No switch required</span>
      </div>
    </form>
  );
}

export function ContactSection(): JSX.Element {
  return (
    <section className="sec band t-ink contact" id="contact">
      <div className="wrap">
        <div>
          <p className="mark">Cyber Risk Assessment</p>
          <h2>Start with a Cyber Risk Assessment.</h2>
          <p className="lede">Every fully managed and co-managed plan starts here. We find identity, endpoint, email, backup, and operating gaps, then confirm scope after we see the environment.</p>
          <p className="small" style={{ color: "var(--on-band-2)", margin: "-14px 0 28px" }}>Only need devices and licenses for a team under 30? Choose {THIRD_LANE_NAME} in the form.</p>
          <a href={PHONE_HREF} className="btn btn-line"><PhoneIcon width={18} height={18} />Call {PHONE_DISPLAY}</a>
          <div className="info">
            <div><span>Email</span><a href={`mailto:${EMAIL_ADDRESS}`}>{EMAIL_ADDRESS}</a></div>
            <div><span>Office</span>Chandler, AZ</div>
            <div><span>Hours</span>Mon–Fri, 7:00 AM – 6:00 PM MST</div>
            <div><span>Weekends</span>Emergency support only</div>
          </div>
          <div className="live"><i />24/7/365 emergency incident response</div>
        </div>
        <AssessmentForm />
      </div>
    </section>
  );
}
