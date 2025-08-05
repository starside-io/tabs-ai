// Browser compatibility layer with better error handling
let browserAPI: any;

if (typeof chrome !== 'undefined' && chrome.storage) {
    browserAPI = chrome;
} else if (typeof (window as any).browser !== 'undefined' && (window as any).browser.storage) {
    browserAPI = (window as any).browser;
} else if ((window as any).chrome && (window as any).chrome.storage) {
    browserAPI = (window as any).chrome;
} else {
    console.error('No browser storage API found');
    browserAPI = null;
}

export class StorageService {
    private storage: any;

    constructor() {
        console.log('Initializing StorageService...');
        
        // Check if browser APIs are available
        if (!browserAPI) {
            throw new Error('Browser API not available');
        }
        
        if (!browserAPI.storage) {
            throw new Error('Browser storage API not available');
        }
        
        // Force use of local storage for better reliability
        // Chrome sync storage can have issues with quotas and sync delays
        if (browserAPI.storage.local) {
            console.log('Using chrome.storage.local for better reliability');
            this.storage = browserAPI.storage.local;
        } else if (browserAPI.storage.sync) {
            console.log('Falling back to chrome.storage.sync');
            this.storage = browserAPI.storage.sync;
        } else {
            throw new Error('No storage API available');
        }
        
        console.log('StorageService initialized successfully');
    }

    async getSettings(): Promise<any> {
        try {
            // Use Promise wrapper to ensure proper async handling
            const result = await new Promise<any>((resolve, reject) => {
                this.storage.get(null, (result: any) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(result);
                    }
                });
            });
            
            console.log('Retrieved raw all settings:', result);
            
            // Handle case where result is undefined or null
            if (!result || typeof result !== 'object') {
                console.log('Invalid result structure for all settings, returning empty object');
                return {};
            }
            
            console.log('Retrieved all settings:', result);
            return result;
        } catch (error) {
            console.error('Error getting settings:', error);
            return {};
        }
    }

    async saveSetting(key: string, value: any): Promise<void> {
        try {
            console.log(`Saving setting: ${key} =`, value);
            
            // Use Promise wrapper to ensure proper async handling
            await new Promise<void>((resolve, reject) => {
                this.storage.set({ [key]: value }, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
            
            console.log(`Successfully saved setting: ${key}`);
        } catch (error) {
            console.error(`Error saving setting ${key}:`, error);
            throw error;
        }
    }

    async getSetting(key: string): Promise<any> {
        try {
            // Use Promise wrapper to ensure proper async handling
            const result = await new Promise<any>((resolve, reject) => {
                this.storage.get(key, (result: any) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(result);
                    }
                });
            });
            
            console.log(`Retrieved raw result for ${key}:`, result);
            
            // Handle case where result is undefined or null
            if (!result || typeof result !== 'object') {
                console.log(`Invalid result structure for ${key}, returning null`);
                return null;
            }
            
            const value = result[key];
            console.log(`Retrieved setting ${key}:`, value);
            return value !== undefined ? value : null;
        } catch (error) {
            console.error(`Error getting setting ${key}:`, error);
            return null;
        }
    }

    async removeSetting(key: string): Promise<void> {
        try {
            console.log(`Removing setting: ${key}`);
            
            // Use Promise wrapper to ensure proper async handling
            await new Promise<void>((resolve, reject) => {
                this.storage.remove(key, () => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve();
                    }
                });
            });
            
            console.log(`Successfully removed setting: ${key}`);
        } catch (error) {
            console.error(`Error removing setting ${key}:`, error);
            throw error;
        }
    }

    async clearAllSettings(): Promise<void> {
        try {
            await this.storage.clear();
        } catch (error) {
            console.error('Error clearing settings:', error);
        }
    }

    // Convenience methods for get/set operations
    async get(key: string): Promise<any> {
        return this.getSetting(key);
    }

    async set(key: string, value: any): Promise<void> {
        return this.saveSetting(key, value);
    }

    // Test method to verify storage functionality
    async testStorage(): Promise<boolean> {
        try {
            console.log('Testing storage functionality...');
            const testKey = 'storage_test';
            const testValue = 'test_value_' + Date.now();
            
            // Test save
            await this.saveSetting(testKey, testValue);
            console.log('Test save successful');
            
            // Test retrieve
            const retrievedValue = await this.getSetting(testKey);
            console.log('Test retrieve result:', retrievedValue);
            
            // Test remove
            await this.removeSetting(testKey);
            console.log('Test remove successful');
            
            // Verify remove
            const verifyRemove = await this.getSetting(testKey);
            console.log('Verify remove result:', verifyRemove);
            
            const success = retrievedValue === testValue && verifyRemove === null;
            console.log('Storage test result:', success ? 'PASSED' : 'FAILED');
            return success;
        } catch (error) {
            console.error('Storage test failed:', error);
            return false;
        }
    }
}
