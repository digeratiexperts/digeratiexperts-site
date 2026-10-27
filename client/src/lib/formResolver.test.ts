import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// The old resolver threw ZodError instead of returning field errors after
// the project moved to Zod 4. Exercise the actual package boundary.
const schema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  consent: z.boolean().refine(Boolean, "Agree to be contacted"),
});
const resolve = (values: z.input<typeof schema>) =>
  zodResolver(schema)(values, {}, { fields: {}, shouldUseNativeValidation: false });

describe("Zod 4 form resolver compatibility", () => {
  it("returns accessible field errors instead of rejecting invalid input", async () => {
    const result = await resolve({ name: "", consent: false });
    expect(result.values).toEqual({});
    expect(result.errors.name?.message).toBe("Enter your name");
    expect(result.errors.consent?.message).toBe("Agree to be contacted");
  });

  it("returns parsed values when the form is valid", async () => {
    const result = await resolve({ name: "  Example  ", consent: true });
    expect(result.errors).toEqual({});
    expect(result.values).toEqual({ name: "Example", consent: true });
  });
});
