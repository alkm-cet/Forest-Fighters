/**
 * Pure combat simulation — no DB access.
 * Reusable for both PvE (dungeon) and PvP battles.
 *
 * Each round:
 *   1. Attacker rolls chance → if hit, attack *= 1.3
 *   2. Defender rolls chance → if hit, defense *= 1.3
 *   3. damage = max(0, boostedAtk - boostedDef)
 *   4. Defender loses HP
 *   5. If defender alive, swap roles and repeat
 *
 * @param {object} attacker  - { attack, defense, chance, max_hp }
 * @param {object} defender  - { attack, defense, chance, max_hp }
 * @returns {{ winner: 'attacker'|'defender', attackerHpLeft, defenderHpLeft, log }}
 */
function simulateCombat(attacker, defender) {
  let attackerHp = attacker.max_hp || 100;
  let defenderHp = defender.max_hp || 100;
  const log = [];

  for (let round = 0; round < 10; round++) {
    // --- Attacker's turn ---
    const atkBoosted = Math.random() * 100 < (attacker.chance || 0);
    const atkValue = atkBoosted ? attacker.attack * 1.3 : attacker.attack;

    const defBoosted = Math.random() * 100 < (defender.chance || 0);
    const defValue = defBoosted ? defender.defense * 1.3 : defender.defense;

    const damage = Math.max(0, atkValue - defValue);
    defenderHp -= damage;

    log.push({
      round,
      actor: 'attacker',
      atkBoosted,
      defBoosted,
      attackValue: Math.round(atkValue),
      defenseValue: Math.round(defValue),
      damage: Math.round(damage),
      attackerHpAfter: Math.max(0, Math.round(attackerHp)),   // unchanged this step
      defenderHpAfter: Math.max(0, Math.round(defenderHp)),   // took damage
    });

    if (defenderHp <= 0) break;

    // --- Defender's counter-attack ---
    const defAtkBoosted = Math.random() * 100 < (defender.chance || 0);
    const defAtkValue = defAtkBoosted ? defender.attack * 1.3 : defender.attack;

    const atkBlockBoosted = Math.random() * 100 < (attacker.chance || 0);
    const atkBlockValue = atkBlockBoosted ? attacker.defense * 1.3 : attacker.defense;

    const counterDamage = Math.max(0, defAtkValue - atkBlockValue);
    attackerHp -= counterDamage;

    log.push({
      round,
      actor: 'defender',
      atkBoosted: defAtkBoosted,
      defBoosted: atkBlockBoosted,
      attackValue: Math.round(defAtkValue),
      defenseValue: Math.round(atkBlockValue),
      damage: Math.round(counterDamage),
      attackerHpAfter: Math.max(0, Math.round(attackerHp)),   // took damage
      defenderHpAfter: Math.max(0, Math.round(defenderHp)),   // unchanged this step
    });

    if (attackerHp <= 0) break;
  }

  // Attacker wins ties (equal HP)
  const winner =
    defenderHp <= 0 ? 'attacker'
    : attackerHp <= 0 ? 'defender'
    : attackerHp >= defenderHp ? 'attacker'
    : 'defender';

  return {
    winner,
    attackerHpLeft: Math.max(0, Math.round(attackerHp)),
    defenderHpLeft: Math.max(0, Math.round(defenderHp)),
    log,
  };
}

module.exports = { simulateCombat };
