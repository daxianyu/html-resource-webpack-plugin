/**
 * Created by tangjianfeng on 2017/3/11.
 */

require('./in.css');

require('./WechatIMG422.jpeg')
require('./WechatIMG46371.jpeg')
// require('./load!./testLoad')
// const v = require('./testvue.vue')
import 'co'
let xx = 34375;

function tep() {
    this._p = {}
}
tep.prototype.a = function () {
    console.log(3)
}

function tap() {
    tep.call(this)
}
tap.prototype = Object.create(tep.prototype);

let t = new tap();

console.log(TEST)
