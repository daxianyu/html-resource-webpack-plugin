# plugin for html-webpack-plugin to extract resources from html page

# install 
> npm install html-resource-webpack-plugin --save-dev


```javascript
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlResourcePlugin = require('../index')

let webpackConfig = {
    // .....
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'index2.html',
            template: path.resolve(pwd, "./test/te2/index2.html"),
            resourceName: {
                js: 'statics/[name]_[hash:6].[ext]',
                css: 'statics/[name]_[hash:6].[ext]'
            },
            chunks: ['index2']
        }),
        new HtmlResourcePlugin()
    ]
}

```