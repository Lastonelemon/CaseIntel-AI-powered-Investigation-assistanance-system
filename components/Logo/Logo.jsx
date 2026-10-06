import * as Shared from "../shared.js";
const { Shield } = Shared;

function GeminiSparkle() {
  return (
    <svg
      className="gemini-sparkle"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id="gemini-sparkle-gradient"
          x1="2"
          y1="3"
          x2="22"
          y2="21"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4285f4" />
          <stop offset="0.34" stopColor="#9b72cb" />
          <stop offset="0.68" stopColor="#d96570" />
          <stop offset="1" stopColor="#f4b400" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gemini-sparkle-gradient)"
        d="M12 2.25c1.55 5.39 3.61 7.45 9 9-5.39 1.55-7.45 3.61-9 9-1.55-5.39-3.61-7.45-9-9 5.39-1.55 7.45-3.61 9-9Z"
      />
    </svg>
  );
}

function Logo({ small = false }) {
  return (
    <div className={`brand ${small ? "brand-small" : ""}`}>
      <span className="brand-mark">
        <Shield size={small ? 16 : 19} strokeWidth={2.25} />
        <span />
      </span>
      <span className="brand-copy">
        <span className="brand-name">
          Case<span>Intel</span>
        </span>
        <small className="brand-powered">
          powered by{" "}
          <span className="brand-powered-gemini">
            <GeminiSparkle />
            Gemini
          </span>
        </small>
      </span>
    </div>
  );
}

export default Logo;
