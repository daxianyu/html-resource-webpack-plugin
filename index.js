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

const NODE_ENV = process.env.NODE_ENV || ''

function isSkipped(skipAttr){
    "use strict";
    let skip
    if(skipAttr){
        if(skipAttr === NODE_ENV || skipAttr === 'true'){
            skip = true
        } else if(skipAttr[0]==='!' && skipAttr !== ('!'+NODE_ENV)){
            skip = true
        } else {
            skip = false
        }
    } else if(skipAttr===''){
        skip = true
    } else {
        skip = false
    }
    return skip
}

const ResourceType = {
    link: 'href',
    script: 'src'
}

function stringifyPath(attr, resourceType){
    let attrStr = '', skipped = ['skip', '__raw', 'rawSrc']
    for (let item in attr){
        if(skipped.indexOf(item)===-1){
            if(attr[item]){
                attrStr += `${item}="${attr[item]}" `
            } else {
                attrStr += item
            }
        }
    }
    if(resourceType === 'link') {
        return `<${resourceType} ${attrStr} />`
    }
    return `<${resourceType} ${attrStr}></${resourceType}>`
}

function compileResource(htmlResPluginData, matchedResource, attr, resourceType) {
    const compilation = htmlResPluginData.compilation,
        publicPath = htmlResPluginData.publicPath

    const rType = ResourceType[resourceType]
    return new Promise((res, rej)=>{
        if(attr.skip){
            res()
            return
        }
        if(!this.resourceList[attr[rType]]) {         // 如果没有缓存，则去获取
            let data
            try {
                data = fs.readFileSync(attr[rType])
            } catch (e) {
                compilation.errors.push(e)
                res(attr.rawSrc)
                return
            }
            let outPathAndName = htmlResPluginData.plugin.options.resourceName.js || '[name].[ext]'

            const scriptName = loaderUtils.interpolateName(
                {resourcePath: attr[rType]},
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
            this.resourceList[attr[rType]] = scriptName
            res(scriptName)
        } else {
            res(this.resourceList[attr[rType]])
        }
    }).then(result=>{
        htmlResPluginData.template = htmlResPluginData.template.replace(matchedResource, function () {
            if(attr.skip) return ''
            if(attr.__raw || attr.__raw==='') {
                attr[rType] = attr.rawSrc
                return stringifyPath(attr, resourceType)
            }
            attr[rType] = publicPath + result
            return stringifyPath(attr, resourceType)
        })
        return true
    }).catch(e=>{
        compilation.errors.push(e)
        return true
    })
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
        compilation = htmlResPluginData.compilation;

    function dealImport(attr, matchedLink) {

        return new Promise((res, rej)=>{
            attr.href = attr.href && attr.href.split('?')[0] || ''
            if(!self.resourceList[attr.href]) {
                res(self.getInlineHtml(attr.href, htmlContext, htmlResPluginData.plugin.options.filename, compilation))
            } else {
                res(self.resourceList[attr.href])
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

    return linkMatchResult.map(matchedLink=>{
        "use strict";
        const $link = cheerio.load(matchedLink),
            attr = $link('link').attr()
        attr.skip = isSkipped(attr.skip)
        attr.rawSrc = attr.href

        if(hasProtocal(attr.href)) return true
        if(attr.href[0]==='/') {
            attr.href = context + attr.href
        } else {
            attr.href = path.resolve(htmlContext, attr.href)
        }

        if(attr.rel === 'import'){
            return dealImport(attr, matchedLink)
        } else if (attr.rel ==='stylesheet'){
            return compileResource.call(this, htmlResPluginData, matchedLink, attr, 'link')
        } else {
            return compileResource.call(this, htmlResPluginData, matchedLink, attr, 'link')
        }
    })
}


HtmlResourceWebpackPlugin.prototype.promisedCompileScript = function (scriptMatchResult, htmlResPluginData) {

    const htmlContext = htmlResPluginData.context,
        context = htmlResPluginData.rootContext

    return scriptMatchResult.map(script=>{
        const $script = cheerio.load(script),
            attr = $script('script').attr()
        attr.skip = isSkipped(attr.skip)
        attr.rawSrc = attr.src

        if(hasProtocal(attr.src)) return true
        if(attr.src[0]==='/') {
            attr.src = context + attr.src
        } else {
            attr.src = path.resolve(htmlContext, attr.src)
        }
        return compileResource.call(this, htmlResPluginData, script, attr, 'script')
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