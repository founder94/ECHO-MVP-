import { useTheme } from '@/context/ThemeContext';

interface ThemeToggleProps {
  translucent?: boolean;
}

export default function ThemeToggle({ translucent = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-300 cursor-pointer ${
        translucent
          ? 'border-white/40 text-white/70 hover:text-white hover:border-white hover:bg-white/10'
          : 'border-foreground-700 text-foreground-200 hover:text-foreground-50 hover:border-foreground-500 hover:bg-foreground-50/5'
      }`}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <i className={`ri-sun-line text-lg ${theme === 'dark' ? 'block' : 'hidden'}`} />
      <i className={`ri-moon-line text-lg ${theme === 'light' ? 'block' : 'hidden'}`} />
    </button>
  );
}