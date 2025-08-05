/// <reference types="chrome"/>
import { StorageService } from '../services/storageService';

interface Options {
    enableGrouping: boolean;
    groupingThreshold: number;
    showDebugConsole: boolean;
    apiKey?: string;
}

const storageService = new StorageService();
const optionsForm = document.getElementById('options-form') as HTMLFormElement;
const enableGroupingCheckbox = document.getElementById('enable-grouping') as HTMLInputElement;
const groupingThresholdInput = document.getElementById('grouping-threshold') as HTMLInputElement;
const showDebugConsoleCheckbox = document.getElementById('show-debug-console') as HTMLInputElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;

async function loadOptionsToForm() {
    try {
        console.log('Loading options from storage...');
        const allSettings = await storageService.getSettings();
        console.log('All settings retrieved:', allSettings);
        
        // Load options
        const options: Options = allSettings.options || {};
        console.log('Parsed options:', options);
        
        // Load API key directly
        const apiKey = await storageService.getSetting('openai_api_key');
        console.log('API key retrieved:', apiKey ? 'Key present' : 'Key missing');
        console.log('API key length:', apiKey ? apiKey.length : 0);
        
        // Populate form
        enableGroupingCheckbox.checked = options.enableGrouping || false;
        groupingThresholdInput.value = (options.groupingThreshold || 7).toString();
        showDebugConsoleCheckbox.checked = options.showDebugConsole !== false; // Default to true
        apiKeyInput.value = apiKey || '';
        
        console.log('Form populated with values:', {
            enableGrouping: enableGroupingCheckbox.checked,
            groupingThreshold: groupingThresholdInput.value,
            showDebugConsole: showDebugConsoleCheckbox.checked,
            apiKeyLength: apiKeyInput.value.length
        });
    } catch (error) {
        console.error('Error loading options:', error);
    }
}

async function saveOptionsToStorage(event: Event) {
    event.preventDefault();
    try {
        console.log('Saving options to storage...');
        const options: Options = {
            enableGrouping: enableGroupingCheckbox.checked,
            groupingThreshold: parseInt(groupingThresholdInput.value, 10),
            showDebugConsole: showDebugConsoleCheckbox.checked,
        };
        
        console.log('Options to save:', options);
        await storageService.saveSetting('options', options);
        
        // Save API key separately for security - always save, even if empty
        const apiKeyValue = apiKeyInput.value.trim();
        console.log('API key value to save:', apiKeyValue ? 'Key present' : 'Key empty');
        
        if (apiKeyValue) {
            await storageService.saveSetting('openai_api_key', apiKeyValue);
        } else {
            // If API key is empty, remove it from storage
            await storageService.removeSetting('openai_api_key');
        }
        
        console.log('All settings saved successfully');
        
        // Verify the save by loading back the settings
        const verification = await storageService.getSettings();
        console.log('Verification - All settings after save:', verification);
        
        // Show success message
        const button = optionsForm.querySelector('button[type="submit"]') as HTMLButtonElement;
        const originalText = button.textContent;
        button.textContent = 'Saved!';
        button.style.backgroundColor = '#28a745';
        
        setTimeout(() => {
            button.textContent = originalText;
            button.style.backgroundColor = '#5cb85c';
        }, 2000);
        
    } catch (error) {
        console.error('Error saving options:', error);
        alert('Error saving options. Please try again.');
    }
}

optionsForm?.addEventListener('submit', saveOptionsToStorage);

// Add a global function for debugging
(window as any).debugStorage = async () => {
    console.log('=== STORAGE DEBUG ===');
    
    // Test 1: Check if storage service is working
    console.log('1. Testing storage service...');
    const testResult = await storageService.testStorage();
    console.log('Storage test result:', testResult);
    
    // Test 2: Check raw storage access
    console.log('2. Testing raw storage access...');
    try {
        const rawResult = await chrome.storage.sync.get(null);
        console.log('Raw storage (sync):', rawResult);
    } catch (e) {
        console.log('Sync storage failed, trying local:', e);
        try {
            const rawResult = await chrome.storage.local.get(null);
            console.log('Raw storage (local):', rawResult);
        } catch (e2) {
            console.log('Local storage also failed:', e2);
        }
    }
    
    // Test 3: Test specific API key retrieval
    console.log('3. Testing API key retrieval...');
    const apiKey = await storageService.getSetting('openai_api_key');
    console.log('API key from storage service:', apiKey);
    
    // Test 4: Check all settings
    console.log('4. Testing all settings retrieval...');
    const allSettings = await storageService.getSettings();
    console.log('All settings:', allSettings);
    
    console.log('=== END DEBUG ===');
};

// Add a global function to clear corrupted data
(window as any).clearCorruptedData = async () => {
    console.log('Clearing potentially corrupted data...');
    try {
        const storageService = new StorageService();
        await storageService.clearAllSettings();
        console.log('All settings cleared successfully');
        alert('All settings have been cleared. Please re-enter your API key.');
    } catch (error) {
        console.error('Error clearing settings:', error);
        alert('Failed to clear settings. Please try again.');
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    // Test storage functionality on page load
    console.log('Testing storage functionality...');
    const storageTest = await storageService.testStorage();
    console.log('Storage test result:', storageTest);
    
    // Load the options
    await loadOptionsToForm();
});