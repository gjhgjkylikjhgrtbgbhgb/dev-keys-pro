# Plan - Fix Login Flicker and Loading States

The goal is to eliminate the rendering lag and "flicker" where the Reseller Dashboard appears briefly before switching to the Admin Dashboard for the Master Admin (11921009176), and ensure a smooth loading state until permissions are fully resolved.

## User Review Required

> [!IMPORTANT]
> The Master Admin identification relies on the phone number `11921009176`. This is currently hardcoded in multiple places for security and routing consistency.

## Proposed Changes

### 1. Unified Authentication Logic
- Move `isAdmin` and `currentUser` detection from the `DashboardPage` component to the `_authenticated` layout route (`src/routes/_authenticated/route.tsx`).
- This ensures data is fetched once at the layout level before child routes render.

### 2. Immediate Master Admin Identification
- Update the `_authenticated` loader to check if the logged-in user's phone matches the Master Admin number (`11921009176`) immediately.
- If it matches, set an `isMasterAdmin` flag in the route context instantly.

### 3. Loading State & Flash Protection
- Implement a full-screen loading spinner in `src/routes/_authenticated/route.tsx` that remains visible until the profile data and roles are fully loaded from Supabase.
- Modify the `DashboardPage` to rely on the context provided by the parent route instead of fetching permissions locally.
- Prevent rendering any dashboard components until `loading` is `false` and `is_admin` is determined.

### 4. Route Protection
- Ensure the `_authenticated` layout blocks rendering of children until the session is valid and profile is loaded.

## Technical Details

### `src/routes/_authenticated/route.tsx`
- Add a stateful context provider (or similar pattern) to handle profile loading.
- Use `useEffect` to fetch profile data and roles immediately on load.
- Show a `LoadingOverlay` component if the profile is null and the session exists.

### `src/routes/_authenticated/dashboard.tsx`
- Remove local `useSuspenseQuery` for `current-user-data`.
- Consume `isAdmin` and `currentUser` from the route context provided by `_authenticated`.
- Add a check: if `isAdmin` is not yet a boolean, return null or a skeleton.

### `src/lib/auth.functions.ts`
- Ensure the phone number check is consistent across the app.
