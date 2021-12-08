import type { GameState, Action, Bot, Position, Dir } from "./model/types";

const teamA = (game: GameState): Action => {
  // rules are the same as for react hooks, order must not change
  const [last, setLast] = game.useStash(0);
  const next = (last + 1) < game.myBots.length ? last + 1 : 0;
  setLast(next)
  const current = game.myBots[last];


  for (let i = 0; i < game.myBots.length; i++) {
    const my = game.myBots[i];
    const target = game.lib.findClosest(my, game.enemyBots);
    const dir = game.lib.getDir(my, target);
    if (my.viewDir === dir && game.lib.inGunRange(my, target)) {
      return {
        type: "shoot",
        id: my.id
      }
    }

    const d = game.lib.getDistance(my, target);
    if (d < 3) {
      return {
        type: "move",
        id: my.id,
        dir,
      }
    }
  }

  const closest = game.lib.findClosest(current, game.enemyBots);
  const closestDir = game.lib.getDir(current, closest);

  // defence move example
  if (game.lib.inGunRange(closest, current)) {
    return {
      type: "move",
      dir: game.lib.getRot(closestDir, -1),
      id: current.id,
    };
  }

  const distance = game.lib.getDistance(current, closest);
  const far = distance > 4;
  let nextDir = closestDir;

  if (nextDir.includes("e") && !far) {
    nextDir = game.lib.getRot(closestDir, current.position.y > 5 ? 1 : -1);
  }

  if (nextDir.includes("w") && !far) {
    nextDir = game.lib.getRot(closestDir, current.position.y > 5 ? -1 : 1);
  }

  return {
    type: "move",
    dir: nextDir,
    id: current.id,
  };
};

export default teamA;
