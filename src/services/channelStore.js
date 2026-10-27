/**
 * Service de stockage et de gestion du salon de relais actif.
 * Permet de définir dynamiquement le salon via la commande /setchannel
 * avec persistance locale dans un fichier JSON pour survivre aux redémarrages.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, isValidSnowflake } from "../config.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const CONFIG_FILE = path.join(DATA_DIR, "channel-config.json");

class ChannelStore {
  constructor() {
    this.configuredChannelId = null;
    this.updatedAt = null;
    this.updatedBy = null;
    this.init();
  }

  /**
   * Initialise le magasin en lisant la persistance ou la variable d'environnement.
   */
  init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
        const data = JSON.parse(raw);
        if (data && isValidSnowflake(data.channelId)) {
          this.configuredChannelId = data.channelId;
          this.updatedAt = data.updatedAt || null;
          this.updatedBy = data.updatedBy || null;
          logger.info(`[ChannelStore] Salon chargé depuis le stockage persistant : ${this.configuredChannelId}`);
          return;
        }
      }
    } catch (err) {
      logger.warn(`[ChannelStore] Impossible de charger le fichier de salon persistant : ${err.message}`);
    }

    // Repli sur la variable d'environnement si aucune configuration sauvegardée
    if (config.defaultChannelId && isValidSnowflake(config.defaultChannelId)) {
      this.configuredChannelId = config.defaultChannelId;
      this.updatedAt = new Date().toISOString();
      this.updatedBy = "ENVIRONMENT";
      logger.info(`[ChannelStore] Salon initialisé depuis DISCORD_CHANNEL_ID : ${this.configuredChannelId}`);
    } else {
      logger.info("[ChannelStore] Aucun salon configuré initialement. En attente de configuration via /setchannel ou .env");
    }
  }

  /**
   * Récupère l'identifiant du salon actuellement configuré.
   * @returns {string|null}
   */
  getChannelId() {
    return this.configuredChannelId;
  }

  /**
   * Vérifie si un salon valide est configuré.
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.configuredChannelId && isValidSnowflake(this.configuredChannelId));
  }

  /**
   * Modifie le salon configuré et sauvegarde la configuration.
   * @param {string} channelId
   * @param {string} [userId="UNKNOWN"]
   * @returns {boolean}
   */
  setChannelId(channelId, userId = "UNKNOWN") {
    if (!isValidSnowflake(channelId)) {
      throw new Error(`Identifiant de salon invalide : '${channelId}'`);
    }

    this.configuredChannelId = channelId;
    this.updatedAt = new Date().toISOString();
    this.updatedBy = userId;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const payload = {
        channelId: this.configuredChannelId,
        updatedAt: this.updatedAt,
        updatedBy: this.updatedBy
      };
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(payload, null, 2), "utf-8");
      logger.info(`[ChannelStore] Salon mis à jour : ${channelId} par ${userId}`);
      return true;
    } catch (err) {
      logger.error(`[ChannelStore] Erreur lors de la sauvegarde du salon dans ${CONFIG_FILE} : ${err.message}`);
      // La valeur reste en mémoire même si l'écriture disque échoue
      return false;
    }
  }

  /**
   * Réinitialise la configuration vers le salon défini dans .env
   */
  resetToDefault() {
    if (config.defaultChannelId && isValidSnowflake(config.defaultChannelId)) {
      return this.setChannelId(config.defaultChannelId, "SYSTEM_RESET");
    }
    this.configuredChannelId = null;
    this.updatedAt = null;
    this.updatedBy = null;
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        fs.unlinkSync(CONFIG_FILE);
      }
    } catch (err) {
      logger.warn(`[ChannelStore] Impossible de supprimer le fichier de configuration : ${err.message}`);
    }
    return true;
  }

  /**
   * Retourne les métadonnées sur le salon configuré.
   */
  getMetadata() {
    return {
      channelId: this.configuredChannelId,
      isConfigured: this.isConfigured(),
      updatedAt: this.updatedAt,
      updatedBy: this.updatedBy
    };
  }
}

export const channelStore = new ChannelStore();
