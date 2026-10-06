import * as Shared from "../shared.js";
const { Sun, Moon } = Shared;

function ThemeSwitch({ theme, onToggle, className = "" }) {
  return (
    <label
      className={`theme-switch ${className}`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label="Dark mode"
        aria-checked={theme === "dark"}
        checked={theme === "dark"}
        onChange={(event) => onToggle(event.target.checked)}
      />
      <span className="theme-switch-icon">
        {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
      </span>
    </label>
  );
}

export default ThemeSwitch;
