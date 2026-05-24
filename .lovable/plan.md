# Delete Prospect from Edit Drawer

## Goal
Let users delete a prospect entirely while editing them, with a confirmation step to prevent accidents.

## Changes

### 1. ProspectDrawer — add Delete button + confirmation
- When `editing` is provided (i.e., edit mode), show a red **Delete** button next to Cancel/Save.
- Clicking Delete opens a confirmation dialog asking: "Delete [Name]? This cannot be undone."
- On confirm, call `deleteProspect(editing.id)`, close the drawer.

### 2. Use existing store action
- `deleteProspect` already exists in `useStore`. Just wire it up in the drawer.

### 3. UI details
- Use shadcn AlertDialog for the confirmation.
- Delete button styled with `variant="destructive"`.
- Only shown when editing, never when adding a new prospect.

## Files to change
- `src/components/ProspectDrawer.tsx`