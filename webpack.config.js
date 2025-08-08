const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const fs = require('fs');

module.exports = (env) => {
    const browser = env.browser || 'chrome';
    const outputDir = browser === 'firefox' ? 'dist-firefox' : 'dist';
    
    return {
        mode: 'development',
        entry: {
            background: './src/background/background.ts',
            content: './src/content/content.ts',
            popup: './src/popup/popup.ts',
            options: './src/options/options.ts',
        },
        output: {
            filename: '[name].bundle.js',
            path: path.resolve(__dirname, outputDir),
            clean: true,
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
            ],
        },
        plugins: [
            new CopyWebpackPlugin({
                patterns: [
                    { from: 'src/popup/popup.css', to: 'popup.css' },
                    { from: 'src/options/options.css', to: 'options.css' },
                    { from: 'icons/', to: 'icons/' }
                ]
            }),
            new HtmlWebpackPlugin({
                template: './src/popup/popup.html',
                filename: 'popup.html',
                chunks: ['popup'],
            }),
            new HtmlWebpackPlugin({
                template: './src/options/options.html',
                filename: 'options.html',
                chunks: ['options'],
            }),
            // Custom plugin to copy the appropriate manifest
            {
                apply: (compiler) => {
                    compiler.hooks.emit.tap('CopyManifestPlugin', (compilation) => {
                        const manifestSource = browser === 'firefox' 
                            ? 'manifest.firefox.json' 
                            : 'manifest.chrome.json';
                        
                        const manifestPath = path.resolve(__dirname, manifestSource);
                        const manifestContent = fs.readFileSync(manifestPath, 'utf8');
                        
                        compilation.assets['manifest.json'] = {
                            source: () => manifestContent,
                            size: () => manifestContent.length
                        };
                    });
                }
            }
        ],
        devtool: 'source-map',
        devServer: {
            static: `./${outputDir}`,
        },
    };
};