# SG Stock

Stock, purchases and stock cards for the stamp department. React + Vite, Supabase, deployed on Vercel.

## Setup (once)

1. **Supabase:** new project. SQL Editor: run `sql/01_schema.sql`.
2. **Import data** (Table Editor, "Import data from CSV"), in this order:
   `lookups.csv` → lookups, `purchases.csv` → purchases, `items.csv` → items.
   (The CSVs are kept out of GitHub on purpose. They contain cost prices.)
3. SQL Editor: run `sql/02_app_setup.sql`.
4. **Login:** Authentication → Users → Add user (the shared team email and password).
5. **Vercel:** import this repo, framework "Vite", and add two environment variables
   from Supabase → Project Settings → API:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Stock cards

`public/card-template.pptx` is the team's own card file. The app copies its theme and slide size
and adds one slide per card with the exact text boxes the old Excel macro made
(same positions, Times New Roman, sizes 20/26, bold country, justified description, price as £0.00).
Don't replace or re-save that file in a different PowerPoint theme.
