"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

const HARDCODED = { username: "admin", password: "rajrestro123" };

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === HARDCODED.username && password === HARDCODED.password) {
      // store a tiny token in sessionStorage (client-side only)
      sessionStorage.setItem("adminAuth", "true");
      router.replace("/admin"); // go to protected admin page
    } else {
      setError("Invalid credentials");
    }
  };

  return (
    <section className="min-h-screen bg-linear-to-b from-yellow-700 to-yellow-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-xl bg-white/95">
        <h1 className="text-3xl font-bold text-center text-yellow-700 mb-6">
          Admin Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Login
          </Button>
        </form>

        {/* <p className="mt-6 text-center text-xs text-gray-500">
          Hint: <code className="bg-gray-200 px-1 rounded">admin / wtf123</code>
        </p> */}
      </Card>
    </section>
  );
}
