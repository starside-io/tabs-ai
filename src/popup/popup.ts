/// <reference types="chrome"/>
import { TabGrouper } from '../services/tabGrouper';
import { AIService } from '../services/aiService';
import { StorageService } from '../services/storageService';
import { TabData } from '../types';

console.log('=== POPUP SCRIPT STARTING ===');
console.log('Popup script loaded and executing...');

// Browser compatibility layer
const browserAPI = (typeof chrome !== 'undefined') ? chrome : (window as any).browser;
console.log('Browser API:', browserAPI);

const tabGrouper = new TabGrouper();
const aiService = new AIService();
const storageService = new StorageService();

// Set up the log callback for AIService to log to popup
aiService.setLogCallback((message: string, isError: boolean = false) => {
    addLogToPopup(`[AI SERVICE] ${message}`, isError);
});

// Set up the log callback for TabGrouper to log to popup
tabGrouper.setLogCallback((message: string, isError: boolean = false) => {
    addLogToPopup(`[TAB GROUPER] ${message}`, isError);
});

console.log('TabGrouper instance:', tabGrouper);
console.log('AIService instance:', aiService);
console.log('=== POPUP SCRIPT INITIALIZED ===');

// Create a logging system that displays in the popup
let logContainer: HTMLDivElement;
let debugConsoleEnabled = false; // Default to disabled

function addLogToPopup(message: string, isError: boolean = false) {
    // Only show debug logs if enabled
    if (!debugConsoleEnabled) {
        // Always log to console even if debug console is hidden
        if (isError) {
            console.error(message);
        } else {
            console.log(message);
        }
        return;
    }

    if (!logContainer) {
        logContainer = document.createElement('div');
        logContainer.id = 'debug-logs';
        // Remove inline styles to let CSS take control
        document.body.appendChild(logContainer);
    }
    
    const logEntry = document.createElement('div');
    logEntry.style.cssText = `
        margin: 2px 0;
        color: ${isError ? '#ff6b6b' : '#e0e0e0'};
        border-bottom: 1px solid var(--mars-gray);
        padding: 2px 0;
    `;
    logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Also log to console
    if (isError) {
        console.error(message);
    } else {
        console.log(message);
    }
}

function displayGroups(groups: Array<{ subject: string; tabs: any[] }>, container: HTMLDivElement) {
    container.innerHTML = '';
    
    if (groups.length === 0) {
        container.innerHTML = '<p>No groups found.</p>';
        return;
    }
    
    groups.forEach((group, index) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'tab-group';
        
        const groupHeader = document.createElement('h3');
        groupHeader.textContent = group.subject;
        groupDiv.appendChild(groupHeader);
        
        const tabList = document.createElement('ul');
        tabList.className = 'tab-list';
        
        group.tabs.forEach(tab => {
            const listItem = document.createElement('li');
            const tabSpan = document.createElement('span');
            tabSpan.textContent = tab.title;
            tabSpan.style.color = '#e0e0e0';
            
            listItem.appendChild(tabSpan);
            tabList.appendChild(listItem);
        });
        
        groupDiv.appendChild(tabList);
        container.appendChild(groupDiv);
    });
    
    // Add clear groups button
    const clearButton = document.createElement('button');
    clearButton.textContent = 'Clear Groups';
    clearButton.className = 'clear-groups-button';
    clearButton.addEventListener('click', async () => {
        await tabGrouper.clearSavedGroups();
        container.innerHTML = '<p>Groups cleared.</p>';
        addLogToPopup('Groups cleared by user');
    });
    
    container.appendChild(clearButton);
}

document.addEventListener('DOMContentLoaded', async () => {
    addLogToPopup('=== POPUP SCRIPT LOADED ===');
    addLogToPopup('DOM content loaded, setting up event listeners...');
    
    // Load debug console setting first
    await loadDebugConsoleSetting();
    
    const groupTabsButton = document.getElementById('group-tabs') as HTMLButtonElement;
    const groupedTabsDiv = document.getElementById('grouped-tabs') as HTMLDivElement;
    const optionsGearButton = document.getElementById('options-gear') as HTMLButtonElement;

    addLogToPopup(`Button element: ${groupTabsButton ? 'Found' : 'Not found'}`);
    addLogToPopup(`Div element: ${groupedTabsDiv ? 'Found' : 'Not found'}`);
    addLogToPopup(`Options gear button: ${optionsGearButton ? 'Found' : 'Not found'}`);

    // Set up options gear button click listener
    optionsGearButton?.addEventListener('click', () => {
        addLogToPopup('Options gear clicked, opening options page...');
        browserAPI.runtime.openOptionsPage();
    });

    if (!groupTabsButton) {
        addLogToPopup('ERROR: group-tabs button not found!', true);
        return;
    }

    if (!groupedTabsDiv) {
        addLogToPopup('ERROR: grouped-tabs div not found!', true);
        return;
    }

    // Check for existing groups on popup load
    addLogToPopup('Checking for existing groups...');
    try {
        const hasExistingGroups = await tabGrouper.hasExistingGroups();
        if (hasExistingGroups) {
            addLogToPopup('Found existing groups, displaying them...');
            const existingGroups = await tabGrouper.getGroupsForDisplay();
            displayGroups(existingGroups, groupedTabsDiv);
        } else {
            addLogToPopup('No existing groups found');
        }
    } catch (error) {
        addLogToPopup(`Error checking for existing groups: ${error}`, true);
    }

    addLogToPopup('Setting up button click listener...');

    groupTabsButton?.addEventListener('click', async () => {
        addLogToPopup('=== BUTTON CLICKED ===');
        addLogToPopup('Button click handler started');
        addLogToPopup('=== TAB GROUPING STARTED ===');
        
        try {
            addLogToPopup('Step 1: Checking API key...');
            // Check if API key is set
            const apiKey = await aiService.getApiKey();
            addLogToPopup(`API key check result: ${apiKey ? 'Key present' : 'Key missing'}`);
            
            if (!apiKey) {
                addLogToPopup('No API key found, showing error message');
                groupedTabsDiv.innerHTML = `
                    <div class="error-message">
                        <p>⚠️ OpenAI API key not found!</p>
                        <p>Please set your API key in the extension options.</p>
                        <button id="open-options">Open Options</button>
                    </div>
                `;
                
                const openOptionsButton = document.getElementById('open-options');
                openOptionsButton?.addEventListener('click', () => {
                    browserAPI.runtime.openOptionsPage();
                });
                return;
            }

            addLogToPopup('Step 2: Setting loading state...');
            // Show loading state
            groupTabsButton.disabled = true;
            groupTabsButton.textContent = 'Grouping...';
            groupedTabsDiv.innerHTML = '<p>Analyzing your tabs...</p>';

            addLogToPopup('Step 3: Querying tabs...');
            addLogToPopup('About to call browserAPI.tabs.query...');
            addLogToPopup(`browserAPI: ${browserAPI ? 'Present' : 'Missing'}`);
            addLogToPopup(`browserAPI.tabs: ${browserAPI?.tabs ? 'Present' : 'Missing'}`);
            
            // Check if we have tabs permission
            if (browserAPI.permissions) {
                try {
                    const hasTabsPermission = await browserAPI.permissions.contains({ permissions: ['tabs'] });
                    addLogToPopup(`Has tabs permission: ${hasTabsPermission}`);
                } catch (permError) {
                    addLogToPopup(`Error checking tabs permission: ${permError}`);
                }
            }
            
            let tabs;
            try {
                addLogToPopup('Calling browserAPI.tabs.query with options: { currentWindow: true }');
                
                // Firefox compatibility: use different approach for Firefox
                if (typeof (window as any).browser !== 'undefined' && (window as any).browser.tabs) {
                    // Firefox WebExtensions API
                    tabs = await (window as any).browser.tabs.query({ currentWindow: true });
                } else {
                    // Chrome API
                    tabs = await browserAPI.tabs.query({ currentWindow: true });
                }
                
                addLogToPopup(`browserAPI.tabs.query completed successfully`);
                addLogToPopup(`Found ${tabs ? tabs.length : 0} tabs`);
                
                // Check if tabs is undefined or null
                if (tabs === undefined) {
                    addLogToPopup('ERROR: tabs is undefined!', true);
                    throw new Error('tabs.query returned undefined - this may be a permissions issue');
                }
                
                if (tabs === null) {
                    addLogToPopup('ERROR: tabs is null!', true);
                    throw new Error('tabs.query returned null - this may be a permissions issue');
                }
                
                if (!Array.isArray(tabs)) {
                    addLogToPopup(`ERROR: tabs is not an array! Type: ${typeof tabs}`, true);
                    throw new Error(`tabs.query returned unexpected type: ${typeof tabs}`);
                }
                
            } catch (queryError) {
                addLogToPopup(`ERROR in browserAPI.tabs.query: ${queryError}`, true);
                
                // Try alternative tab query methods
                addLogToPopup('Trying alternative tab query methods...');
                
                try {
                    // Try querying all tabs instead of just current window
                    addLogToPopup('Trying to query all tabs...');
                    if (typeof (window as any).browser !== 'undefined' && (window as any).browser.tabs) {
                        tabs = await (window as any).browser.tabs.query({});
                    } else {
                        tabs = await browserAPI.tabs.query({});
                    }
                    addLogToPopup(`All tabs query result: found ${tabs ? tabs.length : 0} tabs`);
                    
                    if (!Array.isArray(tabs)) {
                        addLogToPopup('All tabs query also returned non-array, trying callback approach...');
                        
                        // Try callback-based approach as final fallback
                        tabs = await new Promise((resolve, reject) => {
                            addLogToPopup('Attempting callback-based tabs.query...');
                            try {
                                browserAPI.tabs.query({ currentWindow: true }, (result: any) => {
                                    addLogToPopup(`Callback tabs.query result: found ${result ? result.length : 0} tabs`);
                                    if (browserAPI.runtime.lastError) {
                                        addLogToPopup(`Callback error: ${browserAPI.runtime.lastError.message}`, true);
                                        reject(new Error(browserAPI.runtime.lastError.message));
                                    } else {
                                        resolve(result);
                                    }
                                });
                            } catch (callbackError) {
                                addLogToPopup(`Callback approach failed: ${callbackError}`, true);
                                reject(callbackError);
                            }
                        });
                    }
                    
                } catch (alternativeError) {
                    addLogToPopup(`Alternative query also failed: ${alternativeError}`, true);
                    throw new Error(`Both tab query methods failed: ${queryError} / ${alternativeError}`);
                }
            }
            
            addLogToPopup(`Tabs found: ${tabs && Array.isArray(tabs) ? tabs.length : 'undefined'}`);

            addLogToPopup('Step 4: Processing tab contents...');
            
            if (!Array.isArray(tabs)) {
                addLogToPopup(`ERROR: tabs is not an array in popup! Value: ${JSON.stringify(tabs)}`, true);
                groupedTabsDiv.innerHTML = '<p>Error: Invalid tab data received</p>';
                return;
            }
            
            let tabContents;
            try {
                addLogToPopup('Processing tabs...');
                tabContents = await Promise.all(tabs.map((tab: any) => {
                    return aiService.getTabContent(tab);
                }));
                addLogToPopup('Tab processing completed successfully');
            } catch (tabProcessingError) {
                addLogToPopup(`ERROR in tab processing: ${tabProcessingError}`, true);
                throw tabProcessingError;
            }
            
            addLogToPopup(`Tab contents processed: ${tabContents.length}`);

            addLogToPopup('Step 5: Analyzing tabs with AI...');
            addLogToPopup('About to call aiService.analyzeTabs...');
            
            let aiResponses;
            try {
                aiResponses = await aiService.analyzeTabs(tabContents);
                addLogToPopup('aiService.analyzeTabs completed successfully');
            } catch (aiAnalysisError) {
                addLogToPopup(`ERROR in aiService.analyzeTabs: ${aiAnalysisError}`, true);
                throw aiAnalysisError;
            }
            
            addLogToPopup(`AI analysis complete. Found ${aiResponses.length} response(s)`);
            
            // Validate aiResponses structure
            if (!Array.isArray(aiResponses) || aiResponses.length === 0) {
                addLogToPopup(`AI responses is not an array or empty`, true);
                groupedTabsDiv.innerHTML = '<p>No groupings found for your current tabs.</p>';
                return;
            }
            
            const firstResponse = aiResponses[0];
            
            if (!firstResponse || !firstResponse.groups || !Array.isArray(firstResponse.groups)) {
                addLogToPopup(`Invalid first response structure`, true);
                groupedTabsDiv.innerHTML = '<p>Invalid response format from AI service.</p>';
                return;
            }
            
            addLogToPopup('Step 6: Processing groups...');
            if (firstResponse.groups.length > 0) {
                addLogToPopup(`Groups found: ${firstResponse.groups.length}`);
                
                // Display grouped tabs using the new function
                displayGroups(firstResponse.groups, groupedTabsDiv);
                
                addLogToPopup('Step 7: Creating browser tab groups...');
                // Create actual tab groups in the browser
                const groupedTabsMap = new Map<string, TabData[]>();
                firstResponse.groups.forEach(group => {
                    if (group && group.subject && Array.isArray(group.tabs)) {
                        groupedTabsMap.set(group.subject, group.tabs);
                    }
                });
                
                await tabGrouper.createTabGroups(groupedTabsMap);
                addLogToPopup('Browser tab groups created successfully');
                
                // Add success message
                const successDiv = document.createElement('div');
                successDiv.className = 'success-message';
                successDiv.innerHTML = '✅ Tabs have been grouped successfully!';
                groupedTabsDiv.appendChild(successDiv);
                
                addLogToPopup('=== TAB GROUPING COMPLETED SUCCESSFULLY ===');
            } else {
                addLogToPopup('No groups found in response');
                groupedTabsDiv.innerHTML = '<p>No groupings found for your current tabs.</p>';
            }
            
        } catch (error) {
            addLogToPopup('=== TAB GROUPING ERROR ===', true);
            addLogToPopup(`Error details: ${error}`, true);
            addLogToPopup(`Error message: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            addLogToPopup(`Error stack: ${error instanceof Error ? error.stack : 'No stack trace'}`, true);
            addLogToPopup(`Error name: ${error instanceof Error ? error.name : 'Unknown'}`, true);
            addLogToPopup(`Full error object: ${JSON.stringify(error, null, 2)}`, true);
            
            groupedTabsDiv.innerHTML = `
                <div class="error-message">
                    <p>❌ Error grouping tabs:</p>
                    <p>${error instanceof Error ? error.message : 'Unknown error occurred'}</p>
                </div>
            `;
        } finally {
            addLogToPopup('Resetting button state...');
            groupTabsButton.disabled = false;
            groupTabsButton.textContent = 'Group Tabs';
            addLogToPopup('=== TAB GROUPING PROCESS ENDED ===');
        }
    });

    console.log('Button click listener set up successfully');
});

// Add debug functions to global scope
document.addEventListener('DOMContentLoaded', () => {
    // Make debug functions available globally
    (window as any).debugTabGrouper = async () => {
        console.log('=== TAB GROUPER DEBUG ===');
        
        try {
            // Test 1: Check API key
            const apiKey = await aiService.getApiKey();
            console.log('1. API key status:', apiKey ? 'Present' : 'Missing');
            
            // Test 2: Get tabs
            const tabs = await browserAPI.tabs.query({ currentWindow: true });
            console.log('2. Current tabs:', tabs.length);
            
            // Test 3: Process tab contents
            const tabContents = await Promise.all(tabs.map((tab: any) => aiService.getTabContent(tab)));
            console.log('3. Tab contents:', tabContents);
            
            // Test 4: Test fallback grouping
            const fallbackResult = await aiService.testFallbackGrouping(tabContents);
            console.log('4. Fallback grouping result:', fallbackResult);
            
            console.log('=== END TAB GROUPER DEBUG ===');
        } catch (error) {
            console.error('Debug failed:', error);
        }
    };

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

    console.log('Debug functions loaded. Try: debugTabGrouper() or clearCorruptedData()');
});

// Global error handlers to catch any uncaught errors
window.addEventListener('error', (event) => {
    addLogToPopup('=== GLOBAL ERROR CAUGHT ===', true);
    addLogToPopup(`Error event: ${event}`, true);
    addLogToPopup(`Error message: ${event.message}`, true);
    addLogToPopup(`Error filename: ${event.filename}`, true);
    addLogToPopup(`Error line: ${event.lineno}`, true);
    addLogToPopup(`Error column: ${event.colno}`, true);
    addLogToPopup(`Error object: ${JSON.stringify(event.error, null, 2)}`, true);
});

window.addEventListener('unhandledrejection', (event) => {
    addLogToPopup('=== UNHANDLED PROMISE REJECTION ===', true);
    addLogToPopup(`Promise rejection event: ${event}`, true);
    addLogToPopup(`Reason: ${JSON.stringify(event.reason, null, 2)}`, true);
});

async function loadDebugConsoleSetting() {
    try {
        const settings = await storageService.getSettings();
        const options = settings.options || {};
        debugConsoleEnabled = options.showDebugConsole || false; // Default to false if not set
        
        // If debug console is disabled and container exists, hide it
        if (!debugConsoleEnabled && logContainer) {
            logContainer.style.display = 'none';
        }
        
        addLogToPopup(`Debug console setting loaded: ${debugConsoleEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
        console.error('Error loading debug console setting:', error);
        // Default to disabled on error
        debugConsoleEnabled = false;
    }
}

// Load debug console setting on startup
loadDebugConsoleSetting();