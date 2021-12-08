import type {
  Bot,
  Id,
  Action,
  GameSize,
  Dir,
  Move,
  Rotate,
  Stash,
} from "./types";
import {
  createEvent,
  createStore,
  attach,
  split,
  combine,
  sample,
  createApi,
  guard,
  restore,
  EventPayload,
  StoreValue,
  merge,
} from "effector";
import { klona } from "klona/json";
import {
  takeHealth,
  getDir,
  getPos,
  isPosEqual,
  inGunRange,
  isOutOfBounds,
  RANGE,
} from "./lib";
import { interval } from "./interval";
import { abort } from "./abort";

export const $gameSize = createStore<GameSize>(
  {
    w: 100,
    h: 100,
  },
  { sid: "game-size" }
);

// TEAM A
export const $teamA = createStore<Record<Id, Bot>>(
  {
    defaultAttacker: {
      id: "defaultAttacker",
      name: "Boba",
      position: {
        x: 50,
        y: 25,
      },
      health: 100,
      viewDir: "n",
    },
  },
  { sid: "teamA" }
);
const teamABaseApi = createApi($teamA, {
  damage: (kv, hit: [id: Id, amount: number]) => 
  {
    const [id, amount] = hit;
    const next = klona(kv);
    next[id].health = takeHealth(next[id].health, amount);
    return next;
  },
  rotate: (kv, rot: [id: Id, dir: Dir]) => {
    if (!kv[rot[0]].health) return;
    const [id, dir] = rot;
    const next = klona(kv);
    next[id].viewDir = getDir(dir);
    return next;
  },
});
const moveA = createEvent<[id: Id, dir: Dir]>();
sample({
  source: [$gameSize, $teamA],
  clock: moveA,
  fn: ([size, kv], [id, dir]) => {
    if (!kv[id].health) return;
    const realDir = getDir(dir);
    const next = klona(kv);
    const pos = getPos(size, next[id].position, realDir);
    next[id].position = pos;
    next[id].viewDir = realDir;
    return next;
  },
  target: $teamA,
});

const teamAApi = {
  ...teamABaseApi,
  move: moveA,
  shoot: createEvent<Id>(),
};

// TEAM B
export const $teamB = createStore<Record<Id, Bot>>(
  {
    defaultAttacker: {
      id: "defaultAttacker",
      name: "Boba",
      position: {
        x: 50,
        y: 25,
      },
      health: 100,
      viewDir: "n",
    },
  },
  { sid: "teamB" }
);
const teamBBaseApi = createApi($teamB, {
  damage: (kv, hit: [id: Id, amount: number]) => {
    const [id, amount] = hit;
    const next = klona(kv);
    next[id].health = takeHealth(next[id].health, amount);
    return next;
  },
  rotate: (kv, rot: [id: Id, dir: Dir]) => {
    if (!kv[rot[0]].health) return;
    const [id, dir] = rot;
    const next = klona(kv);
    next[id].viewDir = getDir(dir);
    return next;
  },
});
const moveB = createEvent<[id: Id, dir: Dir]>();
sample({
  source: [$gameSize, $teamB],
  clock: moveB,
  fn: ([size, kv], [id, dir]) => {
    if (!kv[id].health) return;
    const realDir = getDir(dir);
    const next = klona(kv);
    const pos = getPos(size, next[id].position, realDir);
    next[id].position = pos;
    next[id].viewDir = realDir;
    return next;
  },
  target: $teamB,
});

const teamBApi = {
  ...teamBBaseApi,
  move: moveB,
  shoot: createEvent<Id>(),
};

const $teamAMeta = $teamA.map((kv) =>
  Object.values(kv)
    .map((v) => ({ ...v }))
    .filter((v) => v.health > 0)
);

const $teamBMeta = $teamB.map((kv) =>
  Object.values(kv)
    .map((v) => ({ ...v }))
    .filter((v) => v.health > 0)
);

const teamAConf = {
  sid: "teamAMove",
  source: combine({
    myBots: $teamAMeta,
    enemyBots: $teamBMeta,
    stash: {} as Stash,
  }),
  effect: (meta): { id: Id } & Action => {
    return {
      id: "",
      type: "nothing",
    };
  },
} as const;
export const teamAMoveFx = attach(teamAConf);

const teamBConf = {
  sid: "teamBMove",
  source: combine({
    myBots: $teamBMeta,
    enemyBots: $teamAMeta,
    stash: {} as Stash,
  }),
  effect: (meta): { id: Id } & Action => {
    return {
      id: "",
      type: "nothing",
    };
  },
} as const;
export const teamBMoveFx = attach(teamBConf);

export type GameStateBase = StoreValue<typeof teamBConf.source>;

// game
export const tick = createEvent();

const $currentMove = createStore<"a" | "b">("a").on(tick, (curr) =>
  curr === "a" ? "b" : "a"
);

// attacker
// game state
export const stopGame = createEvent();
const stopGameInternal = createEvent<string>();
export const startGameFx = abort({
  handler: (params: string, { onAbort }) => {
    const game = new Promise((r) => {
      onAbort(() => {
        setTimeout(() => r(params), 0);
      });
    });

    return game;
  },
  getKey: (id: string) => id,
  signal: stopGameInternal,
});
const $gameId = restore(
  startGameFx.map((v) => v),
  null
);
sample({
  source: $gameId,
  clock: stopGame,
  target: stopGameInternal,
});

split({
  source: $currentMove,
  match: $currentMove,
  cases: {
    a: teamAMoveFx.prepend(() => {}),
    b: teamBMoveFx.prepend(() => {}),
  },
});

split({
  source: teamAMoveFx.doneData,
  match: {
    move: (act) => Boolean(act && act.type === "move"),
    rotate: (act) => Boolean(act && act.type === "rotate"),
    shoot: (act) => Boolean(act && act.type === "shoot"),
  },
  cases: {
    move: teamAApi.move.prepend<{ id: Id } & Move>(({ id, dir }) => [id, dir]),
    rotate: teamAApi.rotate.prepend<{ id: Id } & Rotate>(({ id, dir }) => [
      id,
      dir,
    ]),
    shoot: teamAApi.shoot.prepend<{ id: Id }>(({ id }) => id),
  },
});

split({
  source: teamBMoveFx.doneData,
  match: {
    move: (act) => Boolean(act && act.type === "move"),
    rotate: (act) => Boolean(act && act.type === "rotate"),
    shoot: (act) => Boolean(act && act.type === "shoot"),
  },
  cases: {
    move: teamBApi.move.prepend<{ id: Id } & Move>(({ id, dir }) => [id, dir]),
    rotate: teamBApi.rotate.prepend<{ id: Id } & Rotate>(({ id, dir }) => [
      id,
      dir,
    ]),
    shoot: teamBApi.shoot.prepend<{ id: Id }>(({ id }) => id),
  },
});

// game events
type BotTeam = Bot & { team: string };
// shooting
const shotFired = sample({
  source: { aMeta: $teamAMeta, bMeta: $teamBMeta, a: $teamA, b: $teamB },
  clock: [
    teamAApi.shoot.map((id) => ({ team: "a", id })),
    teamBApi.shoot.map((id) => ({ team: "b", id })),
  ],
  fn: (teams, shot) => {
    const shooter = teams[shot.team as "a" | "b"][shot.id];
    const listA: BotTeam[] = teams.aMeta.map((bot) => ({ ...bot, team: "a" }));
    const listB: BotTeam[] = teams.bMeta.map((bot) => ({ ...bot, team: "b" }));
    const list: BotTeam[] = [...listA, ...listB];
    let target: BotTeam | null = null;
    let range = RANGE + 1;

    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      if (current.id === shooter.id) continue;
      const gun = inGunRange(
        shooter.position,
        shooter.viewDir,
        current.position
      );
      if (gun.inRange && gun.range < range) {
        target = current;
      }
    }

    return target ? { target, dir: shooter.viewDir, by: shooter } : null;
  },
});
const shotHit = guard({
  clock: shotFired,
  filter: Boolean,
});

// hand damage
const handFired = sample({
  source: { aMeta: $teamAMeta, bMeta: $teamBMeta, a: $teamA, b: $teamB },
  clock: [
    teamAApi.move.map((m) => ({ id: m[0], dir: m[1], team: "a" })),
    teamBApi.move.map((m) => ({ id: m[0], dir: m[1], team: "b" })),
  ],
  fn: (teams, move) => {
    const mover = teams[move.team as "a" | "b"][move.id];
    const listA: BotTeam[] = teams.aMeta.map((bot) => ({ ...bot, team: "a" }));
    const listB: BotTeam[] = teams.bMeta.map((bot) => ({ ...bot, team: "b" }));
    const list: BotTeam[] = [...listA, ...listB];
    let target: BotTeam | null = null;

    for (let i = 0; i < list.length; i++) {
      const current = list[i];
      if (current.id === mover.id) continue;
      if (isPosEqual(mover.position, current.position)) {
        target = current;
        break;
      }
    }

    return target ? { target, dir: mover.viewDir, by: mover } : null;
  },
});

const handHit = guard({
  clock: handFired,
  filter: Boolean,
});

const attacked = merge([handHit, shotHit]);

split({
  source: attacked,
  match: {
    a: (hit) => hit.target.team === "a",
    b: (hit) => hit.target.team === "b",
  },
  cases: {
    a: [
      teamAApi.damage.prepend<EventPayload<typeof attacked>>((attack) => [
        attack.target.id,
        25,
      ]),
      teamAApi.move.prepend<EventPayload<typeof attacked>>((attack) => [
        attack.target.id,
        attack.dir,
      ]),
    ],
    b: [
      teamBApi.damage.prepend<EventPayload<typeof attacked>>((attack) => [
        attack.target.id,
        25,
      ]),
      teamBApi.move.prepend<EventPayload<typeof attacked>>((attack) => [
        attack.target.id,
        attack.dir,
      ]),
    ],
  },
});

// out of map
const fellOut = guard({
  clock: sample({
    source: { size: $gameSize, a: $teamA, b: $teamB },
    clock: [
      teamAApi.move.map((m) => ({ id: m[0], dir: m[1], team: "a" })),
      teamBApi.move.map((m) => ({ id: m[0], dir: m[1], team: "b" })),
    ],
    fn: (data, move) => {
      const mover = data[move.team as "a" | "b"][move.id];

      return {
        fallen: isOutOfBounds(mover.position, data.size),
        mover,
        team: move.team,
      };
    },
  }),
  filter: (outMove) => outMove.fallen,
});

split({
  source: fellOut,
  match: {
    a: (outMove) => outMove.team === "a",
    b: (outMove) => outMove.team === "b",
  },
  cases: {
    a: teamAApi.damage.prepend<EventPayload<typeof fellOut>>((outMove) => [
      outMove.mover.id,
      outMove.mover.health,
    ]),
    b: teamBApi.damage.prepend<EventPayload<typeof fellOut>>((outMove) => [
      outMove.mover.id,
      outMove.mover.health,
    ]),
  },
});

const botDamaged = sample({
  source: { a: $teamA, b: $teamB },
  clock: [
    teamAApi.damage.map((d) => ({ id: d[0], team: "a" })),
    teamBApi.damage.map((d) => ({ id: d[0], team: "b" })),
  ],
  fn: (teams, damage) => {
    const damaged = teams[damage.team as "a" | "b"][damage.id];

    return {
      isDead: damaged.health === 0,
      damaged,
      team: damage.team,
    };
  },
});

const botDead = guard({
  clock: botDamaged,
  filter: (d) => d.isDead,
});

// results
const teamADead = guard({
  clock: $teamA,
  filter: (kv) => {
    const list = Object.values(kv);

    return list.every((a) => a.health === 0);
  },
});

const teamBDead = guard({
  clock: $teamB,
  filter: (kv) => {
    const list = Object.values(kv);

    return list.every((a) => a.health === 0);
  },
});

const $interval = createStore(1, { sid: "tick-interval" });

const int = interval({
  timeout: $interval,
  start: startGameFx.map(() => {}),
  stop: stopGame,
});

sample({
  clock: int.tick,
  target: tick,
});

const $iteration = createStore(0).on(tick, (s) => s + 1);
const $maxSteps = createStore(200);

const maxStepsHit = guard({
  source: [$iteration, $maxSteps],
  filter: ([it, max]) => it === max,
});

// moves log
const $log = createStore([]).on(
  [
    teamAMoveFx.doneData.map((act) => ({ ...act, team: "a" })),
    teamBMoveFx.doneData.map((act) => ({ ...act, team: "b" })),
  ],
  (log, action) => {
    return [...log, action];
  }
);

// human log
const gameEvent = sample({
  greedy: true,
  source: [$iteration, $teamAMeta, $teamBMeta],
  clock: [
    teamAMoveFx.doneData.map(
      (act) => `${act.id} from team A decided to ${act.type}${act.dir ? ` in "${act.dir}" direction` : ""}`
    ),
    teamBMoveFx.doneData.map(
      (act) => `${act.id} from team B decided to ${act.type}${act.dir ? ` in "${act.dir}" direction` : ""}`
    ),
    maxStepsHit.map(() => "Game over by steps"),
    teamADead.map(() => "Team B won!"),
    teamBDead.map(() => "Team A won!"),
    fellOut.map((out) => `${out.mover.id} fallen from the edge`),
    handHit.map((hit) => `${hit.target.id} was hit by hand of ${hit.by.id}`),
    shotHit.map((hit) => `${hit.target.id} was shot by ${hit.by.id}`),
    botDead.map((d) => `${d.damaged.id} from team ${d.team.toUpperCase()} is no more`),
  ],
  fn: ([tick, A, B], message) => ({ message, tick, A, B }),
});

gameEvent.watch(console.log);

sample({
  clock: [teamADead, teamBDead, maxStepsHit],
  target: stopGame,
});

export const GameModel = {
  $gameSize,
  startGameFx,
  stopGame,
  tick,
  $teamA,
  $teamB,
  teamAMoveFx,
  teamBMoveFx,
  $maxSteps,
  $interval,
};

export const ViewModel = {
  $gameSize,
  startGameFx,
  stopGame,
  tick,
  $teamA: $teamA.map(kv => {
    const next: typeof kv = {};

    Object.entries(kv).forEach(([id, bot]) => {
      if (bot.health > 0) {
        next[id] = bot;
      }
    })

    return kv;
  }),
  $teamB: $teamB.map(kv => {
    const next: typeof kv = {};

    Object.entries(kv).forEach(([id, bot]) => {
      if (bot.health > 0) {
        next[id] = bot;
      }
    })

    return kv;
  }),
  teamAMoveFx,
  teamBMoveFx,
  $maxSteps,
  $interval,
};
