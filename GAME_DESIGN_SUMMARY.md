IMPORTANT: THE INFORMATION BELOW IS A CONCEPT BRIEF FOR A MOBILE GAME. IT IS NOT A COMPLETE DESIGN DOCUMENT, BUT RATHER AN OVERVIEW OF THE CORE IDEAS AND MECHANICS. THIS SHOULD BE USED AS A STARTING POINT FOR DISCUSSIONS AND FURTHER DEVELOPMENT.

Game Design Summary
Champion System

The game has 3 champions available from the beginning.
Players must strategically decide how to use them.

Example champion roles:

Champion Role
Warrior Tank
Mage High damage
Archer High chance / crit

Since there are only three champions, players must constantly choose which champion performs which task.

Champion Slot System (3 Slot Economy)

Each player has three champions, and each champion can take one role at a time.

Slot Purpose
Defender Defends against PvP attacks while the player is offline
PvP Attacker Used for attacking other players
PvE Explorer Sent to dungeons to collect resources

Example configuration:

Warrior → Defender
Mage → PvP attacker
Archer → Resource dungeon

Players can change these assignments strategically.

Level Progression System

If the game uses a hard level cap (e.g. level 100), multiplayer progression may stall.

Problems:

Late game stagnation

Players reach max level
No more upgrades
Progression stops

PvP imbalance

Example: Level 100 vs Level 20
Results become unfair
Solution: Soft Progression

Introduce an Ascension system.

Example:

Level cap = 50

Level 50
↓
Ascend
↓
Level resets to 1
Permanent stat bonus (+10%)

This allows infinite progression without breaking balance.

Similar systems exist in:

Archero
AFK Arena
Resource System

The game has 3 main resources, each with a different purpose.

Strawberry 🍓

High value resource.

Uses:

Revive champion
Heal champion
PvP revive

Example:

1 Strawberry = revive champion
Pinecone 🌰

Main upgrade resource.

Used for:

Attack upgrades
Defense upgrades

Example:

+1 attack = 10 pinecone
Blueberry 🫐

Temporary combat buff resource.

Used before battles.

Examples:

+5% chance
+10% crit
increased rare loot chance
Resource Sink (Critical for Economy)

A healthy economy requires resource sinks.

Resource sink = systems where resources are consumed.

System Resource
Champion upgrade Pinecone
Revive Strawberry
Combat buff Blueberry
Dungeon entry Pinecone

Without sinks, resources accumulate and the economy breaks.

PvP Resource Transfer

If players lose all resources when defeated, frustration may cause players to quit.

Recommended Solution: Lootable Pool

Only a small portion of resources is lootable.

Example:

Total Pinecone = 200
Lootable Pinecone = 20

If the player loses:

Enemy may steal up to 20 pinecone

This system is used in:

Clash of Clans
Dungeon System

Dungeons are PvE missions used for resource farming.

Example dungeon types:

Dungeon Duration Reward
Forest 5 min Pinecone
Berry Field 10 min Strawberry
Ancient Ruins 15 min Blueberry

Champions sent to dungeons are temporarily unavailable.

Champion Death / Fatigue System

After losing a battle, a champion enters a Fatigued state.

Effects:

Cannot fight again immediately
Must recover first

Recovery methods:

Wait 10 minutes
OR
Use Strawberry

This prevents PvP spamming while still allowing recovery.

PvP Battle Timer

PvP battles last 5 minutes before results are calculated.

Benefits:

Creates suspense
Encourages players to return to the game

During battle:

Champion card shows status
Countdown timer visible

Example UI:

⚔ In Battle
04:32

Champions already in battle cannot be used again until the timer ends.

Randomness (RNG) in Combat

RNG adds excitement and unpredictability to battles.

Battle outcomes depend on:

Attack
Defense
Chance
Random factors

Chance stat can affect:

Critical hits
Dodge
Double attack
Early Game Pacing

The first 10 minutes of gameplay are crucial for player retention.

Recommended early pacing:

First dungeon: 30 seconds
First upgrades: cheap
Early rewards: frequent

This helps hook the player quickly.

Combat System

Combat will use a round-based system (3 rounds) rather than a single instant calculation.

Example:

Round 1
Round 2
Round 3
Result determined

Round-based combat provides more engaging battle outcomes.
