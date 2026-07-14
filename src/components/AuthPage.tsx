import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import "./auth-page.css";

const GoogleIcon = () => (
  <svg className="g-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fullName = `${firstName} ${lastName}`.trim();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created! Check your email to confirm.");
    navigate({ to: "/dashboard" });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const isSignin = mode === "signin";

  return (
    <div className="auth-layout">
      {/* LEFT — form */}
      <div className="panel-left">
        <div className="panel-left-inner">
          <Link to="/" className="back-home">
            <span className="back-arrow">←</span> Back to IG-Cloner
          </Link>

          <div className="auth-logo"><span className="grad-text">IG-Cloner</span></div>

          <div className="auth-toggle" style={{ marginTop: 16 }}>
            <button
              type="button"
              className={`toggle-btn ${isSignin ? "active" : ""}`}
              onClick={() => setMode("signin")}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`toggle-btn ${!isSignin ? "active" : ""}`}
              onClick={() => setMode("signup")}
            >
              Create Account
            </button>
          </div>

          {isSignin ? (
            <form className="form-page active" onSubmit={handleLogin}>
              <h1 className="form-headline">Welcome back. 👋<br />Ready to clone smarter?</h1>
              <p className="form-sub">
                Sign in and <strong>keep growing.</strong>
              </p>

              <button type="button" className="btn-google" onClick={handleGoogle}>
                <GoogleIcon /> Continue with Google
              </button>

              <div className="divider">
                <div className="div-line" />
                <span className="div-text">or sign in with email</span>
                <div className="div-line" />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="si-email">Email address</label>
                <div className="field-wrap">
                  <input
                    id="si-email"
                    className="field-input"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="si-password">Password</label>
                <div className="field-wrap">
                  <input
                    id="si-password"
                    className="field-input"
                    type={showPw ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    style={{ paddingRight: 48 }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="field-icon"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    aria-pressed={showPw}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button type="submit" className={`btn-primary ${loading ? "loading" : ""}`} disabled={loading}>
                {loading ? "Signing in…" : "Sign In to IG-Cloner →"}
              </button>

              <div className="switch-link">
                Don't have an account?{" "}
                <a onClick={() => setMode("signup")}>Create one free →</a>
              </div>

              <div className="legal-text">
                By signing in you agree to our <a href="/terms">Terms of Service</a> and{" "}
                <a href="/privacy">Privacy Policy</a>
              </div>
            </form>
          ) : (
            <form className="form-page active" onSubmit={handleRegister}>
              <h1 className="form-headline">
                Turn scrolling into <span className="grad-text">income. 💸</span>
              </h1>
              <p className="form-sub">
                Join 8,400+ creators who stopped guessing and started growing.{" "}
                <strong>Your first 3 analyses are free.</strong>
              </p>

              <div className="signup-value-pills">
                <span className="val-pill">✦ No credit card</span>
                <span className="val-pill">🔥 3 free analyses</span>
                <span className="val-pill">⚡ Ready in 2 min</span>
              </div>

              <button type="button" className="btn-google" onClick={handleGoogle}>
                <GoogleIcon /> Sign up with Google — it's free
              </button>

              <div className="divider">
                <div className="div-line" />
                <span className="div-text">or use your email</span>
                <div className="div-line" />
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="su-first">First name</label>
                  <input
                    id="su-first"
                    className="field-input"
                    type="text"
                    placeholder="Alex"
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="su-last">Last name</label>
                  <input
                    id="su-last"
                    className="field-input"
                    type="text"
                    placeholder="Rivera"
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="su-email">Email address</label>
                <input
                  id="su-email"
                  className="field-input"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label className="field-label" htmlFor="su-password">Create a password</label>
                <div className="field-wrap">
                  <input
                    id="su-password"
                    className="field-input"
                    type={showPw ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                    style={{ paddingRight: 48 }}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="field-icon"
                    onClick={() => setShowPw((s) => !s)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    aria-pressed={showPw}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <button type="submit" className={`btn-primary ${loading ? "loading" : ""}`} disabled={loading}>
                {loading ? "Creating account…" : "Create My Free Account →"}
              </button>

              <div className="switch-link">
                Already have an account?{" "}
                <a onClick={() => setMode("signin")}>Sign in →</a>
              </div>

              <div className="legal-text">
                By creating an account you agree to our <a href="/terms">Terms of Service</a> and{" "}
                <a href="/privacy">Privacy Policy</a>.
              </div>
            </form>
          )}
        </div>
      </div>

      {/* RIGHT — marketing panel */}
      <div className="panel-right">
        <div className="panel-right-inner">
          <div className="rp-eyebrow">What you unlock today</div>
          <h2 className="rp-headline">
            {isSignin ? <>Welcome back.<br />Your growth awaits.</> : <>Your content starts<br />working for you.</>}
          </h2>
          <p className="rp-sub">
            {isSignin ? (
              <>Your content calendar is scheduled, your clones are ready. <strong>Pick up right where you left off.</strong></>
            ) : (
              <>Creators using IG-Cloner don't just grow faster — they <strong>get paid more</strong>. More engagement means more brand deals, more sales, more freedom.</>
            )}
          </p>

          <div className="dash-card float-2">
            <div className="dash-card-header">
              <span className="dash-card-title">Your Content Dashboard</span>
              <span className="dash-badge">✦ Live</span>
            </div>
            <div className="stats-row">
              <div className="stat-box"><div className="stat-box-num">94</div><div className="stat-box-label">Avg. Performance Score</div></div>
              <div className="stat-box"><div className="stat-box-num">3.4×</div><div className="stat-box-label">Engagement Lift</div></div>
              <div className="stat-box"><div className="stat-box-num">50</div><div className="stat-box-label">Analyses / mo</div></div>
            </div>
            <div className="post-cards-row">
              <div className="post-mini">
                <div className="post-mini-top"><span className="post-mini-type type-reel">Reel</span><span className="post-mini-score">94/100</span></div>
                <div className="post-mini-hook">"Nobody tells you this about…"</div>
                <div className="post-mini-bar"><div className="post-mini-fill" style={{ width: "94%" }} /></div>
              </div>
              <div className="post-mini">
                <div className="post-mini-top"><span className="post-mini-type type-carousel">Carousel</span><span className="post-mini-score">88/100</span></div>
                <div className="post-mini-hook">"5 things I wish I knew…"</div>
                <div className="post-mini-bar"><div className="post-mini-fill" style={{ width: "88%" }} /></div>
              </div>
              <div className="post-mini">
                <div className="post-mini-top"><span className="post-mini-type type-post">Post</span><span className="post-mini-score">79/100</span></div>
                <div className="post-mini-hook">"Hot take: this changes…"</div>
                <div className="post-mini-bar"><div className="post-mini-fill" style={{ width: "79%" }} /></div>
              </div>
            </div>
          </div>

          <div className="cal-strip float-3">
            <div className="cal-strip-header">
              <span className="cal-strip-title">30-Day Auto-Schedule</span>
              <span className="cal-strip-badge">Auto-Publishing ON</span>
            </div>
            <div className="cal-days">
              {[
                { n: 9, c: "has-post" },
                { n: 10, c: "has-post" },
                { n: 11, c: "today" },
                { n: 12, c: "" },
                { n: 13, c: "has-post" },
                { n: 14, c: "has-post" },
                { n: 15, c: "" },
              ].map((d) => (
                <div key={d.n} className={`cal-day-item ${d.c}`}>
                  <div className="cal-day-num">{d.n}</div>
                  <div className="cal-dot" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
