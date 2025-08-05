# AI Tab Grouper Extension - Testing Guide

## Issues Fixed

### 1. Invisible Popup Issue
**Problem:** The popup was invisible because CSS files weren't being copied to the distribution directory.
**Solution:** Added `copy-webpack-plugin` to the webpack config to copy CSS files during build.

### 2. Missing OpenAI API Key
**Problem:** The extension was trying to use a placeholder API service instead of OpenAI.
**Solution:** Implemented proper OpenAI API integration with API key management.

## How to Test

### 1. Load the Extension
- Open Firefox
- Go to `about:debugging`
- Click "This Firefox"
- Click "Load Temporary Add-on"
- Navigate to the `dist-firefox/` directory in your project folder and select `manifest.json`

### 2. Set Up Your OpenAI API Key
- Right-click the extension icon in the toolbar
- Select "Options" (or go to about:addons, find the extension, and click "Options")
- Enter your OpenAI API key (get one from https://platform.openai.com/api-keys)
- Click "Save Options"

### 3. Test Tab Grouping
- Open several tabs with different types of content (news, social media, development, etc.)
- Click the AI Tab Grouper extension icon
- Click "Group Tabs"
- The extension will:
  - Analyze your tabs using OpenAI
  - Display the grouped tabs in the popup
  - Create actual browser tab groups (if your browser supports it)

## Features Added

### Popup Interface
- Better error handling and user feedback
- Loading states during processing
- Clear error messages when API key is missing
- Success confirmations
- Direct link to open options page

### Options Page
- Secure API key storage
- Visual feedback when settings are saved
- Clear instructions for getting an API key
- Link to OpenAI platform

### AI Integration
- Real OpenAI API integration using GPT-3.5-turbo
- Fallback grouping by domain if AI fails
- Proper error handling for API failures
- JSON parsing with fallback strategies

### Tab Grouping
- Creates actual browser tab groups (where supported)
- Assigns colors to different groups
- Handles edge cases and errors gracefully

## Testing Different Scenarios

1. **No API Key Set**: Should show error message with link to options
2. **Invalid API Key**: Should show API error message
3. **Valid API Key**: Should successfully group tabs
4. **No Tabs to Group**: Should handle gracefully
5. **API Rate Limits**: Should show appropriate error messages

## Notes

- The extension uses GPT-3.5-turbo for cost efficiency
- API key is stored locally in browser storage
- Supports both Chrome and Firefox (though you're using Firefox)
- Tab grouping works best with modern browsers that support the tab groups API
