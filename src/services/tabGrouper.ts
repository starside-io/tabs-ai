import { Tab, TabData, AIResponse } from '../types'; 
import { analyzeTabs } from './aiService';
import { StorageService } from './storageService';

// Browser compatibility layer
const browserAPI = (typeof chrome !== 'undefined') ? chrome : (window as any).browser;

export class TabGrouper {
    private tabGroups: Map<string, Tab[]>;
    private logCallback: ((message: string, isError?: boolean) => void) | null = null;
    private storageService: StorageService;

    constructor() {
        this.tabGroups = new Map();
        this.storageService = new StorageService();
    }

    setLogCallback(callback: (message: string, isError?: boolean) => void) {
        this.logCallback = callback;
    }

    private log(message: string, isError: boolean = false) {
        console.log(message);
        if (this.logCallback) {
            this.logCallback(message, isError);
        }
    }

    public async groupTabs(tabs: Tab[]): Promise<void> {
        const analysisResults = await analyzeTabs(tabs);
        this.createGroups(analysisResults);
    }

    public async groupTabsBySubject(subjects: string[]): Promise<Map<string, Tab[]>> {
        // For now, return the current groups - this would need to be implemented based on subjects
        return this.tabGroups;
    }

    public getGroupedTabs(): Map<string, Tab[]> {
        return this.tabGroups;
    }

    public async createTabGroups(groupedTabs: Map<string, TabData[]>): Promise<void> {
        this.tabGroups.clear();
        
        try {
            // Validate input
            if (!groupedTabs || !(groupedTabs instanceof Map)) {
                this.log('Invalid groupedTabs parameter', true);
                return;
            }
            
            this.log('=== CREATING TAB GROUPS ===');
            this.log(`Creating tab groups with: ${groupedTabs.size} groups`);
            
            // Convert TabData[] to Tab[] for internal storage
            for (const [groupName, tabs] of groupedTabs) {
                if (!groupName || !Array.isArray(tabs)) {
                    this.log(`Invalid group data: ${groupName}`, true);
                    continue;
                }
                this.tabGroups.set(groupName, tabs);
            }

            // Create actual browser tab groups if the browser supports it
            if (browserAPI && browserAPI.tabs && browserAPI.tabs.group) {
                this.log('Browser supports tab groups, proceeding with grouping...');
                
                // Use Firefox-compatible tab query
                let allTabs;
                if (typeof (window as any).browser !== 'undefined' && (window as any).browser.tabs) {
                    allTabs = await (window as any).browser.tabs.query({ currentWindow: true });
                } else {
                    allTabs = await browserAPI.tabs.query({ currentWindow: true });
                }
                
                this.log(`Found ${allTabs.length} tabs in current window for grouping`);
                
                // Step 1: Ungroup all tabs first
                this.log('=== STEP 1: UNGROUPING EXISTING TABS ===');
                await this.ungroupAllTabs(allTabs);
                this.log('=== UNGROUPING COMPLETED ===');
                
                // Add a small delay to ensure ungrouping is complete
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Step 2: Create new tab groups
                this.log('=== STEP 2: CREATING NEW TAB GROUPS ===');
                let groupIndex = 0;
                for (const [groupName, tabs] of groupedTabs) {
                    if (!groupName || !Array.isArray(tabs)) {
                        this.log(`Skipping invalid group: ${groupName}`, true);
                        continue;
                    }
                    
                    const tabIds = tabs
                        .map(tab => tab && tab.id)
                        .filter(id => id !== undefined && id !== null && typeof id === 'number');
                    
                    this.log(`Creating group ${++groupIndex}: "${groupName}" with ${tabIds.length} tabs`);
                    
                    if (tabIds.length > 0) {
                        try {
                            // Create a new tab group
                            const groupId = await browserAPI.tabs.group({ tabIds });
                            this.log(`✓ Created group "${groupName}" with ID: ${groupId}`);
                            
                            // Update the group with a title and color
                            if (browserAPI.tabGroups && browserAPI.tabGroups.update) {
                                await browserAPI.tabGroups.update(groupId, {
                                    title: groupName,
                                    color: this.getGroupColor(groupName)
                                });
                                this.log(`✓ Updated group "${groupName}" with title and color`);
                            }
                        } catch (error) {
                            this.log(`✗ Failed to create tab group "${groupName}": ${error}`, true);
                        }
                    } else {
                        this.log(`⚠ No valid tab IDs found for group "${groupName}"`);
                    }
                }
                this.log('=== TAB GROUP CREATION COMPLETED ===');
            } else {
                this.log('Browser does not support tab groups - tab grouping will be visual only');
            }
            
            // Save the grouped tabs to storage for persistence
            await this.saveGroupedTabs();
        } catch (error) {
            this.log(`Error creating tab groups: ${error}`, true);
        }
    }

    private async ungroupAllTabs(allTabs: any[]): Promise<void> {
        try {
            this.log('🔄 Starting ungroupAllTabs process...');
            
            // Check if tabGroups API is available
            if (!browserAPI || !browserAPI.tabGroups) {
                this.log('⚠ Browser does not support tabGroups API - skipping ungrouping');
                return;
            }
            
            // Get all tab groups
            if (browserAPI.tabGroups.query) {
                this.log('📋 Querying existing tab groups...');
                const existingGroups = await browserAPI.tabGroups.query({});
                this.log(`📊 Found ${existingGroups.length} existing tab groups`);
                
                if (existingGroups.length === 0) {
                    this.log('✅ No existing tab groups to ungroup');
                    return;
                }
                
                // Ungroup all tabs by moving them out of their groups
                for (let i = 0; i < existingGroups.length; i++) {
                    const group = existingGroups[i];
                    try {
                        const tabsInGroup = allTabs.filter(tab => tab.groupId === group.id);
                        const tabIds = tabsInGroup.map(tab => tab.id).filter(id => id !== undefined);
                        
                        this.log(`🔓 Ungrouping ${tabIds.length} tabs from group "${group.title || 'Unnamed'}" (${i + 1}/${existingGroups.length})`);
                        
                        if (tabIds.length > 0) {
                            await browserAPI.tabs.ungroup(tabIds);
                            this.log(`✅ Successfully ungrouped ${tabIds.length} tabs from group "${group.title || 'Unnamed'}"`);
                        } else {
                            this.log(`ℹ No valid tab IDs found for group "${group.title || 'Unnamed'}"`);
                        }
                    } catch (error) {
                        this.log(`❌ Failed to ungroup tabs from group "${group.title || 'Unnamed'}": ${error}`, true);
                        // Continue with other groups even if one fails
                    }
                }
                
                this.log('🎉 Ungrouping process completed');
            } else {
                this.log('⚠ tabGroups.query is not available');
            }
        } catch (error) {
            this.log(`❌ Error in ungroupAllTabs: ${error}`, true);
            // Don't throw - we want to continue with creating new groups even if ungrouping fails
        }
    }

    private getGroupColor(groupName: string): string {
        // Simple color assignment based on group name
        const colors = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'grey'];
        const index = groupName.length % colors.length;
        return colors[index];
    }

    public async groupTab(tabId: number, subject: string): Promise<void> {
        console.log(`Grouping tab ${tabId} under subject: ${subject}`);
    }

    private createGroups(analysisResults: AIResponse[]): void {
        analysisResults.forEach((result: AIResponse) => {
            result.groups.forEach(group => {
                const groupName = group.subject;
                const tabsInGroup = group.tabs;

                if (!this.tabGroups.has(groupName)) {
                    this.tabGroups.set(groupName, []);
                }

                this.tabGroups.get(groupName)?.push(...tabsInGroup);
            });
        });
    }

    public getGroups(): Map<string, Tab[]> {
        return this.tabGroups;
    }

    public clearGroups(): void {
        this.tabGroups.clear();
    }

    public async saveGroupedTabs(): Promise<void> {
        try {
            const groupsObject: { [key: string]: Tab[] } = {};
            for (const [groupName, tabs] of this.tabGroups) {
                groupsObject[groupName] = tabs;
            }
            
            await this.storageService.saveSetting('groupedTabs', groupsObject);
            await this.storageService.saveSetting('groupedTabsTimestamp', Date.now());
            this.log('Grouped tabs saved to storage');
        } catch (error) {
            this.log(`Error saving grouped tabs: ${error}`, true);
        }
    }

    public async loadGroupedTabs(): Promise<void> {
        try {
            const settings = await this.storageService.getSettings();
            const groupedTabs = settings.groupedTabs;
            
            if (groupedTabs && typeof groupedTabs === 'object') {
                this.tabGroups.clear();
                for (const [groupName, tabs] of Object.entries(groupedTabs)) {
                    if (Array.isArray(tabs)) {
                        this.tabGroups.set(groupName, tabs);
                    }
                }
                this.log(`Loaded ${this.tabGroups.size} groups from storage`);
            }
        } catch (error) {
            this.log(`Error loading grouped tabs: ${error}`, true);
        }
    }

    public async clearSavedGroups(): Promise<void> {
        try {
            await this.storageService.saveSetting('groupedTabs', null);
            await this.storageService.saveSetting('groupedTabsTimestamp', null);
            this.log('Cleared saved groups from storage');
        } catch (error) {
            this.log(`Error clearing saved groups: ${error}`, true);
        }
    }

    public async hasExistingGroups(): Promise<boolean> {
        try {
            const settings = await this.storageService.getSettings();
            const groupedTabs = settings.groupedTabs;
            const timestamp = settings.groupedTabsTimestamp;
            
            // Check if groups exist and are not too old (less than 24 hours)
            if (groupedTabs && typeof groupedTabs === 'object' && timestamp) {
                const twentyFourHours = 24 * 60 * 60 * 1000;
                const isRecent = (Date.now() - timestamp) < twentyFourHours;
                
                if (isRecent) {
                    const groupCount = Object.keys(groupedTabs).length;
                    return groupCount > 0;
                }
            }
            
            return false;
        } catch (error) {
            this.log(`Error checking for existing groups: ${error}`, true);
            return false;
        }
    }

    public async getGroupsForDisplay(): Promise<Array<{ subject: string; tabs: Tab[] }>> {
        try {
            await this.loadGroupedTabs();
            const groups: Array<{ subject: string; tabs: Tab[] }> = [];
            
            for (const [groupName, tabs] of this.tabGroups) {
                groups.push({
                    subject: groupName,
                    tabs: tabs
                });
            }
            
            return groups;
        } catch (error) {
            this.log(`Error getting groups for display: ${error}`, true);
            return [];
        }
    }
}