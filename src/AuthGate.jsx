import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";

export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-[#FBF7EA] flex items-center justify-center font-sans text-[#8A8064] text-[13px]">
        Loading…
      </div>
    );
  }

  if (session) return children;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-[#FBF7EA] flex items-center justify-center font-sans">
      <form onSubmit={submit} className="bg-white rounded-2xl border border-[#E9DFC2] p-6 w-[320px]">
        <p className="font-semibold text-[#23305A] text-[15px] mb-1">Tafasa Admin</p>
        <p className="text-[12px] text-[#8A8064] mb-4">Sign in with your admin account.</p>

        <label className="text-[11.5px] text-[#5C5540] mb-1 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          className="w-full border border-[#E9DFC2] rounded-lg px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-[#D9A62E] mb-3"
        />

        <label className="text-[11.5px] text-[#5C5540] mb-1 block">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-[#E9DFC2] rounded-lg px-3 py-2 text-[13.5px] outline-none focus:ring-2 focus:ring-[#D9A62E] mb-2"
        />

        {error && <p className="text-[11.5px] text-[#B4482A] mb-2">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#23305A] text-white font-semibold text-[13px] rounded-lg py-2.5 mt-2 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-[10.5px] text-[#B0A883] mt-3 leading-snug">
          Admin accounts are created in Supabase (Authentication → Users),
          then linked in the <code>admins</code> table. See the backend README.
        </p>
      </form>
    </div>
  );
}
