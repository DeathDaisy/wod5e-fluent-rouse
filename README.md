### WARNING: DEVELOPED WITH THE HELP OF CHATGPT
# WoD5e Fluent Rouse Checks (local prototype)

This is an editable Foundry VTT **V14** module for **WoD5e 5.3.25**.
It does not modify the system source files. It is an experimental local
extension and has not been run in a live Foundry world.

## What it does

If the actor owns an item with an EXACT name below, a Blood Surge-modified
roll containing a matching selector qualifies:

| Owned item | Roll selector |
|---|---|
| Fluent Strength | `attributes.strength`, `disciplines.potence` |
| Fluent Swiftness | `attributes.dexterity`, `disciplines.celerity` |
| Fluent Endurance | `attributes.stamina`, `disciplines.fortitude` |

The module detects the system-generated automatic Rouse Check associated with
that roll. On a failed check, it rolls a second Hunger die and treats the
second outcome as the Rouse result. Hunger is increased exactly once only
if both checks fail and WoD5e's "Automated Hunger" option is enabled.

The extra roll is automatic (without a confirmation prompt) and is shown
separately in chat. The original dice pool and its modifiers are not changed.

## Install

1. Stop Foundry.
2. Extract the `wod5e-fluent-rouse` directory into your Foundry *User Data*
   folder, in `Data/modules/` (not the application installation directory).
3. Start Foundry; enable "WoD5e Fluent Rouse Checks" in your world's
   **Manage Modules** screen.
4. Reload the world.
5. Add one of the named powers as an owned item on the character.
6. Roll a matching Attribute/Discipline pool, select Blood Surge, and tick
   its situational modifier in the dice dialog.

To disable temporarily, use **Configure Settings** -> **Module Settings** ->
**Automate Fluent Blood Surge rerolls**.

## How to test

Use a test actor and note its Hunger before trying the following cases:

- Strength + Blood Surge + Fluent Strength: failed first Rouse => bonus reroll.
- Strength + Blood Surge but no Fluent Strength: ordinary system check.
- Dexterity + Fluent Strength: ordinary system check.
- Strength without Blood Surge: no extra check.
- Potence + Blood Surge + Fluent Strength: bonus reroll if first check fails.

At 50% per Rouse die, expected chance of no Hunger gain with the power is 75%.
Check browser console (F12) for `wod5e-fluent-rouse |` messages.

## Important limitations

- This wraps the **internal** `WOD5eDice.Roll` method. If WoD5e changes its
  internal call structure or exports, the module may need an update.
- It only intercepts automatic single-die Rouse Checks generated **from a
  qualifying Blood Surge roll**. Multi-check sequences, manually initiated
  Rouse Checks, and unrelated Discipline activations are left untouched.
- Owned item names are matched case-insensitively but otherwise exactly.
  Change `FLUENT_POWERS` in `scripts/fluent-rouse.js` if your items are named
  differently.
- A successful reroll is taken automatically; the module does not offer a
  choice to refuse the reroll.
- Use only one module that alters this particular roll path. Other roll
  automation modules may conflict.
- Test with copies of characters, not a live game, until you confirm that
  chat rolls and Hunger changes behave as expected in your particular
  Foundry / WoD5e versions.

## Relevant upstream implementation

- `system/api/wod5e-api.js` adds the `blood-surge` selector.
- `system/actor/scripts/roll.js` forwards selectors and extra checks.
- `system/scripts/system-rolls.js` recursively rolls the automatic Rouse.
- `system/scripts/rolls/increase-hunger.js` handles WoD5e Hunger updates.

All rights in the World of Darkness game content belong to their respective
owners. This prototype does not bundle rulebook text or system code.
