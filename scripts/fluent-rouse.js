/**
 * WoD5e Fluent Rouse Checks — local Foundry V14 / WoD5e 5.3.25 extension.
 *
 * WoD5e's WOD5eDice.Roll() performs a separate, recursive Roll() for the
 * automatic Rouse Check attached to an active Blood Surge modifier.
 * We intercept only that child roll for characters with an applicable power.
 * The original WoD5e system files remain untouched.
 *
 * This wraps a system method rather than relying on a public hook. Recheck
 * compatibility after WoD5e updates its internal roll implementation.
 */

const MODULE_ID = 'wod5e-fluent-rouse';

// Match owned item NAMES, not item IDs. Change these names if needed.
const FLUENT_POWERS = [
  {
    itemName: 'Fluent Strength',
    selectors: ['attributes.strength', 'disciplines.potence']
  },
  {
    itemName: 'Fluent Swiftness',
    selectors: ['attributes.dexterity', 'disciplines.celerity']
  },
  {
    itemName: 'Fluent Endurance',
    selectors: ['attributes.stamina', 'disciplines.fortitude']
  }
];

// Each actor can have more than one pending roll dialog open at a time.
// A WeakMap avoids retaining references to actors after their use.
const pendingRolls = new WeakMap();

function findFluentPower(actor, selectors) {
  if (!actor?.items || !Array.isArray(selectors)) return null;
  if (!selectors.includes('blood-surge')) return null;

  const ownedNames = new Set(
    [...actor.items].map(item => item.name?.trim().toLocaleLowerCase())
  );

  return FLUENT_POWERS.find(power =>
    ownedNames.has(power.itemName.toLocaleLowerCase()) &&
    power.selectors.some(selector => selectors.includes(selector))
  ) || null;
}

function failedRouseCheck(roll) {
  const results = roll?.advancedDice?.results?.filter(result =>
    !result.discarded && result.active !== false
  );

  if (!results || results.length !== 1) {
    throw new Error('Expected one active Hunger die on the Rouse Check.');
  }

  const die = results[0];
  // WoD5e uses the `success` property when detecting Hunger failures.
  // The numeric fallback is for instances where that property is absent.
  return typeof die.success === 'boolean'
    ? !die.success
    : Number(die.result) < 6;
}

export function installFluentRouse(WOD5eDice, increaseHunger) {
  if (WOD5eDice.Roll._fluentRouseWrapped) return;

  const originalRoll = WOD5eDice.Roll;

  WOD5eDice.Roll = async function patchedFluentRoll(options = {}) {
    const actor = options.actor;
    const rollStack = actor && pendingRolls.get(actor);
    const rouseLabel = game.i18n.localize('WOD5E.VTM.RousingBlood');

    // The nested automatic check has the exact title that the system builds:
    // "Rousing the Blood - <parent roll title>".
    const parent = rollStack?.findLast(context =>
      options.title === `${rouseLabel} - ${context.title}`
    );

    const isAutomaticRouse = Boolean(
      parent &&
      options.quickRoll === true &&
      options.increaseHunger === true &&
      options.disableBasicDice === true &&
      options.advancedDice === 1
    );

    if (isAutomaticRouse) {
      // Prevent WoD5e from increasing Hunger before the Fluent reroll.
      const checkOptions = { ...options, increaseHunger: false };
      const firstRoll = await originalRoll.call(this, checkOptions);

      let firstFailed;
      try {
        firstFailed = failedRouseCheck(firstRoll);
      } catch (error) {
        console.error(`${MODULE_ID} | Could not inspect the Rouse result`, error);
        ui.notifications.error('Fluent Rouse: cannot read Rouse result; check Hunger manually.');
        return firstRoll;
      }

      if (!firstFailed) return firstRoll;

      let rerollFailed = true;
      try {
        // A SECOND Hunger die is rolled only after a failure.
        // Do not call patchedFluentRoll recursively for this bonus roll.
        const secondRoll = await originalRoll.call(this, {
          ...checkOptions,
          title: `${parent.power.itemName} - Rouse reroll`,
          advancedCheckDice: 0,
          originMessage: ''
        });
        rerollFailed = failedRouseCheck(secondRoll);
      } catch (error) {
        console.error(`${MODULE_ID} | Fluent reroll failed`, error);
        ui.notifications.error('Fluent Rouse reroll failed; inspect chat and Hunger.');
      }

      if (rerollFailed && game.settings.get('wod5e', 'automatedHunger')) {
        // Let WoD5e apply its own Hunger cap, permission handling, and notices.
        await increaseHunger(actor, 1, options.rollMode);
      }
      return firstRoll;
    }

    // The system includes blood-surge + relevant attribute/discipline in
    // the main roll's `selectors`. No need to inspect UI checkboxes directly.
    const power =
      game.settings.get(MODULE_ID, 'enabled') &&
      actor?.system?.gamesystem === 'vampire'
        ? findFluentPower(actor, options.selectors)
        : null;

    if (!power) return originalRoll.call(this, options);

    const stack = rollStack || [];
    if (!rollStack) pendingRolls.set(actor, stack);
    const context = { title: options.title, power };
    stack.push(context);

    try {
      return await originalRoll.call(this, options);
    } finally {
      const index = stack.indexOf(context);
      if (index !== -1) stack.splice(index, 1);
      if (!stack.length) pendingRolls.delete(actor);
    }
  };

  WOD5eDice.Roll._fluentRouseWrapped = true;
  console.info(`${MODULE_ID} | Roll interception enabled.`);
}

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'enabled', {
    name: 'Automate Fluent Blood Surge rerolls',
    hint: 'Automatically reroll failed Blood Surge Rouse Checks when the actor owns a matching Fluent power.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once('ready', async () => {
  if (game.system.id !== 'wod5e') return;

  try {
    const { WOD5eDice } = await import('/systems/wod5e/system/scripts/system-rolls.js');
    const { _increaseHunger } = await import('/systems/wod5e/system/scripts/rolls/increase-hunger.js');
    installFluentRouse(WOD5eDice, _increaseHunger);
  } catch (error) {
    console.error(`${MODULE_ID} | Initialization failed`, error);
    ui.notifications.error('Fluent Rouse module failed to initialize; see the browser console.');
  }
});
