import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useToast } from "@/hooks/use-toast";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { FieldOk, SubmitFace, submitPhase, useSentFlash } from "./SubmitFace";
import "./13-lead-form.css";
import { ChapterPattern } from "@/components/site/Atmosphere";

/**
 * Section 13 (mock: artifacts/design-concepts/homepage-sections-2026-10/sections/13-lead-form.html).
 * The page's one assessment form. Submission contract copied from DigeratiLeadFormSection.tsx:
 * POST /api/assessment { fullName, email, phone, company, source: "lead_form" }, same validation and toasts.
 */

const formSchema = z.object({
  fullName: z.string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters"),
  email: z.string()
    .email("Please enter a valid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function V8LeadForm(): JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: revealInitial,
          whileInView: revealInView,
          viewport: revealViewport,
          transition: { ...revealTransition, delay },
        };

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      company: "",
    },
  });
  const { errors } = form.formState;
  const [sent, flashSent] = useSentFlash();
  const phase = submitPhase(isSubmitting, sent);

  const handleSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          phone: data.phone || "",
          company: data.company || "",
          source: "lead_form",
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Submission failed");
      }

      toast({
        title: "Assessment Request Submitted!",
        description: "We'll contact you within 24 hours to schedule your Cyber Risk Assessment.",
        variant: "default",
      });

      form.reset();
      flashSent();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Something went wrong. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="f-paper v8-section" id="assessment-form" aria-labelledby="assessment-form-title">
      <ChapterPattern variant="dots" />
      <div className="v8-canvas lead">
        <motion.div className="lead__statement" {...reveal()}>
          <p className="v8-eyebrow">Cyber Risk Assessment</p>
          <h2 className="v8-h2" id="assessment-form-title">
            Get Your Free Security Assessment
          </h2>
          <p className="v8-lede">
            Discover vulnerabilities before attackers do. Our experts will analyze your security posture and provide
            actionable recommendations.
          </p>
        </motion.div>

        <motion.div className="lead__form" {...reveal(0.04)}>
          <form className="v8-card--paper lead__card" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="lead__fields">
              <div className="v8-float">
                <label className="v8-label" htmlFor="lead-name">
                  Full Name <span aria-hidden="true">*</span>
                </label>
                <input
                  className="v8-input"
                  id="lead-name"
                  type="text"
                  placeholder=" "
                  autoComplete="name"
                  required
                  aria-invalid={errors.fullName ? true : undefined}
                  aria-describedby={errors.fullName ? "lead-name-error" : undefined}
                  data-testid="input-lead-full-name"
                  disabled={isSubmitting}
                  {...form.register("fullName")}
                />
                <FieldOk />
                {errors.fullName ? (
                  <p className="v8-field-error" id="lead-name-error" role="alert">
                    {errors.fullName.message}
                  </p>
                ) : null}
              </div>
              <div className="v8-float">
                <label className="v8-label" htmlFor="lead-email">
                  Work Email <span aria-hidden="true">*</span>
                </label>
                <input
                  className="v8-input"
                  id="lead-email"
                  type="email"
                  placeholder=" "
                  autoComplete="email"
                  required
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "lead-email-error" : undefined}
                  data-testid="input-lead-email"
                  disabled={isSubmitting}
                  {...form.register("email")}
                />
                <FieldOk />
                {errors.email ? (
                  <p className="v8-field-error" id="lead-email-error" role="alert">
                    {errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="v8-float">
                <label className="v8-label" htmlFor="lead-phone">
                  Phone (Optional)
                </label>
                <input
                  className="v8-input"
                  id="lead-phone"
                  type="tel"
                  placeholder=" "
                  autoComplete="tel"
                  data-testid="input-lead-phone"
                  disabled={isSubmitting}
                  {...form.register("phone")}
                />
              </div>
              <div className="v8-float">
                <label className="v8-label" htmlFor="lead-company">
                  Company (Optional)
                </label>
                <input
                  className="v8-input"
                  id="lead-company"
                  type="text"
                  placeholder=" "
                  autoComplete="organization"
                  data-testid="input-lead-company"
                  disabled={isSubmitting}
                  {...form.register("company")}
                />
              </div>
            </div>
            <button
              className="v8-btn v8-btn--primary lead__submit v8-submit"
              type="submit"
              disabled={isSubmitting}
              data-state={phase}
              data-testid="button-lead-submit"
            >
              <SubmitFace phase={phase} sendingLabel="Submitting your request" sentLabel="Request sent">
                {CTA.primary}{" "}
                <svg {...svgProps}>
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </SubmitFace>
            </button>
            <ul className="lead__footers">
              <li>
                <svg {...svgProps}>
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                </svg>
                Complimentary security assessment
              </li>
              <li>
                <svg {...svgProps}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                No obligation, no credit card
              </li>
            </ul>
          </form>
          <p className="lead__call v8-body">
            Prefer to call?{" "}
            <a className="v8-link" href={PRIMARY_PHONE.telHref} data-testid="link-lead-phone">
              {PRIMARY_PHONE.display}
            </a>
          </p>
        </motion.div>

        <motion.ul className="lead__assure" {...reveal()}>
          {["Independent findings", "No switch required", "Arizona-based experts"].map((item) => (
            <li key={item}>
              <span className="v8-dash" aria-hidden="true" />
              {item}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  );
}
