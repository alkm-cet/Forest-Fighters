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
  // Use current_hp if provided (champion entered the fight injured), otherwise start at max_hp
  let attackerHp = attacker.current_hp ?? attacker.max_hp ?? 100;
  let defenderHp = defender.current_hp ?? defender.max_hp ?? 100;
  const log = [];

  for (let round = 0; round < 100; round++) {
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

/**
 * 2-champion vs 1-boss combat simulation.
 * Turn order rotates each round to avoid first-actor bias:
 *   Even rounds: c1 attacks, c2 attacks, boss→c1, boss→c2
 *   Odd  rounds: c2 attacks, c1 attacks, boss→c2, boss→c1
 * Boss wins only if BOTH champions reach 0 HP.
 */
function simulateBossCombat(champion1, champion2, boss) {
  let c1Hp = champion1.current_hp ?? champion1.max_hp ?? 100;
  let c2Hp = champion2.current_hp ?? champion2.max_hp ?? 100;
  let bossHp = boss.max_hp ?? 100;
  const log = [];
  let bossKilled = false;

  for (let round = 0; round < 100; round++) {
    const c1First = round % 2 === 0;
    const order = c1First
      ? [{ champ: champion1, label: 'champion1', isC1: true  }, { champ: champion2, label: 'champion2', isC1: false }]
      : [{ champ: champion2, label: 'champion2', isC1: false }, { champ: champion1, label: 'champion1', isC1: true  }];

    // Champions attack boss
    for (const { champ, label, isC1 } of order) {
      const curHp = isC1 ? c1Hp : c2Hp;
      if (curHp <= 0) continue;
      const atkBoosted = Math.random() * 100 < (champ.chance || 0);
      const defBoosted = Math.random() * 100 < (boss.chance  || 0);
      const atk = atkBoosted ? champ.attack  * 1.3 : champ.attack;
      const def = defBoosted ? boss.defense  * 1.3 : boss.defense;
      const dmg = Math.max(0, atk - def);
      bossHp = Math.round(Math.max(0, bossHp - dmg));
      log.push({ round, actor: label, atkBoosted, defBoosted, attackValue: Math.round(atk), defenseValue: Math.round(def), damage: Math.round(dmg), c1HpAfter: c1Hp, c2HpAfter: c2Hp, bossHpAfter: bossHp });
      if (bossHp <= 0) { bossKilled = true; break; }
    }
    if (bossKilled) break;

    // Boss retaliates in same rotation order
    for (const { champ, label, isC1 } of order) {
      const curHp = isC1 ? c1Hp : c2Hp;
      if (curHp <= 0) continue;
      const atkBoosted = Math.random() * 100 < (boss.chance  || 0);
      const defBoosted = Math.random() * 100 < (champ.chance || 0);
      const atk = atkBoosted ? boss.attack   * 1.3 : boss.attack;
      const def = defBoosted ? champ.defense * 1.3 : champ.defense;
      const dmg = Math.max(0, atk - def);
      if (isC1) c1Hp = Math.round(Math.max(0, c1Hp - dmg));
      else      c2Hp = Math.round(Math.max(0, c2Hp - dmg));
      log.push({ round, actor: `boss_vs_${label}`, atkBoosted, defBoosted, attackValue: Math.round(atk), defenseValue: Math.round(def), damage: Math.round(dmg), c1HpAfter: c1Hp, c2HpAfter: c2Hp, bossHpAfter: bossHp });
    }

    if (c1Hp <= 0 && c2Hp <= 0) break;
  }

  const winner = bossHp <= 0 ? 'attacker' : 'defender';
  return { winner, attackerHpLeft: Math.round(c1Hp), attacker2HpLeft: Math.round(c2Hp), defenderHpLeft: Math.round(bossHp), log };
}

module.exports = { simulateCombat, simulateBossCombat };
