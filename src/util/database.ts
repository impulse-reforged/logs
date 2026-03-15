import mysql from "mysql2";
import SteamID from "steamid";
import { LogEntry } from "logs";
import { Query } from "express-serve-static-core";
import * as config from "./secrets";

type LogSource = "helix" | "impulse";
type QueryValue = string | number | null;

abstract class BaseDatabase {
    private readonly _adminQuery: string;
    private readonly _target: string;
    private readonly _adminMod: string;
    protected logSource: LogSource = "helix";
    protected logTable = "ix_logs";

    abstract getRank(steamid: string): Promise<string | undefined>;
    abstract getLogs(query: Query): Promise<LogEntry[]>;
    abstract getLogById(id: number): Promise<LogEntry | null>;
    abstract getLogsByTimeRange(startTime: number, endTime: number): Promise<LogEntry[]>;
    abstract getTicketStatistics(startDate: string, endDate: string): Promise<any[]>;

    protected constructor() {
        let target = "usergroup";
        let table = "WUMALookup";
        let identifier = "steamid";
        const adminMod = (config.ADMIN_MOD || "ulx").toLowerCase();

        switch (adminMod) {
            case "serverguard":
                target = "rank";
                table = "serverguard_users";
                identifier = "steam_id";
                break;

            case "sam":
                target = "rank";
                table = "sam_players";
                identifier = "steamid";
                break;

            case "impulse":
                target = "usergroup";
                table = "impulse_players";
                identifier = "steamid";
                break;

            case "ulx":
            default:
                break;
        }

        this._adminQuery = `SELECT ${target} FROM ${table} WHERE ${identifier} = ?;`;
        this._target = target;
        this._adminMod = adminMod;
    }

    public get adminQuery(): string {
        return this._adminQuery;
    }

    public get target(): string {
        return this._target;
    }

    public get adminMod(): string {
        return this._adminMod;
    }

    protected setLogSource(source: LogSource, table: string): void {
        this.logSource = source;
        this.logTable = table;
    }

    protected escapedTable(): string {
        return `\`${this.logTable}\``;
    }

    protected getTimeColumn(): string {
        return this.logSource === "impulse" ? "ts" : "datetime";
    }

    protected getBaseLogQuery(): string {
        if (this.logSource === "impulse") {
            return [
                "SELECT",
                "id,",
                "NULLIF(actor_steamid64, '') AS steamid,",
                "NULL AS char_id,",
                "category AS log_type,",
                "NULL AS pos_x,",
                "NULL AS pos_y,",
                "NULL AS pos_z,",
                "NULL AS map,",
                "ts AS datetime,",
                "text,",
                "NULLIF(actor_name, '') AS lookup1,",
                "NULLIF(target_name, '') AS lookup2,",
                "NULLIF(action, '') AS lookup3,",
                "category,",
                "action,",
                "NULLIF(target_steamid64, '') AS target_steamid64,",
                "details",
                `FROM ${this.escapedTable()}`
            ].join(" ");
        }

        return `SELECT * FROM ${this.escapedTable()}`;
    }

    protected mapFilterKey(key: string): string | null {
        if (this.logSource === "impulse") {
            switch (key) {
                case "log_type":
                case "category":
                    return "category";
                case "lookup1":
                    return "actor_name";
                case "lookup2":
                    return "target_name";
                case "lookup3":
                case "action":
                    return "action";
                default:
                    return null;
            }
        }

        switch (key) {
            case "log_type":
            case "char_id":
            case "lookup1":
            case "lookup2":
            case "lookup3":
                return key;
            default:
                return null;
        }
    }

    protected appendWhere(whereClause: string, clause: string): string {
        return `${whereClause}${whereClause.length > 0 ? " AND " : " WHERE "}${clause}`;
    }

    public userID(input: string): string {
        try {
            const trimmedInput = input.trim();
            const steam = new SteamID(trimmedInput);

            switch (this.adminMod) {
                case "impulse":
                    return steam.getSteamID64();

                case "serverguard":
                case "sam":
                case "ulx":
                default:
                    return steam.getSteam2RenderedID();
            }
        } catch (error) {
            console.error(`Invalid SteamID provided: ${input}. Error: ${error}`);
            throw error;
        }
    }

    public buildQuery(args: Query): { query: string; values: QueryValue[] } {
        let logQuery = this.getBaseLogQuery();
        let whereClause = "";
        let limitClause = "";
        const values: QueryValue[] = [];

        for (const key in args) {
            let value: any = args[key];

            if (typeof value === "string") {
                value = value.trim();
            }

            if (value === "") {
                continue;
            }

            switch (key) {
                case "text":
                    whereClause = this.appendWhere(whereClause, "text LIKE ?");
                    values.push(`%${value}%`);
                    break;

                case "steamid":
                    if (!value) {
                        break;
                    }

                    const sanitisedSteamID = String(value).replace(/["']/g, "");
                    let resolvedSteamID = sanitisedSteamID;

                    try {
                        const steam = new SteamID(sanitisedSteamID);
                        if (steam.isValid()) {
                            resolvedSteamID = steam.getSteamID64();
                        }
                    } catch (_err) {
                        // use the raw value as-is
                    }

                    if (this.logSource === "impulse") {
                        whereClause = this.appendWhere(whereClause, "(actor_steamid64 LIKE ? OR target_steamid64 LIKE ?)");
                        values.push(resolvedSteamID, resolvedSteamID);
                    } else {
                        whereClause = this.appendWhere(whereClause, "steamid LIKE ?");
                        values.push(resolvedSteamID);
                    }
                    break;

                case "before": {
                    const beforeDate = String(value).replace(/'/g, "");
                    const unixDateBefore = new Date(beforeDate).getTime() / 1000;
                    if (!isNaN(unixDateBefore)) {
                        whereClause = this.appendWhere(whereClause, `${this.getTimeColumn()} < ?`);
                        values.push(unixDateBefore);
                    }
                    break;
                }

                case "after": {
                    const afterDate = String(value).replace(/'/g, "");
                    const unixDateAfter = new Date(afterDate).getTime() / 1000;
                    if (!isNaN(unixDateAfter)) {
                        whereClause = this.appendWhere(whereClause, `${this.getTimeColumn()} > ?`);
                        values.push(unixDateAfter);
                    }
                    break;
                }

                case "limit": {
                    const parsedLimit = parseInt(String(value), 10);
                    limitClause = " LIMIT ?";
                    values.push(isNaN(parsedLimit) ? 5000 : parsedLimit);
                    break;
                }

                default: {
                    const column = this.mapFilterKey(key);
                    if (column) {
                        whereClause = this.appendWhere(whereClause, `${column} = ?`);
                        values.push(value);
                    }
                    break;
                }
            }
        }

        logQuery += whereClause;
        logQuery += ` ORDER BY ${this.getTimeColumn()} DESC, id DESC`;
        logQuery += limitClause.length > 0 ? limitClause : " LIMIT 5000";
        logQuery += ";";

        return { query: logQuery, values };
    }
}

export class MySqlDatabase extends BaseDatabase {
    private pool!: mysql.Pool;
    private samPool!: mysql.Pool;
    private setupPromise?: Promise<void>;

    constructor() {
        super();
        this.setupPromise = this.setup();
        this.setupPromise.catch((error) => {
            console.error("Error setting up connection pool: ", error);
        });
    }

    private createPool(databaseName?: string): mysql.Pool {
        return mysql.createPool({
            user: config.MYSQL_USER,
            password: config.MYSQL_PASS,
            host: config.MYSQL_HOST,
            port: parseInt(config.MYSQL_PORT || "3306", 10),
            database: databaseName || config.MYSQL_DB
        });
    }

    private async ensureReady(): Promise<void> {
        this.setupPromise = this.setupPromise || this.setup();
        await this.setupPromise;
    }

    private async setup(): Promise<void> {
        this.pool = this.createPool(config.MYSQL_DB);
        this.samPool = this.createPool(config.MYSQL_SAM_DB || config.MYSQL_DB);
        await this.detectLogSource();
    }

    private async reconnect(): Promise<void> {
        try {
            await this.pool.end();
        } catch (_err) {
            // ignore
        }

        try {
            if (this.samPool) {
                await this.samPool.end();
            }
        } catch (_err) {
            // ignore
        }

        this.setupPromise = this.setup();
        await this.setupPromise;
    }

    private async withPrimaryConnection<T>(callback: (promisePool: any) => Promise<T>): Promise<T> {
        await this.ensureReady();

        try {
            return await callback(this.pool.promise());
        } catch (err) {
            console.error("Error executing query, reconnecting primary pool", err);
            await this.reconnect();
            return callback(this.pool.promise());
        }
    }

    private async withSamConnection<T>(callback: (promisePool: any) => Promise<T>): Promise<T> {
        await this.ensureReady();

        try {
            return await callback(this.samPool.promise());
        } catch (err) {
            console.error("Error executing query, reconnecting SAM/admin pool", err);
            await this.reconnect();
            return callback(this.samPool.promise());
        }
    }

    private async tableExists(tableName: string): Promise<boolean> {
        const promisePool = this.pool.promise();
        const [rows] = await promisePool.query(
            "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1",
            [config.MYSQL_DB, tableName]
        );

        return Array.isArray(rows) && rows.length > 0;
    }

    private async detectLogSource(): Promise<void> {
        const configuredSource = (config.LOG_FRAMEWORK || "auto").toLowerCase();
        const impulseCandidates = Array.from(new Set([
            config.IMPULSE_LOG_TABLE,
            "impulse_logs",
            "impulse_ops_logs"
        ].filter(Boolean))) as string[];

        if (configuredSource === "helix") {
            this.setLogSource("helix", "ix_logs");
            return;
        }

        for (const tableName of impulseCandidates) {
            if (await this.tableExists(tableName)) {
                this.setLogSource("impulse", tableName);
                return;
            }
        }

        if (configuredSource === "impulse") {
            this.setLogSource("impulse", impulseCandidates[0] || "impulse_logs");
            return;
        }

        this.setLogSource("helix", "ix_logs");
    }

    public async getRank(steamid: string): Promise<string | undefined> {
        const trimmedSteamId = steamid.trim();
        const rankQuery = async (promisePool: any): Promise<string | undefined> => {
            const [rows] = await promisePool.query(this.adminQuery, [this.userID(trimmedSteamId)]);
            const firstRow = Array.isArray(rows) ? rows[0] : undefined;

            return firstRow ? firstRow[this.target] : undefined;
        };

        if (this.adminMod === "impulse") {
            return this.withPrimaryConnection(rankQuery);
        }

        return this.withSamConnection(rankQuery);
    }

    public async getLogs(args: Query): Promise<LogEntry[]> {
        return this.withPrimaryConnection(async (promisePool) => {
            const { query, values } = this.buildQuery(args);
            const [rows] = await promisePool.query(query, values);

            return rows as LogEntry[];
        });
    }

    public async getLogById(id: number): Promise<LogEntry | null> {
        try {
            return await this.withPrimaryConnection(async (promisePool) => {
                const [rows] = await promisePool.query(`${this.getBaseLogQuery()} WHERE id = ? LIMIT 1`, [id]);
                const logEntries = rows as LogEntry[];

                return logEntries.length > 0 ? logEntries[0] : null;
            });
        } catch (err) {
            console.error("Error executing query", err);
            return null;
        }
    }

    public async getLogsByTimeRange(startTime: number, endTime: number): Promise<LogEntry[]> {
        try {
            return await this.withPrimaryConnection(async (promisePool) => {
                const [rows] = await promisePool.query(
                    `${this.getBaseLogQuery()} WHERE ${this.getTimeColumn()} BETWEEN ? AND ? ORDER BY ${this.getTimeColumn()} ASC, id ASC`,
                    [startTime, endTime]
                );

                return rows as LogEntry[];
            });
        } catch (err) {
            console.error("Error executing query", err);
            return [];
        }
    }

    public async getTicketStatistics(startDate: string, endDate: string): Promise<any[]> {
        try {
            return await this.withPrimaryConnection(async (promisePool) => {
                let query: string;

                if (this.logSource === "impulse") {
                    query = `
                        SELECT
                            actor_name AS steam_name,
                            actor_steamid64 AS steamid,
                            COUNT(*) AS tickets
                        FROM
                            ${this.escapedTable()}
                        WHERE
                            category = "ADMIN"
                        AND
                            action LIKE "claimed report #%"
                        AND
                            ts > UNIX_TIMESTAMP(STR_TO_DATE(?, '%M %d %Y %h:%i%p'))
                        AND
                            ts < UNIX_TIMESTAMP(STR_TO_DATE(?, '%M %d %Y %h:%i%p'))
                        GROUP BY actor_steamid64, actor_name
                        ORDER BY tickets DESC
                    `;
                } else {
                    query = `
                        SELECT
                            ix_players.steam_name,
                            ix_logs.steamid,
                            COUNT(*) AS tickets
                        FROM
                            ix_logs
                        LEFT JOIN
                            ix_players
                        ON
                            ix_players.steamid = ix_logs.steamid
                        WHERE
                            log_type = "samReportClaimed"
                        AND
                            FROM_UNIXTIME(ix_logs.datetime) > STR_TO_DATE(?, '%M %d %Y %h:%i%p')
                        AND
                            FROM_UNIXTIME(ix_logs.datetime) < STR_TO_DATE(?, '%M %d %Y %h:%i%p')
                        GROUP BY steamid
                        ORDER BY tickets DESC
                    `;
                }

                const [rows] = await promisePool.query(query, [startDate, endDate]);
                return rows as any[];
            });
        } catch (err) {
            console.error("Error executing ticket statistics query", err);
            return [];
        }
    }
}
