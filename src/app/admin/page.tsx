"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLogin from "./login/page";          // <-- login imported here
import AdminPanel from "@/app/admin/adminpanel/page"; // <-- your original UI

export default function AdminRoot() {
  const router = useRouter();
  const [isAuth, setIsAuth] = useState<null | boolean>(null);

  // Check auth on mount
  useEffect(() => {
    const auth = sessionStorage.getItem("adminAuth") === "true";
    setIsAuth(auth);
    if (!auth) router.replace("/admin/login");
  }, [router]);

  // Still checking
  if (isAuth === null) return null;

  // Not logged-in → show login (same URL)
  if (!isAuth) return <AdminLogin />;

  // Logged-in → full admin UI
  return <AdminPanel />;
}