export interface LogEntry {
    id: number;
    steamid: string | null;
    char_id: number | null;
    log_type: string;
    pos_x: number | null;
    pos_y: number | null;
    pos_z: number | null;
    map: string | null;
    datetime: number;
    text: string;
    lookup1: string | null;
    lookup2: string | null;
    lookup3: string | null;
    category?: string | null;
    action?: string | null;
    target_steamid64?: string | null;
    details?: string | null;
}
