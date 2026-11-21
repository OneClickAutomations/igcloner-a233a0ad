import { useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import "./auth-page.css";
import character from "@/assets/auth-character.png";

const GoogleIcon = () => (
  <svg className="g-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);


const MailIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>);
const LockIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.2" fill="currentColor"/></svg>);
const UserIcon = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>);
const EyeIcon = ({ off }: { off: boolean }) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>{off && <path d="M3 3l18 18"/>}</svg>);
const LogoTile = () => (<span className="ac-logo-tile" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8.2 5.5 13.4 12l-5.2 6.5"/><path d="M15.8 5.5 10.6 12l5.2 6.5"/></svg></span>);

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
    navigate({ to: "/get-app", replace: true });
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
    navigate({ to: "/get-app" });
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) {
      toast.error(result.error.message || "Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/get-app", replace: true });
  };

  const isSignin = mode === "signin";

  const pw = (id: string, ph: string, ac: string, min?: number) => (
    <div className="ac-field">
      <span className="ac-ficon"><LockIcon /></span>
      <input id={id} className="ac-input" type={showPw ? "text" : "password"} placeholder={ph} autoComplete={ac}
        minLength={min} value={password} onChange={(e) => setPassword(e.target.value)} required aria-label="Password" />
      <button type="button" className="ac-eye" onClick={() => setShowPw((s) => !s)}
        aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}><EyeIcon off={!showPw} /></button>
    </div>
  );
  const emailField = (id: string) => (
    <div className="ac-field">
      <span className="ac-ficon"><MailIcon /></span>
      <input id={id} className="ac-input" type="email" placeholder="Email Address" autoComplete="email"
        value={email} onChange={(e) => setEmail(e.target.value)} required aria-label="Email address" />
    </div>
  );

  return (
    <div className="ac-page">
      <div className="ac-bg" aria-hidden="true"><span className="ac-streak s1" /><span className="ac-streak s2" /><span className="ac-streak s3" /></div>
      <div className="ac-shell">
        <div className="ac-hero">
          <Link to="/" className="ac-brand"><LogoTile /><span>IGCloner</span></Link>
          <Link to="/" className="ac-back"><span aria-hidden="true">←</span> Back to IG-Cloner</Link>
          <img className="ac-character" src={character} alt="IGCloner character holding floating Instagram and Facebook icons" />
          <div className="ac-copy">
            {isSignin ? (
              <>
                <p className="ac-welcome">Welcome back. <span aria-hidden="true">👋</span></p>
                <h1 className="ac-title">Ready to clone <span className="ac-accent">smarter?</span></h1>
                <p className="ac-sub">Sign in and <strong>keep growing.</strong></p>
              </>
            ) : (
              <>
                <p className="ac-welcome">Join free. <span aria-hidden="true">✨</span></p>
                <h1 className="ac-title">Start cloning <span className="ac-accent">smarter.</span></h1>
                <p className="ac-sub">Your first 3 analyses are <strong>free.</strong></p>
              </>
            )}
          </div>
        </div>

        <form className="ac-form" onSubmit={isSignin ? handleLogin : handleRegister}>
          <button type="button" className="ac-google" onClick={handleGoogle}>
            <GoogleIcon /> {isSignin ? "Continue with Google" : "Sign up with Google"}
          </button>
          <div className="ac-or"><span /><em>or</em><span /></div>
          <p className="ac-with">{isSignin ? "Sign in with email" : "Sign up with email"}</p>

          {!isSignin && (
            <div className="ac-row">
              <div className="ac-field">
                <span className="ac-ficon"><UserIcon /></span>
                <input className="ac-input" placeholder="First name" autoComplete="given-name" aria-label="First name"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="ac-field">
                <input className="ac-input ac-noicon" placeholder="Last name" autoComplete="family-name" aria-label="Last name"
                  value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
          )}
          {emailField(isSignin ? "si-email" : "su-email")}
          {isSignin
            ? pw("si-password", "Enter your password", "current-password")
            : pw("su-password", "Create a password (8+ characters)", "new-password", 8)}

          <button type="submit" className="ac-primary" disabled={loading}>
            {loading ? (isSignin ? "Signing in…" : "Creating account…") : isSignin ? "Sign In to IG-Cloner" : "Create My Free Account"}
            {!loading && <span aria-hidden="true"> →</span>}
          </button>

          <p className="ac-switch">
            {isSignin ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => setMode(isSignin ? "signup" : "signin")}>
              {isSignin ? "Create one free →" : "Sign in →"}
            </button>
          </p>
          <p className="ac-legal">
            By {isSignin ? "signing in" : "creating an account"} you agree to our <a href="/terms">Terms of Service</a> and <a href="/privacy">Privacy Policy</a>
          </p>
        </form>
      </div>
    </div>
  );
}
