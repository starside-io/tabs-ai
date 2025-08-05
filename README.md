# AI Tab Grouper Extension

Starside Labs, Transforming the future through AI.
https://starside.io

## Overview
The AI Tab Grouper Extension is a browser extension designed to enhance your browsing experience by automatically grouping tabs based on their subject matter. Leveraging AI technology, this extension analyzes the content of your open tabs and organizes them into meaningful groups, making it easier to manage and navigate your browsing sessions.

## Features
- **Automatic Tab Grouping**: Uses AI to analyze tab content and suggest groupings based on subjects.
- **User-Friendly Popup Interface**: Easily access and manage your tab groups through a simple popup interface.
- **Customizable Options**: Configure settings to tailor the extension's behavior to your preferences.

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/ai-tab-grouper-extension.git
   ```
2. Navigate to the project directory:
   ```
   cd ai-tab-grouper-extension
   ```
3. Install the dependencies:
   ```
   npm install
   ```

4. Build the extension:
   ```bash
   # Build for both browsers
   npm run build
   
   # Or build for specific browser
   npm run build:chrome    # Creates dist/ folder
   npm run build:firefox   # Creates dist-firefox/ folder
   ```

5. Load the extension in your browser:
   - **For Chrome**: Go to `chrome://extensions/`, enable "Developer mode", and click "Load unpacked". Select the `dist` directory.
   - **For Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select the `manifest.json` file from the `dist-firefox` directory.

## Usage
- Click the extension icon in your browser toolbar to open the popup interface.
- The extension will automatically analyze your open tabs and suggest groupings.
- You can customize settings through the options page accessible from the popup.

## Privacy Policy
**Your privacy is important to us.** This extension operates with the following privacy principles:

- **No Data Retention**: We do not store, collect, or retain any of your browsing data on our servers
- **Local Storage Only**: All settings (including your OpenAI API key) are stored locally in your browser
- **AI Processing**: Tab titles and URLs are sent to OpenAI's API for grouping analysis, but are not stored by us
- **No Tracking**: We do not track your browsing habits or collect analytics
- **Open Source**: All code is available for review to ensure transparency

Your OpenAI API key and all extension settings remain on your device and are never transmitted to us.

## License
This project is licensed under the Apache 2.0 License. See the LICENSE file for details.

---

Made with ❤️ by [Starside Labs](https://starside.io)