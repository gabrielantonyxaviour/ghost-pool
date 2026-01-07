import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        /* Aurora Borealis custom colors */
        aurora: {
          green: "hsl(160 80% 50%)",
          teal: "hsl(175 70% 45%)",
          purple: "hsl(280 60% 55%)",
          pink: "hsl(320 70% 55%)",
          blue: "hsl(200 80% 50%)",
        },
        cosmic: {
          50: "#e8f5f0",
          100: "#c5e8dd",
          200: "#9edac8",
          300: "#77ccb3",
          400: "#50bea3",
          500: "#2eb88a",
          600: "#22996f",
          700: "#177a55",
          800: "#0d5b3c",
          900: "#043c24",
          950: "#011f12",
        },
        nebula: {
          50: "#f5e8ff",
          100: "#e8ccff",
          200: "#d4a3ff",
          300: "#bf7aff",
          400: "#aa51ff",
          500: "#9333ea",
          600: "#7928c7",
          700: "#5f1da4",
          800: "#461381",
          900: "#2c085e",
          950: "#14033b",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "aurora-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 10px hsla(160, 80%, 50%, 0.3)" },
          "50%": { boxShadow: "0 0 20px hsla(160, 80%, 50%, 0.5), 0 0 30px hsla(280, 60%, 55%, 0.2)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "aurora-shift": "aurora-shift 8s ease-in-out infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        shimmer: "shimmer 3s ease-in-out infinite",
      },
      backgroundImage: {
        "aurora-gradient": "linear-gradient(135deg, hsl(160 80% 50%) 0%, hsl(175 70% 45%) 50%, hsl(280 60% 55%) 100%)",
        "aurora-radial": "radial-gradient(ellipse at center, hsla(160, 80%, 50%, 0.15) 0%, transparent 70%)",
      },
      boxShadow: {
        aurora: "0 0 20px hsla(160, 80%, 50%, 0.3), 0 0 40px hsla(160, 80%, 50%, 0.15)",
        "aurora-lg": "0 0 30px hsla(160, 80%, 50%, 0.4), 0 0 60px hsla(280, 60%, 55%, 0.2)",
        "glow-green": "0 0 15px hsla(160, 80%, 50%, 0.5)",
        "glow-purple": "0 0 15px hsla(280, 60%, 55%, 0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
