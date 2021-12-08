import { GameModel, GameStateBase } from "./game";
import { inGunRange as libInGunRange } from "./lib";
import { fork, allSettled, scopeBind, serialize } from "effector";
import type { GameSize, GameState, Bot, Dir } from "./types";
import teamA from "../team-a";
import teamB from "../team-b";

const botLib: GameState["lib"] = {
  getDistance: (l: Bot, r: Bot) =>
    Math.sqrt(
      (l.position.x - r.position.x) ** 2 + (l.position.y - r.position.y) ** 2
    ),
  getDir: (me: Bot, bot: Bot): Dir => {
    let ydir = "";
    let xdir = "";

    if (bot.position.y > me.position.y) {
      ydir = "n";
    }

    if (bot.position.y < me.position.y) {
      ydir = "s";
    }

    if (bot.position.x < me.position.x) {
      xdir = "w";
    }

    if (bot.position.x > me.position.x) {
      xdir = "e";
    }

    return (ydir + xdir) as Dir;
  },
  findClosest: (current: Bot, enemies: Bot[]) => {
    let closest = enemies[0];
    if (enemies.length === 1) return closest;

    let distance = 10_000;
    for (let i = 0; i < enemies.length; i++) {
      const maybeClosest = enemies[i];
      const currentDistance = botLib.getDistance(maybeClosest, current);
      if (currentDistance < distance) {
        closest = maybeClosest;
        distance = currentDistance;
      }
    }

    return closest;
  },
  inGunRange: (me: Bot, target: Bot) => {
    return libInGunRange(me.position, me.viewDir, target.position).inRange;
  },
  getRot: (dir: Dir, angle: number): Dir => {
    const dirs = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
    const dirIndex = dirs.findIndex((d) => d === dir);
    let nextIndex = dirIndex + angle;

    while (nextIndex > dirs.length) {
      nextIndex = nextIndex - dirs.length;
     }

    if (nextIndex < 0) {
      nextIndex = dirs.length + nextIndex;
    }

    return dirs[nextIndex];
  },
};

export const createGame = (config: { size: GameSize; interval: number }) => {
  const scope = fork({
    handlers: [
      [
        GameModel.teamAMoveFx,
        (game: GameStateBase) =>
          teamA({ ...game, lib: botLib, meta: { field: config.size } }) ?? {
            type: "nothing ",
          },
      ],
      [
        GameModel.teamBMoveFx,
        (game: GameStateBase) =>
          teamB({ ...game, lib: botLib, meta: { field: config.size } }) ?? {
            type: "nothing ",
          },
      ],
    ],
    values: [
      [GameModel.$interval, config.interval],
      [GameModel.$gameSize, config.size],
      [
        GameModel.$teamA,
        {
          Abba: {
            id: "Abba",
            name: "Abba",
            position: { x: 2, y: 2 },
            health: 100,
            viewDir: "e",
          },
          Amba: {
            id: "Amba",
            name: "Amba",
            position: { x: 2, y: 4 },
            health: 100,
            viewDir: "e",
          },
          Aooba: {
            id: "Aooba",
            name: "Aooba",
            position: { x: 2, y: 8 },
            health: 100,
            viewDir: "e",
          },
        },
      ],
      [
        GameModel.$teamB,
        {
          Boba: {
            id: "Boba",
            name: "Boba",
            position: { x: 8, y: 2 },
            health: 100,
            viewDir: "w",
          },
          Boomba: {
            id: "Boomba",
            name: "Boomba",
            position: { x: 8, y: 4 },
            health: 100,
            viewDir: "w",
          },
          Bogba: {
            id: "Bogba",
            name: "Bogba",
            position: { x: 8, y: 8 },
            health: 100,
            viewDir: "w",
          },
        },
      ],
    ],
  });

  const runGame = async () => {
    await allSettled(GameModel.startGameFx, {
      scope,
      params: `${Math.random()}`,
    });
  };

  return {
    run: runGame,
    scope,
  };
};
