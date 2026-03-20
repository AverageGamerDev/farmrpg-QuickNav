# farmrpg-QuickNav

A Tampermonkey userscript that adds a draggable favorites overlay to [FarmRPG](https://farmrpg.com), letting you bookmark any page and jump to it in one click — no more drilling through menus to reach the Wishing Well, a specific townsfolk, or the Exchange Center.

---

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Click the [install link](https://raw.githubusercontent.com/AverageGamerDev/farmrpg-QuickNav/main/farmrpg-quickNav.user.js)
3. Click "Install" when Tampermonkey prompts you
4. Visit FarmRPG and look for the "QuickNav" button in the left sidebar


The script activates automatically the next time you open `farmrpg.com`.

---

## Usage

### Opening the overlay

A **⭐ QuickNav** entry is injected near the top of the left sidebar menu. Click it to toggle the overlay open or closed. The overlay is draggable — grab it by the **⠿ Favorites** handle and move it anywhere on screen.

### Adding a favorite

Navigate to any page in the game, open the overlay, and click **+ Add this page**. The page title is read automatically from the game's navbar — no typing required. If the page is already saved, the existing chip briefly flashes gold instead of adding a duplicate.

### Navigating to a favorite

Click any chip in the overlay. Navigation goes through Framework7's own router so the game loads the page correctly without breaking the back-button history.

### Creating a group

Click **+ New Group** in the overlay header. A small inline input appears — type a name and press **Enter** or **✔** to create it. Press **Escape** or **✕** to cancel. Groups appear as blue chips with a **▾** arrow to distinguish them from regular favorites.

### Expanding a group

Click a group chip to expand it inline. Its member chips appear to the right of the group header, connected visually. Click the group chip again to collapse it.

---

## Edit Mode

Click **✎ Edit** to enter edit mode. Click **✔ Done** to exit.

In edit mode you can:

- **Rename** any chip or group — click the label text and type. Press Enter or click away to save.
- **Delete a favorite** — click the red ✕ badge on any chip.
- **Delete a group** — click the red ✕ on the group chip. All members are returned to the main bar at the group's position; nothing is lost.
- **Reorder** — drag any chip by its **⠿** handle and drop it onto another chip to swap positions.
- **Move a favorite into a group** — drag any regular chip and drop it onto a group chip. The favorite moves inside the group.

---

## Data & Persistence

Everything is stored in `localStorage` under the key `frpg_favorites`. No data is sent anywhere. Favorites survive page refreshes and browser restarts. The overlay position is not persisted between sessions — it always opens at the top-right corner.

---

## Compatibility

| Browser | Status |
|---------|--------|
| Chrome / Edge | ✅ Tested |
| Firefox | ✅ Tested |
| Safari (via Userscripts app) | ✅ Should work |

Requires Tampermonkey (or a compatible manager: Violentmonkey, Greasemonkey, Userscripts for iOS).

Does **not** conflict with the existing [FarmRPG Farmhand](https://greasyfork.org/en/scripts/497660-farm-rpg-farmhand) script — both can run simultaneously.

---

## Code of Conduct

This script is purely a UI enhancement. It does not automate any game actions, send additional server requests, or interact with the game's API. It reads only from the DOM and `localStorage`. Usage is in the spirit of the [FarmRPG Code of Conduct](https://farmrpg.com/index.php#!/coc.php).
