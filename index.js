const path = require('path')
const cheerio = require('cheerio')
const fs = require('fs')
const loaderUtils = require('loader-utils')

function HtmlResourceWebpackPlugin() {
    "use strict";
    this.resourceList = {}
}

HtmlResourceWebpackPlugin.prototype.apply = function (compiler) {
    const self = this
    function hasProtocal(route) {
        return route.indexOf('http://') === 0 || route.indexOf('https://') === 0 || route.indexOf('//') === 0;
    }

    const linkRegex = new RegExp("(<link[^>]*href=([\'\"]*)(.*?)([\'\"]*).*?\>)", "ig"),
        scriptRegex = new RegExp("(<script[^>]*src=([\'\"]*)(.*?)([\'\"]*).*?\>(<\/script>)?)", "ig");

    compiler.plugin('compilation', function (compilation) {
        compilation.plugin('html-webpack-plugin-before-html-processing', function (htmlPluginData, callback) {
            const context = compiler.options.context
            const htmlContext = path.dirname(htmlPluginData.plugin.options.template.split('!')[1])
            let content = htmlPluginData.html

            const linkMatchResult = content.match(linkRegex) || []
            const scriptMatchResult = content.match(scriptRegex) || []
            linkMatchResult.forEach(link=>{
                let linkDistName = '',
                    linkFrom = ''
                const $link = cheerio.load(link),
                    attr = $link('link').attr()
                if(hasProtocal(attr.href)) return
                if(attr.__raw || attr.__raw==='') return
                if(attr.href[0]==='/') {
                    linkFrom = context + attr.href
                } else {
                    linkFrom = path.resolve(htmlContext, attr.href)
                }
                if(true || !self[linkFrom]) {
                    const data = fs.readFileSync(linkFrom)
                    let outPathAndName = htmlPluginData.plugin.options.resourceName.css || '[name].[ext]'

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
                    linkDistName = linkName
                    self[linkFrom] = linkName
                } else {
                    linkDistName = self[linkFrom]
                }

                content = content.replace(link, function () {
                    return `<link rel="stylesheet" href="${linkDistName}">`
                })
                htmlPluginData.html = content
            })

            scriptMatchResult.forEach(script=>{
                let scriptDistName = '',
                    scriptFrom = ''
                const $script = cheerio.load(script),
                    attr = $script('script').attr()
                if(hasProtocal(attr.src)) return
                if(attr.__raw || attr.__raw==='') return
                if(attr.href[0]==='/') {
                    scriptFrom = context + attr.href
                } else {
                    scriptFrom = path.resolve(htmlContext, attr.href)
                }
                if(true || !self[scriptFrom]){
                    const data = fs.readFileSync(scriptFrom)
                    let outPathAndName = htmlPluginData.plugin.options.resourceName.js || '[name].[ext]'

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
                    scriptDistName = scriptName
                    self[scriptFrom] = scriptName
                } else {
                    scriptDistName = self[scriptFrom]
                }

                content = content.replace(script, function () {
                    return `<script src="${scriptDistName}"></script>`
                })
                htmlPluginData.html = content
            })
            callback(null, htmlPluginData)
        })
    })
}

module.exports = HtmlResourceWebpackPlugin