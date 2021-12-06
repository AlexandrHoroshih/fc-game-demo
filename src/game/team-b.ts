import type { GameState, Action } from "./model/types";

const teamB = (game: GameState): Action => {
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

  return {
    type: "move",
    dir: closestDir,
    id: current.id,
  };
};

export default teamB;
