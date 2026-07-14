"use client";

import { useEffect, useState } from "react";
import { Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button, Modal, TextInput } from "@/components/ui";

type Mode = "signin" | "signup";

export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  // Magic link is the default sign-in: most accounts are created passwordless
  // (paywall free tier + guest checkout), so leading with a password field
  // dead-ends users who never set one. Password entry is opt-in.
  const [usePassword, setUsePassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const valid = emailValid && password.length >= 6;
  const passwordMode = mode === "signup" || usePassword;

  // The modal stays mounted across open/close — reset transient state on close
  // so reopening always starts back at the magic-link-first view (email kept).
  useEffect(() => {
    if (open) return;
    setUsePassword(false);
    setPassword("");
    setMsg(null);
  }, [open]);

  async function submit() {
    if (!supabase || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) throw error;
        if (data.session) onClose();
        else setMsg({ tone: "ok", text: "Almost there — confirm the email we just sent you, then sign in." });
      }
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!supabase || busy) return;
    if (!emailValid) {
      setMsg({ tone: "error", text: "Enter your email first." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
      setMsg({ tone: "ok", text: "Sign-in link sent — check your inbox and tap it on this device." });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === "signin" ? "Sign in" : "Create your account"} size="md">
      <p className="mb-4 text-sm text-muted">
        {mode === "signin"
          ? "Enter your email and we’ll send a one-tap sign-in link — no password needed."
          : "Your library and credits sync to your account, on any device."}
      </p>
      <div className="space-y-3">
        <TextInput
          type="email"
          placeholder="you@example.com"
          value={email}
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            if (!passwordMode && emailValid) magicLink();
          }}
        />
        {passwordMode && (
          <TextInput
            type="password"
            placeholder={mode === "signup" ? "Password (6+ characters)" : "Password"}
            value={password}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && valid && submit()}
          />
        )}
      </div>

      {msg && (
        <p className={cn("mt-3 text-sm", msg.tone === "error" ? "text-danger" : "text-teal")}>{msg.text}</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {passwordMode ? (
          <>
            <Button className="w-full" disabled={!valid || busy} onClick={submit}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : mode === "signin" ? (
                <>
                  <LogIn size={16} /> Sign in
                </>
              ) : (
                <>
                  <UserPlus size={16} /> Create account
                </>
              )}
            </Button>
            {mode === "signin" && (
              <Button variant="outline" className="w-full" disabled={busy} onClick={magicLink}>
                <Mail size={16} /> Email me a sign-in link instead
              </Button>
            )}
          </>
        ) : (
          <>
            <Button className="w-full" disabled={!emailValid || busy} onClick={magicLink}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Mail size={16} /> Email me a sign-in link
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() => {
                setUsePassword(true);
                setMsg(null);
              }}
            >
              <LogIn size={16} /> Use a password instead
            </Button>
          </>
        )}
      </div>

      <p className="mt-4 text-center text-[13px] text-muted">
        {mode === "signin" ? (
          <>
            New here?{" "}
            <button className="font-medium text-accent-2 hover:underline" onClick={() => { setMode("signup"); setMsg(null); }}>
              Create an account
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button className="font-medium text-accent-2 hover:underline" onClick={() => { setMode("signin"); setUsePassword(false); setMsg(null); }}>
              Sign in
            </button>
          </>
        )}
      </p>
    </Modal>
  );
}
