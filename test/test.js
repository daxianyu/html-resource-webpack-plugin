/**
 * Created by tangjianfeng on 2017/3/11.
 */
const webpack = require('webpack');
const HtmlPlugin = require('html-webpack-plugin')
const path = require('path')
const pwd = process.cwd()
const HtmlResourcePlugin = require('../index')

module.exports = {
    entry: {
        index: path.resolve(pwd, "./test/te2/index.js"),
        index2: path.resolve(pwd, "./test/te2/index.js"),
    },
    // watch: true,
    cache: true,
    profile: true,
    // devtool: 'eval',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [{
                    loader: 'css-loader'
                }]
            },
            {
                test: /\.jpe?g$/,
                use: [{
                    loader: 'file-loader'
                }]
            },
            {
                test: /\.html$/,
                use: [{
                    loader: 'html-loader'
                }]
            }
        ]
    },
    output: {
        path: path.resolve(pwd, './dist'),
        filename: 'statics/script/[name]_[chunkhash:6].js'
    },
    plugins: [
        new webpack.DefinePlugin({
            TEST: JSON.stringify('daxianyu')
        }),
        new HtmlPlugin({
            filename: 'index.html',
            template: path.resolve(pwd, "./test/te2/index.html"),
            resourceName: {
                js: 'statics/script/[name]_[hash:6].[ext]',
                css: 'statics/css/[name]_[hash:6].[ext]'
            },
            chunks: ['index']
        }),
        new HtmlPlugin({
            filename: 'index2.html',
            template: path.resolve(pwd, "./test/te2/index2.html"),
            resourceName: {
                js: 'statics/[name]_[hash:6].[ext]',
                css: 'statics/[name]_[hash:6].[ext]'
            },
            chunks: ['index2']
        }),
        new HtmlResourcePlugin(),
    ]
}

webpack(module.exports, ()=>{
    console.error('done')
})