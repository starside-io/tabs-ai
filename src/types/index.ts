export type TabData = {
    id: number;
    title: string;
    url: string;
    subject?: string;
};

export type Tab = TabData; // Alias for backward compatibility

export type AIResponse = {
    groups: Array<{
        subject: string;
        tabs: TabData[];
    }>;
    suggestions: string[];
};

export interface TabGrouper {
    groupTabs(tabs: TabData[]): Promise<AIResponse>;
}