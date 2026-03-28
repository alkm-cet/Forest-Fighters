IMPORTANT: THE INFORMATION BELOW IS A CONCEPT BRIEF FOR A MOBILE GAME. IT IS NOT A COMPLETE DESIGN DOCUMENT, BUT RATHER AN OVERVIEW OF THE CORE IDEAS AND MECHANICS. THIS SHOULD BE USED AS A STARTING POINT FOR DISCUSSIONS AND FURTHER DEVELOPMENT.

## Test Account

| Field    | Value         |
| -------- | ------------- |
| Email    | test@test.com |
| Password | password123   |

Mobile Game Concept Brief
Game Type

This project is a mobile cozy strategy / idle battle game developed with React Native.

The game will be online but not real-time multiplayer.
Players interact asynchronously (similar to idle games or asynchronous PvP).

The gameplay focuses on:

simple strategy
short battles
idle resource production
cozy and cute visuals
quick play sessions (3–5 minutes)

The game should feel relaxing and rewarding rather than complex.

Core Gameplay Concept

Players control a small group of champions and send them to either:

PvP battles against other players
Dungeon missions against AI enemies

While champions are fighting or on missions, farmers produce resources over time.

The core gameplay loop is:

Login → Collect resources → Upgrade champions → Send champions to missions or PvP → Earn rewards → Repeat.

Sessions should be short and satisfying.

Champion System

Players have a small roster of champions.

Total champion count should stay small:

approximately 6–10 champions maximum

Example champion classes:

Warrior
Mage
Archer

Each champion has 3 core stats:

Attack
Defense
Chance

Example meaning:

Attack → damage dealt
Defense → damage resistance
Chance → chance for critical hit or dodge

Champions can be upgraded using resources collected in the game.

Resource System

The game includes three main resources, represented as fruit / nature items.

Example resources:

Strawberry
Pinecone
Blueberry

Example uses:

Strawberry → revive fallen champions
Pinecone → champion upgrades
Blueberry → temporary combat boosts or stat increases

These resources appear in the top header of the UI with icon + quantity.

Farming System (Idle Resource Production)

Players also have farmers that generate resources automatically over time.

Example:

Farmers produce resources every few minutes.

Example production:

10 minutes → 5 strawberries

Players can:

collect resources
upgrade farmers
increase production rate

Farmers should be accessible from the main screen.

Tapping a farmer should open a bottom drawer UI where players can:

see production rate
collect resources
upgrade production

Missions / Dungeon System

Players can send champions to dungeons.

Dungeons are time-based missions.

Example durations:

5 minutes
15 minutes
30 minutes

Dungeon cards show:

dungeon name
enemy preview
mission duration
rewards

Example rewards:

resources
upgrade materials

The dungeon system should allow players to send champions while they continue playing or leave the game.

PvP System

PvP is asynchronous.

Players do not fight live.

Instead:

Player selects a champion → starts PvP → battle is simulated → result is returned.

Battles should be very short (a few seconds).

Battle System

Battles are simple and quick.

The outcome should be determined using champion stats.

Example idea:

Attack vs Defense calculation combined with randomness.

Chance stat influences:

critical hits
dodge chance
combat randomness

The battle system should remain simple and fast.

Main Gameplay Loop

The intended gameplay loop:

Player opens the game
Collects resources from farmers
Upgrades champions
Sends champions to dungeon missions
Starts PvP battles
Receives rewards
Upgrades again

This loop should take about 3–5 minutes per session.

UI / UX Concept

The UI should be:

simple
minimal
cozy
cartoon-style
easy to understand

Visual inspiration comes from casual mobile games such as:

Rush Royale
The Battle Cats

The interface should use:

rounded cards
cute characters
bright but soft colors
simple layouts

Main Screen Layout

The main screen contains several sections.

Top Header

Shows the three resources:

Strawberry
Pinecone
Blueberry

Each resource has an icon and quantity.

Center Area

A simple battlefield lane where small cute characters fight automatically.

This is mostly visual feedback rather than complex gameplay.

Bottom Area

Three champion cards belonging to the player.

Each card shows:

character icon
cost or level indicator

Cards are tappable.

Bottom Drawer Interaction

When a champion card is tapped, a bottom drawer slides up.

The drawer shows:

Champion information

Name
Level
Attack
Defense
Chance

And two main buttons:

PVP
DUNGEON

Dungeon Navigation

If the player presses Dungeon, another screen appears.

This screen shows a list of dungeon cards.

Each dungeon card includes:

Dungeon name
Dungeon level
Enemy preview icon
Mission duration
Reward icons

Players select a dungeon and send their champion.

Champion Collection Screen

There is also a character gallery screen.

This screen shows all owned champions.

Layout:

grid of character cards

Each card contains:

character portrait
star level
upgrade button

Players will only have around 6–10 champions total.

Farmers Access

Farmers should be easy to access from the main screen.

Tapping a farmer opens a bottom drawer where players can:

see production stats
collect resources
upgrade the farmer

Visual Theme

The game theme is cozy fantasy forest.

Environment elements may include:

grass
trees
bones
rocks
nature decorations

Characters should be:

small
cute
cartoon-style
expressive

The overall atmosphere should feel relaxed and cozy rather than intense or competitive.

Design Philosophy

The design should focus on:

simple mechanics
short sessions
clear progression
rewarding feedback

Players should always feel like they are progressing with small upgrades and resource collection.
