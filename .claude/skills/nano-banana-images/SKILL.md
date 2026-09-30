---
name: nano-banana-images
description: Generate hyper-realistic, tightly controlled images with the Nano Banana 2 model on kie.ai using structured JSON prompts. Use when the user asks for a "nano banana image", an AI-generated photo, product still, portrait, environment plate, infographic, or any generated image, and when iterating on a previous generation. Each image costs kie.ai credits.
---

> **Digerati Experts repository note (local addition, not upstream text).**
>
> - **Cost and consent.** Every run spends kie.ai credits (roughly $0.04 to $0.09
>   per image). Generate only when the user asks for an image; never run the
>   script speculatively. `--dry-run` validates a payload with no network call.
> - **Key.** The scripts read `KIE_AI_API_KEY`, then `KIE_API_KEY`, from the
>   environment or from a project-root `.env` (gitignored). Never print or
>   commit the key. `scripts/kie_credit.py` checks the key without spending.
> - **Where files go.** Prompt JSON:
>   `artifacts/kie-ai/nano-banana/prompts/<category>/<YYYY-MM-DD>-<slug>.json`.
>   Image: `artifacts/kie-ai/nano-banana/images/<category>/<YYYY-MM-DD>-<slug>.<jpg|png>`.
>   Use `miscellaneous` when no category fits. The generator writes a
>   `<image>.manifest.json` sidecar (task id, model, input, classification
>   `ILLUSTRATIVE`, approval `candidate`) next to every image.
> - **Site-bound imagery.** A generated file is a candidate, never an approved
>   asset. Anything for digeratiexperts.com must pass `design/IMAGERY.md`,
>   Visual System v2 and the rendered-component check before an optimized
>   derivative lands under `client/public/images/`. The DE-branded connector
>   `scripts/kie-assets.mjs` (issue #167 / PR #178's sibling PR #168, with
>   `design/KIE-AI-ASSETS.md`; both exist only once that PR merges)
>   is the alternative route when brand art-direction should be enforced
>   automatically; this skill is the JSON-prompt methodology route.
> - **Parallel runs.** When several images are requested, launch the
>   generation commands in parallel (background Bash), one prompt file each.

# Nano Banana 2 Image Generation Master

## Goal
The purpose of this skill is to provide a standardized, highly controlled method for generating images using AI model Nano Banana 2 (or any underlying model connected to the `generate_image` tool). By strictly enforcing a structured JSON parameter schema, this skill neutralizes native model biases (like over-smoothing, dataset-averaging, or "plastic" AI styling) and ensures raw, unretouched, hyper-realistic outputs.

## Prerequisites
- Python 3 with the `requests` package (`pip install requests`) and a kie.ai key (see the repository note above).
- A clear understanding of the user's desired Subject, Lighting, and Camera characteristics.

## Core Schema Structure
When constructing a prompt for the `generate_image` tool, you **MUST** use the following JSON schema as the foundation. Fill in the string values with extreme, microscopic detail.

```json
{
  "task": "string - High-level goal (e.g., 'sports_selfie_collage', 'single_macro_portrait')",
  
  "output": {
    "type": "string - e.g., 'single_image', '4-panel_collage'",
    "layout": "string - e.g., '1x1', '2x2_grid', 'side-by-side'",
    "aspect_ratio": "string - e.g., '3:4', '16:9', '4:5'",
    "resolution": "string - e.g., 'ultra_high', 'medium_low'",
    "camera_style": "string - e.g., 'smartphone_front_camera', 'professional_dslr'"
  },

  "image_quality_simulation": {
    "sharpness": "string - e.g., 'tack_sharp', 'slightly_soft_edges'",
    "noise": "string - e.g., 'unfiltered_sensor_grain', 'visible_film_grain', 'clean_digital'",
    "compression_artifacts": "boolean - true if attempting to simulate uploaded UGC",
    "dynamic_range": "string - e.g., 'limited', 'hdr_capable'",
    "white_balance": "string - e.g., 'slightly_warm', 'cool_fluorescent'",
    "lens_imperfections": [
      "array of strings - e.g., 'subtle chromatic aberration', 'minor lens distortion', 'vignetting'"
    ]
  },

  "subject": {
    "type": "string - e.g., 'human_portrait', 'nature_macro', 'infographic_flatlay'",
    "human_details": {
      "//": "Use this block ONLY for human subjects",
      "identity": "string",
      "appearance": "string - Extremely specific (e.g., visible pores, mild redness)",
      "outfit": "string"
    },
    "object_or_nature_details": {
      "//": "Use this block for non-human subjects",
      "material_or_texture": "string - e.g., 'brushed aluminum', 'dew-covered velvety petals'",
      "wear_and_tear": "string - e.g., 'subtle scratches on the anodized finish', 'browning edges on leaves'",
      "typography": "string - e.g., 'clean sans-serif overlaid text, perfectly legible'"
    }
  },

  "multi_panel_layout": {
    "grid_panels": [
      {
        "panel": "string - e.g., 'top_left', 'full_frame' (if not a grid)",
        "pose": "string - e.g., 'slight upward selfie angle, relaxed smile'",
        "action": "string - e.g., 'holding phone with one hand, casual posture'"
      }
    ]
  },

  "environment": {
    "location": "string - e.g., 'gym or outdoor sports area'",
    "background": "string - What is behind the subject (e.g., 'blurred gym equipment')",
    "lighting": {
      "type": "string - e.g., 'natural or overhead gym lighting', 'harsh direct sunlight'",
      "quality": "string - e.g., 'uneven, realistic, non-studio', 'high-contrast dramatic'"
    }
  },

  "embedded_text_and_overlays": {
    "text": "string (optional)",
    "location": "string (optional)"
  },

  "structural_preservation": {
    "preservation_rules": [
      "array of strings - e.g., 'Exact physical proportions must be preserved'"
    ]
  },

  "controlnet": {
    "pose_control": {
      "model_type": "string - e.g., 'DWPose'",
      "purpose": "string",
      "constraints": ["array of strings"],
      "recommended_weight": "number"
    },
    "depth_control": {
      "model_type": "string - e.g., 'ZoeDepth'",
      "purpose": "string",
      "constraints": ["array of strings"],
      "recommended_weight": "number"
    }
  },

  "explicit_restrictions": {
    "no_professional_retouching": "boolean - typically true for realism",
    "no_studio_lighting": "boolean - typically true for candid shots",
    "no_ai_beauty_filters": "boolean - mandatory true to avoid plastic look",
    "no_high_end_camera_look": "boolean - true if simulating smartphones"
  },

  "negative_prompt": {
    "forbidden_elements": [
      "array of strings - Massive list of 'AI style' blockers required for extreme realism. Example stack: 'anatomy normalization', 'body proportion averaging', 'dataset-average anatomy', 'wide-angle distortion not in reference', 'lens compression not in reference', 'cropping that removes volume', 'depth flattening', 'mirror selfies', 'reflections', 'beautification filters', 'skin smoothing', 'plastic skin', 'airbrushed texture', 'stylized realism', 'editorial fashion proportions', 'more realistic reinterpretation'"
    ]
  }
}
```

## Paradigm 2: The Dense Narrative Format (Optimized for APIs like Kie.ai)
When executing API calls to standard generation endpoints (which often only accept string prompts), it is incredibly powerful to condense the logic above into a dense, flat JSON string containing a massive descriptive text block.

```json
{
  "prompt": "string - A dense, ultra-descriptive narrative. Use specific camera math (85mm lens, f/1.8, ISO 200), explicit flaws (visible pores, mild redness, subtle freckles, light acne marks), lighting behavior (direct on-camera flash creating sharp highlights), and direct negative commands (Do not beautify or alter facial features).",
  "negative_prompt": "string - A comma-separated list of explicit realism blockers (no plastic skin, no CGI).",
  "image_input": [
    "array of strings (URLs) - Optional. Input images to transform or use as reference (up to 14). Formatting: URL to jpeg, png, or webp. Max size: 30MB."
  ],
  "api_parameters": {
    "google_search": "boolean - Optional. Use Google Web Search grounding",
    "resolution": "string - Optional. '1K', '2K', or '4K' (default 1K)",
    "output_format": "string - Optional. 'jpg' or 'png' (default jpg)",
    "aspect_ratio": "string - Optional. Overrides CLI aspect_ratio (e.g., '16:9', '4:5', 'auto')"
  },
  "settings": {
    "resolution": "string",
    "style": "string - e.g., 'documentary realism'",
    "lighting": "string - e.g., 'direct on-camera flash'",
    "camera_angle": "string",
    "depth_of_field": "string - e.g., 'shallow depth of field'",
    "quality": "string - e.g., 'high detail, unretouched skin'"
  }
}
```

## Best Practices & Natural Language Hacks

1.  **Camera Mathematics:** Always define exact focal length, aperture, and ISO (e.g., `85mm lens, f/2.0, ISO 200`). This forces the model to mimic optical physics rather than digital rendering.
2.  **Explicit Imperfections:** Words like "realistic" are not enough. Dictate flaws: `mild redness`, `subtle freckles`, `light acne marks`, `unguided grooming`.
3.  **Direct Commands:** Use imperative negative commands *inside* the positive prompt paragraph: `Do not beautify or alter facial features. No makeup styling.`
4.  **Lighting Behavior:** Don't just name the light, name what it does: `direct flash photography, creating sharp highlights on skin and a slightly shadowed background.`
5.  **Non-Human Materials (Products/Nature):** When generating non-humans, replace skin/outfit logic with extreme material physics. Define surface scoring (e.g., "micro-scratches on anodized aluminum"), light scattering (e.g., "subsurface scattering through dew-covered petals"), or graphic layouts (e.g., "flat-lay composition, clean sans-serif typography").
6.  **Mandatory Negative Stack:** You MUST include the extensive negative prompt block (e.g., forbidding "skin smoothing" and "anatomy normalization").
7.  **Avoid Over-Degradation (The Noise Trap):** While simulating camera flaws (like `compression artifacts`) can help realism, pushing extreme `ISO 3200` or `heavy film grain` in complex, contrast-heavy environments (like neon night streets) actually triggers the model's "digital art/illustration" biases. Keep ISO settings below 800 and rely on *physical subject imperfections* (like peach fuzz or asymmetrical pores) rather than heavy camera noise to sell the realism.

## Master Reference Guide
If you require the absolute full schema breakdown, parameter options, or the complex JSON structing for multi-panel grids, refer to the root project document:
[`references/master_prompt_reference.md`](references/master_prompt_reference.md) (in this skill's folder). The original project organizer notes are kept as `references/gemini-project-organizer.md`.

## Execution via Kie.ai (Python Workflow)

There is no `generate_image` tool in this repository. Use the dedicated Python
pipeline in this skill's `scripts/` folder, which hits the `createTask` and
`recordInfo` endpoints, serializes the payload, polls, downloads the image and
writes the provenance manifest.

**Prerequisites:**
1. `KIE_AI_API_KEY` (or `KIE_API_KEY`) in the environment or a project-root `.env`.
2. A JSON prompt file matching the **Dense Narrative Format**, saved under
   `artifacts/kie-ai/nano-banana/prompts/<category>/`.

**Execution (from the repository root):**

```bash
# validate the payload first, no network call, no credits
python3 .claude/skills/nano-banana-images/scripts/generate_kie.py <prompt.json> <output.jpg> "4:5" --dry-run

# generate (aspect ratio defaults to "auto" if omitted; api_parameters in the prompt file win)
python3 .claude/skills/nano-banana-images/scripts/generate_kie.py <prompt.json> <output.jpg> "4:5"

# recover a result later, for example after a poll timeout
python3 .claude/skills/nano-banana-images/scripts/get_kie_image.py <taskId> <output.jpg>

# check the key and remaining credit without generating
python3 .claude/skills/nano-banana-images/scripts/kie_credit.py
```

Supported `api_parameters`: `aspect_ratio` (`auto`, `1:1`, `16:9`, `9:16`,
`4:5`, `5:4`, `3:4`, `4:3`, `3:2`, `2:3`, `21:9`), `resolution` (`1K`, `2K`,
`4K`), `output_format` (`jpg`, `png`), `google_search` (boolean). `image_input`
takes up to 14 public image URLs.

## How to use this skill
When a user asks for a highly detailed, realistic, or complex image:

1. Ask one clarifying question only if the subject, framing or use is unclear.
2. Write the prompt as a JSON file in the **Dense Narrative Format** above,
   with camera mathematics, explicit imperfections, lighting behaviour and the
   mandatory negative stack. Save it under the prompts path from the note.
3. Run `generate_kie.py` (dry-run first when the payload is new), saving the
   image under the images path from the note.
4. Show the user the saved path, then iterate by changing one or two JSON
   values at a time.
