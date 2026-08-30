import "../style.css";
import { createGame, type GameApplication } from "../composition/create-game";

const mount = document.querySelector<HTMLElement>("#app");
if (mount === null) {
  throw new Error("Application mount #app was not found.");
}

let application: GameApplication | undefined;
let pageHidden = false;

window.addEventListener(
  "pagehide",
  () => {
    pageHidden = true;
    application?.dispose();
    application = undefined;
  },
  { once: true },
);

const created = await createGame(mount);
if (pageHidden) {
  created.dispose();
} else {
  application = created;
}
