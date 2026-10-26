export type Mode = "mixed" | "text" | "visual";
export type Kind = "MODIFIED" | "NUMERIC" | "ADDED" | "DELETED" | "VISUAL";
export interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface Change {
    id: string;
    page: number;
    kind: Kind;
    before: string;
    after: string;
    originalBox: Box | null;
    revisedBox: Box | null;
}
export interface Page {
    number: number;
    originalWidth: number;
    originalHeight: number;
    revisedWidth: number;
    revisedHeight: number;
    originalExists: boolean;
    revisedExists: boolean;
}
export interface Result {
    pages: Page[];
    changes: Change[];
    warnings: string[];
}
export interface Job {
    id: string;
    status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
    originalName: string;
    revisedName: string;
    originalSize: number;
    revisedSize: number;
    mode: Mode;
    createdAt: string;
    progress: number;
    pageCount: number;
    changeCount: number;
    error: string | null;
    result?: Result;
}
export const kindLabels: Record<Kind, string> = {
    MODIFIED: "変更",
    NUMERIC: "数値変更",
    ADDED: "追加",
    DELETED: "削除",
    VISUAL: "外観",
};
export const modeLabels: Record<Mode, string> = {
    mixed: "テキスト＋外観",
    text: "テキストのみ",
    visual: "外観のみ",
};
export const statusLabels = {
    QUEUED: "待機中",
    PROCESSING: "比較中",
    COMPLETED: "完了",
    FAILED: "エラー",
};
