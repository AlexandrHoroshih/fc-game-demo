import type { GameState, Action, Bot, Position, Dir } from "./model/types";

const teamA = (game: GameState): Action => {
  game.stash.last =
    typeof game.stash.last !== "undefined" ? game.stash.last : 0;
  const next = game.stash.last + 1;
  game.stash.last = next < game.myBots.length ? next : 0;
  const current = game.myBots[game.stash.last];

  const closest = game.lib.findClosest(current, game.enemyBots);
  const closestDir = game.lib.getDir(current, closest);

  if (closestDir === current.viewDir && game.lib.inGunRange(current, closest)) {
    return {
      type: "shoot",
      id: current.id,
    };
  }

  // defence move example
  if (game.lib.inGunRange(closest, current)) {
    return {
      type: "move",
      dir: game.lib.getRot(closestDir, 1),
      id: current.id,
    };
  }

  const distance = game.lib.getDistance(current, closest);
  const far = distance > 4;
  const canHit = distance < 3

  return {
    type: "move",
    dir: (canHit || far) ? closestDir : game.lib.getRot(closestDir, 1),
    id: current.id,
  };
};

export default teamA;
