/**
 * @filename elementExtend.js
 * @authors remy
 * @creatTime 2017-11-06 13:57:29
 * @description dom元素扩展
 * @version 0.1.0
 */

/**
 * 在Element的原型链上增加一系列自定义方法,对element进行系列操作,以更少的编码实现对dom的复杂操作
 * 注：目前仅支持"<>"+"</>"结构
 */
// 解析参数，返回json
function parseArg(arg) {
  var obj = {};
  if (typeof arg === 'object') {
    obj = arg;
  } else if (typeof arg === 'string') {
    if (arg[0] == '.') {
      obj.className = arg.substr(1);
    } else if (arg[0] == '#') {
      obj.id = arg.substr(1);
    } else {
      obj.tagName = arg;
    }
  } else {
    obj = null;
  }
  return obj;
}
// 是否是符合的dom
function isAccord(ele, obj) {
  if (ele.nodeType == 1 || ele.nodeType == 5 ||
    ele.nodeType == 6 || ele.nodeType == 9 || ele.nodeType == 11) {
    // 有效地dom元素
    if ((obj.className && ele.className.indexOf(obj.className) > -1) ||
      (obj.id && ele.id === obj.id) ||
      (obj.tagName && ele.tagName.toLowerCase() === obj.tagName) ||
      (obj.attribute && ele.hasAttribute(obj.attribute))) {
      return true;
    }
  }
  return false;
}
/**
 * 选择与当前对象同级的所有dom
 */
Element.prototype.eSiblings = function() {
  var arg = parseArg(arguments[0]),
    arr = [],
    index = 0,
    childs = this.parentNode.childNodes;
  for (var i = 0, len = childs.length; i < len; i++) {
    var ele = childs[i];
    if (ele != this) {
      if (arg === null || (arg && isAccord(ele, arg))) {
        arr[index++] = ele;
      }
    }
  }
  return arr;
}
/**
 * 选择当前对象之前并且同级的所有dom
 */
Element.prototype.ePrevAll = function() {
  var arg = parseArg(arguments[0]),
    arr = [],
    index = 0,
    prev = this.previousSibling;
  while (prev) {
    if (arg === null || (arg && isAccord(prev, arg))) {
      arr[index++] = prev;
    }
    prev = prev.previousSibling;
  }
  return arr;
}
/**
 * 选择当前对象之后并且同级的所有dom
 */
Element.prototype.eNextAll = function() {
  var arg = parseArg(arguments[0]),
    arr = [],
    index = 0,
    next = this.nextSibling;
  while (next) {
    if (arg === null || (arg && isAccord(next, arg))) {
      arr[index++] = next;
    }
    next = next.nextSibling;
  }
  return arr;
}
/**
 * 选择当前元素的所有子元素,除文本节点node以外,可选参数index指定返回第几个child或返回指定className/id的child
 */
Element.prototype.eChildren = function() {
  var arg = parseArg(arguments[0]),
    arr = [],
    index = 0,
    childs = this.childNodes;
  for (var i = 0, len = childs.length; i < len; i++) {
    var ele = childs[i];
    if (arg === null || (arg && isAccord(ele, arg))) {
      arr[index++] = ele;
    }
  }
  return arr;
}
/**
 * 选择当前元素的所有后代posterity,可选参数json{tagName:tagName}/{className:className}/{attribute:attribute}/{id:id}返回指定标签的childs数组
 */
Element.prototype.eFind = function() {
  var arg = parseArg(arguments[0]),
    arr = [],
    index = 0,
    childs = this.childNodes;
  childs.length > 0 ? eleUtil.traversalPosterity(childs, arr, arg) : "";
  return arr;
}
/**
 * 清空元素的所有子节点
 */
Element.prototype.eEmpty = function() {
  for (var i = 0, len = this.childNodes.length; i < len; i++) {
    this.removeChild(this.childNodes[0]);
  }
}
/**
 * 选择当前元素的所有祖先parents,可选参数返回指定dom的childs数组
 */
Element.prototype.eParents = function() {
  var arg = parseArg(arguments[0]),
    arr = [],
    index = 0,
    parent = this.parentNode;
  parent ? eleUtil.traversalParents(parent, arr, index, arg) : "";
  return arr;
}
/**
 * 在element之前插入dom对象(入参object 或 入参string代码生成)
 */
Element.prototype.eBefore = function() {
  if (typeof arguments[0] === "object") {
    this.parentNode.insertBefore(arguments[0], this);
  } else {
    //解析入参string,生成dom
    var childs = eleUtil.parseStringToElement(arguments[0]);
    for (var i = 0; i < childs.length; i++) {
      this.parentNode.insertBefore(childs[i], this);
    }
  }
}
/**
 * 在element之后插入dom对象(入参object 或 入参string代码生成)
 */
Element.prototype.eAfter = function() {
  if (typeof arguments[0] === "object") {
    this.nextSibling ? this.parentNode.insertBefore(arguments[0], this.nextSibling) : this.parentNode.appendChild(arguments[0]);
  } else {
    //解析入参string,生成dom
    var nextNode = this.nextSibling ? this.nextSibling : "";
    var childs = eleUtil.parseStringToElement(arguments[0]);
    for (var i = 0; i < childs.length; i++) {
      nextNode ? this.parentNode.insertBefore(childs[i], nextNode) : this.parentNode.appendChild(childs[i]);
    }
  }
}
/**
 * 在element最后一个子节点之后追加dom对象(入参object 或 入参string代码生成)
 */
Element.prototype.eAppend = function() {
  if (typeof arguments[0] === "object") {
    this.appendChild(arguments[0]);
  } else {
    //解析入参string,生成dom
    var childs = eleUtil.parseStringToElement(arguments[0]);
    for (var i = 0; i < childs.length; i++) {
      this.appendChild(childs[i]);
    }
  }
}
var eleUtil = {
  /**
   * 遍历traversal传入参数eles数组的所有父级,将tagName标签存入数组arr中
   */
  traversalParents: function(ele, arr, index, json) {
    if (isAccord(ele, json)) {
      arr[index++] = ele;
    }
    var parent = ele.parentNode;
    parent && parent.tagName.toLowerCase() != 'body' ? eleUtil.traversalParents(parent, arr, index, json) : "";
    return arr;
  },
  /**
   * 遍历traversal传入参数eles数组的所有后代posterity
   * 可选参数json{tagName:tagName}/{className:className}/{attribute:attribute}/{id:id}将指定标签存入数组arr中,并执行callback
   */
  traversalPosterity: function(eles, arr, json, callback) {
    var isFunction = typeof callback === 'function';
    for (var i = 0, len = eles.length; i < len; i++) {
      var temp = eles[i];
      if (!json || isAccord(temp, json)) {
        isFunction && callback(temp);
        arr.push(temp);
      }
      var childs = temp.childNodes;
      childs.length > 0 ? eleUtil.traversalPosterity(childs, arr, json, callback) : "";
    }
  },
  /**
   * 解析string,创建对应的dom
   * 思路：string(str) -> 待转换array(wTransform) -> 树结构array -> dom树
   * 如："<span class='test' id='test' data-data='测试beforef方法解析string'>测试before<i></i></span>"
   * ->["","span class='test' id='test' data-data='测试beforef方法解析string'>测试before","i>","/i>","/span>"]
   * ->[{tagName:"span",txt:"测试before",data:[{"class":"test"},{"id","test"},{"data-data","测试beforef方法解析string"}],status:"open"},{tagName:"i",txt:"",data:"",status:"open"},{tagName:"i",closeLayer:1},{tagName:"span",closeLayer:0}]
   * ->[{tagName:"span",txt:"测试before",data:[{"class":"test"},{"id","test"},{"data-data","测试beforef方法解析string"}],children:[{tagName:"i",txt:"",data:""}]]
   * 注：目前仅支持"<>"+"</>"结构
   */
  parseStringToElement: function(str) {
    var wTransform = []; //存放string转换后的待转换数组
    var wIndex = 0; //数组wTransform的索引
    var preLayer = 0;
    //var rge = new RegExp(/\<[^\>]*\>[^\<]*/g);
    //var data = rge.exec(str);
    //解析，封装
    var data = str.split("<");
    for (var i = 0, len = data.length; i < len; i++) {
      var dataTemp = data[i];
      if (dataTemp) {
        var json = {};
        if (dataTemp.substr(0, 1) != "/") {
          //标签开始
          json.status = "open";
          json.layer = preLayer++;
          var attrArr = [];
          var aIndex = 0;
          var arr = dataTemp.split(" ");
          for (var j = 0; j < arr.length; j++) {
            var arrTemp = arr[j];
            if (j == 0) {
              if (arrTemp.indexOf(">") > -1) {
                var txtTemp = arrTemp.split(">");
                json.tagName = txtTemp[0];
                json.txt = txtTemp[1];
              } else {
                json.tagName = arrTemp;
              }
            }
            if (j != 0 && arrTemp.indexOf("=") > -1) {
              var attrTemp = arrTemp.split("=");
              if (attrTemp[1].indexOf(">") > -1) {
                var txtTemp = attrTemp[1].split(">");
                attrArr[aIndex++] = { key: attrTemp[0], value: txtTemp[0].replace(/[\'\"]/g, "") };
                json.txt = txtTemp[1];
              } else {
                attrArr[aIndex++] = { key: attrTemp[0], value: attrTemp[1].replace(/[\'\"]/g, "") };
              }
            }
          }
          json.data = attrArr;
        } else {
          //标签结束
          json.tagName = dataTemp.substring(1).replace(/\>/g, "");
          for (var k = wTransform.length - 1; k >= 0; k--) {
            if (wTransform[k].tagName == json.tagName) {
              if (wTransform[k].closeLayer) {
                k = wTransform[k].closeLayer;
                continue;
              }
              preLayer = wTransform[k].layer;
              json.closeLayer = preLayer;
              break;
            }
          }
        }
        wTransform[wIndex++] = json;
      }
    }
    //将wTransform转换成树结构数组tree
    var tree = [];
    var tIndex = 0;
    for (var i = 0, len = wTransform.length; i < len; i++) {
      var temp = wTransform[i];
      if (temp.layer == 0) {
        tree[tIndex++] = temp;
      } else {
        if (typeof temp.closeLayer === "number") {
          eleUtil.createTree(tree[tIndex - 1], temp.closeLayer);
        } else {
          eleUtil.createTree(tree[tIndex - 1], temp);
        }
      }
    }
    //将tree转换生成dom
    var domTree = eleUtil.initTreesToDom(tree);
    return domTree;
  },
  /**
   * @param tree 树结构的数组
   * 将多棵树trees转换成dom
   */
  initTreesToDom: function(trees) {
    var doms = [];
    var parent = arguments[1] ? arguments[1] : "";
    for (var i = 0; i < trees.length; i++) {
      var temp = trees[i];
      doms[i] = eleUtil.JSONtoElement(temp);
      temp.children ? eleUtil.initTreeNodeToDom(temp.children, doms[i]) : "";
    }
    return doms;
  },
  /**
   * @param tree 数结构的数组
   * 将单棵树tree的子节点nodeArr数组转换成dom
   */
  initTreeNodeToDom: function(nodeArr) {
    for (var j = 0; j < nodeArr.length; j++) {
      var temp = nodeArr[j];
      var dom = eleUtil.JSONtoElement(temp);
      arguments[1] ? arguments[1].appendChild(dom) : "";
      temp.children ? eleUtil.initTreeNodeToDom(temp.children, dom) : "";
    }
  },
  /**
   * @param parent 数结构数组
   * 将child添加到parent最里层的节点下面
   */
  createTree: function(parent) {
    if (arguments[1].tagName) {
      var child = arguments[1];
      if (parent.layer + 1 == child.layer && parent.status === "open") {
        parent.children ? "" : parent.children = [];
        parent.children[parent.children.length] = child;
      } else {
        eleUtil.createTree(parent.children[parent.children.length - 1], child);
      }
    } else {
      var layer = arguments[1];
      if (parent.layer == layer) {
        parent.status = "close";
      } else {
        eleUtil.createTree(parent.children[parent.children.length - 1], layer);
      }
    }
  },
  /**
   * 解析单个dom标签的string,并返回json对象
   */
  parseTagStr: function(str) {
    var ele = {}; //存放单个标签元素的各名称及属性的JSON
    var attrs = []; //存放标签元素的属性名和值
    var aIndex = 0; //数组attrs的索引
    var items = str.replace(/[\<\>\'\"]/g, "").split(" ");
    for (var i = 0, len = items.length; i < len; i++) {
      var temp = items[i];
      if (i == 0) {
        ele.tagName = temp;
        continue;
      }
      var tempAttr = temp.split("=");
      if (temp.indexOf("=") > -1) {
        attrs[aIndex++] = { key: tempAttr[0], value: tempAttr[1] };
      }
    }
    ele.data = attrs;
    return ele;
  },
  /**
   * 创建单个dom,将JSON对象生成对应的dom
   */
  JSONtoElement: function(json) {
    var dom = document.createElement(json.tagName);
    for (var i = 0, len = json.data.length; i < len; i++) {
      var temp = json.data[i];
      dom.setAttribute(temp.key, temp.value);
    }
    json.txt ? dom.innerHTML = json.txt : "";
    return dom;
  },
  /**
   * 遍历数组eles，对每个element执行回调callback
   */
  traversal: function(eles, callback) {
    for (var i = 0, len = eles.length; i < len; i++) {
      var ele = eles[i];
      callback(ele);
    }
  },
  /**
   * 工具类，遍历数组args，验证是否包含传入参数str，返回true/false
   */
  verifyISInclude: function(args, str) {
    for (var i = 0, len = args.length; i < len; i++) {
      if (args[i] === str) {
        return true;
      }
      return false;
    }
  },
  getElesById: function() {
    var arr = [];
    var index = 0;
    for (var i = 0; i < arguments.length; i++) {
      var ele = document.getElementById(arguments[i]);
      arr[index++] = ele;
    }
    return arr;
  }
}

export default eleUtil;
