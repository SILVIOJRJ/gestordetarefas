import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta Enterprise — base azul-marinho
        brand: {
          950: '#020617',
          900: '#0f172a',
          800: '#1e293b',
          700: '#334155',
          600: '#475569',
          500: '#64748b',
          400: '#94a3b8',
          300: '#cbd5e1',
          200: '#e2e8f0',
          100: '#f1f5f9',
          50:  '#f8fafc',
        },
        // Acento: verde esmeralda para status positivo / validação
        accent: {
          700: '#047857',
          600: '#059669',
          500: '#10b981',
          400: '#34d399',
          100: '#d1fae5',
          50:  '#ecfdf5',
        },
        // Alerta / perigo
        danger: {
          600: '#dc2626',
          500: '#ef4444',
          100: '#fee2e2',
        },
        // Aviso
        warning: {
          600: '#d97706',
          500: '#f59e0b',
          100: '#fef3c7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.15), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'sidebar': '2px 0 8px 0 rgb(0 0 0 / 0.15)',
      },
      screens: {
        'xs': '375px',
      },
    },
  },
  plugins: [],
}

export default config
