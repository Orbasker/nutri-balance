"use client";

import Link from "next/link";

export function TopAppBar() {
  return (
    <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-screen-xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-md-primary-fixed overflow-hidden flex items-center justify-center">
            <span className="material-symbols-outlined text-md-on-primary-fixed">person</span>
          </div>
          <Link href="/dashboard">
            <h1 className="font-extrabold text-blue-800 tracking-tight text-xl">
              Nutrient Tracker
            </h1>
          </Link>
        </div>
        <button className="text-blue-700 hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined">notifications</span>
        </button>
      </div>
    </header>
  );
}
