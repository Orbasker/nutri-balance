-- Add personalization fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS health_goal text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT 'blue';

-- Backfill first_name from display_name for existing users
UPDATE profiles
SET first_name = split_part(display_name, ' ', 1),
    last_name  = NULLIF(substr(display_name, length(split_part(display_name, ' ', 1)) + 2), '')
WHERE display_name IS NOT NULL AND first_name IS NULL;

-- Update the auth trigger to populate new fields on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', ''),
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'user'
  );
  RETURN NEW;
END;
$$;
