/**
 * @filename traversal.js
 * @authors remy
 * @creatTime 2017-11-29 09:14:05
 * @description 遍历array、object、tree等
 * @version 0.0.1
 */

import util from './typeJudge/index.js'

export default {
  /**
   * data { Array/Object } 单层遍历，多层请用traversalTree
   * nodeCallback { Function } 每项的回调
   * endCallback { Function } 遍历结束的回调
   **/
  forEach(data, itemCallback, endCallback) {
    var isFunction = util.isFunction(itemCallback);
    if (util.isArray(data)) {
      for (var i = 0, len = data.length; i < len; i++) {
        isFunction && itemCallback(data[i], i);
      }
    } else if (util.isObject(data)) {
      for (key in data) {
        isFunction && itemCallback(key, data[key]);
      }
    }
    util.isFunction(endCallback) && endCallback(data);
  },
  /**
   * treeData { Object }----{ childNodes: { childNodes: { } } }
   * nodeCallback { Function } 每个节点的回调
   * layer { Number } 树节点的层级, 根节点层级为1
   **/
  traversalTree(treeData, nodeCallback, layer) {
    if (!util.isNumber(layer)) layer = 1;
    if (layer === 1 && !util.isArray(treeData)) treeData = [treeData];
    this.forEach(treeData, (node, i) => {
      util.isFunction(nodeCallback) && nodeCallback(node, layer);
      util.isArray(node.childNodes) && this.traversalTree(node.childNodes, nodeCallback, ++layer);
    });
  }
}
