/// <reference types="chrome"/>
import { TabGrouper } from '../services/tabGrouper';
import { AIService } from '../services/aiService';

// Browser compatibility layer
const browserAPI = (typeof chrome !== 'undefined') ? chrome : (window as any).browser;

console.log('AI Tab Grouper background script loaded!');

const tabGrouper = new TabGrouper();
const aiService = new AIService();

// Test that the extension is working
browserAPI.runtime.onInstalled.addListener(() => {
    console.log('AI Tab Grouper extension installed/updated');
});

browserAPI.tabs.onUpdated.addListener((tabId: number, changeInfo: any, tab: any) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('Tab updated:', tab.url);
        aiService.analyzeTabContent(tab.url).then((subjects: string[]) => {
            tabGrouper.groupTabsBySubject(subjects);
        }).catch(error => {
            console.error('Error analyzing tab content:', error);
        });
    }
});

browserAPI.runtime.onMessage.addListener((request: any, sender: any, sendResponse: (response?: any) => void) => {
    console.log('Message received:', request);
    if (request.action === 'getGroupedTabs') {
        const groupedTabs = tabGrouper.getGroupedTabs();
        sendResponse({ groupedTabs });
        return true; // Important for async response
    }
});