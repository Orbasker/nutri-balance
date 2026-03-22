"use client";

import { useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import { saveProfile } from "./actions";

const AVATAR_COLORS = [
  { id: "blue", bg: "bg-blue-100", ring: "ring-blue-400" },
  { id: "purple", bg: "bg-purple-100", ring: "ring-purple-400" },
  { id: "green", bg: "bg-emerald-100", ring: "ring-emerald-400" },
  { id: "orange", bg: "bg-orange-100", ring: "ring-orange-400" },
  { id: "pink", bg: "bg-pink-100", ring: "ring-pink-400" },
  { id: "teal", bg: "bg-teal-100", ring: "ring-teal-400" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
];

export type ProfileSettingsProps = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  healthGoal: string;
  avatarColor: string;
};

export function ProfileSettings({
  firstName: initFirst,
  lastName: initLast,
  dateOfBirth: initDob,
  gender: initGender,
  healthGoal: initGoal,
  avatarColor: initColor,
}: ProfileSettingsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState(initFirst);
  const [lastName, setLastName] = useState(initLast);
  const [dob, setDob] = useState(initDob);
  const [gender, setGender] = useState(initGender);
  const [goal, setGoal] = useState(initGoal);
  const [color, setColor] = useState(initColor);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty =
    firstName !== initFirst ||
    lastName !== initLast ||
    dob !== initDob ||
    gender !== initGender ||
    goal !== initGoal ||
    color !== initColor;

  const age = dob ? calcAge(dob) : null;

  function markDirty() {
    setSaved(false);
  }

  const inputClass =
    "w-full bg-md-surface-container-low border-none rounded-xl px-4 py-3 text-md-on-surface text-sm placeholder:text-md-outline/50 focus:ring-2 focus:ring-md-primary/20 outline-none";

  return (
    <section className="bg-md-surface-container-lowest p-8 rounded-xl shadow-[0_10px_30px_rgba(0,68,147,0.06)]">
      <div className="flex items-center gap-3 mb-8">
        <span className="material-symbols-outlined text-md-primary">person</span>
        <h3 className="font-bold text-lg">Profile</h3>
      </div>

      {error && (
        <p className="text-md-error text-sm mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {/* Avatar color picker */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-widest text-md-outline mb-3">
            Avatar color
          </label>
          <div className="flex gap-3">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setColor(c.id);
                  markDirty();
                }}
                className={cn(
                  "w-10 h-10 rounded-full transition-all",
                  c.bg,
                  color === c.id ? `ring-2 ${c.ring} ring-offset-2 scale-110` : "hover:scale-105",
                )}
                aria-label={c.id}
              />
            ))}
          </div>
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-first"
              className="block text-xs font-bold uppercase tracking-widest text-md-outline mb-2"
            >
              First name
            </label>
            <input
              id="profile-first"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                markDirty();
              }}
              placeholder="First name"
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="profile-last"
              className="block text-xs font-bold uppercase tracking-widest text-md-outline mb-2"
            >
              Last name
            </label>
            <input
              id="profile-last"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                markDirty();
              }}
              placeholder="Last name"
              className={inputClass}
            />
          </div>
        </div>

        {/* DOB + Gender row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-dob"
              className="block text-xs font-bold uppercase tracking-widest text-md-outline mb-2"
            >
              Date of birth
            </label>
            <input
              id="profile-dob"
              type="date"
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                markDirty();
              }}
              className={inputClass}
            />
            {age !== null && <p className="text-[11px] text-md-outline mt-1.5">{age} years old</p>}
          </div>
          <div>
            <label
              htmlFor="profile-gender"
              className="block text-xs font-bold uppercase tracking-widest text-md-outline mb-2"
            >
              Gender
            </label>
            <select
              id="profile-gender"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value);
                markDirty();
              }}
              className={inputClass}
            >
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Health goal */}
        <div>
          <label
            htmlFor="profile-goal"
            className="block text-xs font-bold uppercase tracking-widest text-md-outline mb-2"
          >
            Health goal
          </label>
          <input
            id="profile-goal"
            type="text"
            value={goal}
            onChange={(e) => {
              setGoal(e.target.value);
              markDirty();
            }}
            placeholder="e.g., Managing CKD stage 3, Low oxalate diet"
            className={inputClass}
          />
          <p className="text-[11px] text-md-outline mt-1.5">
            Shown on your dashboard as a daily reminder.
          </p>
        </div>

        {/* Save */}
        <button
          disabled={pending || !isDirty}
          onClick={() => {
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const res = await saveProfile({
                firstName,
                lastName,
                dateOfBirth: dob || null,
                gender: gender || null,
                healthGoal: goal,
                avatarColor: color,
              });
              if ("error" in res) {
                setError(res.error);
                return;
              }
              setSaved(true);
              router.refresh();
            });
          }}
          className="w-full bg-md-primary text-white font-bold py-4 rounded-xl active:scale-95 transition-all duration-200 disabled:opacity-60"
        >
          {pending ? "Saving..." : saved ? "Saved!" : "Save Profile"}
        </button>
      </div>
    </section>
  );
}

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
