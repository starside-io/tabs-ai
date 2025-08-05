/// <reference types="chrome"/>
import { TabGrouper } from '../services/tabGrouper';
import { AIService } from '../services/aiService';

const tabGrouper = new TabGrouper();
const aiService = new AIService();

chrome.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        analyzeTabContent(tab);
    }
});

function analyzeTabContent(tab: chrome.tabs.Tab) {
    const content = `${tab.title} ${tab.url}`;

    aiService.analyzeContent(content).then((subjects: string[]) => {
        if (tab.id && subjects.length > 0) {
            tabGrouper.groupTab(tab.id, subjects[0]);
        }
    });
}