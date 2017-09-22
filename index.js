const path = require('path')
const cheerio = require('cheerio')
const fs = require('fs')
const vm = require('vm')
const loaderUtils = require('loader-utils')
const childCompiler = require('./lib/compiler')

function HtmlResourceWebpackPlugin() {
    "use strict";
    this.resourceList = {}
    this.template = ''
}

function hasProtocal(route) {
    return route.indexOf('http://') === 0 || route.indexOf('https://') === 0 || route.indexOf('//') === 0;
}

HtmlResourceWebpackPlugin.prototype.apply = function (compiler) {
    const self = this

    const linkRegex = new RegExp("[^-](<link[^>]*href=([\'\"]*)(.*?)([\'\"]*).*?\>)", "ig"),
        scriptRegex = new RegExp("[^-](<script[^>]*src=([\'\"]*)(.*?)([\'\"]*).*?\>(<\/script>)?)", "ig");

    compiler.plugin('compilation', function (compilation) {
        compilation.plugin('html-webpack-plugin-before-html-processing', function (htmlPluginData, callback) {
            const stylePublicPath = htmlPluginData.plugin.options.resourceName.css,
                scriptPublicPath = htmlPluginData.plugin.options.resourceName.js
            if(stylePublicPath && stylePublicPath[0]==='/') {
                throw new Error(`Invalid HtmlWebpackPlugin configuration object.\n - relative resourceName path expected, ${stylePublicPath} is absolute`)
            }

            if(scriptPublicPath && scriptPublicPath[0]==='/') {
                throw new Error(`Invalid HtmlWebpackPlugin configuration object.\n - relative resourceName path expected, ${scriptPublicPath} is absolute`)
            }

            let htmlResPluginData = Object.assign({}, htmlPluginData, {
                rootContext: compiler.options.context,
                context: path.dirname(htmlPluginData.plugin.options.template.split('!')[1]),
                template: htmlPluginData.html,
                compilation: compilation,
                publicPath: compiler.options.output.publicPath || ''
            })

            self.template = htmlPluginData.html

            const linkMatchResult = htmlPluginData.html.match(linkRegex) || []
            const scriptMatchResult = htmlPluginData.html.match(scriptRegex) || []

            let promisedStyleResult = self.promisedCompileStyle(linkMatchResult, htmlResPluginData)
            let promisedScriptResult = self.promisedCompileScript(scriptMatchResult, htmlResPluginData)

            let allResult = [].concat(promisedStyleResult, promisedScriptResult)

            Promise.all(allResult).then(()=>{
                "use strict";
                htmlPluginData.html = htmlResPluginData.template
                callback(null, htmlPluginData)
            }).catch(err=>{
                "use strict";
                compilation.errors.push(err)
                callback(null, htmlPluginData)
            })
        })
    })
}

HtmlResourceWebpackPlugin.prototype.promisedCompileStyle = function (linkMatchResult, htmlResPluginData) {
    const self = this

    const htmlContext = htmlResPluginData.context,
        context = htmlResPluginData.rootContext,
        publicPath = htmlResPluginData.publicPath,
        compilation = htmlResPluginData.compilation;

    function dealImport(linkFrom, matchedLink) {

        return new Promise((res, rej)=>{
            linkFrom = linkFrom && linkFrom.split('?')[0] || ''
            if(!self.resourceList[linkFrom]) {
                res(self.getInlineHtml(linkFrom, htmlContext, htmlResPluginData.plugin.options.filename, compilation))
            } else {
                res(self.resourceList[linkFrom])
            }
        }).then(result=>{
            htmlResPluginData.template = htmlResPluginData.template.replace(matchedLink, function () {
                return result
            })
            return true
        }).catch(e=>{
            compilation.errors.push(e)
            return true
        })
    }

    function dealNormalStyle(linkFrom, matchedLink, rawHref) {
        return new Promise((res, rej)=>{
            "use strict";
            if(!self.resourceList[linkFrom]) {
                let data
                try{
                    data = fs.readFileSync(linkFrom)
                } catch (e){
                    compilation.errors.push(e)
                    res(rawHref)
                    return
                }
                let outPathAndName = htmlResPluginData.plugin.options.resourceName.css || '[name].[ext]'

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
                self.resourceList[linkFrom] = linkName
                res(linkName)
            } else {
                res(self.resourceList[linkFrom])
            }
        }).then(result=>{
            htmlResPluginData.template = htmlResPluginData.template.replace(matchedLink, function () {
                return `<link rel="stylesheet" href="${publicPath + result}">`
            })
            return true
        }).catch(e=>{
            compilation.errors.push(e)
            return true
        })
    }

    return linkMatchResult.map(link=>{
        "use strict";
        const $link = cheerio.load(link),
            attr = $link('link').attr()
        let attrHref = attr.href, rawHref = attrHref

        if(hasProtocal(attrHref)) return true
        if(attr.__raw || attr.__raw==='') return true

        if(attrHref[0]==='/') {
            attrHref = context + attrHref
        } else {
            attrHref = path.resolve(htmlContext, attrHref)
        }

        if(attr.rel === 'import'){
            return dealImport(attrHref, link, rawHref)
        } else if (attr.rel ==='stylesheet'){
            return dealNormalStyle(attrHref, link, rawHref)
        } else {
            return true
        }
    })
}

HtmlResourceWebpackPlugin.prototype.promisedCompileScript = function (scriptMatchResult, htmlResPluginData) {
    const self = this;

    const htmlContext = htmlResPluginData.context,
        context = htmlResPluginData.rootContext,
        publicPath = htmlResPluginData.publicPath,
        compilation = htmlResPluginData.compilation;

    function dealNormalScript(scriptFrom, matchedScript, rawSrc) {
        return new Promise((res, rej)=>{
            if(!self.resourceList[scriptFrom]) {
                let data
                try {
                    data = fs.readFileSync(scriptFrom)
                } catch (e) {
                    compilation.errors.push(e)
                    res(rawSrc)
                    return
                }
                let outPathAndName = htmlResPluginData.plugin.options.resourceName.js || '[name].[ext]'

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
                self.resourceList[scriptFrom] = scriptName
                res(scriptName)
            } else {
                res(self.resourceList[scriptFrom])
            }
        }).then(result=>{
            htmlResPluginData.template = htmlResPluginData.template.replace(matchedScript, function () {
                return `<script src="${publicPath + result}"></script>`
            })
            return true
        }).catch(e=>{
            compilation.errors.push(e)
            return true
        })
    }

    return scriptMatchResult.map(script=>{
        const $script = cheerio.load(script),
            attr = $script('script').attr()
        let attrSrc = attr.src, rawSrc = attrSrc

        if(hasProtocal(attrSrc)) return true
        if(attr.__raw || attr.__raw==='') return true

        if(attrSrc[0]==='/') {
            attrSrc = context + attrSrc
        } else {
            attrSrc = path.resolve(htmlContext, attrSrc)
        }

        return dealNormalScript(attrSrc, script, rawSrc)
    })
}

HtmlResourceWebpackPlugin.prototype.getInlineHtml = function (template, context, outputFilename, compilation) {
    const self = this
    return childCompiler.compileTemplate(template, context, outputFilename, compilation)
        .catch(err=>{
            compilation.errors.push(err)
            return {
                content: 'ERROR',
                outputName: self.options.filename
            }
        })
        .then(compilationResult=>{
            return self.evaluateCompilationResult(compilation, compilationResult.content)
        })
}

HtmlResourceWebpackPlugin.prototype.evaluateCompilationResult = function (compilation, source) {
    if (!source) {
        return Promise.reject('The child compilation didn\'t provide a result');
    }

    // The LibraryTemplatePlugin stores the template result in a local variable.
    // To extract the result during the evaluation this part has to be removed.
    source = source.replace('var HTML_WEBPACK_PLUGIN_RESULT =', '');
    const template = this.template.replace(/^.+!/, '').replace(/\?.+$/, '');
    const vmContext = vm.createContext(Object.assign({HTML_WEBPACK_PLUGIN: true, require: require}, global));
    const vmScript = new vm.Script(source, {filename: template});
    // Evaluate code and cast to string
    let newSource;
    try {
        newSource = vmScript.runInContext(vmContext);
    } catch (e) {
        return Promise.reject(e);
    }
    if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
        newSource = newSource.default;
    }
    return typeof newSource === 'string' || typeof newSource === 'function'
        ? Promise.resolve(newSource)
        : Promise.reject('The loader "' + this.options.template + '" didn\'t return html.');
};

module.exports = HtmlResourceWebpackPlugin