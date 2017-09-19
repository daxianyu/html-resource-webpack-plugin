const path = require('path')
const cheerio = require('cheerio')
const fs = require('fs')
const loaderUtils = require('loader-utils')

function HtmlResourceWebpackPlugin(options) {}

HtmlResourceWebpackPlugin.prototype.apply = function (compiler) {

    function hasProtocal(route) {
        return route.indexOf('http://') === 0 || route.indexOf('https://') === 0 || route.indexOf('//') === 0;
    }

    const linkRegex = new RegExp("(<link[^>]*href=([\'\"]*)(.*?)([\'\"]*).*?\>)", "ig"),
        scriptRegex = new RegExp("(<script[^>]*src=([\'\"]*)(.*?)([\'\"]*).*?\>(<\/script>)?)", "ig");

    compiler.plugin('compilation', function (compilation) {

        compilation.plugin('html-webpack-plugin-before-html-processing', function (htmlPluginData, callback) {
            const htmlContext = path.dirname(htmlPluginData.plugin.options.template.split('!')[1])
            let content = htmlPluginData.html

            const linkMatchResult = content.match(linkRegex)
            const scriptMatchResult = content.match(scriptRegex)

            linkMatchResult.forEach(link=>{
                const $link = cheerio.load(link),
                    attr = $link('link').attr()
                if(hasProtocal(attr.href)) return
                if(attr.__raw || attr.__raw==='') return
                const linkFrom = path.resolve(htmlContext, attr.href)
                const data = fs.readFileSync(linkFrom)
                let outPathAndName = htmlPluginData.plugin.options.resourceName || '[name].[ext]'
                outPathAndName = outPathAndName.replace('[type]', function () {
                    return 'script'
                })
                const linkName = loaderUtils.interpolateName(
                    {resourcePath: linkFrom},
                    outPathAndName,
                    {content: data})
                compilation.assets[linkName] = {
                    size: function () {
                        return data.length
                    },
                    source: function () {
                        return data
                    }
                }
                content = content.replace(link, function () {
                    return `<link rel="stylesheet" href="${linkName}">`
                })
                htmlPluginData.html = content
            })

            scriptMatchResult.forEach(script=>{
                const $script = cheerio.load(script),
                    attr = $script('script').attr()
                if(hasProtocal(attr.src)) return
                if(attr.__raw || attr.__raw==='') return
                const scriptFrom = path.resolve(htmlContext, attr.src)
                const data = fs.readFileSync(scriptFrom)
                let outPathAndName = htmlPluginData.plugin.options.resourceName || '[name].[ext]'
                outPathAndName = outPathAndName.replace('[type]', function () {
                    return 'css'
                })
                const scriptName = loaderUtils.interpolateName(
                    {resourcePath: scriptFrom},
                    outPathAndName,
                    {content: data})

                compilation.assets[scriptName] = {
                    size: function () {
                        return data.length
                    },
                    source: function () {
                        return data
                    }
                }

                content = content.replace(script, function () {
                    return `<script src="${scriptName}"></script>`
                })
                htmlPluginData.html = content
            })

            callback(null, htmlPluginData)
        })
    })
}

module.exports = HtmlResourceWebpackPlugin