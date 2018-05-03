/**
 * @filename
 * @authors remy
 * @creatTime 2017-09-19 15:50:01
 * @description 工具库入口
 * @version 0.0.1
 */

import typeJudge from './typeJudge'
import timeConversion from './timeConversion'
import docClientWH from './docClientWH'
import localStorage from './localstorage'
import traversal from './traversal'
import urlUtil from './urlUtil'
import other from './other'

export default Object.assign({}, typeJudge, timeConversion,
 docClientWH, localStorage, traversal, urlUtil, other)

export {
  typeJudge,
  timeConversion,
  docClientWH,
  localStorage,
  traversal,
  urlUtil,
  other
}
