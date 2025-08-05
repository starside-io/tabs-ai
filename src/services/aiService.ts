import { TabData, AIResponse } from '../types';
import { StorageService } from './storageService';

// Simple logging callback interface
type LogCallback = (message: string, isError?: boolean) => void;

export class AIService {
    private storageService = new StorageService();
    private apiKey: string | null = null;
    private logCallback: LogCallback | null = null;

    setLogCallback(callback: LogCallback) {
        this.logCallback = callback;
    }

    private log(message: string, isError: boolean = false) {
        console.log(message);
        if (this.logCallback) {
            this.logCallback(message, isError);
        }
    }

    private logError(message: string) {
        console.error(message);
        if (this.logCallback) {
            this.logCallback(message, true);
        }
    }

    async getApiKey(): Promise<string | null> {
        // Always fetch from storage to ensure we have the latest value
        this.apiKey = await this.storageService.get('openai_api_key');
        this.log(`Retrieved API key from storage: ${this.apiKey ? 'Key present' : 'Key missing'}`);
        
        // Validate the API key format
        if (this.apiKey && typeof this.apiKey === 'string') {
            // Check if it's a valid OpenAI API key format (starts with sk-)
            if (this.apiKey.startsWith('sk-') && this.apiKey.length > 20) {
                return this.apiKey;
            } else {
                this.log('Invalid API key format detected, clearing...');
                this.apiKey = null;
                await this.storageService.removeSetting('openai_api_key');
                return null;
            }
        }
        
        return this.apiKey;
    }

    async setApiKey(apiKey: string): Promise<void> {
        this.apiKey = apiKey;
        await this.storageService.set('openai_api_key', apiKey);
    }

    async analyzeTabs(tabs: TabData[]): Promise<AIResponse[]> {
        this.log('=== AI SERVICE: analyzeTabs STARTED ===');
        this.log(`Processing ${tabs ? tabs.length : 0} tabs`);
        
        if (!Array.isArray(tabs)) {
            this.logError('ERROR: Input tabs is not an array!');
            return this.createFallbackGrouping([]);
        }
        
        const apiKey = await this.getApiKey();
        this.log(`API key retrieved: ${apiKey ? 'Present' : 'Missing'}`);
        
        if (!apiKey) {
            this.logError('No API key found, throwing error');
            throw new Error('OpenAI API key not found. Please set your API key in the extension options.');
        }

        try {
            this.log('Preparing tab data for OpenAI...');
            
            if (!tabs || !Array.isArray(tabs)) {
                this.logError('ERROR: tabs is not valid for mapping');
                return this.createFallbackGrouping([]);
            }
            
            const mappedTabs = tabs.map((tab, index) => {
                if (!tab) {
                    this.log(`Tab ${index} is null or undefined`);
                    return { id: 0, title: 'Unknown', url: 'about:blank' };
                }
                return { id: tab.id, title: tab.title, url: tab.url };
            });
            this.log(`Mapped ${mappedTabs.length} tabs for analysis`);
            
            const requestBody = {
                model: 'gpt-3.5-turbo',
                messages: [{
                    role: 'system',
                    content: 'You are a helpful assistant that groups browser tabs by topic and purpose, NOT by website domain. Group tabs that serve similar purposes together.\n\nRules:\n1. Focus on what the user is doing, not the website\n2. Group tabs about the same topic together\n3. WhatsApp + Outlook = "Communication"\n4. GitHub + docs + tutorials = "Development"\n5. Google searches + documentation about same topic = "Research: [topic]"\n\nReturn ONLY valid JSON in this exact format:\n{"groups": [{"subject": "Communication", "tabs": [tab objects]}, {"subject": "Development", "tabs": [tab objects]}], "suggestions": ["Group by topic"]}\n\nDo not include any text before or after the JSON.'
                }, {
                    role: 'user',
                    content: `Group these tabs by PURPOSE and TOPIC (not domain). Return only valid JSON: ${JSON.stringify(mappedTabs)}`
                }],
                max_tokens: 1000
            };
            
            this.log('Sending request to OpenAI...');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            this.log(`OpenAI response status: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                this.logError(`OpenAI API error response: ${errorText}`);
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';
            this.log(`OpenAI API response received`);
            
            if (!content) {
                this.log('Empty content from OpenAI, using fallback');
                return this.createFallbackGrouping(tabs);
            }
            
            try {
                this.log('Parsing JSON response...');
                let cleanedContent = content.trim();
                
                // Try to extract JSON from the response if it's wrapped in text
                const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    cleanedContent = jsonMatch[0];
                }
                
                // Try to fix common JSON issues
                cleanedContent = cleanedContent
                    .replace(/,(\s*[}\]])/g, '$1') // Remove trailing commas
                    .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Quote unquoted keys
                    .replace(/:\s*'([^']*)'/g, ': "$1"'); // Replace single quotes with double quotes
                
                this.log('Attempting to parse cleaned JSON...');
                const groupedTabs = JSON.parse(cleanedContent);
                
                this.log('Validating and formatting response...');
                const result = this.validateAndFormatResponse(groupedTabs, tabs);
                
                return result;
            } catch (parseError) {
                this.log(`Failed to parse AI response as JSON: ${parseError}`);
                this.log(`Raw AI response: ${content.substring(0, 200)}...`);
                this.log('Using fallback grouping due to parse error');
                return this.createFallbackGrouping(tabs);
            }
        } catch (error) {
            this.logError('=== AI SERVICE ERROR ===');
            this.logError(`Error analyzing tabs: ${error}`);
            this.logError(`Error details: ${JSON.stringify({
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : 'Unknown'
            }, null, 2)}`);
            
            // Return fallback grouping instead of throwing
            this.log('Using fallback grouping due to error');
            return this.createFallbackGrouping(tabs || []);
        }
    }

    private createFallbackGrouping(tabs: TabData[]): AIResponse[] {
        this.log('=== CREATE FALLBACK GROUPING ===');
        this.log(`Processing ${tabs ? tabs.length : 0} tabs in fallback grouping`);
        
        if (!Array.isArray(tabs)) {
            this.logError('ERROR: tabs is not an array in createFallbackGrouping');
            return [{
                groups: [],
                suggestions: ['No tabs available for grouping - input was not an array']
            }];
        }
        
        if (tabs.length === 0) {
            this.log('No tabs provided to fallback grouping');
            return [{
                groups: [],
                suggestions: ['No tabs available for grouping - empty array']
            }];
        }
        
        // Create semantic groups based on title analysis instead of just domains
        const groups: { [key: string]: TabData[] } = {};
        
        tabs.forEach((tab, index) => {
            if (!tab || typeof tab !== 'object' || !tab.url || !tab.title) {
                return;
            }
            
            // Analyze title and URL to determine semantic category
            const category = this.categorizeTab(tab);
            
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(tab);
        });
        
        const result = [{
            groups: Object.entries(groups).map(([category, tabsInGroup]) => ({
                subject: category,
                tabs: tabsInGroup
            })),
            suggestions: ['Group by semantic topic', 'Group by work context', 'Group by purpose and function']
        }];
        
        this.log(`Fallback created ${Object.keys(groups).length} semantic groups`);
        return result;
    }

    private categorizeTab(tab: TabData): string {
        const title = tab.title.toLowerCase();
        const url = tab.url.toLowerCase();
        
        // Communication & Social
        if (title.includes('whatsapp') || title.includes('outlook') || title.includes('calendar') || 
            title.includes('gmail') || title.includes('slack') || title.includes('discord') ||
            title.includes('linkedin') || url.includes('linkedin') || url.includes('whatsapp') ||
            url.includes('outlook') || url.includes('mail')) {
            return 'Communication & Social';
        }
        
        // Development & Documentation
        if (title.includes('github') || title.includes('api') || title.includes('documentation') ||
            title.includes('docs') || title.includes('developer') || url.includes('github') ||
            url.includes('developer') || url.includes('docs') || title.includes('chrome.tabs') ||
            title.includes('trpc') || title.includes('next.js') || title.includes('chakra')) {
            return 'Development & Documentation';
        }
        
        // AI Tools & Platforms
        if (title.includes('chatgpt') || title.includes('openai') || title.includes('cursor') ||
            title.includes('ultracite') || url.includes('chatgpt') || url.includes('openai') ||
            url.includes('cursor') || url.includes('ultracite')) {
            return 'AI Tools & Platforms';
        }
        
        // Research (try to extract topic from search queries)
        if (title.includes('google search') || title.includes('search') || url.includes('google.com/search')) {
            if (title.includes('optical') || url.includes('optical')) {
                return 'Research: Optical Technology';
            }
            if (title.includes('shiphats') || title.includes('gitlab')) {
                return 'Research: Development Tools';
            }
            return 'Research & Information';
        }
        
        // Government/Official docs
        if (url.includes('gov.sg') || title.includes('singapore government') ||
            title.includes('optical documentation') || title.includes('pricing')) {
            return 'Government & Official Documentation';
        }
        
        // Development Tools & Utilities
        if (title.includes('uuid') || title.includes('generator') || title.includes('cuid') ||
            title.includes('vercel') || title.includes('template') || url.includes('localhost')) {
            return 'Development Tools & Utilities';
        }
        
        // Extension/Browser tools
        if (url.includes('about:') || url.includes('moz-extension') || url.includes('chrome-extension') ||
            title.includes('extension') || title.includes('debugging')) {
            return 'Browser & Extensions';
        }
        
        // Default to domain-based grouping as last resort
        return this.extractDomain(tab.url);
    }

    private extractDomain(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname;
        } catch {
            return 'Other';
        }
    }

    async analyzeTabContent(url: string): Promise<string[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('OpenAI API key not found. Please set your API key in the extension options.');
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'system',
                        content: 'You are a helpful assistant that analyzes web URLs and page titles to determine the main SEMANTIC TOPICS and THEMES. Focus on the purpose, content area, and conceptual category rather than technical details. Return a JSON array of strings representing the main conceptual topics. Examples: ["Communication", "Development", "Research", "Entertainment", "Shopping", "Work", "Education", "Social Media", "Documentation", "News"]'
                    }, {
                        role: 'user',
                        content: `What are the main semantic topics and themes for this URL and title: ${url}`
                    }],
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content || '';
            
            try {
                return JSON.parse(content);
            } catch {
                return [this.extractDomain(url)];
            }
        } catch (error) {
            console.error('Error analyzing tab content:', error);
            return [this.extractDomain(url)];
        }
    }

    async getTabContent(tab: chrome.tabs.Tab): Promise<TabData> {
        // Ensure tab has required properties
        if (!tab || typeof tab !== 'object') {
            const defaultResult = {
                id: 0,
                title: 'Unknown Tab',
                url: 'about:blank'
            };
            return defaultResult;
        }
        
        const result = {
            id: tab.id || 0,
            title: tab.title || 'Unknown Tab',
            url: tab.url || 'about:blank'
        };
        
        return result;
    }

    async analyzeContent(content: string): Promise<string[]> {
        const apiKey = await this.getApiKey();
        if (!apiKey) {
            throw new Error('OpenAI API key not found. Please set your API key in the extension options.');
        }

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: [{
                        role: 'system',
                        content: 'You are a helpful assistant that analyzes text content to determine the main SEMANTIC TOPICS and THEMES. Focus on the conceptual areas, purpose, and subject matter rather than technical details. Return a JSON array of strings representing the main conceptual topics. Examples: ["Communication", "Development", "Research", "Entertainment", "Shopping", "Work", "Education", "Social Media", "Documentation", "News"]'
                    }, {
                        role: 'user',
                        content: `What are the main semantic topics and themes in this content: ${content.substring(0, 1000)}...`
                    }],
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            const content_response = data.choices[0]?.message?.content || '';
            
            try {
                return JSON.parse(content_response);
            } catch {
                return ['General'];
            }
        } catch (error) {
            console.error('Error analyzing content:', error);
            return ['General'];
        }
    }

    private validateAndFormatResponse(groupedTabs: any, tabs: TabData[]): AIResponse[] {
        this.log('=== VALIDATE AND FORMAT RESPONSE ===');
        this.log(`Input groupedTabs: ${JSON.stringify(groupedTabs, null, 2)}`);
        this.log(`Input tabs: ${JSON.stringify(tabs, null, 2)}`);
        this.log(`groupedTabs type: ${typeof groupedTabs}`);
        this.log(`Is groupedTabs an array? ${Array.isArray(groupedTabs)}`);
        
        // Check if the response is a single object (not an array)
        if (groupedTabs && typeof groupedTabs === 'object' && !Array.isArray(groupedTabs)) {
            this.log('Processing single object response');
            
            // If it's a single object with groups, wrap it in an array
            if (groupedTabs.groups && Array.isArray(groupedTabs.groups)) {
                this.log('Single object has groups array, converting to array format');
                this.log(`Groups found: ${JSON.stringify(groupedTabs.groups, null, 2)}`);
                this.log(`Groups type: ${typeof groupedTabs.groups}`);
                this.log(`Is groups an array? ${Array.isArray(groupedTabs.groups)}`);
                this.log(`Groups length: ${groupedTabs.groups ? groupedTabs.groups.length : 'undefined'}`);
                
                if (!Array.isArray(groupedTabs.groups)) {
                    this.logError('ERROR: groups is not an array even though Array.isArray returned true earlier');
                    this.logError(`groups value: ${JSON.stringify(groupedTabs.groups)}`);
                    return this.createFallbackGrouping(tabs);
                }
                
                this.log('About to map over groups array...');
                const mappedGroups = groupedTabs.groups.map((group: any, groupIndex: number) => {
                    this.log(`Processing group ${groupIndex}: ${JSON.stringify(group)}`);
                    if (!group) {
                        this.log(`Group ${groupIndex} is null or undefined`);
                        return {
                            subject: 'Unknown',
                            tabs: []
                        };
                    }
                    
                    const result = {
                        subject: group.subject || 'Unknown',
                        tabs: Array.isArray(group.tabs) ? group.tabs : []
                    };
                    this.log(`Processed group ${groupIndex} result: ${JSON.stringify(result)}`);
                    return result;
                });
                this.log(`Mapped groups: ${JSON.stringify(mappedGroups, null, 2)}`);
                
                const result = [{
                    groups: mappedGroups,
                    suggestions: Array.isArray(groupedTabs.suggestions) ? groupedTabs.suggestions : []
                }];
                
                this.log(`Single object conversion result: ${JSON.stringify(result, null, 2)}`);
                return result;
            } else {
                this.log('Single object response but missing groups array, using fallback grouping');
                this.log(`groupedTabs.groups: ${JSON.stringify(groupedTabs.groups)}`);
                this.log(`Is groups an array? ${Array.isArray(groupedTabs.groups)}`);
                return this.createFallbackGrouping(tabs);
            }
        }
        
        // Validate that the response has the expected structure
        if (!Array.isArray(groupedTabs)) {
            this.log('AI response is not an array or valid object, using fallback grouping');
            this.log(`Type of groupedTabs: ${typeof groupedTabs}`);
            this.log(`Value of groupedTabs: ${JSON.stringify(groupedTabs)}`);
            return this.createFallbackGrouping(tabs);
        }
        
        this.log(`Processing array response with ${groupedTabs.length} items`);
        
        // Validate each item in the array
        const validatedResponse: AIResponse[] = [];
        
        for (let i = 0; i < groupedTabs.length; i++) {
            const item = groupedTabs[i];
            this.log(`Processing array item ${i}: ${JSON.stringify(item)}`);
            
            if (!item || typeof item !== 'object') {
                this.log(`Invalid AI response item: ${JSON.stringify(item)}`);
                continue;
            }
            
            // Ensure the item has the expected structure
            if (!item.groups || !Array.isArray(item.groups)) {
                this.log(`AI response item missing groups array: ${JSON.stringify(item)}`);
                validatedResponse.push({
                    groups: [],
                    suggestions: Array.isArray(item.suggestions) ? item.suggestions : []
                });
                continue;
            }
            
            this.log(`Item ${i} has valid groups array with ${item.groups.length} groups`);
            this.log(`About to map over item ${i} groups...`);
            
            // Add safety check before mapping
            if (!Array.isArray(item.groups)) {
                this.logError(`ERROR: item.groups is not an array for item ${i}`);
                this.logError(`item.groups value: ${JSON.stringify(item.groups)}`);
                continue;
            }
            
            const mappedItemGroups = item.groups.map((group: any, groupIndex: number) => {
                this.log(`Processing group ${groupIndex} in item ${i}: ${JSON.stringify(group)}`);
                if (!group) {
                    this.log(`Group ${groupIndex} in item ${i} is null or undefined`);
                    return {
                        subject: 'Unknown',
                        tabs: []
                    };
                }
                
                const result = {
                    subject: group.subject || 'Unknown',
                    tabs: Array.isArray(group.tabs) ? group.tabs : []
                };
                this.log(`Processed group ${groupIndex} in item ${i} result: ${JSON.stringify(result)}`);
                return result;
            });
            
            const processedItem = {
                groups: mappedItemGroups,
                suggestions: Array.isArray(item.suggestions) ? item.suggestions : []
            };
            
            this.log(`Processed item ${i}: ${JSON.stringify(processedItem)}`);
            validatedResponse.push(processedItem);
        }
        
        if (validatedResponse.length === 0) {
            this.log('No valid AI response items, using fallback grouping');
            return this.createFallbackGrouping(tabs);
        }
        
        this.log(`Final validated response: ${JSON.stringify(validatedResponse, null, 2)}`);
        return validatedResponse;
    }

    // Public method for debugging
    public async testFallbackGrouping(tabs: TabData[]): Promise<AIResponse[]> {
        return this.createFallbackGrouping(tabs);
    }
}

export async function analyzeTabs(tabs: TabData[]): Promise<AIResponse[]> {
    const aiService = new AIService();
    return aiService.analyzeTabs(tabs);
}