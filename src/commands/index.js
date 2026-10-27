/**
 * Registre centralisé des commandes slash du bot.
 */
import * as pingCommand from "./ping.js";
import * as helpCommand from "./help.js";
import * as setchannelCommand from "./setchannel.js";
import * as unsetchannelCommand from "./unsetchannel.js";
import * as statusCommand from "./status.js";
import * as testdmCommand from "./testdm.js";
import * as sendCommand from "./send.js";
import * as anonymeCommand from "./anonyme.js";
import * as annonimeCommand from "./annonime.js";
import * as uptimeCommand from "./uptime.js";

export const commands = [
  pingCommand,
  helpCommand,
  setchannelCommand,
  unsetchannelCommand,
  statusCommand,
  testdmCommand,
  sendCommand,
  anonymeCommand,
  annonimeCommand,
  uptimeCommand
];

/**
 * Crée une Map indexée par le nom de commande pour un accès O(1) lors des interactions.
 * @returns {Map<string, any>}
 */
export function getCommandsMap() {
  const map = new Map();
  for (const cmd of commands) {
    if (cmd.data && cmd.data.name) {
      map.set(cmd.data.name, cmd);
    }
  }
  return map;
}
