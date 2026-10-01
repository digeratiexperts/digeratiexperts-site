module.exports = {
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{html,js,ts,jsx,tsx}",
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        "paragraph-2": "var(--paragraph-2-font-family)",
        // Primary font system - Space Grotesk for headings, Inter for body
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"Oxanium"', '"JetBrains Mono"', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // shadcn Sidebar primitive (client/src/components/ui/sidebar.tsx);
        // the variables are defined per surface, see client/src/styles/portal.css.
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        de: {
          magenta: "var(--de-magenta)",
          "magenta-ink": "var(--de-magenta-ink)",
          "magenta-paper-ink": "var(--de-magenta-paper-ink)",
          "magenta-hover": "var(--de-magenta-hover)",
          accent: "rgb(var(--de-accent-rgb) / <alpha-value>)",
          "accent-ink": "rgb(var(--de-accent-ink-rgb) / <alpha-value>)",
          bg: "var(--de-bg)",
          surface: "var(--de-surface)",
          raised: "var(--de-raised)",
          hairline: "var(--de-hairline)",
          paper: "var(--de-paper)",
          "paper-raised": "var(--de-paper-raised)",
          "paper-hairline": "var(--de-paper-hairline)",
          muted: "var(--de-muted)",
          "muted-soft": "var(--de-muted-soft)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // Lift the small end of the scale so chips, spy nav, and captions
      // stay readable after the 16px rem restore. text-base stays 1rem.
      fontSize: {
        xs: ["0.875rem", { lineHeight: "1.35" }],
        sm: ["1rem", { lineHeight: "1.5" }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
    container: { center: true, padding: "1rem", screens: { "2xl": "1680px" } },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
  darkMode: ["class"],
};
