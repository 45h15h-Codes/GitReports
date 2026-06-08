/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Base surfaces — PRD §10
        'bg-canvas':       '#0D1117',
        'bg-surface':      '#161B22',
        'bg-overlay':      '#1C2128',
        'border-subtle':   '#30363D',
        'border-default':  '#21262D',
        // Text
        'text-primary':    '#E6EDF3',
        'text-secondary':  '#8B949E',
        'text-muted':      '#484F58',
        // Accent
        'accent':          '#58A6FF',
        'accent-muted':    '#1F3450',
        // Delta
        'delta-up':        '#3FB950',
        'delta-down':      '#F85149',
        // Persona — PRD §4.3. These colors are reserved — do not reuse for other UI.
        'persona-architect':   '#185FA5',
        'persona-shipper':     '#3FB950',
        'persona-maintainer':  '#888780',
        'persona-explorer':    '#E3B341',
        'persona-opensource':  '#BC8CFF',
        'persona-builder':     '#D85A30',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        mono:    ['"DM Mono"', 'monospace'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
