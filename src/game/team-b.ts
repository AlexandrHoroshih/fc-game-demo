import type { GameState, Action } from "./model/types";

const teamB = (game: GameState): Action => {
  // rules are the same as for react hooks, order must not change
  const [last, setLast] = game.useStash(0);
  const next = (last + 1) < game.myBots.length ? last + 1 : 0;
  const current = game.myBots[last];
  setLast(next)


  const closest = game.lib.findClosest(current, game.enemyBots);
  const closestDir = game.lib.getDir(current, closest);

  if (closestDir === current.viewDir && game.lib.inGunRange(current, closest)) {
    return {
      type: "shoot",
      id: current.id,
    };
  }

  return {
    type: "rotate",
    dir: closestDir,
    id: current.id,
  };
};

export default teamB;
