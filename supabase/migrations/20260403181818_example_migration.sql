create table user_profiles (
    id uuid references auth.users on delete cascade not null primary key,
    full_name text,
    avatar_url text,
    updated_at timestamp with time zone,
    constraint full_name_length check (char_length(full_name) >= 3)
);