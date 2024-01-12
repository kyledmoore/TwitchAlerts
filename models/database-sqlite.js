//sqlite adaptation of database.js
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

class Database {
    constructor(filePath) {
        this.dbPromise = open({
            filename: filePath.replace('file://', ''),
            driver: sqlite3.Database
        });

        this.debug = process.env.NODE_ENV !== "production";
    }

    async run(sql, params = []) {
        const db = await this.dbPromise;
        return db.run(sql, params);
    }

    async all(sql, params = []) {
        const db = await this.dbPromise;
        return db.all(sql, params);
    }

    async get(sql, params = []) {
        const db = await this.dbPromise;
        return db.get(sql, params);
    }

    async passFetchLive(fetchlive) {
        this.fetchlive = fetchlive;
    }

    async addNewGuild(guild_id) {
        if (this.debug) return;
        return await this.run("INSERT OR IGNORE INTO guilds(guild_id) VALUES (?)", [guild_id]);
    }

    async setGuildLanguage(guild_id, language) {
        if (this.debug) return;
        await this.addNewGuild(guild_id);
        return await this.run("UPDATE guilds SET guild_language = ? WHERE guild_id = ?", [language, guild_id]);
    }

    async deleteGuild(guild_id) {
        if (this.debug) return;
        const alerts = await this.listAlertsByGuild(guild_id);
        for (const alert of alerts) {
            await this.deleteAlert(guild_id, alert.streamer_id);
        }
        return await this.run("DELETE FROM guilds WHERE guild_id = ?", [guild_id]);
    }

    async listAllAlerts() {
        if (this.debug) return;
        return await this.all("SELECT * FROM streamers JOIN alerts USING(streamer_id) JOIN guilds USING(guild_id)");
    }

    async listAlertsByGuild(guild_id) {
        if (this.debug) return;
        return (await this.all("SELECT * FROM streamers JOIN alerts USING(streamer_id) JOIN guilds USING(guild_id) WHERE guild_id=?", [guild_id]));
    }
    async countAlertsByGuild(guild_id) {
        if (this.debug) return;
        return (await this.get("SELECT COUNT(streamer_id) AS count FROM alerts WHERE guild_id=?", [guild_id])).count;
    }

    async listAlertsByStreamer(streamer) {
        if (this.debug) return;
        return (await this.all("SELECT * FROM streamers JOIN alerts USING(streamer_id) JOIN guilds USING(guild_id) WHERE streamer_id=?", [streamer]));
    }

    async addStreamer(streamer) {
        return await this.run("INSERT OR IGNORE INTO streamers(streamer_id) VALUES (?)", [streamer]);
    }

    async removeStreamerIfEmpty(streamer) {
        const q = await this.listAlertsByStreamer(streamer);
        if (q.length === 0) await this.run("DELETE FROM streamers WHERE streamer_id=?", [streamer]);
    }

    async addAlert(guild_id, streamer, channel, start, end, display_game, display_viewers) {
        if (this.debug) return;
        await this.addNewGuild(guild_id);
        await this.addStreamer(streamer);
        await this.run("INSERT INTO alerts(guild_id, streamer_id, alert_channel, alert_start, alert_end, alert_pref_display_game, alert_pref_display_viewers) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [guild_id, streamer, channel, start, end, display_game, display_viewers]);
        this.fetchlive.streamerAdded(streamer);
    }
    async editAlert(guild_id, oldStreamer, newStreamer, start, end, display_game, display_viewers) {
        if (this.debug) return;
        if (oldStreamer !== newStreamer) await this.addStreamer(newStreamer);
        await this.run("UPDATE alerts SET alert_start=?, alert_end=?, streamer_id=?, alert_pref_display_game=?, alert_pref_display_viewers=? WHERE streamer_id=? AND guild_id=?",
            [start, end, newStreamer, display_game, display_viewers, oldStreamer, guild_id]);
        if (oldStreamer !== newStreamer) {
            await this.removeStreamerIfEmpty(oldStreamer);
            await this.fetchlive.streamerRemoved(oldStreamer);
            this.fetchlive.streamerAdded(newStreamer);
        }
    }
    async moveAlert(guild_id, streamer, channel) {
        if (this.debug) return;
        return await this.run("UPDATE alerts SET alert_channel=?, WHERE streamer_id=? AND guild_id=?",
            [channel, streamer, guild_id]);
    }
    async deleteAlert(guild_id, streamer) {
        if (this.debug) return;
        await this.run("DELETE FROM alerts WHERE guild_id=? AND streamer_id=?", [guild_id, streamer]);
        await this.removeStreamerIfEmpty(streamer);
        await this.fetchlive.streamerRemoved(streamer);
    }
    async streamOnline(streamer) {
        if (this.debug) return;
        return await this.run("UPDATE streamers SET streamer_live=true WHERE streamer_id=?", [streamer]);
    }
    async streamOffline(streamer) {
        if (this.debug) return;
        return await this.run("UPDATE streamers SET streamer_live=false WHERE streamer_id=?", [streamer]);
    }
    async setAlertMessage(guild_id, streamer, message) {
        if (this.debug) return;
        return await this.run("UPDATE alerts SET alert_message=? WHERE streamer_id=? AND guild_id=?",
            [message, streamer, guild_id]);
    }
    async removeAlertMessage(guild_id, streamer) {
        if (this.debug) return;
        return await this.run("UPDATE alerts SET alert_message=NULL WHERE streamer_id=? AND guild_id=?",
            [streamer, guild_id]);
    }

    async getAlert(guild_id, streamer) {
        if (this.debug) return;
        return (await this.all("SELECT * FROM streamers JOIN alerts USING(streamer_id) JOIN guilds USING(guild_id) WHERE guild_id=? AND streamer_id=?", [guild_id, streamer]));
    }
}

module.exports = Database;
