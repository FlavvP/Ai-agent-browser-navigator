"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

type AuthMode = "login" | "register";

export function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          setError(typeof data.error === "string" ? data.error : "Creation du compte impossible.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email ou mot de passe incorrect.");
        return;
      }

      window.location.reload();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Agent Web Chat</h1>
          <p className="mt-2 text-sm text-zinc-500">Connecte-toi pour retrouver tes conversations.</p>
        </div>

        <Button className="mb-4 w-full" variant="subtle" onClick={() => signIn("google")}>
          Continuer avec Google
        </Button>

        <div className="my-5 h-px bg-zinc-800" />

        <form className="space-y-3" onSubmit={submit}>
          <input
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-500"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm outline-none focus:border-zinc-500"
            type="password"
            placeholder="Mot de passe"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {error ? <div className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-200">{error}</div> : null}

          <Button className="w-full" variant="primary" type="submit" disabled={loading}>
            {mode === "login" ? "Se connecter" : "Creer un compte"}
          </Button>
        </form>

        <button
          className="mt-5 w-full text-sm text-zinc-400 hover:text-white"
          type="button"
          onClick={() => {
            setError("");
            setMode((value) => (value === "login" ? "register" : "login"));
          }}
        >
          {mode === "login" ? "Creer un compte avec email" : "J'ai deja un compte"}
        </button>
      </div>
    </main>
  );
}
