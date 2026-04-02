/**
 * Auth type definitions.
 * Authentication is handled by Supabase Auth — this file exports
 * the Session type used across the app for type compatibility.
 */
export type Session = {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string | null;
  };
};
